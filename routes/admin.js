import { getActivity } from '../lib/notes.js';
import { getActivitySince, getActivityStream, getFullPostDetails, sortByDate } from '../lib/theAlgorithm.js';
import express from 'express';
import debug from 'debug';
import {
  getFollowers,
  getFollowing,
  writeFollowing,
  createNote,
  getNotifications,
  getNote,
  getLikes,
  writeLikes,
  getBoosts,
  writeBoosts,
  isFollower,
  isFollowing,
  getInboxIndex,
  getInbox,
  writeInboxIndex,
  updateAccount
} from '../lib/account.js';
import { fetchUser } from '../lib/users.js';
import { getPrefs, INDEX, searchKnownUsers, updatePrefs } from '../lib/storage.js';
import { ActivityPub } from '../lib/ActivityPub.js';
import { queue } from '../lib/queue.js';
const { DOMAIN } = process.env;
export const router = express.Router();
const logger = debug('ono:admin');

import multer from 'multer';

/**
 * Return the INDEX in form of JSON
 */
router.get('/index', async (req, res) => {
  res.json(INDEX);
});

/** 
  _____           _____ _    _ ____   ____          _____  _____  
 |  __ \   /\    / ____| |  | |  _ \ / __ \   /\   |  __ \|  __ \ 
 | |  | | /  \  | (___ | |__| | |_) | |  | | /  \  | |__) | |  | |
 | |  | |/ /\ \  \___ \|  __  |  _ <| |  | |/ /\ \ |  _  /| |  | |
 | |__| / ____ \ ____) | |  | | |_) | |__| / ____ \| | \ \| |__| |
 |_____/_/    \_\_____/|_|  |_|____/ \____/_/    \_\_|  \_\_____/                                                              

 */
/**
 * Render the dashboard console in the html
 * display the feeds
 */
router.get('/', async (req, res) => {
  const offset = parseInt(req.query.offset) || 0;
  const pageSize = 20;

  const { activitystream, next } = await getActivityStream(pageSize, offset);

  const feeds = await getFeedList();

  if (req.query.json) {
    res.json(activitystream);
  } else {
    // set auth cookie
    res.cookie('token', ActivityPub.account.apikey, { maxAge: 7 * 24 * 60 * 60 * 1000 });

    res.render('dashboard', {
      layout: 'private',
      url: '/',
      me: ActivityPub.actor,
      offset,
      next: activitystream.length === pageSize ? next : null,
      activitystream,
      feeds,
      prefs: getPrefs()
    });
  }
});

/**
  _   _  ____ _______ _____ ______ _____ _____       _______ _____ ____  _   _  _____ 
 | \ | |/ __ \__   __|_   _|  ____|_   _/ ____|   /\|__   __|_   _/ __ \| \ | |/ ____|
 |  \| | |  | | | |    | | | |__    | || |       /  \  | |    | || |  | |  \| | (___  
 | . ` | |  | | | |    | | |  __|   | || |      / /\ \ | |    | || |  | | . ` |\___ \ 
 | |\  | |__| | | |   _| |_| |     _| || |____ / ____ \| |   _| || |__| | |\  |____) |
 |_| \_|\____/  |_|  |_____|_|    |_____\_____/_/    \_\_|  |_____\____/|_| \_|_____/ 

 */

/**
 * Render the notifications by fetching the notification API
 */
