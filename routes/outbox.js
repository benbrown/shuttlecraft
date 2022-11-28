import express from 'express';
export const router = express.Router();
import fs from 'fs';
import path from 'path';
import debug from 'debug';
const logger = debug('inbox');
import { INDEX } from '../lib/storage.js';
import { getNote, getOutboxPosts } from '../lib/account.js';
import { getNoteGuid, } from '../lib/notes.js';

const config = JSON.parse(fs.readFileSync('./config.json'));
const { USER, PASS, DOMAIN, PRIVKEY_PATH, CERT_PATH, PORT } = config;


router.get('/', async (req, res) => {
    const offset = parseInt(req.query.offset) || 0;
    const {total, posts } = await getOutboxPosts(offset);

    let outboxCollection = {
        "type":"OrderedCollection",
        "totalItems":total,
        "id":`https://${DOMAIN}/api/outbox`,
        "first": {
            "type":"OrderedCollectionPage",
            "totalItems":posts.length,
            "partOf":`https://${DOMAIN}/api/outbox`,
            "next": `https://${DOMAIN}/api/outbox?offset=${offset+10}`,
            "orderedItems": posts,
            "id":`https://${DOMAIN}/api/outbox?offset=${offset}`
        },
        "@context":["https://www.w3.org/ns/activitystreams"]
    };

    res.json(outboxCollection);

});