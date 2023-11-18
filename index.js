// index.js is the start point for our project

// middleware to parse request bodies in different formats (e.g., JSON)
import bodyParser from 'body-parser';

// middleware to parse cookies in incoming requests
import cookieParser from 'cookie-parser';

// Cross-Origin Resource Sharing (CORS) middleware for enabling cross-origin requests
import cors from 'cors';

// the dotenv module for loading environment variables from a .env file
import dotenv from 'dotenv';

// the Express.js framework for building web applications
import express from 'express';

// middleware for implementing basic authentication in Express
import basicAuth from 'express-basic-auth';

// the Handlebars view engine for rendering dynamic HTML content
import { create } from 'express-handlebars';

// the built-in Node.js HTTP module for creating an HTTP server
import http from 'http';

// the Moment.js library for handling dates and times
import moment from 'moment';

import { ActivityPub } from './lib/ActivityPub.js';
import { ensureAccount } from './lib/account.js';

import { UserProfileRouter, WebfingerRouter, inbox, outbox, admin, notes, publicFacing } from './routes/index.js';

// load process.env from .env file
dotenv.config();
const { USERNAME, PASS, DOMAIN, PORT } = process.env;

const envVariables = ['USERNAME', 'PASS', 'DOMAIN'];
const PATH_TO_TEMPLATES = './design';

/**
 * Check the existence of required environment variables.
 *
 * @param {string[]} env_variables - An array of environment variable names that are required.
 * @throws {Error} Throws an error and exits the process if any required environment variable is missing.
 */
function checkRequiredEnvironmentVariables(envVariables) {
  envVariables.forEach(reqdVariable => {
    /**
     * Check if the required environment variable is missing.
     * If missing, log an error message and exit the process.
     *
     * @example
     * // Example usage:
     * checkRequiredEnvironmentVariables(['PORT', 'DATABASE_URL']);
     */
    if (!process.env[reqdVariable]) {
      console.error(`Missing required environment variable: \`${reqdVariable}\`. Exiting.`);
      process.exit(1);
    }
  });
}
checkRequiredEnvironmentVariables(envVariables);

const app = express();
/**
 * Handlebars helper functions for custom template rendering.
 *
 * @typedef {Object} HandlebarsHelpers
 * @property {Function} isVideo - Check if a string contains 'video' and execute the provided block if true.
 * @property {Function} isImage - Check if a string contains 'image' and execute the provided block if true.
 * @property {Function} isEq - Check if two values are equal and execute the provided block if true.
 * @property {Function} or - Logical OR between two values.
 * @property {Function} timesince - Format a date to show the time elapsed since the specified date.
 * @property {Function} getUsername - Get the username using the ActivityPub module.
 * @property {Function} stripProtocol - Remove 'https://' from the beginning of a string.
 * @property {Function} stripHTML - Remove HTML tags from a string.
 */

/**
 * Create an instance of Handlebars with custom helpers.
 *
 * @type {Handlebars}
 * @see {@link https://handlebarsjs.com/api-reference/helpers.html}
 */
