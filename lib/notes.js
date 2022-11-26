import path from 'path';
import fs from 'fs';
import debug from 'debug';
import md5 from 'md5';
import glob from 'glob';
import { fetchUser } from './users.js';
import {getAccount} from './account.js';
const logger = debug('notes');

const pathToFiles = path.resolve('./',`data/activitystream/`);
const pathToPosts = path.resolve('./',`data/posts/`);

export const createNote = (note) => {

    const noteFile = path.resolve('./',`data/activitystream/${ md5(note.id) }.json`);
    console.log('WRITE TO ', noteFile);
    fs.writeFileSync(noteFile, JSON.stringify(note, null, 2));

}

export const getActivityStream = async (limit, offset) => {
    const myaccount = getAccount();
    return new Promise((resolve, reject) => {
        glob(path.join(pathToFiles,'*.json'), async (err, files) => {
            let res = [];
            for (const f of files) {
            try {
                const post = JSON.parse(fs.readFileSync(path.resolve(pathToFiles,f)));
                const { actor } = await fetchUser(post.attributedTo);
                res.push({
                    note: post,
                    actor: actor
                });
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