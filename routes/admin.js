import { getActivityStream, getNoteGuid } from '../lib/notes.js';
import express from 'express';
export const router = express.Router();
import debug from 'debug';
import { getFollowers, getFollowing, createNote, getNotifications, getNote } from '../lib/account.js';
import { sendFollowMessage, fetchUser } from '../lib/users.js';
const logger = debug('admin');

router.get('/', async (req, res) => {

    const notes = await getActivityStream();
    const followers = await getFollowers();
    const following = await getFollowing();

    const offset = req.query.offset || 0;

    res.render('dashboard', {layout: 'private', activitystream: notes.splice(offset,offset+10), followers: followers.length, following: following.length});
});

router.get('/notifications', async (req, res) => {
    const following = await getFollowing();
    const notifications = await Promise.all(getNotifications().map(async (notification) => {
        const {actor} = await fetchUser(notification.notification.actor);
        let note;
        // TODO: check if user is in following list
        if (notification.notification.type === 'Like' || notification.notification.type === 'Announce') {
            note = await getNote(getNoteGuid(notification.notification.object));
        }
        return {
            actor,
            note,
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

router.post('/follow', async (req, res) => {

    console.log('INCOMING follow', req.body);
    const { actor } = await fetchUser(req.body.handle);
    if (actor) {
        const post = await sendFollowMessage(actor.id);
        res.status(200).json(post);
    } else {
        res.status(404).send('not found');
    }
});