router.get('/notifications', async (req, res) => {
  const likes = await getLikes();
  const offset = parseInt(req.query.offset) || 0;
  const pageSize = 20;
  const notes = getNotifications()
    .slice()
    .reverse()
    .slice(offset, offset + pageSize);
  const notifications = await Promise.all(
    notes.map(async notification => {
      const { actor } = await fetchUser(notification.notification.actor);
      let note, original;
      // TODO: check if user is in following list
      actor.isFollowing = isFollowing(actor.id);

      if (notification.notification.type === 'Like' || notification.notification.type === 'Announce') {
        note = await getNote(notification.notification.object);
      }
      if (notification.notification.type === 'Reply') {
        try {
          note = await getActivity(notification.notification.object);
          original = await getNote(note.inReplyTo);
          note.isLiked = !!likes.some(l => l.activityId === note.id);
        } catch (err) {
          console.error('Could not fetch parent post', err);
          return null;
        }
      }
      if (notification.notification.type === 'Mention') {
        try {
          note = await getActivity(notification.notification.object);
          note.isLiked = !!likes.some(l => l.activityId === note.id);
        } catch (err) {
          console.log('Could not fetch mention post', err);
          return null;
        }
      }

      return {
        actor,
        note,
        original,
        ...notification
      };
    })
  );

  const following = getFollowing();
  const followers = getFollowers();

  const feeds = await getFeedList();

  res.render('notifications', {
    layout: 'private',
    prefs: getPrefs(),
    me: ActivityPub.actor,
    url: '/notifications',
    offset,
    feeds,
    next: notifications.length === pageSize ? offset + notifications.length : null,
    notifications: notifications.filter(n => n !== null),
    followersCount: followers.length,
    followingCount: following.length
  });
});

/**
 * Load the feeds in the activity stream
 */
router.get('/feeds/:handle?', async (req, res) => {
  const offset = parseInt(req.query.offset) || 0;
  const pageSize = 20;
  let feed;

  let feedcount = 20;
  if (req.query.expandfeeds) {
    feedcount = 120;
  }
  const feeds = await getFeedList(0, feedcount);

  let activitystream;

  if (req.params.handle) {
    const account = await fetchUser(req.params.handle);
    feed = account.actor;
    feed.isFollowing = isFollowing(feed.id);
    feed.isFollower = isFollower(feed.id);

    if (feed.id === req.app.get('account').actor.id || isFollowing(feed.id)) {
      logger('Loading posts from index for', feed.id);
      activitystream = await Promise.all(
        INDEX.filter(p => p.actor === account.actor.id)
          .sort(sortByDate)
          .slice(offset, offset + pageSize)
          .map(async p => {
            try {
              return getFullPostDetails(p.id);
            } catch (err) {
              console.error('error while loading post from index', err);
            }
          })
          .filter(p => p !== undefined) // remove items where we couldn't load the boost
      );
    } else {
      logger('Loading remote posts for', feed.id);
      const { items } = await ActivityPub.fetchOutbox(feed);

      activitystream = !items
        ? []
        : await Promise.all(
            items
              .filter(post => {
                // filter to only include posts and boosts
                return post.type === 'Create' || post.type === 'Announce';
              })
              .map(async post => {
                try {
                  if (post.type === 'Create') {
                    return getFullPostDetails(post.object);
                  } else {
                    return getFullPostDetails(post);
                  }
                } catch (err) {
                  console.error('error while loading post from remote outbox', err);
                }
              })
          );
    }
  }

  // res.json(activitystream);
  // return;
  res.render('feeds', {
    layout: 'private',
    me: ActivityPub.actor,
    url: '/feeds',
    prefs: getPrefs(),
    feeds,
    feed,
    expandfeeds: req.query.expandfeeds,
    activitystream,
    offset,
    next: activitystream && activitystream.length === pageSize ? offset + activitystream.length : null
  });
});

/**
 * Load the inboxes
 */
router.get('/dms/:handle?', async (req, res) => {
  const inboxIndex = getInboxIndex();
  let error, inbox, recipient, lastIncoming;

  if (req.params.handle) {
    // first validate that this is a real user
    try {
      const account = await fetchUser(req.params.handle);
      recipient = account.actor;
      inbox = getInbox(recipient.id);

      // reverse sort!
      inbox && inbox.sort(sortByDate);

      // find last message in thread
      lastIncoming = inbox.length ? inbox[0] : null;

      // mark all of these messages as seen
      if (inboxIndex[recipient.id]) {
        inboxIndex[recipient.id].lastRead = new Date().getTime();
        writeInboxIndex(inboxIndex);
      }
    } catch (err) {
      error = {
        message: `Could not load user: ${err.message}`
      };
    }
  }

  const inboxes = await Promise.all(
    Object.keys(inboxIndex).map(async k => {
      const acct = await fetchUser(k);
      return {
        id: k,
        actorId: k,
        actor: acct.actor,
        unread: !inboxIndex[k].lastRead || inboxIndex[k].lastRead < inboxIndex[k].latest,
        ...inboxIndex[k]
      };
    })
  );

  inboxes.sort((a, b) => {
    if (a.latest > b.latest) {
      return -1;
    } else if (a.latest < b.latest) {
      return 1;
    } else {
      return 0;
    }
  });

  res.render('dms', {
    layout: 'private',
    nonav: true,
    me: ActivityPub.actor,
    prefs: getPrefs(),
    url: '/dms',
    lastIncoming: lastIncoming ? lastIncoming.id : null,
    feeds: inboxes,
    inbox,
    feed: recipient,
    error
  });
});

