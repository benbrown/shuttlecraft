import fetch from 'node-fetch';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import debug from 'debug';
import {getAccount} from './account.js';
import { getActivity } from './notes.js';
const logger = debug('users');

const config = JSON.parse(fs.readFileSync('./config.json'));
const { USER, PASS, DOMAIN, PRIVKEY_PATH, CERT_PATH, PORT } = config;

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
    if (user.startsWith('https://')) {
        const actor = new URL(user);
        targetDomain = actor.hostname;
        username = actor.pathname.split(/\//);
        username = username[username.length-1];
    } else {
        // handle leading @
        [username, targetDomain] = user.replace(/^\@/,'').split('@');
    }

    logger(`fetch ${username}@${targetDomain}`);

    const userFile = path.resolve('./',`data/users/${username}@${targetDomain}.json`);
    try {
        const userJSONRaw = fs.readFileSync(userFile);
        const userJSON = JSON.parse(userJSONRaw);

        // TODO: timeout cache and refetch after a while
        return userJSON;
    } catch(err) {

        const webfingerUrl = `https://${ targetDomain }/.well-known/webfinger?resource=acct:${username}@${targetDomain}`;

        logger(`fetch ${ webfingerUrl }`);
        let finger, webfinger;
        try {
            finger = await fetch(webfingerUrl, { headers: {'Accept':'application/jrd+json, application/json'}});
            if (finger.ok) {   
                webfinger = await finger.json();
            } else {
                throw new Error('could not get webfinger');
            }
        } catch(err) {
            console.error(err);
            return {};
        }

        // now fetch actor info
        const self = webfinger.links.filter(l => l.rel=='self');
        let actor;
        if (self) {
            logger(`fetch ${ self[0].href }`);
            try {
                const actorQuery = await fetch(self[0].href, { headers: {'Accept': 'application/json'}});
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
        fs.writeFileSync(userFile, JSON.stringify({
            webfinger,
            actor,
            lastFetched: new Date().getTime(),
        }, null, 2));

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