import express from 'express';
import debug from 'debug';
import RSS from 'rss-generator';
import dotenv from 'dotenv';
import { getNote, getOutboxPosts, isMyPost } from '../lib/account.js';
import { getActivity, getLikesForNote, getReplyCountForNote } from '../lib/notes.js';
import { INDEX } from '../lib/storage.js';
import { ActivityPub } from '../lib/ActivityPub.js';
import { fetchUser } from '../lib/users.js';

dotenv.config();

export const router = express.Router();

const { USERNAME, DOMAIN } = process.env;
const logger = debug('notes');

const unrollThread = async (noteId, results = [], ascend = true, descend = true) => {
  let post, actor;
  let stats;
  if (
    isMyPost({
      id: noteId
    })
  ) {
    try {
      post = await getNote(noteId);
      actor = ActivityPub.actor;
      const likes = getLikesForNote(post.id);
      stats = {
        likes: likes.likes.length,
        boosts: likes.boosts.length,
        replies: getReplyCountForNote(post.id)
      };
    } catch (err) {
      logger('could not fetch own post in thread', err);
    }
  } else {
    try {
      post = await getActivity(noteId);
      const account = await fetchUser(post.attributedTo);
      actor = account.actor;
    } catch (err) {
      logger('Could not load a post in a thread. Possibly deleted.', err);
    }
  }

  // can only check up stream if you can look at the post itself.
  // if it has been deleted, that info is lost.
  if (post) {
    results.push({
      stats,
      note: post,
      actor
    });

    // if this is a reply, get the parent and any other parents straight up the chain
    // this does NOT get replies to those parents that are not part of the active thread right now.
    if (ascend && post.inReplyTo) {
      try {
        await unrollThread(post.inReplyTo, results, true, false);
      } catch (err) {
        logger('Failed to unroll thread parents.', err);
      }
    }
  }

  // now, find all posts that are below this one...
  if (descend) {
    const replies = INDEX.filter(p => p.inReplyTo === noteId);
    for (let r = 0; r < replies.length; r++) {
      try {
        await unrollThread(replies[r].id, results, false, true);
      } catch (err) {
        logger('Failed to unroll thread children', err);
      }
    }
  }

  return results;
};

router.get('/', async (req, res) => {
  const offset = parseInt(req.query.offset) || 0;
  const { posts } = await getOutboxPosts(offset);
  const actor = ActivityPub.actor;
  // const enrichedPosts = posts.map(post => {
  //   let stats;
  //   if (isMyPost(post)) {
  //     const likes = getLikesForNote(post.id);
  //     stats = {
  //       likes: likes.likes.length,
  //       boosts: likes.boosts.length,
  //       replies: getReplyCountForNote(post.id)
  //     };
  //     post.stats = stats;
  //   }
  //   return post;
  // });

  res.render('public/home', {
    me: ActivityPub.actor,
    actor,
    activitystream: posts,
    layout: 'public',
    next: offset + posts.length,
    domain: DOMAIN,
    user: USERNAME
  });
});

router.get('/feed', async (req, res) => {
  const { posts } = await getOutboxPosts(0);

  const feed = new RSS({
    title: `${USERNAME}@${DOMAIN}`,
    site_url: DOMAIN,
    pubDate: posts[0].published
  });

  posts.forEach(post => {
    /* loop over data and add to feed */
    feed.item({
      title: post.subject,
      description: post.content,
      url: post.url,
      date: post.published // any format that js Date can parse.
    });
  });

  res.set('Content-Type', 'text/xml');
  res.send(
    feed.xml({
      indent: true
    })
  );
});

router.get('/notes/:guid', async (req, res) => {
  const guid = req.params.guid;

  if (!guid) {
    return res.status(400).send('Bad request.');
  } else {
    const actor = ActivityPub.actor;
    const note = await getNote(`https://${DOMAIN}/m/${guid}`);
    if (note === undefined) {
      return res.status(404).send(`No record found for ${guid}.`);
    } else {
      const notes = await unrollThread(note.id);
      notes.sort((a, b) => {
        const ad = new Date(a.note.published).getTime();
        const bd = new Date(b.note.published).getTime();
        if (ad > bd) {
          return 1;
        } else if (ad < bd) {
          return -1;
        } else {
          return 0;
        }
      });
      res.render('public/note', {
        me: ActivityPub.actor,
        actor,
        activitystream: notes,
        layout: 'public',
        domain: DOMAIN,
        user: USERNAME
      });
    }
  }
});
