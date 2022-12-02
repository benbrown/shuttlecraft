import fetch from 'node-fetch';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import debug from 'debug';
import dotenv from 'dotenv';
dotenv.config();

import {getAccount} from './account.js';
import { getActivity } from './notes.js';
import { readJSONDictionary, writeJSONDictionary, pathToUsers } from './storage.js';
import { sendToFollowers, sendActivityToFollowers } from './account.js';
const logger = debug('ono:users');

const { DOMAIN } = process.env;

export const sendToUser = async (user, message) => {
    
    const myaccount = getAccount();

    const { actor } = await fetchUser(user);
    const url = new URL(actor.inbox);
    const inboxFragment = url.pathname;

    const digestHash = crypto.createHash('sha256').update(JSON.stringify(message)).digest('base64');
    const signer = crypto.createSign('sha256');
    let d = new Date();
    let stringToSign = `(request-target): post ${inboxFragment}\nhost: ${url.hostname}\ndate: ${d.toUTCString()}\ndigest: SHA-256=${digestHash}`;
    signer.update(stringToSign);
    signer.end();
    const signature = signer.sign(myaccount.privateKey);
    const signature_b64 = signature.toString('base64');
    let header = `keyId="${myaccount.actor.publicKey.id}",headers="(request-target) host date digest",signature="${signature_b64}"`;

    logger('OUTBOUND TO ', actor.inbox);
    logger('MESSAGE', message);
    const res = await fetch(actor.inbox,
     {
        headers: {
        'Host': url.hostname,
        'Content-type': 'application/json',
        'Date': d.toUTCString(),
        'Digest': `SHA-256=${digestHash}`,
        'Signature': header
      },
      method: 'POST',
      json: true,
      body: JSON.stringify(message),
    }, function (error, response){
      if (error) {
        console.log('Error:', error, response);
      }
      else {
        logger('Responose', response.status);
        // console.log('Response:', response.status);
      }
    });

    return res;
}

export const sendPost = async (user, object) => {
    const myaccount = getAccount();

    const guid = crypto.randomBytes(16).toString('hex');
    let message = {
      '@context': 'https://www.w3.org/ns/activitystreams',
      'id': `${ object.id }/activity`,
      'published': object.published,
      'type': 'Create',
      'actor': myaccount.actor.id,
      'object': object,
      "to": [
        "https://www.w3.org/ns/activitystreams#Public"
      ],
      "cc": object.cc,
    };
    return await sendToUser(user, message);
}

export const sendAcceptMessage = async (thebody) => {
    const myaccount = getAccount();

    const guid = crypto.randomBytes(16).toString('hex');
    let message = {
      '@context': 'https://www.w3.org/ns/activitystreams',
      'id': `https://${DOMAIN}/${guid}`,
      'type': 'Accept',
      'actor': myaccount.actor.id,
      'object': thebody,
    };
    return await sendToUser(thebody.actor, message);
}

export const sendFollowMessage = async (user) => {
  const myaccount = getAccount();

  const guid = crypto.randomBytes(16).toString('hex');
  let message = {
    '@context': 'https://www.w3.org/ns/activitystreams',
    'id': `https://${DOMAIN}/${guid}`,
    'type': 'Follow',
    'actor': myaccount.actor.id,
    'object': user,
  };
  return await sendToUser(user, message);
}

export const sendLikeMessage = async (activityId) => {
  const myaccount = getAccount();

  // to who? 
  const post = await getActivity(activityId);

  const guid = crypto.randomBytes(16).toString('hex');
  let message = {
    '@context': 'https://www.w3.org/ns/activitystreams',
    'id': `https://${DOMAIN}/likes/${guid}`,
    'type': 'Like',
    'actor': myaccount.actor.id,
    'object': activityId,
  };
  await sendToUser(post.attributedTo, message);

  // return the guid to make this undoable.
  return guid;
}

export const sendUndoLikeMessage = async (activityId, guid) => {
  const myaccount = getAccount();

  // to who? 
  const post = await getActivity(activityId);

  let message = {
    '@context': 'https://www.w3.org/ns/activitystreams',
    'id': `https://${DOMAIN}/likes/${guid}/undo`,
    'type': 'Undo',
    'actor': myaccount.actor.id,
    'object': {
      'id': `https://${DOMAIN}/likes/${guid}`,
      'type': 'Like',
      'actor': myaccount.actor.id,
      'object': activityId,
    },
  };
  await sendToUser(post.attributedTo, message);

  // return the guid to make this undoable.
  return guid;
}

export const sendBoostMessage = async (activityId) => {
  const myaccount = getAccount();

  // to who? 
  const post = await getActivity(activityId);

  const guid = crypto.randomBytes(16).toString('hex');

  // send to followers and original poster
  const recipients = [
    myaccount.actor.followers,
    post.attributedTo,
  ];

  let message = {
    '@context': 'https://www.w3.org/ns/activitystreams',
    'id': `https://${DOMAIN}/boosts/${guid}`,
    'type': 'Announce',
    'actor': myaccount.actor.id,
    'published': new Date().toISOString(),
    'object': activityId,
    "to": [
      "https://www.w3.org/ns/activitystreams#Public"
    ],
    "cc":recipients,
  };

  // process recipients
  recipients.forEach((recipient) => {
    // if the recipient is "my followers", send it to them
    if (recipient === myaccount.actor.followers) {
      sendActivityToFollowers(message);
    } else {
      // otherwise, send it directly to the person
      sendToUser(recipient, message);
    }
  });

  // return the guid to make this undoable.
  return guid;
}

