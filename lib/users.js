import fetch from 'node-fetch';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import debug from 'debug';
import dotenv from 'dotenv';
dotenv.config();

import {getAccount} from './account.js';
import { getActivity } from './notes.js';
import { readJSONDictionary, writeJSONDictionary } from './storage.js';
const logger = debug('ono:users');

const { DOMAIN } = process.env;

const sendToUser = async (user, message) => {
    
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
        console.log('Response:', response.body);
      }
    });

    logger(res);

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
        "cc": [
            "https://hachyderm.io/users/benbrown/followers"
        ],
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

export const fetchUser = async (user) => {
    let targetDomain, username;
    let skipFinger = false;
    logger('load user', user);
    if (user.startsWith('https://')) {
        const actor = new URL(user);
        targetDomain = actor.hostname;
        username = actor.pathname.split(/\//);
        username = username[username.length-1];
        skipFinger = true;
    } else {
        // handle leading @
        [username, targetDomain] = user.replace(/^\@/,'').split('@');
    }

    const userFile = path.resolve('./',`data/users/${username}@${targetDomain}.json`);
    if (fs.existsSync(userFile)) {
      return readJSONDictionary(userFile);
    } else  {
      let finger, webfinger;

        if (!skipFinger) {
          const webfingerUrl = `https://${ targetDomain }/.well-known/webfinger?resource=acct:${username}@${targetDomain}`;

          logger(`fetch url ${ webfingerUrl }`);
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
        const self = skipFinger ? user : webfinger.links.filter(l => l.rel=='self')[0]?.href;
        let actor;
        if (self) {
            logger(`fetch ${ self[0].href }`);
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

        logger(`update ${ userFile }`);
        writeJSONDictionary(userFile, {
            webfinger,
            actor,
            lastFetched: new Date().getTime(),
        });

        return { webfinger, actor };

    }


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