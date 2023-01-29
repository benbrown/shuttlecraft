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

export const getActivityStream = async (limit, offset) => {
  logger('Generating activity stream...');

  // sort all known posts by date quickly
  // exclude any posts that are marked as unreachable
  // and also exclude posts without a published date
  const sortedSlice = INDEX.filter(p => p.type !== 'fail' && !isNaN(p.published)).sort(sortByDate);

  // res will contain the
  const stream = [];

  // iterate over the list until we get enough posts (or run out of posts)
  let px;
  for (px = offset; px < sortedSlice.length; px++) {
    const p = sortedSlice[px];

    // process a post by someone else
    if (p.type === 'activity') {
      // Ignore posts from people I am not following
      if (!isFollowing(p.actor)) {
        continue;
      }

      if (!p.inReplyTo || isReplyToMyPost(p) || (await isReplyToFollowing(p))) {
        try {
          const post = await getFullPostDetails(p.id);
          stream.push(post);
        } catch (err) {
          console.error('error while loading post from index');
        }
      } else {
        // disgard replies i don't care about
      }
    }

    // process a post by me
    if (p.type === 'note') {
      const post = await getFullPostDetails(p.id);
      stream.push(post);
    }

    // if we have enough posts, break out of the loop
    if (stream.length === limit) {
      break;
    }
  }

  return {
    activitystream: stream,
    next: px
  };
};

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

  const res = [];
  let px;
  for (px = 0; px < sortedSlice.length; px++) {
    const p = sortedSlice[px];
    if (p.type === 'activity') {
      if (isFollowing(p.actor)) {
        if (!p.inReplyTo || isReplyToMyPost(p) || (await isReplyToFollowing(p))) {
          try {
            const { actor } = await fetchUser(p.actor);
            const post = await getActivity(p.id);
            res.push({
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
      const post = await getNote(p.id);
      res.push({
        note: post,
        actor: ActivityPub.actor
      });
    }
  }

  return {
    activitystream: res
  };
};
