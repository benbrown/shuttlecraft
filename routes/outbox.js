import express from 'express';
import dotenv from 'dotenv';

import { getOutboxPosts } from '../lib/account.js';

dotenv.config();

/**
 * Express.js router for handling requests related to the user's outbox.
 *
 * @typedef {Object} OutboxRouter
 * @property {Function} getOutbox - Route handler for retrieving the user's outbox posts.
 *
 * @example
 * // Example usage:
 * import { router as outboxRouter } from './outboxRouter';
 * app.use('/outbox', outboxRouter);
 */
export const router = express.Router();

// const {
//     DOMAIN
// } = process.env;

/**
 * Route handler for retrieving the user's outbox posts.
 *
 * @function
 * @async
 * @param {Object} req - Express.js request object.
 * @param {Object} res - Express.js response object.
 * @returns {Promise<void>} Resolves with the user's outbox collection or rejects with an error response.
 *
 * @throws {Error} Responds with a 400 Bad Request if the 'offset' query parameter is not a valid number.
 *
 * @example
 * // Example route:
 * // GET /outbox
 * outboxRouter.get('/', outboxHandlers.getOutbox);
 */
router.get('/', async (req, res) => {
  /**
   * The result object containing the total number of posts and an array of outbox posts.
   *
   * @type {Object}
   * @property {number} total - The total number of outbox posts.
   * @property {Array<Object>} posts - An array of outbox posts.
   */
  const { total, posts } = await getOutboxPosts(req.query.offset || 0);

  /**
   * The URL of the user's outbox.
   *
   * @type {string}
   */
  const outboxUrl = req.app.get('account').actor.outbox;

  /**
   * The representation of the outbox collection to be sent in the response.
   *
   * @type {Object}
   * @property {string} type - The type of the collection ('OrderedCollection' or 'OrderedCollectionPage').
   * @property {number} totalItems - The total number of items in the collection.
   * @property {string} id - The unique identifier for the collection.
   * @property {string} [first] - The URL of the first page of the collection.
   * @property {string} [partOf] - The URL of the main collection that this page is part of.
   * @property {string} [next] - The URL of the next page of the collection.
   * @property {string} [prev] - The URL of the previous page of the collection.
   * @property {Array<Object>} [orderedItems] - An array of ordered items in the collection.
   * @property {Array<string>} ['@context'] - The context of the collection.
   */
  const collection = {
    type: 'OrderedCollection',
    totalItems: total,
    id: outboxUrl,
    '@context': ['https://www.w3.org/ns/activitystreams']
  };

  // Check if the 'offset' query parameter is a valid number
  if (isNaN(req.query.offset)) {
    collection.first = `${outboxUrl}?offset=0`;
  } else {
    // Adjust collection properties for paginated results
    const offset = parseInt(req.query.offset);
    collection.type = 'OrderedCollectionPage';
    collection.id = `${outboxUrl}?offset=${offset}`;
    collection.partOf = outboxUrl;
    collection.next = `${outboxUrl}?offset=${offset + 10}`;
    if (offset - 10 > 0) {
      collection.prev = `${outboxUrl}?offset=${offset - 10}`;
    } else {
      collection.first = `${outboxUrl}?offset=0`;
    }

    // Transform each post into an ordered item in the collection
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

  // Send the outbox collection in the response
  res.json(collection);
});