/**
 * Load the post using the GET method
 */
router.get('/post', async (req, res) => {
  const to = req.query.to;
  const inReplyTo = req.query.inReplyTo;
  let op;
  let actor;
  let prev;
  if (inReplyTo) {
    op = await getActivity(inReplyTo);
    const account = await fetchUser(op.attributedTo);
    actor = account.actor;
  }

  if (req.query.edit) {
    console.log('COMPOSING EDIT', req.query.edit);
    prev = await getNote(req.query.edit);
    // console.log("ORIGINAL", original);
  }

  res.status(200).render('partials/composer', {
    url: '/post',
    to,
    inReplyTo,
    actor,
    originalPost: op, // original post being replied to
    prev, // previous version we posted, now editing
    me: req.app.get('account').actor,
    prefs: getPrefs(),
    layout: 'private'
  });
});

/**
 * Update and create the post using the POST method
 */
router.post('/post', async (req, res) => {
  // TODO: this is probably supposed to be a post to /api/outbox
  const post = await createNote(req.body.post, req.body.cw, req.body.inReplyTo, req.body.to, req.body.editOf);
  if (post.directMessage === true) {
    // return html partial of the new post for insertion in the feed
    res.status(200).render('partials/dm', {
      message: post,
      actor: req.app.get('account').actor,
      me: req.app.get('account').actor,
      layout: null
    });
  } else {
    // return html partial of the new post for insertion in the feed
    res.status(200).render('partials/note', {
      note: post,
      actor: req.app.get('account').actor,
      layout: 'activity'
    });
  }
});

/**
 * Poll the new notifications, inboxes, activities.
 */
router.get('/poll', async (req, res) => {
  const sincePosts = new Date(req.cookies.latestPost).getTime();
  const sinceNotifications = parseInt(req.cookies.latestNotification);
  const notifications = getNotifications().filter(n => n.time > sinceNotifications);
  const inboxIndex = getInboxIndex();
  const unreadDM =
    Object.keys(inboxIndex).filter(k => {
      return !inboxIndex[k].lastRead || inboxIndex[k].lastRead < inboxIndex[k].latest;
    })?.length || 0;

  const { activitystream } = await getActivitySince(sincePosts, true);
  res.json({
    newPosts: activitystream.length,
    newNotifications: notifications.length,
    newDMs: unreadDM
  });
});

/**
 * Render the followers in the page
 */
router.get('/followers', async (req, res) => {
  let following = await Promise.all(
    getFollowing().map(async f => {
      const acct = await fetchUser(f.actorId);
      if (acct?.actor?.id) {
        acct.actor.isFollowing = true; // duh
        return acct.actor;
      }
      return undefined;
    })
  );

  following = following.filter(f => f !== undefined);

  let followers = await Promise.all(
    getFollowers().map(async f => {
      const acct = await fetchUser(f);
      if (acct?.actor?.id) {
        acct.actor.isFollowing = following.some(p => p.id === f);
        return acct.actor;
      }
      return undefined;
    })
  );

  followers = followers.filter(f => f !== undefined);

  if (req.query.json) {
    const notes = {}; // FIXME: Where are the notes coming from?
    res.json(notes);
  } else {
    res.render('followers', {
      layout: 'private',
      url: '/followers',
      prefs: getPrefs(),
      me: ActivityPub.actor,
      followers,
      following,
      followersCount: followers.length,
      followingCount: following.length
    });
  }
});

/**
 * Render the following in the page
 */
