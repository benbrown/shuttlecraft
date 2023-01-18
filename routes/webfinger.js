import express from 'express';
export const router = express.Router();

router.get('/', function (req, res) {
  let resource = req.query.resource;
  if (!resource || !resource.includes('acct:')) {
    return res
      .status(400)
      .send(
        'Bad request. Please make sure "acct:USER@DOMAIN" is what you are sending as the "resource" query parameter.'
      );
  } else {
    if (resource == req.app.get('account').webfinger.subject) {
      res.json(req.app.get('account').webfinger);
    } else {
      return res.status(404).send(`No record found for ${resource}.`);
    }
  }
});
