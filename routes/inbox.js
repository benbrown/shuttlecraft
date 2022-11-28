import express from 'express';
export const router = express.Router();
import { sendAcceptMessage, validateSignature } from '../lib/users.js';
import { addFollower, removeFollower, follow, isReplyToMyPost, addNotification } from '../lib/account.js';
import { createActivity, recordLike, recordUndoLike, recordBoost, noteExists, getActivity} from '../lib/notes.js';
import debug from 'debug';
const logger = debug('inbox');

router.post('/', function (req, res) {

    let domain = req.app.get('domain');
    const actor = new URL(req.body.actor);
    let targetDomain = actor.hostname;
    const incomingRequest = req.body;
    let signature;

    if (incomingRequest.signature) {
        signature = incomingRequest.signature;
    } else {
        signature = req.header('Signature');        
    }

    if (incomingRequest) {
        // FIRST, validate the actor
        if (incomingRequest.type==='Delete') {
            return res.status(200).send();
        }
        if (validateSignature(req.body.actor, req)) {
            switch (incomingRequest.type) {
                case 'Follow':
                    logger('Incoming follow request');
                    addFollower(incomingRequest);
                    
                    // TODO: should wait to confirm follow acceptance?
                    sendAcceptMessage(incomingRequest);
                    break;
                case 'Undo':
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
                            console.log('Unknown undo type');
                    }
                    break;
                case 'Accept':
                    switch (incomingRequest.object.type) {
                        case 'Follow':
                            logger('Incoming follow request');
                            follow(incomingRequest.actor);
                            break;
                        default:
                            console.log('Unknown undo type');
                    }
                    break;
                case 'Like':
                    recordLike(incomingRequest);
                    break;
                case 'Announce':
                    // determine if this is a boost on MY post
                    // or someone boosting a post into my feed. DIFFERENT!
                    if (noteExists(incomingRequest.object)) {
                        recordBoost(incomingRequest);
                    } else {
                        // fetch the boosted post if it doesn't exist
                        getActivity(incomingRequest.object);
                        
                        // log the boost itself to the activity stream
                        createActivity(incomingRequest);
                    }
                    break;
                case 'Create':
                    console.log('incoming create');

                    // determine what type of post this is, if it should show up, etc.
                    // - a post that is a reply to your own post from someone you follow (notification AND feed)
                    // - a post that is a reply to your own post from someone you do not follow (notification only)
                    // - a post that that is from someone you follow, and is a reply to a post from someone you follow (in feed)
                    // - a post that is from someone you follow, but is a reply to a post from someone you do not follow (should be ignored?)
                    // - a mention from a following (notification and feed)
                    // - a mention from a stranger (notification only)
                    if (isReplyToMyPost(incomingRequest.object)) {
                        // TODO: What about replies to replies? should we traverse up a bit?
                        createActivity(incomingRequest.object);
                        addNotification({
                            type: 'Reply',
                            actor: incomingRequest.object.attributedTo,
                            object: incomingRequest.object.id
                        });
                    } else if (false) {
                        // TODO: detect mentions!!
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
                default:
                    console.log('Unknown request type:', incomingRequest.type);
            }
        } else {
            console.log('Signature failed:', incomingRequest);
            return res.status(501).send('Invalid signature');
        }
    } else {
        console.log('Unknown request format:', incomingRequest);
    }
    return res.status(200).send();
  });