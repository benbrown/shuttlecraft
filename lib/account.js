import fs, { existsSync } from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';

import { sortByDate } from './theAlgorithm.js';
import { ActivityPub } from './ActivityPub.js';
import { fetchUser } from './users.js';
import {
  INDEX,
  readJSONDictionary,
  writeJSONDictionary,
  followersFile,
  followingFile,
  blocksFile,
  notificationsFile,
  likesFile,
  accountFile,
  createFileName,
  getFileName,
  boostsFile,
  pathToDMs
} from './storage.js';
import { getActivity, createActivity, deleteActivity } from './notes.js';

import debug from 'debug';

import { md } from './Markdown.js';
dotenv.config();
const logger = debug('ono:account');

const { DOMAIN } = process.env;

// TODO:
// Change the mydomain
// const mydomain = "localhost:3000";

/**
 * The function `getInboxIndex` returns the inbox index by reading a JSON dictionary from a specified
 * path.
 * @returns The function `getInboxIndex` returns the `inboxIndex` object.
 */
export const getInboxIndex = () => {
  const inboxIndexPath = path.resolve(pathToDMs, `inboxes.json`);
  const inboxIndex = readJSONDictionary(inboxIndexPath, {});
  return inboxIndex;
};

/**
 * The function writes data to a JSON file that represents the index of an inbox.
 */
export const writeInboxIndex = data => {
  const inboxIndexPath = path.resolve(pathToDMs, `inboxes.json`);
  writeJSONDictionary(inboxIndexPath, data);
};

/**
 * The function `getInbox` retrieves the inbox messages for a given actor ID.
 * @returns The function `getInbox` returns the `inbox` array.
 */
export const getInbox = actorId => {
  const username = ActivityPub.getUsername(actorId);

  const inboxPath = path.resolve(pathToDMs, `${username}.json`);

  const inbox = readJSONDictionary(inboxPath, []);
  return inbox;
};

/**
 * given an activity, return true if the only addressee is this server's owner
 * @param {*} activity
 * @returns
 */
export const addressedOnlyToMe = activity => {
  // load my info
  const actor = ActivityPub.actor;

  // get all addresses
  let addresses = activity.to;
  addresses = addresses.concat(activity.cc);

  // if there is only 1 addressee, and that addressee is me, return true
  if (addresses.length === 1 && addresses[0] === actor.id) {
    return true;
  }

  return false;
};

/**
 * The function `deleteObject` checks if the incoming request is a valid object and if it is a
 * "Tombstone" type, then it verifies if the actor is allowed to delete the object and deletes it if
 * allowed.
 * @param actor - The `actor` parameter represents the user who is performing the delete action. It
 * contains information about the user, such as their ID.
 * @param incomingRequest - The `incomingRequest` parameter is an object that represents the request to
 * delete an object. It contains the following properties:
 * @returns a boolean value. It returns `false` in two cases: if the `incomingRequest.object` is not an
 * object or if its type is not 'Tombstone'. It returns `true` in all other cases.
 */
export const deleteObject = async (actor, incomingRequest) => {
  if (typeof incomingRequest.object !== 'object') {
    return false;
  }
  if (incomingRequest.object.type !== 'Tombstone') {
    return false;
  }
  try {
    const activity = await getActivity(incomingRequest.object.id);
    if (activity.attributedTo !== actor.id) {
      // only allow actor to delete their own Notes
      return false;
    }
  } catch (err) {
    // maybe you couldn't et it because it is a now-deleted DM. Let's make sure.
    // this is a DM and needs to be removed from the inbox
    const inbox = getInbox(actor.id);
    if (inbox.some(m => m.id === incomingRequest.object.id)) {
      const username = ActivityPub.getUsername(actor.id);
      const inboxPath = path.resolve(pathToDMs, `${username}.json`);
      // write an inbox without the deleted message
      writeJSONDictionary(
        inboxPath,
        inbox.filter(m => {
          return m.id !== incomingRequest.object.id;
        })
      );
    }

    // otherwise, if we don't know about this post, we don't need to delete it?
    return true;
  }
  deleteActivity(incomingRequest.object.id, incomingRequest.object);
  return true;
};

