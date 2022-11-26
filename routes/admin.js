import { getActivityStream } from '../lib/notes.js';
import express from 'express';
export const router = express.Router();
import debug from 'debug';
import { getFollowers, getFollowing, createNote } from '../lib/account.js';
const logger = debug('admin');

router.get('/', async (req, res) => {

    const notes = await getActivityStream();
    const followers = await getFollowers();
    const following = await getFollowing();
    // res.json(notes);
    res.render('dashboard', {layout: 'private', activitystream: notes, followers: followers.length, following: following.length});
});
router.get('/raw', async (req, res) => {

    const notes = await getActivityStream();
    res.json(notes);
    // res.render('dashboard', {layout: 'private', notes: notes});
});

router.post('/post', async (req, res) => {

    console.log('INCOMING POST', req.body);
    const post = await createNote(req.body.post, req.body.cw);
    res.status(200).json(post);

});