import { getActivity, getActivityStream, getNoteGuid } from '../lib/notes.js';
import express from 'express';
export const router = express.Router();
import debug from 'debug';
import { getFollowers, getFollowing, createNote, getNotifications, getNote, getLikes, writeLikes } from '../lib/account.js';
import { sendFollowMessage, fetchUser, sendLikeMessage, sendUndoLikeMessage } from '../lib/users.js';
import e from 'express';
const logger = debug('admin');

router.get('/', async (req, res) => {

    const followers = await getFollowers();
    const following = await getFollowing();
    const likes = await getLikes();
    const offset = parseInt(req.query.offset) || 0;
    const {activitystream, next} = await getActivityStream(10, offset);

    const notes = await Promise.all(activitystream.map(async (n) => {
        // handle boosted posts
        if (n.note.type === 'Announce') {
            n.boost = n.note;
            n.booster = n.actor;
            try {
            n.note = await getActivity(n.boost.object);
            const acct = await fetchUser(n.note.attributedTo);
            n.actor = acct.actor;
            } catch(err) {
                console.error('Could not fetch boosted post...', n.boost.object);
                return;
            }
        }

        n.actor.isFollowing = (following.find((f)=>f===n.actor.id));

        // determine if this post has already been liked
        n.note.isLiked = (likes.find((l) => l.activityId === n.note.id)) ? true : false;

        return n;
    })); 

    if (req.query.json) {
        res.json(notes);
    } else {
        res.render('dashboard', {layout: 'private', next: next, activitystream: notes, followers: followers.length, following: following.length});
    }
});

router.get('/notifications', async (req, res) => {
    const following = await getFollowing();
    const likes = await getLikes();
    const notifications = await Promise.all(getNotifications().map(async (notification) => {
        const {actor} = await fetchUser(notification.notification.actor);
        let note, original;
        // TODO: check if user is in following list
        actor.isFollowing = (following.find((f)=>f===actor.id));

        if (notification.notification.type === 'Like' || notification.notification.type === 'Announce') {
            note = await getNote(getNoteGuid(notification.notification.object));
        }
        if (notification.notification.type === 'Reply') {
            note = await getActivity(notification.notification.object);
            original = await getNote(getNoteGuid(note.inReplyTo));
            note.isLiked = (likes.find((l) => l.activityId === note.id)) ? true : false;
        }
        return {
            actor,
            note,
            original,
            ...notification,
        }
    }));
    
    res.render('notifications', {layout: 'private', notifications: notifications.reverse()});
});

router.post('/post', async (req, res) => {

    console.log('INCOMING POST', req.body);
    const post = await createNote(req.body.post, req.body.cw);
    res.status(200).json(post);

});


router.get('/lookup', async (req, res) => {
    const { actor } = await fetchUser(req.query.handle);
    if (actor) {
        const following = await getFollowing();
        actor.isFollowing = (following.find((f)=>f===actor.id));
        res.status(200).render('partials/byline',{actor, layout: null});
    } else {
        res.status(200).send('No user found');
    }
});

router.post('/follow', async (req, res) => {

    console.log('INCOMING follow', req.body);
    const { actor } = await fetchUser(req.body.handle);
    if (actor) {
        const following = await getFollowing();
        if (!following.find((f)=>f===actor.id)) {
            const post = await sendFollowMessage(actor.id);
        }

        // TODO: send unfollow, etc
        res.status(200).json({isFollowed: true});
    } else {
        res.status(404).send('not found');
    }
});

router.post('/like', async (req, res) => {
    console.log('INCOMING like', req.body);
    const activityId = req.body.post;
    let likes = getLikes();
    if (!likes.find((l)=>l.activityId===activityId)) {

        const guid = await sendLikeMessage(activityId);

        likes.push({
            id: guid,
            activityId,
        });
        res.status(200).json({isLiked: true});
    } else {
        // extract so we can send an undo record
        const recordToUndo = likes.find((l)=>l.activityId===activityId);
        await sendUndoLikeMessage(activityId, recordToUndo.id);

        // filter out the one we are removing
        likes = likes.filter((l)=>l.activityId!==activityId);

        // send status back
        res.status(200).json({isLiked: false});
    }
    writeLikes(likes);
});