/**
 * The `acceptDM` function accepts a direct message (DM) and adds it to the inbox of a specified user,
 * updating the inbox index and marking the last read timestamp if the DM is an outbound message.
 * @param dm - The `dm` parameter represents the direct message that is being accepted. It is an object
 * that contains information about the message, such as its content, sender, and timestamp.
 * @param inboxUser - The `inboxUser` parameter represents the user whose inbox the direct message (DM)
 * will be added to.
 */
export const acceptDM = (dm, inboxUser) => {
  const inboxIndex = getInboxIndex();
  const inbox = getInbox(inboxUser);
  const username = ActivityPub.getUsername(inboxUser);

  inbox.push(dm);

  const inboxPath = path.resolve(pathToDMs, `${username}.json`);
  writeJSONDictionary(inboxPath, inbox);
  if (!inboxIndex[inboxUser]) {
    inboxIndex[inboxUser] = {
      lastRead: null
    };
  }

  const timestamp = new Date(dm.published).getTime();
  inboxIndex[inboxUser].latest = timestamp;

  // if this is me sending an outbound DM, mark last read also
  if (dm.attributedTo === ActivityPub.actor.id) {
    inboxIndex[inboxUser].lastRead = timestamp;
  }

  writeInboxIndex(inboxIndex);
};

/**
 * The function checks if the activity's ID starts with a specific domain and returns a boolean value.
 * @returns a boolean value indicating whether the given activity's ID starts with the string
 * "https://DOMAIN/m/".
 */
export const isMyPost = activity => {
  return activity.id.startsWith(`https://${DOMAIN}/m/`);
};

/**
 * The function checks if a given actorId is present in the list of following.
 * @returns a boolean value indicating whether the actor with the specified actorId is being followed
 * or not.
 */
export const isFollowing = actorId => {
  const following = getFollowing();
  return following.some(f => f.actorId === actorId);
};

/**
 * The function `isFollower` checks if a given `actorId` is included in the list of followers.
 * @returns a boolean value indicating whether the given actorId is included in the list of followers.
 */
export const isFollower = actorId => {
  const followers = getFollowers();
  return followers.includes(actorId);
};

/**
 * The function `isMention` checks if an activity contains a mention of the current user.
 * @returns The function `isMention` returns a boolean value. It returns `true` if the `activity`
 * object has a `tag` property that is an array and contains at least one element that has a `type`
 * property equal to `'Mention'` and an `href` property equal to `ActivityPub.actor.id`. Otherwise, it
 * returns `false`.
 */
export const isMention = activity => {
  return activity.tag?.some(tag => {
    return tag.type === 'Mention' && tag.href === ActivityPub.actor.id;
  });
};

/**
 * The function checks if an activity is a reply to a post with a specific pattern.
 * @returns a boolean value indicating whether the given activity is a reply to a post.
 */
export const isReplyToMyPost = activity => {
  // has inReplyTo AND it matches the pattern of our posts.
  // TODO: Do we need to ACTUALLY validate that this post exists?
  return activity.inReplyTo && activity.inReplyTo.startsWith(`https://${DOMAIN}/m/`);
};

/**
 * The function checks if a given activity is a reply to a post from an account that is being followed.
 * @returns The function isReplyToFollowing returns a boolean value. It returns true if the parent post
 * of the given activity is being followed, and false otherwise.
 */
export const isReplyToFollowing = async activity => {
  // fetch the parent, check ITs owner to see if we follow them.
  try {
    const parentPost = await getActivity(activity.inReplyTo);
    if (isFollowing(parentPost.attributedTo)) {
      return true;
    }
  } catch (err) {
    console.error('Could not parent post', activity.id, err);
  }
  return false;
};

/**
 * The above code defines two functions in JavaScript, one for creating an actor object and another for
 * creating a webfinger object.
 * @param name - The name parameter is the name of the actor or user. It is used to create the actor's
 * username and display name.
 * @param domain - The domain parameter represents the domain name of the actor's website or platform.
 * It is used to construct the URLs for the actor's profile, inbox, outbox, followers, and image/icon
 * URLs.
 * @param pubkey - The `pubkey` parameter is the public key of the actor. It is a string that
 * represents the public key in PEM format.
 * @returns The `createActor` function returns an object representing an actor in the ActivityStreams
 * format. The `createWebfinger` function returns an object representing a WebFinger response.
 */
