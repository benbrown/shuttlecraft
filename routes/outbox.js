import express from 'express';
export const router = express.Router();
import dotenv from 'dotenv';
dotenv.config();

import { getOutboxPosts } from '../lib/account.js';

const { DOMAIN } = process.env;

router.get('/', async (req, res) => {
  const { total, posts } = await getOutboxPosts(req.query.offset || 0);
  const outboxUrl = req.app.get('account').actor.outbox;

  let collection = {
    type: 'OrderedCollection',
    totalItems: total,
    id: outboxUrl,
    '@context': ['https://www.w3.org/ns/activitystreams']
  };

  if (isNaN(req.query.offset)) {
    collection.first = `${outboxUrl}?offset=0`;
  } else {
    const offset = parseInt(req.query.offset);
    collection.type = 'OrderedCollectionPage';
    collection.id = `${outboxUrl}?offset=${offset}`;
    collection.partOf = outboxUrl;
    collection.next = `${outboxUrl}?offset=${offset + 10}`;
    // todo: stop at 0
    if (offset - 10 > 0) {
      collection.prev = `${outboxUrl}?offset=${offset - 10}`;
    } else {
      collection.first = `${outboxUrl}?offset=0`;
    }
    collection.orderedItems = posts;
    collection.orderedItems = collection.orderedItems.map(activity => {
      return {
        id: `${activity.id}/activity`,
        type: 'Create',
        actor: activity.attributedTo,
        published: activity.published,
        to: activity.to,
        cc: activity.cc,
        object: activity
      };
    });
  }

  res.json(collection);
});
