import fetch from 'node-fetch';
import crypto from 'crypto';
import debug from 'debug';
import { queue } from './queue.js';
const logger = debug('ActivityPub');

/**
 * ActivityPubClient - a class for sending and fetching ActivityPub content
 */
export class ActivityPubClient {
  constructor(account) {
    logger('Initializing ActivityPub client for user:', account);
    if (account) {
      this.account = account;
    }
  }

  set actor(actor) {
    this._actor = actor;
  }

  get actor() {
    return this._actor;
  }

  set account(account) {
    logger('Setting account:', account);
    this._account = account;
    this._actor = account?.actor;
  }

  get account() {
    return this._account;
  }

  async webfinger(username) {
    const { targetDomain } = this.getUsernameDomain(username);

    const webfingerUrl = `https://${targetDomain}/.well-known/webfinger?resource=acct:${username}`;

    logger(`fetch webfinger ${webfingerUrl}`);
    const finger = await fetch(webfingerUrl, {
      headers: {
        Accept: 'application/jrd+json, application/json, application/ld+json'
      }
    });
    if (finger.ok) {
      const webfinger = await finger.json();
      return webfinger;
    } else {
      throw new Error(`could not get webfinger ${webfingerUrl}: ${finger.status}`);
    }
  }

  async fetchActor(userId) {
    const actorQuery = await ActivityPub.fetch(userId, {});
    if (actorQuery.ok) {
      const actor = await actorQuery.json();
      return actor;
    } else {
      // logger('failed to load actor', actorQuery.status, actorQuery.statusText, await actorQuery.text());
      throw new Error('failed to load actor');
    }
  }

  /**
   * Fetch an ActivityPub URL using the current actor to sign the request
   * @param {*} targetUrl url of activitypub resource
   * @param {*} options options for the fetch, excluding header
   * @returns a fetch promise
   */
  async fetch(targetUrl, options) {
    logger('Fetch:', targetUrl);

    const url = new URL(targetUrl);
    const urlFragment = url.pathname + (url.searchParams.toString() ? `?${url.searchParams.toString()}` : '');

    const signer = crypto.createSign('sha256');
    const d = new Date();
    const stringToSign = `(request-target): get ${urlFragment}\nhost: ${url.hostname}\ndate: ${d.toUTCString()}`;
    signer.update(stringToSign);
    signer.end();
    const signature = signer.sign(this.account.privateKey);
    const signatureB64 = signature.toString('base64');
    const header = `keyId="${this.actor.publicKey.id}",headers="(request-target) host date",signature="${signatureB64}"`;
    options.headers = {
      Date: d.toUTCString(),
      Host: url.hostname,
      Accept: 'application/activity+json, application/ld+json; profile="https://www.w3.org/ns/activitystreams"',
      Signature: header
    };

    const controller = new AbortController();
    setTimeout(() => controller.abort(), 5000);
    options.signal = controller.signal;

    const query = fetch(targetUrl, options);

    return query;
  }

  /**
   * Send an ActivityPub activity to a user
   * @param {*} recipient
   * @param {*} message
   * @returns a fetch result
   */
  async send(recipient, message) {
    queue.enqueue(() => {
      let url;
      try {
        url = new URL(recipient.inbox);
      } catch (err) {
        console.error('INVALID INBOX URL', recipient);
        throw err;
      }
      const inboxFragment = url.pathname;

      const digestHash = crypto.createHash('sha256').update(JSON.stringify(message)).digest('base64');
      const signer = crypto.createSign('sha256');
      const d = new Date();
      const stringToSign = `(request-target): post ${inboxFragment}\nhost: ${
        url.hostname
      }\ndate: ${d.toUTCString()}\ndigest: SHA-256=${digestHash}`;
      signer.update(stringToSign);
      signer.end();
      const signature = signer.sign(this.account.privateKey);
      const signatureB64 = signature.toString('base64');
      const header = `keyId="${this.actor.publicKey.id}",headers="(request-target) host date digest",signature="${signatureB64}"`;

      logger('OUTBOUND TO ', recipient.inbox);
      logger('MESSAGE', message);

      const controller = new AbortController();
      setTimeout(() => controller.abort(), 10000);
      return fetch(
        recipient.inbox,
        {
          headers: {
            Host: url.hostname,
            'Content-type': 'application/activity+json',
            Date: d.toUTCString(),
            Digest: `SHA-256=${digestHash}`,
            Signature: header
          },
          method: 'POST',
          json: true,
          body: JSON.stringify(message),
          signal: controller.signal
        },
        function (error, response) {
          if (error) {
            console.error('Error sending outbound message:', error, response);
          } else {
            logger('Response', response.status);
          }
        }
      );
    });
  }

