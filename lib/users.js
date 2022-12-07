import path from 'path';
import fs from 'fs';
import debug from 'debug';

import {
  readJSONDictionary,
  writeJSONDictionary,
  pathToUsers
} from './storage.js';
import {
  ActivityPub
} from './ActivityPub.js';
const logger = debug('ono:users');

const fetchUserFromSource = async (username, webId) => {
  let webfinger;

  if (!webId) {
    try {
      webfinger = await ActivityPub.webfinger(username);
    } catch (err) {
      console.error(err);
      return {
        actor: {
          name: username,
          preferredUsername: username,
        }
      };
    }
  }

  // now fetch actor info
  const self = webId ? webId : webfinger.links.filter(l => l.rel == 'self')[0]?.href;
  let actor;
  if (self) {
    logger(`fetch activitypub.actor ${ self }`);
    try {
      actor = await ActivityPub.fetchActor(self);
    } catch (err) {
      console.error(err);
      return {
        actor: {
          name: username,
          preferredUsername: username,
          id: webId,
        }
      };
    }
  } else {
    throw new Error('could not find self link in webfinger');
  }

  const userFile = path.resolve(pathToUsers, `${username}.json`);
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

  const username = ActivityPub.getUsername(user);
  // if we start with an activitypub url, we don't need to finger to get it
  if (user.startsWith('https://')) {
    skipFinger = true;
  }

  const userFile = path.resolve(pathToUsers, `${username}.json`);
  logger('load user', user, userFile);

  if (fs.existsSync(userFile)) {
    const account = readJSONDictionary(userFile);
    // check date to see if we need to refetch...
    if (account.lastFetched && account.lastFetched > (now - cacheMax)) {
      return account;
    } else if (!account.actor || !account.actor.id) {
      // do nothing and fall through to the live fetch
      // since we don't have a full user account here
    } else {
      logger('fetch fresh user for', user, `${username}`);
      // attempt to fetch a new one async
      // TODO: needs to be debounced - could try to load same user many times quickly
      fetchUserFromSource(username, account?.actor?.id).catch((err) => console.error('Error updating user data for', username, err));
      return account;
    }
  }

  return await fetchUserFromSource(username, skipFinger ? user : null);
}