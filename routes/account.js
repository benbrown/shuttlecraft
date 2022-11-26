import express from 'express';
import { getFollowers } from '../lib/account.js';
export const router = express.Router();


router.get('/:name', function (req, res) {
  let name = req.params.name;
  if (!name) {
    return res.status(400).send('Bad request.');
  }
  else {
    let domain = req.app.get('domain');
    let username = name;
    name = `https://${domain}/u/${name}`;

    if (name != req.app.get('account').actor.id) {
      return res.status(404).send(`No record found for ${name}.`);
    }
    else {
      let tempActor = req.app.get('account').actor;
      // Added this followers URI for Pleroma compatibility, see https://github.com/dariusk/rss-to-activitypub/issues/11#issuecomment-471390881
      // New Actors should have this followers URI but in case of migration from an old version this will add it in on the fly
      if (tempActor.followers === undefined) {
        tempActor.followers = `https://${domain}/u/${username}/followers`;
      }
      res.json(tempActor);
    }
  }
});

router.get('/:name/followers', function (req, res) {
  let name = req.params.name;
  if (!name) {
    return res.status(400).send('Bad request.');
  }
  else {
    let domain = req.app.get('domain');
    
    name = `https://${domain}/u/${name}`;

    if (name != req.app.get('account').actor.id) {
      return res.status(404).send(`No record found for ${name}.`);
    } else {
        let followers = getFollowers();
        let followersCollection = {
        "type":"OrderedCollection",
        "totalItems":followers.length,
        "id":`https://${domain}/u/${name}/followers`,
        "first": {
            "type":"OrderedCollectionPage",
            "totalItems":followers.length,
            "partOf":`https://${domain}/u/${name}/followers`,
            "orderedItems": followers,
            "id":`https://${domain}/u/${name}/followers?page=1`
        },
        "@context":["https://www.w3.org/ns/activitystreams"]
        };
        res.json(followersCollection);
    }
  }
});
