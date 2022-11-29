import path from 'path';
import fs from 'fs';
import debug from 'debug';
import fetch from 'node-fetch';
import { fetchUser } from './users.js';
import {getAccount, getFollowing, addNotification, getNote, isReplyToMyPost, isReplyToFollowing} from './account.js';
import { INDEX, readJSONDictionary, writeJSONDictionary, pathToPosts, createFileName, getFileName, getLikesFileName } from './storage.js';

const logger = debug('ono:notes');


export const getLikesForNote = (id) => {
    const fileName = getLikesFileName(id);
    return readJSONDictionary(fileName,{likes: [], boosts: []});
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

    logger('INCOMING LIKE FOR', noteId);

    const likes = getLikesForNote(noteId);
    if (likes.likes.indexOf(actor) < 0) {
        likes.likes.push(actor);
        const fileName = getLikesFileName(noteId);
        writeJSONDictionary(fileName, likes);
        addNotification(request);
    }

}

export const recordBoost = (request) => {

    const actor = request.actor;
    const noteId = request.object;

    logger('INCOMING BOOST FOR', noteId);

    const likes = getLikesForNote(noteId);
    if (likes.boosts.indexOf(actor) < 0) {
        likes.boosts.push(actor);
        const fileName = getLikesFileName(noteId);
        writeJSONDictionary(fileName, likes);
        addNotification(request);
    }

}


export const recordUndoLike = (request) => {

    const actor = request.actor;
    const noteId = request.object;

    const guid = getNoteGuid(noteId);

    logger('INCOMING LIKE FOR', noteId);

    const likes = getLikesForNote(noteId);
    likes.likes = likes.likes.filter((a) => a !== actor);
    const fileName = getLikesFileName(noteId);
    writeJSONDictionary(fileName, likes);

}

export const noteExists = (noteId) => {
    try {
        return fs.existsSync(getFileName(noteId));
    } catch(err) {
        return false;
    }
}

export const createActivity = (note) => {

    const noteFile = createFileName(note);
    if (!fs.existsSync(noteFile)) {
        INDEX.push({
            type: 'activity', // someone else
            id: note.id,
            actor: note.attributedTo,
            published: new Date(note.published).getTime(),
            inReplyTo: note.inReplyTo,
        });
    }    
    writeJSONDictionary(noteFile, note);
}

export const getActivity = async (id) => {

    try {
        if (noteExists(id)) {
            const noteFile = getFileName(id);
            return readJSONDictionary(noteFile, {});
        } else {
            return fetchActivity(id);
        }
    } catch(err) {
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
        console.error('Failed to fetch', query.statusText);
        throw new Error('could not get post', activityId);
    }
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
                        console.error('error while loading post from index');
                    }
                } else {
                    // disgard replies i don't care about
                }
            } else {
                // disregard not from following
            }
        } else {
            const post = await getNote(p.id);
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


