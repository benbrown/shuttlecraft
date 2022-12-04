import path from 'path';
import fs from 'fs';
import debug from 'debug';
import { fetchUser, fetchSigned } from './users.js';
import {getAccount, addNotification, getNote, isReplyToMyPost, isReplyToFollowing, isBlocked, isFollowing} from './account.js';
import { INDEX, readJSONDictionary, writeJSONDictionary, isIndexed, addActivityToIndex, addFailureToIndex, createFileName, getFileName, getLikesFileName } from './storage.js';

const logger = debug('ono:notes');


export const getLikesForNote = (id) => {
    const fileName = getLikesFileName(id);
    return readJSONDictionary(fileName,{likes: [], boosts: []});
}

export const getReplyCountForNote = (id) => {
    return INDEX.filter((i)=>i.inReplyTo===id).length;
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

export const createActivity = (note) => {

    const noteFile = createFileName(note);
    if (!fs.existsSync(noteFile)) {
        console.log('ADD TO INDEX', note.id);
        addActivityToIndex(note);
    }    
    writeJSONDictionary(noteFile, note);
}

export const getActivity = async (id) => {

    try {
        if (isBlocked(id)) {
            throw new Error('Content is from blocked domain', id);
        }
        const indexed = isIndexed(id);
        if (indexed) { // if is cached, no need to check for file
            if (indexed.type === 'fail') {
                // TODO: could retry after a while...
                throw new Error('Activity was unreachable', indexed);
            } else {
                const noteFile = getFileName(id);
                return readJSONDictionary(noteFile, {});
            }
        } else {
            return await fetchActivity(id);
        }
    } catch(err) {
        console.error('Failed to getActivity', err);
        throw err;
    }
}

export const fetchActivity = async (activityId) => {
    logger('FETCH ',activityId);
    const query = await fetchSigned(activityId, {});
    if (query.ok) {   
        const activity = await query.json();
        createActivity(activity);
        return activity;
    } else {
        console.error('Failed to fetch', activityId, 'REASON:', query.statusText);
        addFailureToIndex({
            id: activityId,
            time: new Date().getTime(),
            status: query.status,
        });
        throw new Error('could not get post', activityId);
    }
}

export const getActivityStream = async (limit, offset) => {
    const myaccount = getAccount();

    // sort all known posts by date quickly
    const sortedSlice = INDEX.filter((p)=>p.type!=='fail').sort((a, b) => {
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
            if (isFollowing(p.actor)) {
                if (!p.inReplyTo || isReplyToMyPost(p) || await isReplyToFollowing(p)) {
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


export const getActivitySince = async (since, excludeSelf = false) => {
    const myaccount = getAccount();

    // sort all known posts by date quickly
    const sortedSlice = INDEX.filter((p)=>p.type!=='fail').sort((a, b) => {
        if (a.published > b.published) {
            return -1;
        } else if (a.published < b.published) {
            return 1;
        } else {
            return 0;
        }
    }).filter((p)=>{
        if (excludeSelf && p.actor === myaccount.actor.id) {
                return false;
        }
        return p.published > since; 
     });

    const res = [];
    let px;
    for (px = 0; px < sortedSlice.length; px++) {
        const p = sortedSlice[px];
        if (p.type == 'activity') {
            if (isFollowing(p.actor)) {
                if (!p.inReplyTo || isReplyToMyPost(p) || await isReplyToFollowing(p)) {
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
    };

    return {
        activitystream: res,
    }
}

