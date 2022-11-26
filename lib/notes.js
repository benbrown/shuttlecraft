import path from 'path';
import fs from 'fs';
import debug from 'debug';
import md5 from 'md5';
import glob from 'glob';
import { fetchUser } from './users.js';
import {getAccount, getFollowing, addNotification} from './account.js';
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

export const createNote = (note) => {

    const noteFile = path.resolve('./',`data/activitystream/${ md5(note.id) }.json`);
    console.log('WRITE TO ', noteFile);
    fs.writeFileSync(noteFile, JSON.stringify(note, null, 2));

}

export const getActivityStream = async (limit, offset) => {
    const myaccount = getAccount();
    const following = getFollowing();
    return new Promise((resolve, reject) => {
        glob(path.join(pathToFiles,'*.json'), async (err, files) => {
            let res = [];
            for (const f of files) {
            try {
                const post = JSON.parse(fs.readFileSync(path.resolve(pathToFiles,f)));
                if (following.indexOf(post.attributedTo) >= 0) {
                    const { actor } = await fetchUser(post.attributedTo);
                    res.push({
                        note: post,
                        actor: actor
                    });
                } else {
                    console.log('post ignored - not in followers.');
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