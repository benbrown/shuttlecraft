import { isMyPost } from '../account';
import { readJSONDictionary, writeJSONDictionary } from '../storage';
import fs from 'fs';

import 'node-fetch';

jest.mock('node-fetch', () => jest.fn());

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

describe('Tests for getInboxIndex', () => {
  const getInboxIndex = () => {
    const inboxIndexPath = 'lib/__tests__/files/inboxIndex.json';
    const inboxIndex = readJSONDictionary(inboxIndexPath, {});
    return inboxIndex;
  };

  test('Check successful', () => {
    const expectedInboxIndex = { id: 'inboxIndex' };
    expect(getInboxIndex()).toStrictEqual(expectedInboxIndex);
  });
});

describe('Tests for writeInboxIndex', () => {
  const inboxIndexPath = 'lib/__tests__/files/writeInboxIndex.json';
  const writeInboxIndex = data => {
    writeJSONDictionary(inboxIndexPath, data);
  };

  test('Check successful', () => {
    const expectedInboxIndex = { id: 'inboxIndex' };
    writeInboxIndex(expectedInboxIndex);
    const jsonRaw = fs.readFileSync(inboxIndexPath);
    expect(JSON.parse(jsonRaw)).toStrictEqual(expectedInboxIndex);
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