  /**
   * Send a like message to the author of a post
   * @param {*} post activity being liked
   * @param {*} recipient actor record for author of post
   * @returns
   */
  async sendLike(post, recipient) {
    const guid = crypto.randomBytes(16).toString('hex');
    const message = {
      '@context': 'https://www.w3.org/ns/activitystreams',
      id: `${this.actor.id}/likes/${guid}`,
      type: 'Like',
      actor: this.actor.id,
      object: post.id
    };

    ActivityPub.send(recipient, message);

    // return the guid to make this undoable.
    return message;
  }

  /**
   * Send an undo message about a like that was sent previously.
   * @param {*} post post that is being unliked
   * @param {*} recipient  actor record for author of post
   * @param {*} originalActivityId id of original outbound like activity that is being undone
   * @returns
   */
  async sendUndoLike(post, recipient, originalActivityId) {
    const message = {
      '@context': 'https://www.w3.org/ns/activitystreams',
      id: `${originalActivityId}/undo`,
      type: 'Undo',
      actor: this.actor.id,
      object: {
        id: `${originalActivityId}`,
        type: 'Like',
        actor: this.actor.id,
        object: post.id
      }
    };
    ActivityPub.send(recipient, message);
    return message;
  }

  /**
   * Send a follow request
   * @param {*} recipient
   * @returns
   */
  async sendFollow(recipient) {
    const guid = crypto.randomBytes(16).toString('hex');
    const message = {
      '@context': 'https://www.w3.org/ns/activitystreams',
      id: `${this.actor.id}/follows/${guid}`,
      type: 'Follow',
      actor: this.actor.id,
      object: recipient.id
    };
    ActivityPub.send(recipient, message);

    // return the guid to make this undoable.
    return message;
  }

  /**
   * Send an undo about a previously sent follow
   * @param {*} recipient
   * @param {*} originalActivityId
   * @returns
   */
  async sendUndoFollow(recipient, originalActivityId) {
    const message = {
      '@context': 'https://www.w3.org/ns/activitystreams',
      id: `${originalActivityId}/undo`,
      type: 'Undo',
      actor: this.actor.id,
      object: {
        id: originalActivityId,
        type: 'Follow',
        actor: this.actor.id,
        object: recipient.id
      }
    };
    ActivityPub.send(recipient, message);

    // return the guid to make this undoable.
    return message;
  }

  /**
   * Send an Accept for an incoming follow request
   * @param {*} followRequest
   */
  async sendAccept(recipient, followRequest) {
    const guid = crypto.randomBytes(16).toString('hex');
    const message = {
      '@context': 'https://www.w3.org/ns/activitystreams',
      id: `${this.actor.id}/accept/${guid}`,
      type: 'Accept',
      actor: this.actor.id,
      object: followRequest
    };
    ActivityPub.send(recipient, message);

    return message;
  }

  /**
   * Send an outbound update activity to a follower or recipient of a message
   * @param {*} recipient
   * @param {*} object
   * @returns
   */
  async sendUpdate(recipient, object) {
    const message = {
      '@context': 'https://www.w3.org/ns/activitystreams',
      id: `${object.id}/activity`,
      published: object.published,
      type: 'Update',
      actor: this.actor.id,
      object,
      to: object.to,
      cc: object.cc
    };
    ActivityPub.send(recipient, message);
    return message;
  }

  /**
   * Send an outbound create activity to a follower or recipient of a message
   * @param {*} recipient
   * @param {*} object
   * @returns
   */
  async sendCreate(recipient, object) {
    const message = {
      '@context': 'https://www.w3.org/ns/activitystreams',
      id: `${object.id}/activity`,
      published: object.published,
      type: 'Create',
      actor: this.actor.id,
      object,
      to: object.to,
      cc: object.cc
    };
    ActivityPub.send(recipient, message);
    return message;
  }

  /**
   * Send a boost for a specific post to the posts author and our followers
   * @param {*} primaryRecipient
   * @param {*} post
   * @param {*} followers
   * @returns
   */
  async sendBoost(primaryRecipient, post, followers) {
    const guid = crypto.randomBytes(16).toString('hex');

    // send to followers and original poster
    const recipients = [
      this.actor.followers, // this is a reference to the follower list that we will dereference later
      primaryRecipient.id // this is a reference to the recipient
    ];

    const message = {
      '@context': 'https://www.w3.org/ns/activitystreams',
      id: `${this.actor.id}/boosts/${guid}`,
      type: 'Announce',
      actor: this.actor.id,
      published: new Date().toISOString(),
      object: post.id,
      to: ['https://www.w3.org/ns/activitystreams#Public'],
      cc: recipients
    };

    // deliver outbound messages to all recipients
    recipients.forEach(recipient => {
      // if the recipient is "my followers", send it to them
      if (recipient === this.actor.followers) {
        followers.forEach(follower => {
          ActivityPub.send(follower, message);
        });
      } else {
        // otherwise, send it directly to the person
        ActivityPub.send(primaryRecipient, message);
      }
    });

    // return the guid to make this undoable.
    return message;
  }

