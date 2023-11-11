const { isMyPost } = require('../account');

import 'node-fetch';

jest.mock('node-fetch', () => jest.fn());

test('Check if a post is my post', () => {
  const { DOMAIN } = process.env;
  const activity = {
    id: `https://${DOMAIN}/m/`
  };

  expect(isMyPost(activity)).toBe(true);
});
