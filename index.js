import fs from 'fs';
import express from 'express';
import {
  create
} from 'express-handlebars';
import cookieParser from 'cookie-parser';

import dotenv from 'dotenv';

import bodyParser from 'body-parser';
import cors from 'cors';
import http from 'http';
import basicAuth from 'express-basic-auth';
import moment from 'moment';
import {
  ActivityPub
} from './lib/ActivityPub.js';
import {
  ensureAccount
} from './lib/account.js';
import {
  account,
  webfinger,
  inbox,
  outbox,
  admin,
  notes,
  publicFacing
} from './routes/index.js';
// load process.env from .env file
dotenv.config();

const {
  USERNAME,
  PASS,
  DOMAIN,
  PORT
} = process.env;

const PATH_TO_TEMPLATES = './design';
const app = express();
const hbs = create({
  helpers: {
    isVideo: (str, options) => {
      if (str && str.includes('video')) return options.fn(this);
    },
    isImage: (str, options) => {
      if (str && str.includes('image')) return options.fn(this);
    },
    isEq: (a, b, options) => {
      if (a == b) return options.fn(this);
    },
    or: (a, b, options) => {
      return a || b
    },
    timesince: (date) => {
      return moment(date).fromNow();
    },
    getUsername: (user) => {
      return ActivityPub.getUsername(user)
    },
    stripProtocol: (str) => str.replace(/^https\:\/\//, ''),
    stripHTML: (str) => str.replace(/<\/p>/,"\n").replace(/(<([^>]+)>)/gi, "").trim(),
    }
});

app.set('domain', DOMAIN);
app.set('port', process.env.PORT || PORT || 3000);
app.set('port-https', process.env.PORT_HTTPS || 8443);
app.engine('handlebars', hbs.engine);
app.set('views', PATH_TO_TEMPLATES)
app.set('view engine', 'handlebars');
app.use(bodyParser.json({
  type: 'application/activity+json'
})); // support json encoded bodies
app.use(bodyParser.json({
  type: 'application/json'
})); // support json encoded bodies
app.use(cookieParser())

app.use(bodyParser.urlencoded({
  extended: true
})); // support encoded bodies

// basic http authorizer
const basicUserAuth = basicAuth({
  authorizer: asyncAuthorizer,
  authorizeAsync: true,
  challenge: true
});



function asyncAuthorizer(username, password, cb) {
  let isAuthorized = false;
  const isPasswordAuthorized = username === USERNAME;
  const isUsernameAuthorized = password === PASS;
  isAuthorized = isPasswordAuthorized && isUsernameAuthorized;
  if (isAuthorized) {
    return cb(null, true);
  } else {
    return cb(null, false);
  }
}


if (!USERNAME || !DOMAIN || !PASS) {
  console.error('Specify USER PASS and DOMAIN in the .env file');
  process.exit(1);
}





// Load/create account file
ensureAccount(USERNAME, DOMAIN).then((myaccount) => {

  const authWrapper = (req, res, next) => {
    if (req.cookies.token) {
      if (req.cookies.token === myaccount.apikey) {
        return next();
      }
    }
    return basicUserAuth(req, res, next);
  }


  // set the server to use the main account as its primary actor
  ActivityPub.account = myaccount;
  console.log('BOOTING SERVER FOR ACCOUNT: ', myaccount.actor.preferredUsername);
  console.log(`ACCESS DASHBOARD: https://${ DOMAIN }/private`);

  // set up globals
  app.set('domain', DOMAIN);
  app.set('account', myaccount);

  // serve webfinger response
  app.use('/.well-known/webfinger', cors(), webfinger);
  // server user profile and follower list
  app.use('/u', cors(), account);

  // serve individual posts
  app.use('/m', cors(), notes);

  // handle incoming requests
  app.use('/api/inbox', cors(), inbox);
  app.use('/api/outbox', cors(), outbox);

  app.use('/private', cors({
    credentials: true,
    origin: true
  }), authWrapper, admin);
  app.use('/', cors(), publicFacing);
  app.use('/', express.static('public/'));

  http.createServer(app).listen(app.get('port'), function () {
    console.log('Express server listening on port ' + app.get('port'));
  });
});
