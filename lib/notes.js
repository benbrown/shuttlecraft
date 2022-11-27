import path from 'path';
import fs, { lstat } from 'fs';
import debug from 'debug';
import md5 from 'md5';
import fetch from 'node-fetch';
import glob from 'glob';
import { fetchUser } from './users.js';
import {getAccount, getFollowing, addNotification, getNote, isReplyToMyPost, isReplyToFollowing} from './account.js';
import { INDEX, readJSONDictionary, writeJSONDictionary } from './storage.js';

const logger = debug('notes');

const pathToFiles = path.resolve('./',`data/activitystream/`);
const pathToPosts = path.resolve('./',`data/posts/`);

export const getLikesForNote = (guid) => {
    try {
        const noteFile = path.resolve(pathToPosts, `${ guid }.likes.json`);
        const buf = fs.readFileSync(noteFile);
        return JSON.parse(buf);
    } catch(err) {
        return {likes: [], boosts: []}
    }
}

export const getNoteGuid = (noteUrl) => {
    // extract guid from noteId
    // form of http://something.com/something/23u42938492
    // remove everything up til the last / 
    return noteUrl.replace(/.*\//,'');
}

export const recordLike = (request) => {

    const actor = request.actor;
    const noteId = request.object;

    const guid = getNoteGuid(noteId);
    console.log('INCOMING LIKE FOR', guid);

    const likes = getLikesForNote(guid);
    if (likes.likes.indexOf(actor) < 0) {
        likes.likes.push(actor);
        const noteFile = path.resolve(pathToPosts, `${ guid }.likes.json`);
        const buf = fs.writeFileSync(noteFile,JSON.stringify(likes, null, 2));
        addNotification(request);
    }

}

export const recordBoost = (request) => {

    const actor = request.actor;
    const noteId = request.object;

    const guid = getNoteGuid(noteId);
    console.log('INCOMING BOOST FOR', guid);

    const likes = getLikesForNote(guid);
    if (likes.boosts.indexOf(actor) < 0) {
        likes.boosts.push(actor);
        const noteFile = path.resolve(pathToPosts, `${ guid }.likes.json`);
        const buf = fs.writeFileSync(noteFile,JSON.stringify(likes, null, 2));
        addNotification(request);
    }

}


export const recordUndoLike = (request) => {

    const actor = request.actor;
    const noteId = request.object;

    const guid = getNoteGuid(noteId);

    console.log('INCOMING LIKE FOR', guid);

    const likes = getLikesForNote(guid);
    likes.likes = likes.likes.filter((a) => a !== actor);
    const noteFile = path.resolve(pathToPosts, `${ guid }.likes.json`);
    const buf = fs.writeFileSync(noteFile,JSON.stringify(likes, null, 2));

}

export const noteExists = (noteId) => {
    const guid = getNoteGuid(noteId);
    // TODO: should check url structure too
    return fs.existsSync(path.resolve(pathToPosts, `${ guid }.json`));
}

export const createActivity = (note) => {

    const noteFile = path.resolve('./',`data/activitystream/${ md5(note.id) }.json`);
    console.log('WRITE TO ', noteFile);
    if (!fs.existsSync(noteFile)) {
        INDEX.push({
            type: 'activity', // someone else
            id: note.id,
            actor: note.attributedTo,
            published: new Date(note.published).getTime(),
            inReplyTo: note.inReplyTo,
        });
    }    
    fs.writeFileSync(noteFile, JSON.stringify(note, null, 2));


}

export const getActivity = async (id) => {

    const noteFile = path.resolve('./',`data/activitystream/${ md5(id) }.json`);
    if (fs.existsSync(noteFile)) {
        return readJSONDictionary(noteFile);
    } else {
        return fetchActivity(id);
    }
}

export const fetchActivity = async (activityId) => {
    logger('FETCH ',activityId);
    const query = await fetch(activityId, { headers: {'Accept':'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'}});
    if (query.ok) {   
        const activity = await query.json();
        createActivity(activity);
        return activity;
    } else {
        throw new Error('could not get post', activityId);
    }
}

export const getActivityStream2 = async (limit, offset) => {
    const myaccount = getAccount();
    const following = getFollowing();
    return new Promise(async (resolve, reject) => {

        glob(path.join(pathToFiles,'*.json'), async (err, files) => {
            let res = [];
            for (const f of files) {
                try {
                    const post = JSON.parse(fs.readFileSync(path.resolve(pathToFiles,f)));
                    // - not a reply...
                    // - a post that that is from someone you follow, and is a reply to a post from someone you follow (in feed)
                    // - a post that is from someone you follow, but is a reply to a post from someone you do not follow (should be ignored?)
                    if (following.indexOf(post.attributedTo) >= 0) {
                        if (!post.inReplyTo || isReplyToMyPost(post) || await isReplyToFollowing(post, following)) {
                            const { actor } = await fetchUser(post.attributedTo);
                            res.push({
                                note: post,
                                actor: actor
                            });
                        }
                    } else {
                        console.log('post ignored - not in followers.', f);
                    }
                } catch(err) {
                    console.error('failed to parse',f);
                    console.error(err);
                }
            }

            glob(path.join(pathToPosts,'*.json'), async (err, files) => {

                for (const f of files) {
                    try {
                        const post = JSON.parse(fs.readFileSync(path.resolve(pathToFiles,f)));
                        res.push({
                            note: post,
                            actor: myaccount.actor
                        });
                    } catch(err) {
                        console.error('failed to parse',f);
                        console.error(err);
                    }
                }

                res = res.sort((a, b) => {
                    const ad = new Date(a.note.published).getTime();
                    const bd = new Date(b.note.published).getTime();
                    if (ad > bd) {
                        return -1;
                    } else if (ad < bd) {
                        return 1;
                    } else {
                        return 0;
                    }
                });
                resolve(res);

            });
         });
    });

}

export const getActivityStream = async (limit, offset) => {
    const myaccount = getAccount();
    const following = getFollowing();

    // sort all known posts by date quickly
    const sortedSlice = INDEX.sort((a, b) => {
        if (a.published > b.published) {
            return -1;
        } else if (a.published < b.published) {
            return 1;
        } else {
            return 0;
        }
    });

    const res = [];
    let px;
    for (px = offset; px < sortedSlice.length; px++) {
        const p = sortedSlice[px];
        if (p.type == 'activity') {
            if (following.indexOf(p.actor) >= 0) {
                if (!p.inReplyTo || isReplyToMyPost(p) || await isReplyToFollowing(p, following)) {
                    try {
                        const { actor } = await fetchUser(p.actor);
                        const post = await getActivity(p.id);
                        res.push({
                            note: post,
                            actor: actor
                        });
                    } catch(err) {
                        console.log('error while loading post from index');
                    }
                } else {
                    // disgard replies i don't care about
                    console.log('DISGARDING POST');
                }
            } else {
                console.log('not from follower');
            }
        } else {
            const post = await getNote(getNoteGuid(p.id));
            res.push({
                note: post,
                actor: myaccount.actor
            });
        }
        if (res.length == limit) {
            break;
        }
    };

    return {
        activitystream: res,
        next: px,
    }
}


