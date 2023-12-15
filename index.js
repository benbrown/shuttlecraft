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

// the Handlebars view engine for rendering dynamic HTML content
import { create } from 'express-handlebars';

// the built-in Node.js HTTP module for creating an HTTP server
import http from 'http';

// the Moment.js library for handling dates and times
import moment from 'moment';

// ActivityPub for handling ActivityPub requests
import { ActivityPub } from './lib/ActivityPub.js';

// Check if account already exists
import { ifAccount } from './lib/account.js';

// Authentication middleware
import { handleAuthenticatedUser } from './lib/authentication.js';

import {
  UserProfileRouter,
  WebfingerRouter,
  inbox,
  outbox,
  admin,
  notes,
  publicFacing,
  accountHandler
} from './routes/index.js';

// load process.env from .env file
dotenv.config();
const DOMAIN = process.env.DOMAIN;
const PORT = process.env.PORT;

// const envVariables = ['USER_NAME', 'PASS', 'DOMAIN'];
const envVariables = ['DOMAIN'];
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

export const app = express();
// Export app
// module.exports = app;
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

const authWrapper = (req, res, next) => {
  if (ifAccount()) {
    handleAuthenticatedUser(req, res, next);
  } else {
    res.redirect('/account/create');
  }
};

console.log(`ACCESS DASHBOARD: https://${DOMAIN}/private`);

// set up globals
app.set('domain', DOMAIN);
// app.set('account', myaccount);

// serve webfinger response
app.use('/.well-known/webfinger', cors(), WebfingerRouter);
// server user profile and follower list
app.use('/u', cors(), UserProfileRouter);

// serve individual posts
app.use('/m', cors(), notes);

// handle incoming requests
app.use('/api/inbox', cors(), inbox);
app.use('/api/outbox', cors(), outbox);

// serve account creation and login
app.use(
  '/account',
  cors({
    credentials: true,
    origin: true
  }),
  accountHandler
);

// serve user dashboard
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
