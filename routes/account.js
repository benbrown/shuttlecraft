import express from 'express';
import { getFollowers } from '../lib/account.js';

/**
 * Express.js router for handling user profile-related routes.
 *
 * @typedef {Object} UserProfileRouter
 * @property {Function} getProfile - Route handler for retrieving a user profile by name.
 * @property {Function} getFollowers - Route handler for retrieving followers of a user profile by name.
 *
 * @example
 * // Example usage:
 * const userProfileRouter = express.Router();
 * userProfileRouter.get('/:name', userProfileHandlers.getProfile);
 * userProfileRouter.get('/:name/followers', userProfileHandlers.getFollowers);
 * app.use('/profiles', userProfileRouter);
 */
export const router = express.Router();

/**
 * Handle GET requests for a user profile by name.
 *
 * @function
 * @param {Object} req - Express.js request object.
 * @param {Object} res - Express.js response object.
 * @returns {void} Responds with a user profile or redirects based on the request.
 *
 * @throws {Error} Responds with a 400 Bad Request if the 'name' parameter is missing.
 * @throws {Error} Responds with a 404 Not Found if no record is found for the provided 'name'.
 *
 * @example
 * // Example route:
 * // GET /profiles/:name
 * router.get('/:name', function (req, res) {
 *   // ... (route handler implementation)
 * });
 */
router.get('/:name', (req, res) => {
  // Extract the 'name' parameter from the request
  let name = req.params.name;

  // Handle missing 'name' parameter with a 400 Bad Request response
  if (!name) {
    return res.status(400).send('Bad request.');
  } else {
    // Obtain the domain from the app settings
    const domain = req.app.get('domain');

    // Append the user profile URL path to the domain
    name = `https://${domain}/u/${name}`;

    // Check if the provided 'name' matches the stored user profile ID
    if (name !== req.app.get('account').actor.id) {
      // Respond with a 404 Not Found if no record is found for the provided 'name'
      return res.status(404).send(`No record found for ${name}.`);
    } else {
      // Check the 'Accept' header for JSON-LD format and respond accordingly
      if (req.headers.accept?.includes('application/ld+json')) {
        // Respond with the user profile in JSON-LD format
        res.json(req.app.get('account').actor);
      } else {
        // Redirect to the user profile URL or the default domain
        res.redirect(req.app.get('account').actor.url || `https://${domain}/`);
      }
    }
  }
});

/**
 * Handle GET requests for the followers of a user profile by name.
 *
 * @function
 * @param {Object} req - Express.js request object.
 * @param {Object} res - Express.js response object.
 * @returns {void} Responds with a collection of followers or an error message based on the request.
 *
 * @throws {Error} Responds with a 400 Bad Request if the 'name' parameter is missing.
 * @throws {Error} Responds with a 404 Not Found if no record is found for the provided 'name'.
 *
 * @example
 * // Example route:
 * // GET /profiles/:name/followers
 * router.get('/:name/followers', function (req, res) {
 *   // ... (route handler implementation)
 * });
 */
router.get('/:name/followers', (req, res) => {
  // Extract the 'name' parameter from the request
  let name = req.params.name;

  // Handle missing 'name' parameter with a 400 Bad Request response
  if (!name) {
    return res.status(400).send('Bad request.');
  } else {
    // Obtain the domain from the app settings
    const domain = req.app.get('domain');

    // Append the user profile URL path to the domain
    name = `https://${domain}/u/${name}`;

    // Check if the provided 'name' matches the stored user profile ID
    if (name !== req.app.get('account').actor.id) {
      // Respond with a 404 Not Found if no record is found for the provided 'name'
      return res.status(404).send(`No record found for ${name}.`);
    } else {
      // Retrieve followers for the user profile
      const followers = getFollowers();

      // Assemble the followers collection in ActivityStreams format
      const followersCollection = {
        type: 'OrderedCollection',
        totalItems: followers.length,
        id: `https://${domain}/u/${name}/followers`,
        first: {
          type: 'OrderedCollectionPage',
          totalItems: followers.length,
          partOf: `https://${domain}/u/${name}/followers`,
          orderedItems: followers,
          id: `https://${domain}/u/${name}/followers?page=1`
        },
        '@context': ['https://www.w3.org/ns/activitystreams']
      };
      // Respond with the followers collection in JSON format
      res.json(followersCollection);
    }
  }
});
