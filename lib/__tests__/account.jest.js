const { isMyPost } = require('../account');

import 'node-fetch';

jest.mock('node-fetch', () => jest.fn());
import { readJSONDictionary } from '../storage';

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
    const inboxIndexPath = 'lib/__tests__/files/inboxes.json';
    const inboxIndex = readJSONDictionary(inboxIndexPath, {});
    return inboxIndex;
  };
  test('Check successful', () => {
    expect(getInboxIndex()).toStrictEqual({ id: 'test' });
  });
});