router.get('/following', async (req, res) => {
  let following = await Promise.all(
    getFollowing().map(async f => {
      const acct = await fetchUser(f.actorId);
      if (acct?.actor?.id) {
        acct.actor.isFollowing = true; // duh
        return acct.actor;
      }
      return undefined;
    })
  );
  following = following.filter(f => f !== undefined);

  let followers = await Promise.all(
    getFollowers().map(async f => {
      const acct = await fetchUser(f);
      if (acct?.actor?.id) {
        acct.actor.isFollowing = following.some(p => p.id === f);
        return acct.actor;
      }
      return undefined;
    })
  );

  followers = followers.filter(f => f !== undefined);

  if (req.query.json) {
    const notes = {}; // FIXME: Where are the notes coming from?
    res.json(notes);
  } else {
    res.render('following', {
      layout: 'private',
      url: '/followers',
      prefs: getPrefs(),
      me: ActivityPub.actor,
      followers,
      following,
      followersCount: followers.length,
      followingCount: following.length
    });
  }
});

/**
  _____  _____  ______ ______ _____ 
 |  __ \|  __ \|  ____|  ____/ ____|
 | |__) | |__) | |__  | |__ | (___  
 |  ___/|  _  /|  __| |  __| \___ \ 
 | |    | | \ \| |____| |    ____) |
 |_|    |_|  \_\______|_|   |_____/ 
                                                                    
 */
/**
 * Render the preferewnce page with the preference using GET
 */
router.get('/prefs', (req, res) => {
  const following = getFollowing();
  const followers = getFollowers();

  res.render('prefs', {
    layout: 'private',
    url: '/prefs',
    queue: {
      size: queue.size,
      state: queue.state,
      shouldRun: queue.shouldRun
    },
    prefs: getPrefs(),
    me: ActivityPub.actor,
    followersCount: followers.length,
    followingCount: following.length
  });
});

/**
 * Update the preference using POST
 */
router.post('/prefs', (req, res) => {
  // lget current prefs.
  const prefs = getPrefs();

  // incoming prefs
  const updates = req.body;

  console.log('GOT UPDATES', updates);
  res.redirect('/private/prefs');
  Object.keys(updates).forEach(key => {
    // split the fieldname into parts
    const [type, keyname] = key.split(/\./);

    // update the pref in place
    prefs[type][keyname] = updates[key];
  });

  updatePrefs(prefs);
});

/**
 * Update the username preference using POST
 */
router.post('/prefsAccount', (req, res) => {
  // lget current prefs.
  const updates = req.body;
  const bio = updates.bio;
  const img = updates.avatarInput;
  console.log('me ', ActivityPub.actor.name);
  console.log('GOT ACCOUNT UPDATES', updates);
  updateAccount(updates.username, DOMAIN, bio, img).then(myaccount => {
    // set the server to use the main account as its primary actor
    ActivityPub.account = myaccount;
    // app.set('account', myaccount);
  });

  res.redirect('/private');
});

const getFeedList = async (offset = 0, num = 20) => {
  const following = await getFollowing();

  const feeds = await Promise.all(
    following.map(async follower => {
      // posts in index by this author
      // this is probably expensive.
      // what we really need to do is look from this person by date
      // and if we sort right it should be reasonable?
      // and we just return unread counts for everything?
      const posts = INDEX.filter(p => p.actor === follower.actorId);

      // find most recent post
      const mostRecent = posts.sort(sortByDate)[0]?.published || null;

      const account = await fetchUser(follower.actorId);

      return {
        actorId: follower.actorId,
        actor: account.actor,
        postCount: posts.length,
        mostRecent
      };
    })
  );

  feeds.sort((a, b) => {
    if (a.mostRecent > b.mostRecent) {
      return -1;
    } else if (a.mostRecent < b.mostRecent) {
      return 1;
    } else {
      return 0;
    }
  });

  return feeds.slice(offset, offset + num);
};

/**
 * Find the user given the user information and display the result
 */
router.get('/find', async (req, res) => {
  let results = [];

  // can we find an exact match
  try {
    const { actor } = await fetchUser(req.query.handle);
    if (actor && actor.id) {
      actor.isFollowing = isFollowing(actor.id);
      results.push(actor);
    }
  } catch (err) {
    // not found
  }

  if (results.length === 0) {
    const search = await searchKnownUsers(req.query.handle.toLowerCase());
    if (search.length) {
      results = results.concat(search);
    }
  }

  res.status(200).render('findresults', {
    layout: 'private',
    url: '/find',
    query: req.query.handle,
    me: ActivityPub.actor,
    prefs: getPrefs(),
    results
  });
});

