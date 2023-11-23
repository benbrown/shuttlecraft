/** 
 _______  __   __  _______                                                     
|       ||  | |  ||       |                                                    
|_     _||  |_|  ||    ___|                                                    
  |   |  |       ||   |___                                                     
  |   |  |       ||    ___|                                                    
  |   |  |   _   ||   |___                                                     
  |___|  |__| |__||_______|                                                    
 _______  ___      _______  _______  ______    ___   _______  __   __  __   __ 
|   _   ||   |    |       ||       ||    _ |  |   | |       ||  | |  ||  |_|  |
|  |_|  ||   |    |    ___||   _   ||   | ||  |   | |_     _||  |_|  ||       |
|       ||   |    |   | __ |  | |  ||   |_||_ |   |   |   |  |       ||       |
|       ||   |___ |   ||  ||  |_|  ||    __  ||   |   |   |  |       ||       |
|   _   ||       ||   |_| ||       ||   |  | ||   |   |   |  |   _   || ||_|| |
|__| |__||_______||_______||_______||___|  |_||___|   |___|  |__| |__||_|   |_|

This file contains the functions pertaining to how Shuttlecraft creates the "latest" feed

**/

import debug from 'debug';
import { fetchUser } from './users.js';
import { getNote, getLikes, getBoosts, isReplyToMyPost, isReplyToFollowing, isFollowing } from './account.js';
import { getActivity } from './notes.js';
import { INDEX } from './storage.js';
import { ActivityPub } from './ActivityPub.js';

const logger = debug('ono:algorithm');

/**
 * The function `sortByDate` takes two values and compares them. It is used to sort posts in reverse
 * order.
 * @param a - The first object being compared.
 * @param b - The parameter `b` represents the second item being compared in the `sortByDate` function.
 * @returns The `sortByDate` function returns -1 if `a.published` is greater than `b.published`, 1 if
 * `a.published` is less than `b.published`, and 0 if `a.published` is equal to `b.published`.
 */
export const sortByDate = (a, b) => {
  if (a.published > b.published) {
    return -1;
  } else if (a.published < b.published) {
    return 1;
  } else {
    return 0;
  }
};

/**
 * Given an activity record OR an id for an activity record, returns the full activity along with
 * the actor, and, if a boost, information about the boost and boosting user
 * @param {*} activityOrId
 * @returns {note, actor, boost, booster}
 */
export const getFullPostDetails = async activityOrId => {
  const likes = await getLikes();
  const boosts = await getBoosts();

  let note, actor, boost, booster;
  try {
    if (typeof activityOrId === 'string') {
      note = await getActivity(activityOrId);
    } else {
      note = activityOrId;
    }
  } catch (err) {
    console.error(err);
    console.error('Could not load post in feed');
    return;
  }

  const account = await fetchUser(note.attributedTo || note.actor);
  actor = account.actor;

  if (note.type === 'Announce') {
    boost = note;
    booster = actor;
    try {
      note = await getActivity(boost.object);
      const op = await fetchUser(note.attributedTo);
      actor = op.actor;
    } catch (err) {
      console.error(err);
      console.error('Could not fetch boosted post...', boost.object);
      return;
    }
  }

  note.isLiked = !!likes.some(l => l.activityId === note.id);
  note.isBoosted = !!boosts.some(l => l.activityId === note.id);

  return {
    note,
    actor,
    boost,

    booster
  };
};

/**
 * The `getActivityStream` function generates an activity stream by sorting and filtering posts, and
 * then iterating over them to retrieve the necessary details.
 * @param limit - The `limit` parameter specifies the maximum number of posts to include in the
 * activity stream. It determines how many posts will be returned in the `activitystream` array.
 * @param offset - The `offset` parameter is used to determine the starting point of the activity
 * stream. It specifies the index position in the `sortedSlice` array from where the iteration should
 * begin.
 * @returns an object with two properties: "activitystream" and "next". The "activitystream" property
 * contains an array of posts, and the "next" property contains the index of the next post to be
 * fetched.
 */
export const getActivityStream = async (limit, offset) => {
  logger('Generating activity stream...');

  // sort all known posts by date quickly
  // exclude any posts that are marked as unreachable
  // and also exclude posts without a published date
  const sortedSlice = INDEX.filter(p => p.type !== 'fail' && !isNaN(p.published)).sort(sortByDate);

  // res will contain the
  const stream = [];

  // iterate over the list until we get enough posts (or run out of posts)
  let postIndex;
  for (postIndex = offset; postIndex < sortedSlice.length; postIndex++) {
    const postObject = sortedSlice[postIndex];

    // process a post by someone else
    if (postObject.type === 'activity') {
      // Ignore posts from people I am not following
      if (!isFollowing(postObject.actor)) {
        continue;
      }

      if (!postObject.inReplyTo || isReplyToMyPost(postObject) || (await isReplyToFollowing(postObject))) {
        try {
          const post = await getFullPostDetails(postObject.id);
          stream.push(post);
        } catch (err) {
          console.error('error while loading post from index');
        }
      } else {
        // disgard replies i don't care about
      }
    }

    // process a post by me
    if (postObject.type === 'note') {
      const post = await getFullPostDetails(postObject.id);
      stream.push(post);
    }

    // if we have enough posts, break out of the loop
    if (stream.length === limit) {
      break;
    }
  }

  return {
    activitystream: stream,
    next: postIndex
  };
};

/**
 * The function `getActivitySince` retrieves activity data since a specified date, excluding the user's
 * own activity if specified.
 * @param since - The `since` parameter is a timestamp indicating the starting point from which you
 * want to retrieve activity. Only activities that occurred after this timestamp will be included in
 * the result.
 * @param [excludeSelf=false] - The `excludeSelf` parameter is a boolean flag that determines whether
 * or not to exclude the posts made by the current user (self) from the result. If `excludeSelf` is set
 * to `true`, the posts made by the current user will be filtered out from the result. If `exclude
 * @returns an object with a property called "activitystream" which contains an array of objects. Each
 * object in the array represents an activity or a note. Each object has two properties: "note" which
 * represents the content of the activity or note, and "actor" which represents the actor who performed
 * the activity or created the note.
 */
export const getActivitySince = async (since, excludeSelf = false) => {
  // sort all known posts by date quickly
  const sortedSlice = INDEX.filter(p => p.type !== 'fail' && !isNaN(p.published))
    .sort(sortByDate)
    .filter(p => {
      if (excludeSelf && p.actor === ActivityPub.actor.id) {
        return false;
      }
      return p.published > since;
    });

  const stream = [];
  let postIndex;
  for (postIndex = 0; postIndex < sortedSlice.length; postIndex++) {
    const postObject = sortedSlice[postIndex];
    if (postObject.type === 'activity') {
      if (isFollowing(postObject.actor)) {
        if (!postObject.inReplyTo || isReplyToMyPost(postObject) || (await isReplyToFollowing(postObject))) {
          try {
            const { actor } = await fetchUser(postObject.actor);
            const post = await getActivity(postObject.id);
            stream.push({
              note: post,
              actor
            });
          } catch (err) {
            console.error('error while loading post from index');
          }
        } else {
          // disgard replies i don't care about
        }
      } else {
        // disregard not from following
      }
    } else {
      const post = await getNote(postObject.id);
      stream.push({
        note: post,
        actor: ActivityPub.actor
      });
    }
  }

  return {
    activitystream: stream
  };
};
