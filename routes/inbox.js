import express from 'express';
import { ActivityPub } from '../lib/ActivityPub.js';
import { fetchUser } from '../lib/users.js';
import {
  acceptDM,
  addFollower,
  removeFollower,
  follow,
  isReplyToMyPost,
  addNotification,
  isMyPost,
  isBlocked,
  addressedOnlyToMe,
  isMention,
  deleteObject
} from '../lib/account.js';
import { createActivity, recordLike, recordUndoLike, recordBoost, getActivity } from '../lib/notes.js';
import debug from 'debug';
import { isIndexed } from '../lib/storage.js';
const logger = debug('ono:inbox');

/**
 * Express.js router for handling incoming ActivityPub requests.
 *
 * @typedef {Object} ActivityPubRouter
 * @property {Function} processActivity - Route handler for processing incoming ActivityPub requests.
 *
 * @example
 * // Example usage:
 * import { router as activityPubRouter } from './activityPubRouter';
 * app.use('/activitypub', activityPubRouter);
 */
export const router = express.Router();

/**
 * Route handler for processing incoming ActivityPub requests.
 *
 * @function
 * @async
 * @param {Object} req - Express.js request object.
 * @param {Object} res - Express.js response object.
 * @returns {Promise<void>} Resolves with a success response or rejects with an error response.
 *
 * @throws {Error} Responds with a 403 Forbidden if the actor is blocked.
 * @throws {Error} Responds with a 403 Forbidden if the signature validation fails.
 *
 * @example
 * // Example route:
 * // POST /activitypub
 * activityPubRouter.post('/', activityPubHandlers.processActivity);
 */
router.post('/', async (req, res) => {
  /**
   * The incoming ActivityPub request payload.
   *
   * @type {Object}
   * @property {string} type - The type of the incoming request (e.g., 'Create', 'Follow', 'Like').
   * @property {Object} actor - The actor associated with the request.
   * @property {Object} object - The object of the request, containing the main content.
   */
  const incomingRequest = req.body;

  if (incomingRequest) {
    if (isBlocked(incomingRequest.actor)) {
      return res.status(403).send('');
    }

    logger('New message', JSON.stringify(incomingRequest, null, 2));
    logger('Looking up actor', incomingRequest.actor);

    /**
     * The user object obtained from fetching the actor of the incoming request.
     *
     * @type {Object}
     * @property {Object} actor - The actor object representing the user.
     */
    const { actor } = await fetchUser(incomingRequest.actor);

    // FIRST, validate the actor
    if (ActivityPub.validateSignature(actor, req)) {
      switch (incomingRequest.type) {
        case 'Delete':
          logger('Delete request');
          await deleteObject(actor, incomingRequest);
          break;
        case 'Follow':
          logger('Incoming follow request');
          addFollower(incomingRequest);

          // TODO: should wait to confirm follow acceptance?
          ActivityPub.sendAccept(actor, incomingRequest);
          break;
        case 'Undo':
          logger('Incoming undo');
          switch (incomingRequest.object.type) {
            case 'Follow':
              logger('Incoming unfollow request');
              removeFollower(incomingRequest.actor);
              break;
            case 'Like':
              logger('Incoming undo like request');
              recordUndoLike(incomingRequest.object);
              break;
            default:
              logger('Unknown undo type');
          }
          break;
        case 'Accept':
          switch (incomingRequest.object.type) {
            case 'Follow':
              logger('Incoming follow request');
              follow(incomingRequest);
              break;
            default:
              logger('Unknown undo type');
          }
          break;
        case 'Like':
          logger('Incoming like');
          recordLike(incomingRequest);
          break;
        case 'Announce':
          logger('Incoming boost');
          // determine if this is a boost on MY post
          // or someone boosting a post into my feed. DIFFERENT!
          if (
            isMyPost({
              id: incomingRequest.object
            })
          ) {
            recordBoost(incomingRequest);
          } else {
            // fetch the boosted post if it doesn't exist
            try {
              await getActivity(incomingRequest.object);
            } catch (err) {
              console.error('Could not fetch boosted post');
            }

            // log the boost itself to the activity stream
            try {
              createActivity(incomingRequest);
            } catch (err) {
              console.error('Could not fetch boosted post...');
            }
          }
          break;
        case 'Create':
          logger('incoming create');

          // determine what type of post this is, if it should show up, etc.
          // - a post that is a reply to your own post from someone you follow (notification AND feed)
          // - a post that is a reply to your own post from someone you do not follow (notification only)
          // - a post that that is from someone you follow, and is a reply to a post from someone you follow (in feed)
          // - a post that is from someone you follow, but is a reply to a post from someone you do not follow (should be ignored?)
          // - a mention from a following (notification and feed)
          // - a mention from a stranger (notification only)
          if (incomingRequest.object.directMessage === true || addressedOnlyToMe(incomingRequest)) {
            await acceptDM(incomingRequest.object, incomingRequest.object.attributedTo);
          } else if (isReplyToMyPost(incomingRequest.object)) {
            // TODO: What about replies to replies? should we traverse up a bit?
            if (!isIndexed(incomingRequest.object.id)) {
              createActivity(incomingRequest.object);
              addNotification({
                type: 'Reply',
                actor: incomingRequest.object.attributedTo,
                object: incomingRequest.object.id
              });
            } else {
              logger('already created reply');
            }
          } else if (isMention(incomingRequest.object)) {
            if (!isIndexed(incomingRequest.object.id)) {
              createActivity(incomingRequest.object);
              addNotification({
                type: 'Mention',
                actor: incomingRequest.object.attributedTo,
                object: incomingRequest.object.id
              });
            } else {
              logger('already created mention');
            }
          } else if (!incomingRequest.object.inReplyTo) {
            // this is a NEW post - most likely from a follower
            createActivity(incomingRequest.object);
          } else {
            // this is a reply
            // from a following
            // or from someone else who replied to a following?
            // the visibility should be determined on the feed
            // TODO: we may want to discard things NOT from followings
            // since they may never be seen
            // and we can always go fetch them...
            createActivity(incomingRequest.object);
          }

          break;
        case 'Update':
          createActivity(incomingRequest.object);
          break;
        default:
          logger('Unknown request type:', incomingRequest.type);
      }
    } else {
      logger('Signature failed:', incomingRequest);
      return res.status(403).send('Invalid signature');
    }
  } else {
    logger('Unknown request format:', incomingRequest);
  }
  return res.status(200).send();
});
