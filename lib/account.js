import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fetchUser, sendFollowMessage, sendPost } from './users.js';
import { INDEX, readJSONDictionary, writeJSONDictionary } from './storage.js';
import { getActivity, getNoteGuid } from './notes.js';

import  debug  from 'debug';
import MarkdownIt from 'markdown-it';
const logger = debug('account');
const md = new MarkdownIt({
  html: true,
  linkify: false,
});

const followersFile = path.resolve('./','data/followers.json');
const followingFile = path.resolve('./','data/following.json');
const notificationsFile = path.resolve('./','data/notifications.json');
const likesFile = path.resolve('./','data/likes.json');

const pathToPosts = path.resolve('./',`data/posts/`);

const accountFile = path.resolve('./','data/account.json');

const config = JSON.parse(fs.readFileSync('./config.json'));
const { USER, PASS, DOMAIN, PRIVKEY_PATH, CERT_PATH, PORT } = config;

export const isMyPost = (activity) => {
  return (activity.id.startsWith(`https://${DOMAIN}/m/`));
}

export const isReplyToMyPost = (activity) => {
  // has inReplyTo AND it matches the pattern of our posts.
  // TODO: Do we need to ACTUALLY validate that this post exists?
  return (activity.inReplyTo && activity.inReplyTo.startsWith(`https://${DOMAIN}/m/`));
}

export const isReplyToFollowing = async (activity, following) => {
  // fetch the parent, check ITs owner to see if we follow them.
  try {
    const parentPost = await getActivity(activity.inReplyTo);
    if (following.indexOf(parentPost.attributedTo) >= 0) {
      return true;
    } 
  } catch(err) {
    console.error('Could not parent post', activity.id, err);
  }
  return false;
}

function createActor(name, domain, pubkey) {
    return {
      '@context': [
        'https://www.w3.org/ns/activitystreams',
        'https://w3id.org/security/v1'
      ],
  
      'id': `https://${domain}/u/${name}`,
      'type': 'Person',
      'preferredUsername': `${name}`,
      'inbox': `https://${domain}/api/inbox`,
      'inbox': `https://${domain}/api/outbox`,
      'followers': `https://${domain}/u/${name}/followers`,
  
      'publicKey': {
        'id': `https://${domain}/u/${name}#main-key`,
        'owner': `https://${domain}/u/${name}`,
        'publicKeyPem': pubkey
      }
    };
}

function createWebfinger(name, domain) {
    return {
        'subject': `acct:${name}@${domain}`,

        'links': [
        {
            'rel': 'self',
            'type': 'application/activity+json',
            'href': `https://${domain}/u/${name}`
        }
        ]
    };
}

export const getOutboxPosts = async (offset) => {

  // sort all known posts by date quickly
  const sortedSlice = INDEX.filter((p)=>p.type==='note').sort((a, b) => {
      if (a.published > b.published) {
          return -1;
      } else if (a.published < b.published) {
          return 1;
      } else {
          return 0;
      }
  });
  
  const total = sortedSlice.length;
  
  const posts = await Promise.all(sortedSlice.slice(offset,offset+10).map(async (p) => {
      return await getNote(getNoteGuid(p.id));
  }));

  return {total, posts };
}




export const addNotification = (notification) => {
  const notifications = getNotifications();
  notifications.push({
    time: new Date().getTime(),
    notification: notification,
  });
  writeNotifications(notifications);
}

const writeNotifications = (notifications) => {
  return writeJSONDictionary(notificationsFile, notifications);
}

export const getNotifications = () => {
  return readJSONDictionary(notificationsFile);
}

const writeFollowers = (followers) => {
  return writeJSONDictionary(followersFile, followers);
}

export const getFollowers = () => {
  return readJSONDictionary(followersFile);
}

const writeFollowing = (followers) => {
  return writeJSONDictionary(followingFile, followers);
}

export const getFollowing = () => {
  return readJSONDictionary(followingFile);
}

export const writeLikes = (likes) => {
  return writeJSONDictionary(likesFile, likes);
}

export const getLikes = () => {
  return readJSONDictionary(likesFile);
}



