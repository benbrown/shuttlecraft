import express from 'express';

/**
 * Express.js router for handling webfinger-related routes.
 *
 * @typedef {Object} WebfingerRouter
 * @property {Function} getResource - Route handler for retrieving a webfinger resource.
 *
 * @example
 * // Example usage:
 * import { router as webfingerRouter } from './webfingerRouter';
 * app.use('/webfinger', webfingerRouter);
 */
export const router = express.Router();

/**
 * Route handler for retrieving a webfinger resource.
 *
 * @function
 * @param {Object} req - Express.js request object.
 * @param {Object} res - Express.js response object.
 * @returns {void} Responds with a webfinger resource or an error message based on the request.
 *
 * @throws {Error} Responds with a 400 Bad Request if the 'resource' query parameter is missing or incorrectly formatted.
 * @throws {Error} Responds with a 404 Not Found if no record is found for the provided 'resource'.
 *
 */
router.get('/', function (req, res) {
  // Extract the 'resource' query parameter from the request
  const resource = req.query.resource;

  // Check if the 'resource' parameter is missing or incorrectly formatted
  if (!resource || !resource.includes('acct:')) {
    return res
      .status(400)
      .send(
        'Bad request. Please make sure "acct:USER@DOMAIN" is what you are sending as the "resource" query parameter.'
      );
  } else {
    // Check if the provided 'resource' matches the stored webfinger subject
    if (resource === req.app.get('account').webfinger.subject) {
      // Respond with the webfinger resource in JSON format
      res.json(req.app.get('account').webfinger);
    } else {
      // Respond with a 404 Not Found if no record is found for the provided 'resource'
      return res.status(404).send(`No record found for ${resource}.`);
    }
  }
});
