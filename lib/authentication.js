import dotenv from 'dotenv';
import { ensureAccount, getAccount } from './account.js';
import { promises as fsPromises } from 'fs';
import { ActivityPub } from './ActivityPub.js';

/**
 * The function `getUsername` retrieves the value of the `USER_NAME` environment variable.
 * @returns The function `getUsername` is returning the value of the `USER_NAME` environment variable.
 */
const getUsername = () => {
  dotenv.config();
  const { USER_NAME } = process.env;
  return USER_NAME;
};

/**
 * The function `getPassword` retrieves the value of the `PASS` environment variable using the `dotenv`
 * package.
 * @returns The function `getPassword` is returning the value of the `PASS` environment variable.
 */
const getPassword = () => {
  dotenv.config();
  const { PASS } = process.env;
  return PASS;
};

/**
 * The function `authenticateLogin` checks if the provided username and password match the stored
 * username and password.
 * @param username - The `username` parameter is the username entered by the user during the login
 * process.
 * @param password - The `password` parameter is the password entered by the user during the login
 * process.
 * @returns a boolean value. It returns true if the provided username and password match the stored
 * username and password, and false otherwise.
 */
export const authenticateLogin = (username, password) => {
  if (username === getUsername() && password === getPassword()) {
    return true;
  }
  return false;
};

/**
 * The `createAccount` function creates a new account, sets the account in the app, sets a token in a
 * cookie, and redirects to a private route.
 * @param req - The `req` parameter is an object that represents the HTTP request made by the client.
 * It contains information such as the request headers, request body, request method, request URL, and
 * other relevant details.
 * @param res - The `res` parameter is the response object that is used to send the response back to
 * the client. It contains methods and properties that allow you to control the response, such as
 * setting headers, sending data, and redirecting the client to a different URL.
 */
export const createAccount = async (req, res) => {
  const { username, domain } = req.body;

  try {
    await ensureAccount(username, domain);

    // Set account in the app
    const myaccount = await getAccount();
    req.app.set('account', myaccount);

    // Set token in cookie
    res.cookie('token', myaccount.apikey);

    // Redirect to private route
    res.redirect('/private');
  } catch (error) {
    console.error('Error creating account:', error);
    res.status(500).send('Internal Server Error');
  }
};

/**
 * The function `writeEnvToFile` writes the values of `username`, `password`, and `domain` to a `.env`
 * file.
 * @param req - The `req` parameter is an object that represents the HTTP request made to the server.
 * It contains information about the request, such as the request method, headers, and body.
 * @param res - The `res` parameter is the response object. It is used to send a response back to the
 * client after the operation is completed.
 */
export const writeEnvToFile = async (req, res) => {
  const { username, password, domain } = req.body;

  const envData = `
    USER_NAME=${username}
    PASS=${password}
    DOMAIN=${domain}
    `;

  const envFilePath = './.env';

  try {
    await fsPromises.writeFile(envFilePath, envData);
    console.log('Data has been written to .env file');
  } catch (error) {
    console.error('Error writing to .env file:', error);
  }
};

/**
 * The function checks if the user is authenticated by comparing the token in the request cookies with
 * the API key stored in the account, and redirects to the login page if not authenticated.
 * @param req - The `req` parameter is the request object, which contains information about the
 * incoming HTTP request from the client. It includes properties such as the request headers, query
 * parameters, request body, cookies, etc.
 * @param res - The `res` parameter is the response object that is used to send a response back to the
 * client. It contains methods and properties that allow you to control the response, such as setting
 * headers, sending data, and redirecting the client to a different URL.
 * @param next - The `next` parameter is a function that is used to pass control to the next middleware
 * function in the request-response cycle. It is typically called at the end of the current middleware
 * function to indicate that it has completed its processing and the next middleware function should be
 * called.
 * @returns If the condition `req.cookies.token && req.cookies.token === myaccount.apikey` is true,
 * then the `next()` function will be called, which means the control will be passed to the next
 * middleware function in the request-response cycle.
 */
export const handleAuthenticatedUser = (req, res, next) => {
  const myaccount = getAccount();
  req.app.set('account', myaccount);
  ActivityPub.account = myaccount;

  if (req.cookies.token && req.cookies.token === myaccount.apikey) {
    return next();
  } else {
    res.redirect('/account/login');
  }
};