export const getNote = async (guid) => {
  const postFile = path.resolve('./', pathToPosts, guid + '.json');
  if (fs.existsSync(postFile)) {
    const raw = fs.readFileSync(postFile,'utf8');
    try {
      const json = JSON.parse(raw);
      return json;
    } catch(err) {
      console.error(err);
      return undefined;
    }
  }
  return undefined;
}

const sendToFollowers = async(object) => {

  const followers = await getFollowers();
  followers.forEach(follower => {
    sendPost(follower, object);
  });

}


export const createNote = async (body, cw) => {
  const myaccount = getAccount();

  let d = new Date();
  const guid = crypto.randomBytes(16).toString('hex');

  const content = md.render(body);

  const object = {   
    "id": `https://${ DOMAIN }/m/${guid}`,
    "type": "Note",
    "summary": cw || null,
    "inReplyTo": null,
    'published': d.toISOString(),
    'attributedTo': `https://${DOMAIN}/u/${USER}`,
    'content': content,
    "url": `https://${ DOMAIN }/notes/${guid}`,
    "to": [
        "https://www.w3.org/ns/activitystreams#Public"
    ],
    "cc": [
        `https://${DOMAIN}/u/${USER}/followers`,
    ],
    "sensitive": cw !== null ? true : false,
    "atomUri": `https://${DOMAIN}/u/${USER}/${guid}`,
    "inReplyToAtomUri": null,
    "content": content,
    "attachment": [],
    "tag": [],
    "replies": {
        "id": `https://${ DOMAIN }/m/${guid}/replies`,
        "type": "Collection",
        "first": {
            "type": "CollectionPage",
            "next": `https://${ DOMAIN }/m/${guid}/replies?only_other_accounts=true&page=true`,
            "partOf": `https://${ DOMAIN }/m/${guid}/replies`,
            "items": []
        }
    }
  };

  fs.writeFileSync(path.resolve('./', pathToPosts, guid + '.json'), JSON.stringify(object, null, 2));

  // todo: send notifications to all followers
  sendToFollowers(object);

  INDEX.push({
    type: 'note', // someone else
    id: object.id,
    actor: object.attributedTo,
    published: new Date(object.published).getTime(),
    inReplyTo: object.inReplyTo,
  });

  return object;
  
}


export const follow = async(name) => {
  logger('following someone');
  const { actor } = await fetchUser(name);
  if ( actor ) {
    // sendFollowMessage(actor.id);
    const following = getFollowing();
    if (following.indexOf(actor.id) < 0) {
      following.push(actor.id);
    }
    writeFollowing(following);
  } else {
    logger('Failed to fetch user');
  }
}

export const addFollower = async (request) => {

    logger('Adding follower...');
    const { actor } = await fetchUser(request.actor);
    if ( actor ) {
      const followers = getFollowers();
      if (followers.indexOf(actor.id) < 0) {
        followers.push(actor.id);
        writeFollowers(followers);
        addNotification(request);
      }
    } else {
      logger('Failed to fetch user');
    }

}

export const removeFollower = async (follower) => {

  logger('Removing follower...');
  const { actor } = await fetchUser(follower);
  if ( actor ) {
    const followers = getFollowers();
    writeFollowers(followers.filter(f=>f!==follower));
  } else {
    logger('Failed to fetch user');
  }

}

export const getAccount = (name, domain) => {

    try {
        const accountJSONRaw = fs.readFileSync(accountFile);
        const accountJSON = JSON.parse(accountJSONRaw);
        return accountJSON;
    } catch(err) {

        // generate a crypto key
        crypto.generateKeyPair('rsa', {
            modulusLength: 4096,
            publicKeyEncoding: {
              type: 'spki',
              format: 'pem'
            },
            privateKeyEncoding: {
              type: 'pkcs8',
              format: 'pem'
            }
        }, (err, publicKey, privateKey) => {
            const actorRecord = createActor(name, domain, publicKey);
            const webfingerRecord = createWebfinger(name, domain);
            const apikey = crypto.randomBytes(16).toString('hex');

            const account = {
                actor: actorRecord,
                webfinger: webfingerRecord,
                apikey: apikey,
                publicKey: publicKey,
                privateKey: privateKey,
            }

            fs.writeFileSync(accountFile,JSON.stringify(account, null, 2));
            return account;
        });
                
    }
    
}