export const createActor = (name, domain, pubkey, bio, img) => {
  if (typeof img === "undefined") {
    img = 'https://www.shutterstock.com/image-vector/user-profile-icon-vector-avatar-600nw-2247726673.jpg';
  }
  return {
    '@context': ['https://www.w3.org/ns/activitystreams', 'https://w3id.org/security/v1'],
    id: `https://${domain}/u/${name}`,
    url: `https://${domain}/`,
    type: 'Person',
    name: `${name}`,
    bio: `${bio || ''}`,
    preferredUsername: `${name}`,
    inbox: `https://${domain}/api/inbox`,
    outbox: `https://${domain}/api/outbox`,
    followers: `https://${domain}/u/${name}/followers`,
    icon: {
      type: 'Image',
      mediaType: 'image/jpg',
      // url: `https://${domain}/images/avatar.png`
      // default icon image, later can store locally
      // url: 'https://www.shutterstock.com/image-vector/user-profile-icon-vector-avatar-600nw-2247726673.jpg'
      // url: `https://${mydomain}/public/images/avatar/${img}`,
      url: `${img}`,
    },
    image: {
      type: 'Image',
      mediaType: 'image/png',
      // default header image, later can store locally
      url: `https://static.vecteezy.com/system/resources/thumbnails/011/125/580/small/torn-light-blue-paper-with-white-copyspace-for-your-message-png.png`
    },
    publicKey: {
      id: `https://${domain}/u/${name}#main-key`,
      owner: `https://${domain}/u/${name}`,
      publicKeyPem: pubkey
    }
  };
};

/**
 * The function creates a Webfinger object with a subject and a link.
 * @param name - The name parameter represents the username or identifier of the user. It is used to
 * construct the subject property of the returned object.
 * @param domain - The `domain` parameter represents the domain name of the website or service where
 * the webfinger resource is being created. It is used to construct the `subject` and `href` properties
 * in the returned object.
 * @returns The function `createWebfinger` returns an object with two properties: `subject` and
 * `links`.
 */
export const createWebfinger = (name, domain) => {
  return {
    subject: `acct:${name}@${domain}`,

    links: [
      {
        rel: 'self',
        type: 'application/activity+json',
        href: `https://${domain}/u/${name}`
      }
    ]
  };
};

/**
 * The function `getOutboxPosts` retrieves a slice of posts from an array, sorts them by date, and
 * returns the total number of posts and the retrieved posts.
 * @returns The function `getOutboxPosts` returns an object with two properties: `total` and `posts`.
 */
export const getOutboxPosts = async offset => {
  // sort all known posts by date quickly
  const sortedSlice = INDEX.filter(p => p.type === 'note').sort(sortByDate);

  const total = sortedSlice.length;

  const posts = await Promise.all(
    sortedSlice.slice(offset, offset + 10).map(async p => {
      return await getNote(p.id);
    })
  );

  return {
    total,
    posts
  };
};

/**
 * The function `addNotification` adds a new notification to an array of notifications and writes the
 * updated array to storage.
 */
export const addNotification = notification => {
  const notifications = getNotifications();
  notifications.push({
    time: new Date().getTime(),
    notification
  });
  writeNotifications(notifications);
};

/**
 * The function writes a JSON dictionary of notifications to a file.
 * @returns the result of calling the `writeJSONDictionary` function with the `notificationsFile` and
 * `notifications` as arguments.
 */
export const writeNotifications = notifications => {
  return writeJSONDictionary(notificationsFile, notifications);
};

/**
 * The function `getNotifications` returns the contents of a JSON dictionary stored in a file.
 * @returns The function `getNotifications` is returning the result of calling the `readJSONDictionary`
 * function with the `notificationsFile` parameter.
 */
export const getNotifications = () => {
  return readJSONDictionary(notificationsFile);
};

// todo: expose an interface for adding to the block list.
// const writeBlocks = (data) => {
//   return writeJSONDictionary(blocksFile, data);
// }

/**
 * The function checks if an actor is blocked based on a list of banned users or domains.
 * @returns The function `isBlocked` returns a boolean value. It returns `true` if the `actor` is found
 * in the `blocks` array or if the `actor` starts with any of the elements in the `blocks` array.
 * Otherwise, it returns `false`.
 */
