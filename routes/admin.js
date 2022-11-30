import { getActivity, getActivitySince, getActivityStream, getNoteGuid } from '../lib/notes.js';
import express from 'express';
export const router = express.Router();
import debug from 'debug';
import { getFollowers, getFollowing, createNote, getNotifications, getNote, getLikes, writeLikes } from '../lib/account.js';
import { sendFollowMessage, fetchUser, sendLikeMessage, sendUndoLikeMessage } from '../lib/users.js';
import { INDEX } from '../lib/storage.js';
const logger = debug('ono:admin');

router.get('/index', async(req, res) => {
    res.json(INDEX);
});

router.get('/poll', async(req, res) => {

    const sincePosts = new Date(req.cookies.latestPost).getTime();
    const sinceNotifications = parseInt(req.cookies.latestNotification);
    const notifications = getNotifications().filter((n) => n.time > sinceNotifications);
    const { activitystream } = await getActivitySince(sincePosts, true);
    res.json({newPosts: activitystream.length, newNotifications: notifications.length});

});


router.get('/followers', async(req, res) => {
    const following = await Promise.all(getFollowing().map(async (f) => {
        const acct = await fetchUser(f);
        acct.actor.isFollowing = true; // duh
        return acct.actor;
    }));
    const followers = await Promise.all(getFollowers().map(async (f) => {
        const acct = await fetchUser(f);
        acct.actor.isFollowing = following.find((p) => p.id === f);
        return acct.actor;
    }));

    if (req.query.json) {
        res.json(notes);
    } else {
        res.render('followers', {layout: 'private', followers: followers, following: following, followersCount: followers.length, followingCount: following.length});
    }

});

router.get('/following', async(req, res) => {
    const following = await Promise.all(getFollowing().map(async (f) => {
        const acct = await fetchUser(f);
        acct.actor.isFollowing = true; // duh
        return acct.actor;
    }));
    const followers = await Promise.all(getFollowers().map(async (f) => {
        const acct = await fetchUser(f);
        acct.actor.isFollowing = following.find((p) => p.id === f);
        return acct.actor;
    }));

    if (req.query.json) {
        res.json(notes);
    } else {
        res.render('following', {layout: 'private', followers: followers, following: following, followersCount: followers.length, followingCount: following.length});
    }
});


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

        if (n.actor) {
            n.actor.isFollowing = (following.find((f)=>f===n.actor.id));

            // determine if this post has already been liked
            n.note.isLiked = (likes.find((l) => l.activityId === n.note.id)) ? true : false;
        } else {
            console.error('Post without an actor found', n.note.id);
        }

        return n;
    })); 

    if (req.query.json) {
        res.json(notes);
    } else {
        res.render('dashboard', {layout: 'private', next: next, activitystream: notes, followers: followers, following: following, followersCount: followers.length, followingCount: following.length});
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
            note = await getNote(notification.notification.object);
        }
        if (notification.notification.type === 'Reply') {
            note = await getActivity(notification.notification.object);
            original = await getNote(note.inReplyTo);
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
    // TODO: this is probably supposed to be a post to /api/outbox
    console.log('INCOMING POST', req.body);
    const post = await createNote(req.body.post, req.body.cw);
    // return html partial of the new post for insertion in the feed
    res.status(200).render('partials/note', {note: post, actor: req.app.get('account'),layout: null});
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