import express from 'express';
export const router = express.Router();
import debug from 'debug';
import { getNote, isMyPost, getAccount } from '../lib/account.js';
import { getActivity, getNoteGuid } from '../lib/notes.js';
import { INDEX } from '../lib/storage.js';
import { fetchUser } from '../lib/users.js';

const logger = debug('notes');

const unrollThread = async (noteId, results = [], ascend=true, descend=true) => {
  let post, actor;
  if (isMyPost({id:noteId})) {
    post = await getNote(getNoteGuid(noteId));
    let account = getAccount();
    actor = account.actor;
  } else {
    post = await getActivity(noteId);
    let account = await fetchUser(post.attributedTo);
    actor = account.actor;
  }

  results.push({
    note:  post,
    actor: actor,
   });

  // if this is a reply, get the parent and any other parents straight up the chain
  // this does NOT get replies to those parents that are not part of the active thread right now.
  if (ascend && post.inReplyTo) {
    await unrollThread(post.inReplyTo, results, true, false);
  }

  // now, find all posts that are below this one...
  if (descend) {
    const replies = INDEX.filter((p) => p.inReplyTo === noteId);  
    for (let r = 0; r < replies.length; r++) {
      await unrollThread(replies[r].id, results, false, true);
    }
  }

  return results;

}


router.get('/notes/:guid',  async (req, res) => {
  let guid = req.params.guid;
  if (!guid) {
    return res.status(400).send('Bad request.');
  }
  else {
    const note = await getNote(guid);
    if (note === undefined) {
      return res.status(404).send(`No record found for ${guid}.`);
    } else {

      const notes = await unrollThread(note.id);
      notes.sort((a, b) => {
        const ad = new Date(a.published).getTime();
        const bd = new Date(b.published).getTime();
        if (ad > bd) {
            return 1;
        } else if (ad < bd) {
            return -1;
        } else {
            return 0;
        }
      });
      res.render('note', { activitystream: notes, layout: 'public' });        
    }
  }
});