export const isBlocked = actor => {
  const blocks = getBlocks();
  return blocks.some(banned => {
    if (banned === actor) {
      console.log('BLOCKED: banned user');
      return true;
    } else if (actor.startsWith(banned)) {
      console.log('BLOCKED: banned domain');
      return true;
    }
    return false;
  });
};

/**
 * The function `getBlocks` returns the contents of a JSON dictionary stored in a file, or an empty
 * array if the file does not exist.
 * @returns The function `getBlocks` is returning the result of calling the `readJSONDictionary`
 * function with the arguments `blocksFile` and an empty array `[]`.
 */
export const getBlocks = () => {
  return readJSONDictionary(blocksFile, []);
};

/**
 * The function "writeFollowers" writes a JSON dictionary of followers to a file.
 * @returns The function `writeFollowers` is returning the result of calling the `writeJSONDictionary`
 * function with the `followersFile` and `followers` as arguments.
 */
const writeFollowers = followers => {
  return writeJSONDictionary(followersFile, followers);
};

/**
 * The function `getFollowers` returns the contents of a JSON dictionary stored in the `followersFile`
 * variable.
 * @returns The function `getFollowers` is returning the result of calling the `readJSONDictionary`
 * function with the `followersFile` parameter.
 */
export const getFollowers = () => {
  return readJSONDictionary(followersFile);
};

/**
 * The function writes a JSON dictionary of followers to a file.
 * @returns the result of calling the `writeJSONDictionary` function with the `followingFile` and
 * `followers` as arguments.
 */
export const writeFollowing = followers => {
  return writeJSONDictionary(followingFile, followers);
};

/**
 * The function `getFollowing` returns an array of objects representing the following relationships,
 * with an optional mapping from an old format to a new format.
 * @returns The function `getFollowing` returns an array of objects. Each object in the array has two
 * properties: `id` and `actorId`.
 */
export const getFollowing = () => {
  return readJSONDictionary(followingFile).map(f => {
    if (typeof f === 'string') {
      // map old format to new format just in case
      // TODO: remove this before release
      return {
        id: f,
        actorId: f
      };
    } else {
      return f;
    }
  });
};

/**
 * The function `writeBoosts` writes a JSON dictionary to a file.
 * @returns the result of calling the `writeJSONDictionary` function with the `boostsFile` and `data`
 * parameters.
 */
export const writeBoosts = data => {
  return writeJSONDictionary(boostsFile, data);
};

/**
 * The function `getBoosts` returns a JSON dictionary from a file, or an empty array if the file is not
 * found.
 * @returns The function `getBoosts` is returning the result of calling the `readJSONDictionary`
 * function with the `boostsFile` parameter and an empty array as the default value.
 */
export const getBoosts = () => {
  return readJSONDictionary(boostsFile, []);
};

/**
 * The function `writeLikes` writes a JSON dictionary of likes to a file.
 * @returns the result of calling the `writeJSONDictionary` function with the `likesFile` and `likes`
 * as arguments.
 */
export const writeLikes = likes => {
  return writeJSONDictionary(likesFile, likes);
};

/**
 * The function `getLikes` returns the contents of a JSON file as a dictionary.
 * @returns The function `getLikes` is returning the result of calling the `readJSONDictionary`
 * function with the `likesFile` parameter.
 */
export const getLikes = () => {
  return readJSONDictionary(likesFile);
};

/**
 * The function `getNote` is an asynchronous function that takes an `id` parameter and returns the
 * contents of a JSON file with the corresponding `id` if it exists, otherwise it returns `undefined`.
 * @returns a Promise that resolves to the contents of a JSON file if it exists, or undefined if the
 * file does not exist or there is an error reading the file.
 */
export const getNote = async id => {
  // const postFile = path.resolve('./', pathToPosts, guid + '.json');
  const noteFile = getFileName(id);

  if (fs.existsSync(noteFile)) {
    try {
      return readJSONDictionary(noteFile, {});
    } catch (err) {
      console.error(err);
      return undefined;
    }
  }
  return undefined;
};

/**
 * The function sends a create activity to all followers of a user.
 */
