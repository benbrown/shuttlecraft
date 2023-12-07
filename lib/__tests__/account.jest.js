import { getInboxIndex, writeInboxIndex, isMyPost, getNotifications, writeNotifications } from '../account';
import { readJSONDictionary, writeJSONDictionary } from '../storage';
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
  const inboxesPath = 'lib/__tests__/files/dms/inboxes.json';

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
  test('Check successful', () => {
    fs.unlinkSync(testFileDirectoryPath + 'notifications.json');
    expect(fs.existsSync(testFileDirectoryPath + 'notifications.json')).toBe(false);

    jest.replaceProperty(storage, 'notificationsFile', testFileDirectoryPath + 'notifications.json');

    const expectedNotifications = { id: 'notifications' };
    writeNotifications(expectedNotifications);
    const jsonRaw = fs.readFileSync(testFileDirectoryPath + 'notifications.json');
    expect(JSON.parse(jsonRaw)).toStrictEqual(expectedNotifications);
  });
});

describe('Tests for writeBoosts', () => {
  const boostsFile = 'lib/__tests__/files/writeBoosts.json';
  const writeBoosts = data => {
    return writeJSONDictionary(boostsFile, data);
  };

  test('Check successful', () => {
    const expectedBoosts = { id: 'boosts' };
    writeBoosts(expectedBoosts);
    const jsonRaw = fs.readFileSync(boostsFile);
    expect(JSON.parse(jsonRaw)).toStrictEqual(expectedBoosts);
  });
});

describe('Tests for getBoosts', () => {
  const boostsFile = 'lib/__tests__/files/boosts.json';
  const getBoosts = () => {
    return readJSONDictionary(boostsFile, []);
  };

  test('Check successful', () => {
    const expectedBoosts = { id: 'boosts' };
    expect(getBoosts()).toStrictEqual(expectedBoosts);
  });
});

describe('Tests for writeLikes', () => {
  const likesFile = 'lib/__tests__/files/writeLikes.json';
  const writeLikes = likes => {
    return writeJSONDictionary(likesFile, likes);
  };

  test('Check successful', () => {
    const expectedLikes = { id: 'likes' };
    writeLikes(expectedLikes);
    const jsonRaw = fs.readFileSync(likesFile);
    expect(JSON.parse(jsonRaw)).toStrictEqual(expectedLikes);
  });
});

describe('Tests for getLikes', () => {
  const likesFile = 'lib/__tests__/files/likes.json';
  const getLikes = () => {
    return readJSONDictionary(likesFile);
  };

  test('Check successful', () => {
    const expectedLikes = { id: 'likes' };
    expect(getLikes()).toStrictEqual(expectedLikes);
  });
});

describe('Tests for getAccount', () => {
  const accountFile = 'lib/__tests__/files/account.json';
  const getAccount = () => {
    return readJSONDictionary(accountFile, {});
  };

  test('Check successful', () => {
    const expectedAccount = { id: 'account' };
    expect(getAccount()).toStrictEqual(expectedAccount);
  });
});
