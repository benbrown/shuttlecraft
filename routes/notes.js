import express from 'express';
export const router = express.Router();
import debug from 'debug';
import { getNote } from '../lib/account.js';
const logger = debug('notes');

router.get('/:guid',  async (req, res) => {
  let guid = req.params.guid;
  if (!guid) {
    return res.status(400).send('Bad request.');
  }
  else {
    const note = await getNote(guid);
    if (note === undefined) {
      return res.status(404).send(`No record found for ${guid}.`);
    }
    else {
      res.json(note);
    }
  }
});