export const sendCreateToFollowers = async object => {
  const followers = await getFollowers();
  const actors = await Promise.all(
    followers.map(async follower => {
      try {
        const account = await fetchUser(follower);
        return account.actor;
      } catch (err) {
        console.error('Could not fetch follower', err);
      }
    })
  );

  actors.forEach(async actor => {
    ActivityPub.sendCreate(actor, object);
  });
};

/**
 * The function sends an update to all followers by fetching their accounts and sending the update to
 * their actors using ActivityPub.
 */
export const sendUpdateToFollowers = async object => {
  const followers = await getFollowers();
  const actors = await Promise.all(
    followers.map(async follower => {
      try {
        const account = await fetchUser(follower);
        return account.actor;
      } catch (err) {
        console.error('Could not fetch follower', err);
      }
    })
  );

  actors.forEach(async actor => {
    ActivityPub.sendUpdate(actor, object);
  });
};

/**
 * The `createNote` function is used to create a new note or update an existing note, with options for
 * specifying recipients, mentions, and content processing.
 * @param body - The content of the note.
 * @param cw - The `cw` parameter is a string that represents the content warning for the note. It is
 * an optional parameter and can be used to provide a warning or spoiler for the content of the note.
 * @param inReplyTo - The `inReplyTo` parameter is the URL of the post that the new note is replying
 * to. It is used to indicate that the new note is a reply to an existing post.
 * @param toUser - The `toUser` parameter is used to specify the recipient of the note. It should be a
 * valid account identifier. If provided, the note will be sent directly to the specified user.
 * @param editOf - The `editOf` parameter is a string that represents the URL of the post that is being
 * edited. If this parameter is provided, the function will use the same GUID (Globally Unique
 * Identifier) as the post being edited.
 * @returns the `object` variable.
 */
