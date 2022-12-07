import express from 'express';
import {
  getFollowers
} from '../lib/account.js';
export const router = express.Router();


router.get('/:name', function (req, res) {
  let name = req.params.name;
  if (!name) {
    return res.status(400).send('Bad request.');
  } else {
    let domain = req.app.get('domain');
    let username = name;
    name = `https://${domain}/u/${name}`;

    if (name != req.app.get('account').actor.id) {
      return res.status(404).send(`No record found for ${name}.`);
    } else {
      if (req.headers.accept ? .includes('application/ld+json')) {
        res.json(req.app.get('account').actor);
      } else {
        res.redirect(req.app.get('account').actor.url || `https://${domain}/`);
      }
    }
  }
});

router.get('/:name/followers', function (req, res) {
  let name = req.params.name;
  if (!name) {
    return res.status(400).send('Bad request.');
  } else {
    let domain = req.app.get('domain');

    name = `https://${domain}/u/${name}`;

    if (name != req.app.get('account').actor.id) {
      return res.status(404).send(`No record found for ${name}.`);
    } else {
      let followers = getFollowers();
      let followersCollection = {
        "type": "OrderedCollection",
        "totalItems": followers.length,
        "id": `https://${domain}/u/${name}/followers`,
        "first": {
          "type": "OrderedCollectionPage",
          "totalItems": followers.length,
          "partOf": `https://${domain}/u/${name}/followers`,
          "orderedItems": followers,
          "id": `https://${domain}/u/${name}/followers?page=1`
        },
        "@context": ["https://www.w3.org/ns/activitystreams"]
      };
      res.json(followersCollection);
    }
  }
});