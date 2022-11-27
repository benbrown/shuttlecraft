import fs from 'fs';
import { getAccount} from './lib/account.js';
import express from 'express';
import {create} from 'express-handlebars';


import bodyParser from 'body-parser';
import cors from 'cors';
import http from 'http';
import basicAuth from 'express-basic-auth';

import {account, webfinger, inbox, admin, notes, publicFacing} from './routes/index.js';
import {sendFollowMessage} from './lib/users.js';

const config = JSON.parse(fs.readFileSync('./config.json'));
const { USER, PASS, DOMAIN, PRIVKEY_PATH, CERT_PATH, PORT } = config;
const PATH_TO_TEMPLATES = './design';
const app = express();
const hbs = create({
    helpers: {
        isVideo: (str,options) => { if (str.includes('video')) return options.fn(this); },
        isImage: (str,options)=> { if (str.includes('image'))   return options.fn(this); },
        isEq: (a,b,options)=> { console.log('isEq', a, b); if (a===b)   return options.fn(this); },
    }
});

let sslOptions;

try {
  sslOptions = {
    key: fs.readFileSync(PRIVKEY_PATH),
    cert: fs.readFileSync(CERT_PATH)
  };
} catch(err) {
  if (err.errno === -2) {
    console.log('No SSL key and/or cert found, not enabling https server');
  }
  else {
    console.log(err);
  }
}

app.set('domain', DOMAIN);
app.set('port', process.env.PORT || PORT || 3000);
app.set('port-https', process.env.PORT_HTTPS || 8443);
app.engine('handlebars', hbs.engine);
app.set('views', PATH_TO_TEMPLATES)
app.set('view engine', 'handlebars');
app.use(bodyParser.json({type: 'application/activity+json'})); // support json encoded bodies
app.use(bodyParser.json({type: 'application/json'})); // support json encoded bodies

app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies

// basic http authorizer
let basicUserAuth = basicAuth({
  authorizer: asyncAuthorizer,
  authorizeAsync: true,
  challenge: true
});

function asyncAuthorizer(username, password, cb) {
  let isAuthorized = false;
  const isPasswordAuthorized = username === USER;
  const isUsernameAuthorized = password === PASS;
  isAuthorized = isPasswordAuthorized && isUsernameAuthorized;
  if (isAuthorized) {
    return cb(null, true);
  }
  else {
    return cb(null, false);
  }
}


// Load/create account file
const myaccount = getAccount(USER, DOMAIN);

// sendFollowMessage('https://hachyderm.io/users/benbrown');

console.log('BOOTING SERVER FOR ACCOUNT: ', myaccount.actor.preferredUsername);

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

app.get('/', (req, res) => res.send('ONO SENDAI - CYBERSPACE X'));

app.use('/private', cors({ credentials: true, origin: true }), basicUserAuth, admin);
app.use('/', cors(), publicFacing);
app.use('/', express.static('public/'));

http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});
