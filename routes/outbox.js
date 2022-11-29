import express from 'express';
export const router = express.Router();
import dotenv from 'dotenv';
dotenv.config();

import { getOutboxPosts } from '../lib/account.js';

const { DOMAIN } = process.env;


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