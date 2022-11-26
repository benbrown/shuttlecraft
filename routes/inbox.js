import express from 'express';
export const router = express.Router();
import { sendAcceptMessage, validateSignature } from '../lib/users.js';
import { addFollower, removeFollower, follow } from '../lib/account.js';
import { createNote } from '../lib/notes.js';
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
        if (validateSignature(req.body.actor, req)) {
            switch (incomingRequest.type) {
                case 'Follow':
                    logger('Incoming follow request');
                    addFollower(incomingRequest.actor);

                    // TODO: should wait to confirm follow acceptance?
                    sendAcceptMessage(incomingRequest);
                    break;
                case 'Undo':
                    switch (incomingRequest.object.type) {
                        case 'Follow':
                            logger('Incoming unfollow request');
                            removeFollower(incomingRequest.actor);
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
                    break;
                case 'Announce':
                    break;
                case 'Create':
                    console.log('incoming create');
                    createNote(incomingRequest.object);
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