import {
  getInboxIndex,
  writeInboxIndex,
  isMyPost,
  getNotifications,
  writeNotifications,
  getBoosts,
  writeBoosts,
  getLikes,
  writeLikes,
  getAccount
} from '../account';
import * as storage from '../storage';
import fs from 'fs';

import 'node-fetch';

jest.mock('node-fetch', () => jest.fn());

const testFileDirectoryPath = 'lib/__tests__/files/';

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Tests for getInboxIndex', () => {
  test('Check successful', () => {
    jest.replaceProperty(storage, 'pathToDMs', testFileDirectoryPath + 'dms/');

    const expectedInboxIndex = { id: 'inboxes' };
    expect(getInboxIndex()).toStrictEqual(expectedInboxIndex);
  });
});

describe('Tests for writeInboxIndex', () => {
  const inboxesPath = testFileDirectoryPath + 'dms/inboxes.json';

  test('Check successful', () => {
    fs.unlinkSync(inboxesPath);
    expect(fs.existsSync(inboxesPath)).toBe(false);

    jest.replaceProperty(storage, 'pathToDMs', testFileDirectoryPath + 'dms/');

    const expectedInboxes = { id: 'inboxes' };
    writeInboxIndex(expectedInboxes);
    const jsonRaw = fs.readFileSync(inboxesPath);
    expect(JSON.parse(jsonRaw)).toStrictEqual(expectedInboxes);
  });
});

describe('Tests for isMyPost', () => {
  test('Check if a post is my post', () => {
    const { DOMAIN } = process.env;
    const activity = {
      id: `https://${DOMAIN}/m/`
    };

    expect(isMyPost(activity)).toBe(true);
  });

  test('Check if a post is not my post', () => {
    const activity = {
      id: 'https://garbage/m/'
    };

    expect(isMyPost(activity)).toBe(false);
  });
});

describe('Tests for getNotifications', () => {
  test('Check successful', () => {
    jest.replaceProperty(storage, 'notificationsFile', testFileDirectoryPath + 'notifications.json');

    const expectedNotifications = { id: 'notifications' };
    expect(getNotifications()).toStrictEqual(expectedNotifications);
  });
});

describe('Tests for writeNotifications', () => {
  const notificationsPath = testFileDirectoryPath + 'notifications.json';

  test('Check successful', () => {
    fs.unlinkSync(notificationsPath);
    expect(fs.existsSync(notificationsPath)).toBe(false);

    jest.replaceProperty(storage, 'notificationsFile', notificationsPath);

    const expectedNotifications = { id: 'notifications' };
    writeNotifications(expectedNotifications);
    const jsonRaw = fs.readFileSync(notificationsPath);
    expect(JSON.parse(jsonRaw)).toStrictEqual(expectedNotifications);
  });
});

describe('Tests for getBoosts', () => {
  test('Check successful', () => {
    jest.replaceProperty(storage, 'boostsFile', testFileDirectoryPath + 'boosts.json');

    const expectedBoosts = { id: 'boosts' };
    expect(getBoosts()).toStrictEqual(expectedBoosts);
  });
});

describe('Tests for writeBoosts', () => {
  const boostsPath = testFileDirectoryPath + 'boosts.json';

  test('Check successful', () => {
    fs.unlinkSync(boostsPath);
    expect(fs.existsSync(boostsPath)).toBe(false);

    jest.replaceProperty(storage, 'boostsFile', boostsPath);

    const expectedBoosts = { id: 'boosts' };
    writeBoosts(expectedBoosts);
    const jsonRaw = fs.readFileSync(boostsPath);
    expect(JSON.parse(jsonRaw)).toStrictEqual(expectedBoosts);
  });
});

describe('Tests for getLikes', () => {
  test('Check successful', () => {
    jest.replaceProperty(storage, 'likesFile', testFileDirectoryPath + 'likes.json');

    const expectedLikes = { id: 'likes' };
    expect(getLikes()).toStrictEqual(expectedLikes);
  });
});

describe('Tests for writeLikes', () => {
  const likesPath = testFileDirectoryPath + 'likes.json';

  test('Check successful', () => {
    fs.unlinkSync(likesPath);
    expect(fs.existsSync(likesPath)).toBe(false);

    jest.replaceProperty(storage, 'likesFile', likesPath);

    const expectedLikes = { id: 'likes' };
    writeLikes(expectedLikes);
    const jsonRaw = fs.readFileSync(likesPath);
    expect(JSON.parse(jsonRaw)).toStrictEqual(expectedLikes);
  });
});

describe('Tests for getAccount', () => {
  test('Check successful', () => {
    jest.replaceProperty(storage, 'accountFile', testFileDirectoryPath + 'account.json');

    const expectedAccount = { id: 'account' };
    expect(getAccount()).toStrictEqual(expectedAccount);
  });
});
