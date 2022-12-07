import express from 'express';
export const router = express.Router();
import {
  getNote
} from '../lib/account.js';
import dotenv from 'dotenv';
dotenv.config();

const {
  DOMAIN
} = process.env;

router.get('/:guid', async (req, res) => {
  let guid = req.params.guid;
  if (!guid) {
    return res.status(400).send('Bad request.');
  } else {
    const note = await getNote(`https://${ DOMAIN }/m/${ guid }`);
    if (note === undefined) {
      return res.status(404).send(`No record found for ${guid}.`);
    } else {
      if (req.headers.accept ? .includes('application/ld+json; profile="https://www.w3.org/ns/activitystreams"')) {
        res.json(note);
      } else {
        res.redirect(note.url);
      }
    }
  }
});