/**
 * Render more feeds based on different indexes
 */
router.get('/morefeeds', async (req, res) => {
  const feeds = await getFeedList(20, 100);

  res.render('partials/feeds', {
    layout: null,
    feeds,
    expandfeeds: true
  });
});

/**
 * Look up the user based on the user information
 */
router.get('/lookup', async (req, res) => {
  const { actor } = await fetchUser(req.query.handle);
  if (actor) {
    actor.isFollowing = isFollowing(actor.id);
    res.status(200).render('partials/personCard', {
      actor,
      layout: null
    });
  } else {
    res.status(200).send('No user found');
  }
});

/**
 * Follow a user given the user information using POST
 */
router.post('/follow', async (req, res) => {
  const handle = req.body.handle;
  if (handle) {
    logger('toggle follow', handle);
    if (handle === req.app.get('account').actor.id) {
      return res.status(200).json({
        isFollowed: false
      });
    }
    const { actor } = await fetchUser(handle);
    if (actor) {
      const status = isFollowing(actor.id);
      if (!status) {
        ActivityPub.sendFollow(actor);

        return res.status(200).json({
          isFollowed: true
        });
      } else {
        // send unfollow
        await ActivityPub.sendUndoFollow(actor, status.id);

        // todo: this should just be a function like removeFollowing

        let following = getFollowing();

        // filter out the one we are removing
        following = following.filter(l => l.actorId !== actor.id);

        writeFollowing(following);

        return res.status(200).json({
          isFollowed: false
        });
      }
    }
  }
  res.status(404).send('not found');
});

/**
 * Like the post given the activity ID using POST
 */
router.post('/like', async (req, res) => {
  const activityId = req.body.post;
  let likes = getLikes();
  if (!likes.some(l => l.activityId === activityId)) {
    const post = await getActivity(activityId);
    const recipient = await fetchUser(post.attributedTo);
    const message = await ActivityPub.sendLike(post, recipient.actor);
    const guid = message.id;

    likes.push({
      id: guid,
      activityId
    });
    res.status(200).json({
      isLiked: true
    });
  } else {
    // extract so we can send an undo record
    const recordToUndo = likes.find(l => l.activityId === activityId);

    const post = await getActivity(activityId);
    const recipient = await fetchUser(post.attributedTo);

    await ActivityPub.sendUndoLike(post, recipient.actor, recordToUndo.id);

    // filter out the one we are removing
    likes = likes.filter(l => l.activityId !== activityId);

    // send status back
    res.status(200).json({
      isLiked: false
    });
  }
  writeLikes(likes);
});

router.post('/boost', async (req, res) => {
  const activityId = req.body.post;
  let boosts = getBoosts();
  if (!boosts.some(l => l.activityId === activityId)) {
    const post = await getActivity(activityId);
    const account = await fetchUser(post.attributedTo);
    const followers = await getFollowers();
    const fullFollowers = await Promise.all(
      followers.map(async follower => {
        const { actor } = await fetchUser(follower);
        return actor;
      })
    );
    const message = await ActivityPub.sendBoost(account.actor, post, fullFollowers);

    boosts.push({
      id: message.id,
      activityId
    });
    res.status(200).json({
      isBoosted: true
    });
  } else {
    // extract so we can send an undo record
    const recordToUndo = boosts.find(l => l.activityId === activityId);
    const post = await getActivity(activityId);
    const account = await fetchUser(post.attributedTo);
    const followers = await getFollowers();
    const fullFollowers = await Promise.all(
      followers.map(async follower => {
        const { actor } = await fetchUser(follower);
        return actor;
      })
    );
    await ActivityPub.sendUndoBoost(account.actor, post, fullFollowers, recordToUndo.id);

    // filter out the one we are removing
    boosts = boosts.filter(l => l.activityId !== activityId);

    // send status back
    res.status(200).json({
      isBoosted: false
    });
  }
  writeBoosts(boosts);
});