const hbs = create({
  helpers: {
    /**
     * Check if a string contains 'video' and execute the provided block if true.
     * @function
     * @param {string} str - The string to check.
     * @param {Object} options - Handlebars options object.
     * @returns {string} - The rendered block if the condition is true.
     */
    isVideo: (str, options) => {
      if (str && str.includes('video')) return options.fn(this);
    },

    /**
     * Check if a string contains 'image' and execute the provided block if true.
     * @function
     * @param {string} str - The string to check.
     * @param {Object} options - Handlebars options object.
     * @returns {string} - The rendered block if the condition is true.
     */
    isImage: (str, options) => {
      if (str && str.includes('image')) return options.fn(this);
    },

    /**
     * Check if two values are equal and execute the provided block if true.
     * @function
     * @param {*} a - The first value.
     * @param {*} b - The second value.
     * @param {Object} options - Handlebars options object.
     * @returns {string} - The rendered block if the condition is true.
     */
    isEq: (a, b, options) => {
      // eslint-disable-next-line
      if (a == b) return options.fn(this);
    },

    /**
     * Logical OR between two values.
     * @function
     * @param {*} a - The first value.
     * @param {*} b - The second value.
     * @param {Object} options - Handlebars options object.
     * @returns {*} - The result of the logical OR operation.
     */
    or: (a, b, options) => {
      return a || b;
    },

    /**
     * Format a date to show the time elapsed since the specified date.
     * @function
     * @param {Date} date - The date to be formatted.
     * @returns {string} - The formatted time elapsed string.
     */
    timesince: date => {
      return moment(date).fromNow();
    },

    /**
     * Get the username using the ActivityPub module.
     * @function
     * @param {*} user - The user object.
     * @returns {string} - The username.
     */
    getUsername: user => {
      return ActivityPub.getUsername(user);
    },

    /**
     * Remove 'https://' from the beginning of a string.
     * @function
     * @param {string} str - The string to process.
     * @returns {string} - The string with 'https://' removed.
     */
    stripProtocol: str => str.replace(/^https:\/\//, ''),

    /**
     * Remove HTML tags from a string.
     * @function
     * @param {string} str - The string containing HTML tags.
     * @returns {string} - The string with HTML tags removed.
     */
    stripHTML: str =>
      str
        .replace(/<\/p>/, '\n')
        .replace(/(<([^>]+)>)/gi, '')
        .trim()
  }
});

const setExpressApp = app => {
  app.set('domain', DOMAIN);
  app.set('port', process.env.PORT || PORT || 3000);
  app.set('port-https', process.env.PORT_HTTPS || 8443);
  app.engine('handlebars', hbs.engine);
  app.set('views', PATH_TO_TEMPLATES);
  app.set('view engine', 'handlebars');
  app.use(
    bodyParser.json({
      type: 'application/activity+json'
    })
  ); // support json encoded bodies
  app.use(
    bodyParser.json({
      type: 'application/json'
    })
  ); // support json encoded bodies
  app.use(
    bodyParser.json({
      type: 'application/ld+json'
    })
  ); // support json encoded bodies

  app.use(cookieParser());

  app.use(
    bodyParser.urlencoded({
      extended: true
    })
  ); // support encoded bodies
};

setExpressApp(app);

/**
 * Asynchronous basic authorization function for Express.js.
 *
 * @param {string} username - The provided username for authorization.
 * @param {string} password - The provided password for authorization.
 * @param {Function} callback - The callback function to be called upon authorization completion.
 * @param {Error} callback.error - An error object if an error occurred during authorization, or null if successful.
 * @param {boolean} callback.authorized - A boolean indicating whether the user is authorized.
 *
 * @example
 * // Example usage:
 * asyncAuthorizer('admin', 'password123', (error, authorized) => {
 *   if (error) {
 *     console.error(error.message);
 *   } else {
 *     console.log(`User is authorized: ${authorized}`);
 *   }
 * });
 */
const asyncAuthorizer = (username, password, callback) => {
  let isAuthorized = false;
  // Check if the provided password matches the hardcoded username
  const isPasswordAuthorized = username === USERNAME;

  // Check if the provided username matches the hardcoded password
  const isUsernameAuthorized = password === PASS;

  // Set isAuthorized to true if both username and password are authorized
  isAuthorized = isPasswordAuthorized && isUsernameAuthorized;

  // Invoke the callback with the authorization result
  if (isAuthorized) {
    return callback(null, true);
  } else {
    return callback(null, false);
  }
};

/**
 * Express.js middleware for basic user authentication using asyncAuthorizer.
 *
 * @typedef {Object} BasicUserAuth
 * @property {Function} authorize - Function to perform basic authorization using asyncAuthorizer.
 * @property {boolean} authorizeAsync - Indicates that authorization is performed asynchronously.
 * @property {boolean} challenge - Indicates whether to send a 401 Unauthorized response.
 *
 * @example
 * // Example usage:
 * app.use(basicUserAuth);
 */
const basicUserAuth = basicAuth({
  /**
   * Function to perform basic authorization using asyncAuthorizer.
   *
   * @function
   * @param {string} username - The provided username for authorization.
   * @param {string} password - The provided password for authorization.
   * @param {Function} callback - The callback function to be called upon authorization completion.
   * @param {Error} callback.error - An error object if an error occurred during authorization, or null if successful.
   * @param {boolean} callback.authorized - A boolean indicating whether the user is authorized.
   */
  authorizer: asyncAuthorizer,

  /**
   * Indicates that authorization is performed asynchronously.
   *
   * @type {boolean}
   */
  authorizeAsync: true,

  /**
   * Indicates whether to send a 401 Unauthorized response.
   *
   * @type {boolean}
   */
  challenge: true
});

ensureAccount(USERNAME, DOMAIN).then(myaccount => {
  const authWrapper = (req, res, next) => {
    if (req.cookies.token) {
      if (req.cookies.token === myaccount.apikey) {
        return next();
      }
    }
    return basicUserAuth(req, res, next);
  };

  // set the server to use the main account as its primary actor
  ActivityPub.account = myaccount;
  console.log(`BOOTING SERVER FOR ACCOUNT: ${myaccount.actor.preferredUsername}`);
  console.log(`ACCESS DASHBOARD: https://${DOMAIN}/private`);

  // set up globals
  app.set('domain', DOMAIN);
  app.set('account', myaccount);

  // serve webfinger response
  app.use('/.well-known/webfinger', cors(), WebfingerRouter);
  // server user profile and follower list
  app.use('/u', cors(), UserProfileRouter);

  // serve individual posts
  app.use('/m', cors(), notes);

  // handle incoming requests
  app.use('/api/inbox', cors(), inbox);
  app.use('/api/outbox', cors(), outbox);

  app.use(
    '/private',
    cors({
      credentials: true,
      origin: true
    }),
    authWrapper,
    admin
  );
  app.use('/', cors(), publicFacing);
  app.use('/', express.static('public/'));

  http.createServer(app).listen(app.get('port'), function () {
    console.log('Express server listening on port ' + app.get('port'));
  });
});