export const createNote = async (body, cw, inReplyTo, toUser, editOf) => {
  const publicAddress = 'https://www.w3.org/ns/activitystreams#Public';

  const d = new Date();
  let guid;
  if (editOf) {
    // use same guid as post we're updating
    guid = editOf.replace(`https://${DOMAIN}/m/`, '');
  } else {
    // generate new guid
    guid = crypto.randomBytes(16).toString('hex');
  }
  let directMessage;

  // default to public
  let to = [publicAddress];

  // default recipient is my followers
  let cc = [ActivityPub.actor.followers];

  // Contains mentions
  const tags = [];

  if (inReplyTo || toUser) {
    if (toUser) {
      // TODO: validate the to field is a legit account
      to = [toUser];
      cc = [];
      directMessage = true;
    } else {
      // get parent post
      // so we can get the author and add to TO list
      const parent = await getActivity(inReplyTo);
      if (addressedOnlyToMe(parent)) {
        // this is a reply to a DM
        // set the TO to be ONLY to them (override public)
        to = [parent.attributedTo];
        // clear the CC list
        cc = [];
        directMessage = true;
      } else {
        cc.push(parent.attributedTo);
      }
    }
  }

  // Process content in various ways...
  let processedContent = body;

  // cribbed directly from mastodon
  // https://github.com/mastodon/mastodon/blob/main/app/models/account.rb
  const MENTION_RE = /(?<=^|[^/\w])@(([a-z0-9_]+([a-z0-9_.-]+[a-z0-9_]+)?)(?:@[\w.-]+[\w]+)?)/gi;

  const mentions = body.match(MENTION_RE);
  if (mentions && mentions.length) {
    const uniqueMentions = [...new Set(mentions)];
    for (let m = 0; m < uniqueMentions.length; m++) {
      const mention = uniqueMentions[m].trim();
      const uname = ActivityPub.getUsername(mention);
      // construct a mastodon-style link
      // <span class=\"h-card\"><a href=\"https://benbrown.ngrok.io/u/benbrown\" class=\"u-url mention\">@<span>benbrown@benbrown.ngrok.io</span></a></span>
      const account = await fetchUser(uname);

      const link = `<span class="h-card"><a href="${account.actor.url}" class="u-url mention">@<span>${uname}</span></a></span>`;
      processedContent = processedContent.replaceAll(mention, link);

      tags.push({
        type: 'Mention',
        href: account.actor.url,
        name: `@${uname}`
      });

      // if this is not a direct message to a single person,
      // add the mentioned person to the CC list
      if (!directMessage) {
        cc.push(account.actor.id);
      }
    }
  }

  // if this is a DM, require a mention of the recipient
  if (directMessage) {
    const account = await fetchUser(to[0]);
    const uname = ActivityPub.getUsername(to[0]);

    if (!tags.some(t => t.href === account.actor.url)) {
      const link = `<span class="h-card"><a href="${account.actor.url}" class="u-url mention">@<span>${uname}</span></a></span>`;
      processedContent = link + ' ' + processedContent;

      tags.push({
        type: 'Mention',
        href: account.actor.url,
        name: `@${uname}`
      });
    }
  }

  const content = md.render(processedContent);

  const activityId = `https://${DOMAIN}/m/${guid}`;
  const url = `https://${DOMAIN}/notes/${guid}`;
  const object = {
    id: activityId,
    type: 'Note',
    summary: cw || null,
    inReplyTo,
    published: d.toISOString(),
    attributedTo: ActivityPub.actor.id,
    content,
    url,
    to,
    cc,
    directMessage,
    sensitive: !!cw,
    atomUri: activityId,
    inReplyToAtomUri: null,
    attachment: [],
    tag: tags,
    replies: {
      id: `${activityId}/replies`,
      type: 'Collection',
      first: {
        type: 'CollectionPage',
        next: `${activityId}/replies?only_other_accounts=true&page=true`,
        partOf: `${activityId}/replies`,
        items: []
      }
    }
  };

  if (editOf) {
    object.updated = d.toISOString();
  }

  if (directMessage) {
    acceptDM(object, to[0]);
  } else {
    const noteFile = createFileName(object);
    writeJSONDictionary(noteFile, object);

    const inIndex = INDEX.findIndex(idx => idx.id === object.id);
    if (inIndex < 0) {
      INDEX.push({
        type: 'note', // (as opposed to an activity which reps someone else)
        id: object.id,
        actor: object.attributedTo,
        published: new Date(object.published).getTime(),
        inReplyTo: object.inReplyTo
      });
    }
  }

  // process recipients
  to.concat(cc).forEach(async recipient => {
    // if the recipient is "my followers", send it to them

    if (recipient === publicAddress) {
      // do nothing
    } else if (recipient === ActivityPub.actor.followers) {
      if (editOf) {
        sendUpdateToFollowers(object);
      } else {
        sendCreateToFollowers(object);
      }
    } else {
      // otherwise, send it directly to the person
      const account = await fetchUser(recipient);
      if (editOf) {
        ActivityPub.sendUpdate(account.actor, object);
      } else {
        ActivityPub.sendCreate(account.actor, object);
      }
    }
  });

  return object;
};

/**
 * The `follow` function follows a user, fetches their outbox, and logs any new posts to an activity
 * feed.
 */
export const follow = async request => {
  logger('following someone');
  const { actor } = await fetchUser(request.object.object);
  if (actor) {
    if (!isFollowing(actor.id)) {
      const following = getFollowing();
      following.push({
        id: request.object.id, // record the id of the original follow that was just approved
        actorId: actor.id
      });
      writeFollowing(following);
    }

    // fetch the user's outbox if it exists...
    if (actor.outbox) {
      logger('downloading outbox...');
      ActivityPub.fetchOutbox(actor).then(outbox => {
        logger('outbox downloaded', outbox.items.length);
        outbox.items.forEach(activity => {
          if (activity.type === 'Create') {
            logger('create a post', activity.object);
            // log the post to our activity feed
            if (typeof activity.object === 'string') {
              getActivity(activity.object)
                .then(newactivity => {
                  createActivity(newactivity);
                })
                .catch(err => {
                  console.error('Could not get outbox post', err);
                });
            } else {
              createActivity(activity.object);
            }
          } else if (activity.type === 'Announce') {
            // TODO: fetch boosted posts, etc.
          }
        });
      });
    }
  } else {
    logger('Failed to fetch user');
  }
};

/**
 * The function adds a follower by fetching the user, checking if the user is already a follower, and
 * then adding the user as a follower if they are not already.
 */
