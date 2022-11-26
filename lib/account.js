import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fetchUser, sendFollowMessage, sendPost } from './users.js';
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

const pathToPosts = path.resolve('./',`data/posts/`);

const accountFile = path.resolve('./','data/account.json');

const config = JSON.parse(fs.readFileSync('./config.json'));
const { USER, PASS, DOMAIN, PRIVKEY_PATH, CERT_PATH, PORT } = config;


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

export const addNotification = (notification) => {
  const notifications = getNotifications();
  notifications.push({
    time: new Date().getTime(),
    notification: notification,
  });
  writeNotifications(notifications);
}

const writeNotifications = (notifications) => {
  fs.writeFileSync(notificationsFile, JSON.stringify(notifications,null,2));
}

export const getNotifications = () => {
  let jsonRaw = '[]';
  if (fs.existsSync(notificationsFile)) {
     jsonRaw = fs.readFileSync(notificationsFile);
  }
  const results = JSON.parse(jsonRaw) || [];
  return results;
}

const writeFollowers = (followers) => {
  fs.writeFileSync(followersFile, JSON.stringify(followers,null,2));
}

export const getFollowers = () => {
  let followersJSONRaw = '[]';
  if (fs.existsSync(followersFile)) {
     followersJSONRaw = fs.readFileSync(followersFile);
  }
  const followers = JSON.parse(followersJSONRaw) || [];
  return followers;
}

const writeFollowing = (following) => {
  fs.writeFileSync(followingFile, JSON.stringify(following,null,2));
}

export const getFollowing = () => {
  let followersJSONRaw = '[]';
  if (fs.existsSync(followingFile)) {
     followersJSONRaw = fs.readFileSync(followingFile);
  }
  const followers = JSON.parse(followersJSONRaw) || [];
  return followers;
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