export const sendUndoBoostMessage = async (activityId, guid) => {
  const myaccount = getAccount();

  // to who? 
  const post = await getActivity(activityId);
  
  // send to followers and original poster
  const recipients = [
    myaccount.actor.followers,
    post.attributedTo,
  ];

  let message = {
    '@context': 'https://www.w3.org/ns/activitystreams',
    'id': `https://${DOMAIN}/boosts/${guid}/undo`,
    'type': 'Undo',
    'actor': myaccount.actor.id,
    'object': {
      'id': `https://${DOMAIN}/boosts/${guid}`,
      'type': 'Announce',
      'actor': myaccount.actor.id,
      'object': activityId,
    },
    "to": [
      "https://www.w3.org/ns/activitystreams#Public"
    ],
    "cc":recipients,
  };

  // process recipients
  recipients.forEach((recipient) => {
    // if the recipient is "my followers", send it to them
    if (recipient === myaccount.actor.followers) {
      sendActivityToFollowers(message);
    } else {
      // otherwise, send it directly to the person
      sendToUser(recipient, message);
    }
  });

  // return the guid to make this undoable.
  return guid;
}

export const getUsername = (userIdorName) => {
  let targetDomain, username;
  if (userIdorName.startsWith('https://')) {
    const actor = new URL(userIdorName);
    targetDomain = actor.hostname;
    username = actor.pathname.split(/\//);
    username = username[username.length-1];
  } else {
      // handle leading @
      [username, targetDomain] = userIdorName.replace(/^\@/,'').split('@');
  }

  return {username, targetDomain};
}

export const fetchOutbox = async(actor) => {
  if (actor.outbox) {
    try {
      const actorQuery = await fetch(actor.outbox, { headers: {'Accept': 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'}});
      if (actorQuery.ok) {
        const rootOutbox = await actorQuery.json();
        let items = [];
        // find the first element.
        if (rootOutbox.first) {
          if (typeof rootOutbox.first == 'string') {
            const pageQuery = await fetch(rootOutbox.first, { headers: {'Accept': 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'}});
            if (pageQuery.ok) {
              const outboxPage = await pageQuery.json();
              items = outboxPage.orderedItems || [];
            }
          } else {
            items = rootOutbox.first.orderedItems || [];
          }
        }
        return items;
      }
    } catch(err) {
        console.error(err);
    }
  }
  return [];
}

const fetchUserFromSource = async(targetDomain, username, webId) => {
  let finger, webfinger;

  if (!webId) {
    const webfingerUrl = `https://${ targetDomain }/.well-known/webfinger?resource=acct:${username}@${targetDomain}`;

    logger(`fetch webfinger ${ webfingerUrl }`);
    try {
        finger = await fetch(webfingerUrl, { headers: {'Accept':'application/jrd+json, application/json'}});
        if (finger.ok) {   
            webfinger = await finger.json();
        } else {
            console.error(finger.statusText);
            throw new Error('could not get webfinger', webfingerUrl);
        }
    } catch(err) {
        console.error(err);
        return {};
    }
  } 

  // now fetch actor info
  const self = webId ? webId : webfinger.links.filter(l => l.rel=='self')[0]?.href;
  let actor;
  if (self) {
      logger(`fetch activitypub.actor ${ self }`);
      try {
          const actorQuery = await fetch(self, { headers: {'Accept': 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'}});
          if (actorQuery.ok) {
              actor = await actorQuery.json();
          }
      } catch(err) {
          console.error(err);
          return {};
      }
  } else {
      throw new Error('could not find self link in webfinger');
  }

  const userFile = path.resolve(pathToUsers, `${username}@${targetDomain}.json`);
  logger(`update ${ userFile }`);
  writeJSONDictionary(userFile, {
      webfinger,
      actor,
      lastFetched: new Date().getTime(),
  });

  return {
    webfinger,
    actor,
    lastFetched: new Date().getTime(),
  };

}

export const fetchUser = async (user) => {
    let skipFinger = false;
    const now = new Date().getTime();
    const cacheMax = 1 * 60 * 60 * 1000; // cache user info for 1 hour

    const {username, targetDomain} = getUsername(user);
    // if we start with an activitypub url, we don't need to finger to get it
    if (user.startsWith('https://')) {
        skipFinger = true;
    }

    const userFile = path.resolve(pathToUsers, `${username}@${targetDomain}.json`);
    logger('load user', user, userFile);

    if (fs.existsSync(userFile)) {
      const account = readJSONDictionary(userFile);
      // check date to see if we need to refetch...
      if (account.lastFetched && account.lastFetched > (now - cacheMax)) {
        return account;
      } else {
        logger('fetch fresh user for', user,  `${username}@${targetDomain}`);
        // attempt to fetch a new one async
        // TODO: needs to be debounced - could try to load same user many times quickly
        fetchUserFromSource(targetDomain, username, account?.actor?.id).catch((err) => console.error('Error updating user data for', username, err));
        return account;
      }
   }

   return await fetchUserFromSource(targetDomain, username, skipFinger ? user : null);
}

export const validateSignature = async (user, req) => {
    let signature = {};
    req.headers.signature.split(/\,/).map(c=>c.split(/\=/)).forEach(([key,val])=>signature[key] = val.replace(/^\"/,'').replace(/\"$/,''));
    // construct string from headers
    const fields = signature.headers.split(/\s/);
    const str = fields.map(f => f==='(request-target)' ? '(request-target): post /api/inbox' : `${f}: ${req.header(f)}`).join('\n');
    try {
        const { actor } = await fetchUser(user); // should actually use signature.keyId
        if (actor) {
            const verifier = crypto.createVerify('RSA-SHA256');
            verifier.update(str);
            const res = verifier.verify(actor.publicKey.publicKeyPem, signature.signature, 'base64');
            return res;
        } else { 
            return false;
        }
    } catch(err) {
        console.error(err);
        return false;
    }
}