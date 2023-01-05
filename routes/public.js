import express from 'express';
export const router = express.Router();
import debug from 'debug';
import RSS from 'rss-generator';
import dotenv from 'dotenv';
dotenv.config();

import {
  getNote,
  isMyPost,
  getAccount,
  getOutboxPosts,
  readMedia
} from '../lib/account.js';
import {
  getActivity,
  getLikesForNote,
  getReplyCountForNote
} from '../lib/notes.js';
import {
  INDEX
} from '../lib/storage.js';
import {
  ActivityPub
} from '../lib/ActivityPub.js';

const {
  USERNAME,
  DOMAIN
} = process.env;

import {
  fetchUser
} from '../lib/users.js';

const logger = debug('notes');

const unrollThread = async (noteId, results = [], ascend = true, descend = true) => {
  let post, actor;
  let stats;
  if (isMyPost({
      id: noteId
    })) {
    post = await getNote(noteId);
    actor = ActivityPub.actor;
    const likes = getLikesForNote(post.id)
    stats = {
      likes: likes.likes.length,
      boosts: likes.boosts.length,
      replies: getReplyCountForNote(post.id),
    }
  } else {
    post = await getActivity(noteId);
    let account = await fetchUser(post.attributedTo);
    actor = account.actor;
  }

  results.push({
    stats: stats,
    note: post,
    actor: actor,
  });

  // if this is a reply, get the parent and any other parents straight up the chain
  // this does NOT get replies to those parents that are not part of the active thread right now.
  if (ascend && post.inReplyTo) {
    await unrollThread(post.inReplyTo, results, true, false);
  }

  // now, find all posts that are below this one...
  if (descend) {
    const replies = INDEX.filter((p) => p.inReplyTo === noteId);
    for (let r = 0; r < replies.length; r++) {
      await unrollThread(replies[r].id, results, false, true);
    }
  }

  return results;

}

router.get('/', async (req, res) => {
  const offset = parseInt(req.query.offset) || 0;
  const {
    total,
    posts
  } = await getOutboxPosts(offset);
  const actor = ActivityPub.actor;
  let enrichedPosts = posts.map((post) => {
    let stats;
    if (isMyPost(post)) {
      const likes = getLikesForNote(post.id)
      stats = {
        likes: likes.likes.length,
        boosts: likes.boosts.length,
        replies: getReplyCountForNote(post.id),
      }
      post.stats = stats;
    }
    return post;
  })

  res.render('public/home', {
    me: ActivityPub.actor,
    actor: actor,
    activitystream: posts,
    layout: 'public',
    next: offset + posts.length,
    domain: DOMAIN,
    user: USERNAME
  });
});


router.get('/feed', async (req, res) => {
  const {
    total,
    posts
  } = await getOutboxPosts(0);

  var feed = new RSS({
    title: `${USERNAME}@${DOMAIN}`,
    site_url: DOMAIN,
    pubDate: posts[0].published,
  });

  posts.forEach((post) => {
    /* loop over data and add to feed */
    feed.item({
      title: post.subject,
      description: post.content,
      url: post.url,
      date: post.published, // any format that js Date can parse.
    });
  });

  res.set('Content-Type', 'text/xml');
  res.send(feed.xml({
    indent: true
  }));


});

router.get('/notes/:guid', async (req, res) => {
  let guid = req.params.guid;
  if (!guid) {
    return res.status(400).send('Bad request.');
  } else {
    const actor = ActivityPub.actor;
    try {
        const note = await getNote(`https://${ DOMAIN }/m/${ guid }`);
        if (note === undefined) {
          return res.status(404).send(`No record found for ${guid}.`);
        } else {
          if (req.accepts('application/activity+json') && !req.accepts('*/*')) {    // non-browser client
            res.setHeader('Content-Type', 'application/activity+json');
            res.status(200).send(note);
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
              actor: actor,
              activitystream: notes,
              layout: 'public',
              domain: DOMAIN,
              user: USERNAME
            });
          }
        }
    } catch(err) {
        res.status(404).send();
    }
  }
});

router.get('/tags/:tag', async (req, res) => {
  // all posts referencing tag by the owner user
  const noteIds = INDEX.filter((i) => (i.actor === ActivityPub.actor.id) && i.hashtags.includes('#' + req.params.tag));
  // get full posts
  const posts = await Promise.all(noteIds.map(async (p) => {
    return await getNote(p.id);
  }));

  res.render('public/tag', {
    tag: req.params.tag,
    layout: 'public',
    me: ActivityPub.actor,
    actor: ActivityPub.actor,
    domain: DOMAIN,
    user: USERNAME,
    notes: posts
  });
});

router.get('/media/:id', async (req, res) => {
    let attachment = readMedia(req.params.id);
    if (attachment) {
        res.setHeader('Content-Type', attachment.type);
        let data = Buffer.from(attachment.data, 'base64');
        res.status(200).send(data);
    } else {
        res.status(404).send();
    }
});

