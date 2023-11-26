import path from 'path';
import fs from 'fs';
import debug from 'debug';
import { readJSONDictionary, writeJSONDictionary, pathToUsers } from './storage.js';
import { ActivityPub } from './ActivityPub.js';

const logger = debug('ono:users');

/**
 * The function `fetchUserFromSource` fetches user information from a given webId or username using the
 * ActivityPub protocol.
 * @param username - The `username` parameter is the username of the user you want to fetch from the
 * source. It is used to identify the user and retrieve their information.
 * @param webId - The `webId` parameter is a string that represents the unique identifier of a user on
 * the web. It is used to fetch the actor information of the user from an ActivityPub server. If the
 * `webId` parameter is not provided, the function will attempt to fetch the actor information using
 * the
 * @returns The function `fetchUserFromSource` returns an object with the properties `webfinger`,
 * `actor`, and `lastFetched`.
 */
const fetchUserFromSource = async (username, webId) => {
  let webfinger;

  if (!webId) {
    try {
      webfinger = await ActivityPub.webfinger(username);
    } catch (err) {
      return {
        actor: {
          name: username,
          preferredUsername: username
        }
      };
    }
  }

  // now fetch actor info
  const self = webId || webfinger.links.filter(l => l.rel === 'self')[0]?.href;
  let actor;
  if (self) {
    logger(`fetch activitypub.actor ${self}`);
    try {
      actor = await ActivityPub.fetchActor(self);
    } catch (err) {
      return {
        actor: {
          name: username,
          preferredUsername: username,
          id: webId
        }
      };
    }
  } else {
    throw new Error('could not find self link in webfinger');
  }

  const userFile = path.resolve(pathToUsers, `${username}.json`);
  logger(`update ${userFile}`);
  writeJSONDictionary(userFile, {
    webfinger,
    actor,
    lastFetched: new Date().getTime()
  });

  return {
    webfinger,
    actor,
    lastFetched: new Date().getTime()
  };
};

/**
 * The `fetchUser` function fetches user information either from a cache or from a source, with an
 * option to skip fingerprinting if the user is already an ActivityPub URL.
 * @returns The function `fetchUser` returns a Promise that resolves to the user account information.
 */
export const fetchUser = async user => {
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
    if (account.lastFetched && account.lastFetched > now - cacheMax) {
      return account;
    } else if (!account.actor || !account.actor.id) {
      // do nothing and fall through to the live fetch
      // since we don't have a full user account here
    } else {
      logger('fetch fresh user for', user, `${username}`);
      // attempt to fetch a new one async
      // TODO: needs to be debounced - could try to load same user many times quickly
      fetchUserFromSource(username, account?.actor?.id).catch(err =>
        console.error('Error updating user data for', username, err)
      );
      return account;
    }
  }

  return await fetchUserFromSource(username, skipFinger ? user : null);
};
