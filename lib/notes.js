import fs from 'fs';
import debug from 'debug';
import { addNotification, isBlocked, writeNotifications, getNotifications } from './account.js';
import {
  INDEX,
  readJSONDictionary,
  writeJSONDictionary,
  fromIndex,
  deleteActivityFromIndex,
  deleteJSONDictionary,
  addActivityToIndex,
  addFailureToIndex,
  createFileName,
  getFileName,
  getLikesFileName
} from './storage.js';
import { ActivityPub } from './ActivityPub.js';

const logger = debug('ono:notes');

/**
 * The function `getLikesForNote` retrieves the likes and boosts for a given note ID from a JSON
 * dictionary.
 * @returns The function `getLikesForNote` is returning the result of calling the `readJSONDictionary`
 * function with the `fileName` and an object containing `likes` and `boosts` properties.
 */
export const getLikesForNote = id => {
  const fileName = getLikesFileName(id);
  return readJSONDictionary(fileName, {
    likes: [],
    boosts: []
  });
};

/**
 * The function `getReplyCountForNote` returns the number of replies for a given note ID.
 * @returns The number of replies for a given note ID.
 */
export const getReplyCountForNote = id => {
  return INDEX.filter(i => i.inReplyTo === id).length;
};

/**
 * The function records a like for a note and adds the actor to the list of likes if they haven't
 * already liked the note.
 */
export const recordLike = request => {
  const actor = request.actor;
  const noteId = request.object;

  logger('INCOMING LIKE FOR', noteId);

  const likes = getLikesForNote(noteId);
  if (likes.likes.indexOf(actor) < 0) {
    likes.likes.push(actor);
    const fileName = getLikesFileName(noteId);
    writeJSONDictionary(fileName, likes);
    addNotification(request);
  }
};

/**
 * The function `recordBoost` records a boost for a note and adds the actor to the list of boosts if
 * they haven't already boosted the note.
 */
export const recordBoost = request => {
  const actor = request.actor;
  const noteId = request.object;

  logger('INCOMING BOOST FOR', noteId);

  const likes = getLikesForNote(noteId);
  if (likes.boosts.indexOf(actor) < 0) {
    likes.boosts.push(actor);
    const fileName = getLikesFileName(noteId);
    writeJSONDictionary(fileName, likes);
    addNotification(request);
  }
};

/**
 * The function `recordUndoLike` removes the actor's like from the likes list for a given note and
 * updates the likes file.
 */
export const recordUndoLike = request => {
  const actor = request.actor;
  const noteId = request.object;

  logger('INCOMING UNLIKE FOR', noteId);

  const likes = getLikesForNote(noteId);
  likes.likes = likes.likes.filter(a => a !== actor);
  const fileName = getLikesFileName(noteId);
  writeJSONDictionary(fileName, likes);
};

/**
 * The `deleteActivity` function deletes an activity and its associated notifications from the system.
 * @param id - The `id` parameter represents the unique identifier of the activity that needs to be
 * deleted. It is used to locate the corresponding note file and delete it.
 * @param tombstone - The `tombstone` parameter is not used in the code snippet provided. It is
 * mentioned in a comment, but there is no code that utilizes it.
 */
export const deleteActivity = (id, tombstone) => {
  const noteFile = getFileName(id);
  if (fs.existsSync(noteFile)) {
    // rather than capture a tombstone, just delete it like it never was.
    deleteActivityFromIndex(id);
    deleteJSONDictionary(noteFile);

    // delete any reply or mention notifications
    const notifications = getNotifications();
    writeNotifications(
      notifications.filter(n => {
        // filter only notifications that are replies or mentions
        if ((n.notification.type === 'Reply' || n.notification.type === 'Mention') && n.notification.object === id) {
          return false;
        }
        return true;
      })
    );
  }
};

/**
 * The `createActivity` function creates a new activity by writing a note to a file and adding it to an
 * index if the file does not already exist.
 */
export const createActivity = note => {
  const noteFile = createFileName(note);
  if (!fs.existsSync(noteFile)) {
    addActivityToIndex(note);
  }
  writeJSONDictionary(noteFile, note);
};

/**
 * The function `getActivity` retrieves activity data either from a cache or by fetching it from a
 * remote source, handling potential errors along the way.
 * @returns The function `getActivity` returns a Promise that resolves to the result of either
 * `readJSONDictionary(noteFile, {})` or `fetchActivity(id)`.
 */
export const getActivity = async id => {
  try {
    if (isBlocked(id)) {
      throw new Error('Content is from blocked domain', id);
    }
    const indexed = fromIndex(id);
    if (indexed !== false) {
      // if is cached, no need to check for file
      if (indexed.type === 'fail') {
        throw new Error('Activity was unreachable', indexed);
      } else {
        const noteFile = getFileName(id);
        return readJSONDictionary(noteFile, {});
      }
    } else {
      return await fetchActivity(id);
    }
  } catch (err) {
    console.error('Failed to getActivity', err);
    throw err;
  }
};

/**
 * The function fetches an activity using its ID and handles any errors that occur during the process.
 * @returns The `fetchActivity` function returns the `activity` object if the fetch is successful.
 */
const fetchActivity = async activityId => {
  logger('FETCH ', activityId);
  try {
    const query = await ActivityPub.fetch(activityId, {});
    if (query.ok) {
      const activity = await query.json();
      createActivity(activity);
      return activity;
    } else {
      console.error('Failed to fetch', activityId, 'REASON:', query.statusText);
      addFailureToIndex({
        id: activityId,
        time: new Date().getTime(),
        status: query.status
      });
      throw new Error('could not get post', activityId);
    }
  } catch (err) {
    addFailureToIndex({
      id: activityId,
      time: new Date().getTime(),
      status: err.message
    });
    throw new Error('could not get post', activityId);
  }
};