export const addFollower = async request => {
  logger('Adding follower...');
  const { actor } = await fetchUser(request.actor);
  if (actor) {
    const followers = getFollowers();
    if (followers.indexOf(actor.id) < 0) {
      followers.push(actor.id);
      writeFollowers(followers);
      addNotification(request);
    }
  } else {
    logger('Failed to fetch user');
  }
};

/**
 * The function removes a follower by fetching the user and updating the list of followers.
 */
export const removeFollower = async follower => {
  logger('Removing follower...');
  const { actor } = await fetchUser(follower);
  if (actor) {
    const followers = getFollowers();
    writeFollowers(followers.filter(f => f !== follower));
  } else {
    logger('Failed to fetch user');
  }
};

/**
 * The `ensureAccount` function ensures that an account exists by verifying the domain name and
 * generating a crypto key if the account file does not exist.
 * @param name - The name parameter is a string that represents the name of the account.
 * @param domain - The `domain` parameter is a string that represents the domain name. It is used to
 * verify if the domain name is well-formatted before proceeding with the account creation process.
 * @returns The function `ensureAccount` returns a Promise that resolves to an account object.
 */
export const ensureAccount = async (name, domain) => {
  // verify domain name
  const re = /^((?:(?:(?:\w[.\-+]?)*)\w)+)((?:(?:(?:\w[.\-+]?){0,62})\w)+)\.(\w{2,6})$/;
  if (!domain.match(re)) {
    console.error('DOMAIN setting "' + domain + '" does not appear to be a well-formatted domain name.');
    process.exit(1);
  }
  return new Promise((resolve, reject) => {
    if (existsSync(accountFile)) {
      resolve(getAccount());
    } else {
      // generate a crypto key
      crypto.generateKeyPair(
        'rsa',
        {
          modulusLength: 4096,
          publicKeyEncoding: {
            type: 'spki',
            format: 'pem'
          },
          privateKeyEncoding: {
            type: 'pkcs8',
            format: 'pem'
          }
        },
        (err, publicKey, privateKey) => {
          if (err) {
            console.error(err);
            reject(err);
          }
          const actorRecord = createActor(name, domain, publicKey);
          const webfingerRecord = createWebfinger(name, domain);
          const apikey = crypto.randomBytes(16).toString('hex');

          const account = {
            actor: actorRecord,
            webfinger: webfingerRecord,
            apikey,
            publicKey,
            privateKey
          };

          console.log('Account created! Wrote webfinger and actor record to', accountFile);
          writeJSONDictionary(accountFile, account);
          resolve(account);
        }
      );
    }
  });
};

export const updateAccount = async (name, domain, bio, img) => {
  console.log(img);
  // verify domain name
  const re = /^((?:(?:(?:\w[.\-+]?)*)\w)+)((?:(?:(?:\w[.\-+]?){0,62})\w)+)\.(\w{2,6})$/;
  if (!domain.match(re)) {
    console.error('DOMAIN setting "' + domain + '" does not appear to be a well-formatted domain name.');
    process.exit(1);
  }
  return new Promise((resolve, reject) => {
    // generate a crypto key
    crypto.generateKeyPair(
      'rsa',
      {
        modulusLength: 4096,
        publicKeyEncoding: {
          type: 'spki',
          format: 'pem'
        },
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'pem'
        }
      },
      (err, publicKey, privateKey) => {
        if (err) {
          console.error(err);
          reject(err);
        }
        const actorRecord = createActor(name, domain, publicKey, bio, img);
        const webfingerRecord = createWebfinger(name, domain);
        const apikey = crypto.randomBytes(16).toString('hex');
        const account = {
          actor: actorRecord,
          webfinger: webfingerRecord,
          apikey,
          publicKey,
          privateKey
        };
        console.log('Account created! Wrote webfinger and actor record to', accountFile);
        writeJSONDictionary(accountFile, account);
        resolve(account);
      }
    );
  });
};
/**
 * The function `getAccount` reads a JSON dictionary from a file and returns it, or an empty object if
 * the file does not exist.
 * @returns The function `getAccount` is returning the result of calling the `readJSONDictionary`
 * function with the `accountFile` and an empty object as arguments.
 */
export const getAccount = () => {
  return readJSONDictionary(accountFile, {});
};
