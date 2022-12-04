import { getActivity, getActivitySince, getActivityStream, getLikesForNote } from '../lib/notes.js';
import express from 'express';
export const router = express.Router();
import debug from 'debug';
import { getFollowers, getFollowing, writeFollowing, createNote, getNotifications, getNote, getLikes, writeLikes, getBoosts, writeBoosts, isFollowing } from '../lib/account.js';
import { sendFollowMessage, sendUndoFollowMessage, fetchUser, sendLikeMessage, sendUndoLikeMessage, sendBoostMessage, sendUndoBoostMessage, fetchOutbox } from '../lib/users.js';
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
        const acct = await fetchUser(f.actorId);
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
        const acct = await fetchUser(f.actorId);
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
    const boosts = await getBoosts();
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
            n.actor.isFollowing = isFollowing(n.actor.id);

            // determine if this post has already been liked
            n.note.isLiked = (likes.find((l) => l.activityId === n.note.id)) ? true : false;
            n.note.isBoosted = (boosts.find((l) => l.activityId === n.note.id)) ? true : false;

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
    const likes = await getLikes();
    const notifications = await Promise.all(getNotifications().map(async (notification) => {
        const {actor} = await fetchUser(notification.notification.actor);
        let note, original;
        // TODO: check if user is in following list
        actor.isFollowing = isFollowing(actor.id);

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
    const post = await createNote(req.body.post, req.body.cw,  req.body.inReplyTo);
    // return html partial of the new post for insertion in the feed
    res.status(200).render('partials/note', {note: post, actor: req.app.get('account').actor,layout: null});
});

router.get('/profile/:handle', async (req, res) => {
    const { actor } = await fetchUser(req.params.handle);
    const likes = await getLikes();
    const boosts = await getBoosts();

    if (actor) {
        actor.isFollowing = isFollowing(actor.id);
        const posts = (await fetchOutbox(actor)).filter((post) => {
            // filter to only include my posts
            // not boosts or other activity
            // TODO: support boosts
            return post.type==='Create';
        }).map((post) => {
            let note = post.object;
            // determine if this post has already been liked
            note.isLiked = (likes.find((l) => l.activityId === note.id)) ? true : false;
            note.isBoosted = (boosts.find((l) => l.activityId === note.id)) ? true : false;


            return {
                actor: actor,
                note: note,
            };
        });
        res.status(200).render('partials/profile',{actor, activitystream: posts, layout: 'private'});
    } else {
        res.status(200).send('No user found');
    }
});


router.get('/lookup', async (req, res) => {
    const { actor } = await fetchUser(req.query.handle);
    if (actor) {
        actor.isFollowing = isFollowing(actor.id);
        res.status(200).render('partials/personCard',{actor, layout: null});
    } else {
        res.status(200).send('No user found');
    }
});

router.post('/follow', async (req, res) => {

    console.log('INCOMING follow', req.body);
    const handle = req.body.handle;
    if (handle) {
        if (handle === req.app.get('account').actor.id) {
            console.log('Self follow DENIED!');
            return res.status(200).json({isFollowed: false});
        }
        const { actor } = await fetchUser(handle);
        if (actor) {
            const status = isFollowing(actor.id);
            if (!status) {
                const guid = await sendFollowMessage(actor.id);

                return res.status(200).json({isFollowed: true});

            } else {
                // send unfollow
                await sendUndoFollowMessage(actor.id, status.id);

                // todo: this should just be a function like removeFollowing

                let following = getFollowing();

                // filter out the one we are removing
                following = following.filter((l)=>l.actorId!==actor.id);
       
                writeFollowing(following);

                return res.status(200).json({isFollowed: false});
            }
        }
    }
    res.status(404).send('not found');
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

router.post('/boost', async (req, res) => {
    console.log('INCOMING like', req.body);
    const activityId = req.body.post;
    let boosts = getBoosts();
    if (!boosts.find((l)=>l.activityId===activityId)) {

        const guid = await sendBoostMessage(activityId);

        boosts.push({
            id: guid,
            activityId,
        });
        res.status(200).json({isBoosted: true});
    } else {
        // extract so we can send an undo record
        const recordToUndo = boosts.find((l)=>l.activityId===activityId);
        await sendUndoBoostMessage(activityId, recordToUndo.id);

        // filter out the one we are removing
        boosts = boosts.filter((l)=>l.activityId!==activityId);

        // send status back
        res.status(200).json({isBoosted: false});
    }
    writeBoosts(boosts);
});