  /**
   * Send an undo of a previously sent boost
   * @param {*} primaryRecipient
   * @param {*} post
   * @param {*} followers
   * @param {*} originalActivityId
   * @returns
   */
  async sendUndoBoost(primaryRecipient, post, followers, originalActivityId) {
    // send to followers and original poster
    const recipients = [
      this.actor.followers, // this is a reference to the follower list that we will dereference later
      post.attributedTo // this is a reference to the recipient
    ];

    const message = {
      '@context': 'https://www.w3.org/ns/activitystreams',
      id: `${originalActivityId}/undo`,
      type: 'Undo',
      actor: this.actor.id,
      object: {
        id: originalActivityId,
        type: 'Announce',
        actor: this.actor.id,
        object: post.id
      },
      to: ['https://www.w3.org/ns/activitystreams#Public'],
      cc: recipients
    };

    // deliver outbound messages to all recipients
    recipients.forEach(recipient => {
      // if the recipient is "my followers", send it to them
      if (recipient === this.actor.followers) {
        followers.forEach(follower => {
          ActivityPub.send(follower, message);
        });
      } else {
        // otherwise, send it directly to the person
        ActivityPub.send(primaryRecipient, message);
      }
    });

    // return the guid to make this undoable.
    return message;
  }

  getUsernameDomain(userIdorName) {
    let targetDomain, username;
    if (userIdorName.startsWith('https://')) {
      const actor = new URL(userIdorName);
      targetDomain = actor.hostname;
      username = actor.pathname.split(/\//);
      username = username[username.length - 1];
    } else {
      // handle leading @
      [username, targetDomain] = userIdorName.replace(/^@/, '').split('@');
    }

    return {
      username,
      targetDomain
    };
  }

  getUsername(userIdorName) {
    const { username, targetDomain } = this.getUsernameDomain(userIdorName);
    return `${username}@${targetDomain}`;
  }

  async fetchOutbox(actor) {
    if (actor.outbox) {
      try {
        const actorQuery = await ActivityPub.fetch(actor.outbox, {});
        if (actorQuery.ok) {
          const rootOutbox = await actorQuery.json();
          let items = [];
          let outboxPage;
          // find the first element.
          if (rootOutbox.first) {
            if (typeof rootOutbox.first === 'string') {
              const pageQuery = await ActivityPub.fetch(rootOutbox.first, {});
              if (pageQuery.ok) {
                outboxPage = await pageQuery.json();
                items = outboxPage.orderedItems || [];
              } else {
                logger(
                  'failed to load outbox first page',
                  rootOutbox.first,
                  pageQuery.status,
                  pageQuery.statusText,
                  await pageQuery.text()
                );
              }
            } else {
              items = rootOutbox.first.orderedItems || [];
              outboxPage = rootOutbox.first;
            }
          }

          return {
            outbox: rootOutbox,
            page: outboxPage,
            items
          };
        } else {
          logger(
            'failed to load outbox index',
            actor.outbox,
            actorQuery.status,
            actorQuery.statusText,
            await actorQuery.text()
          );
        }
      } catch (err) {
        console.error(err);
      }
    }
    return [];
  }

  /**
   * Validate the signature on an incoming request to the inbox
   * @param {*} actor
   * @param {*} req
   * @returns true if signature is valid
   */
  validateSignature(actor, req) {
    const signature = {};
    req.headers.signature
      .split(/,/)
      .map(c => c.split(/=/))
      .forEach(([key, val]) => {
        signature[key] = val.replace(/^"/, '').replace(/"$/, '');
        return signature[key];
      });
    // construct string from headers
    const fields = signature.headers.split(/\s/);
    const str = fields
      .map(f => (f === '(request-target)' ? '(request-target): post /api/inbox' : `${f}: ${req.header(f)}`))
      .join('\n');
    try {
      if (actor) {
        const verifier = crypto.createVerify('RSA-SHA256');
        verifier.update(str);
        const res = verifier.verify(actor.publicKey.publicKeyPem, signature.signature, 'base64');
        return res;
      } else {
        return false;
      }
    } catch (err) {
      // console.error(err); // any server will get a lot of junk Deletes
      return false;
    }
  }
}

export const ActivityPub = new ActivityPubClient();
