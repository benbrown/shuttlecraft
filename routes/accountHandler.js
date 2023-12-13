import express from 'express';
import { authenticateLogin, writeEnvToFile, createAccount } from '../lib/authentication.js';
import { getAccount, ifAccount } from '../lib/account.js';

export const router = express.Router();

/* The code `router.get('/create', async (req, res) => { ... })` is defining a route handler for a GET
request to the '/create' endpoint. */
router.get('/create', async (req, res) => {
  res.status(200).render('createAccount', {
    layout: 'public'
  });
});

/* The code `router.post('/create', (req, res) => { ... })` is defining a route handler for a POST
request to the '/create' endpoint. */
router.post('/create', async (req, res) => {
  await writeEnvToFile(req, res);
  await createAccount(req, res);
});

/* The code `router.get('/login', (req, res) => { ... })` is defining a route handler for a GET request
to the '/login' endpoint. */
router.get('/login', (req, res) => {
  if (!ifAccount()) {
    res.redirect('/account/create');
  }
  res.status(200).render('login', {
    layout: 'public'
  });
});

/* The code `router.post('/login', (req, res) => { ... })` is defining a route handler for a POST
request to the '/login' endpoint. */
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (authenticateLogin(username, password)) {
    const myaccount = getAccount();
    res.cookie('token', myaccount.apikey);
    res.redirect('/private');
  } else {
    res.status(200).render('login', {
      layout: 'public',
      message: "Username or password don't match"
    });
  }
});

/* The code router.get('/logout', (req, res) => { ... }) is defining a route handler for a GET
request to the '/logout' endpoint. */
router.get('/logout', (req, res) => {
  res.clearCookie('token');
  res.redirect('/account/login');
});
