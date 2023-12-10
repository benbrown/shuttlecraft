import {
  getInboxIndex,
  writeInboxIndex,
  getInbox,
  addressedOnlyToMe,
  isMyPost,
  isFollowing,
  isFollower,
  isMention,
  isReplyToMyPost,
  getNotifications,
  writeNotifications,
  getBoosts,
  writeBoosts,
  writeFollowers,
  getFollowers,
  writeFollowing,
  getFollowing,
  writeLikes,
  getLikes,
  getAccount
} from '../account';
import * as storage from '../storage';
import { ActivityPub } from '../ActivityPub';
import fs from 'fs';

import 'node-fetch';

jest.mock('node-fetch', () => jest.fn());

const testFileDirectoryPath = 'lib/__tests__/files/';

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Tests for getInboxIndex', () => {
  test('Check getting inbox index successfully', () => {
    jest.replaceProperty(storage, 'pathToDMs', testFileDirectoryPath + 'dms/');

    const expectedInboxIndex = { id: 'inboxes' };
    expect(getInboxIndex()).toStrictEqual(expectedInboxIndex);
  });
});

describe('Tests for writeInboxIndex', () => {
  const inboxPath = testFileDirectoryPath + 'dms/inboxes.json';

  test('Check writing inbox index successfully', () => {
    fs.unlinkSync(inboxPath);
    expect(fs.existsSync(inboxPath)).toBe(false);

    jest.replaceProperty(storage, 'pathToDMs', testFileDirectoryPath + 'dms/');

    const expectedInboxes = { id: 'inboxes' };
    writeInboxIndex(expectedInboxes);
    const jsonRaw = fs.readFileSync(inboxPath);
    expect(JSON.parse(jsonRaw)).toStrictEqual(expectedInboxes);
  });
});

describe('Tests for getInbox', () => {
  test('Check getting inbox successfully', () => {
    jest.replaceProperty(storage, 'pathToDMs', testFileDirectoryPath + 'dms/');

    const expectedInbox = { id: 'justin@shuttlecraft.com' };
    expect(getInbox('justin@shuttlecraft.com')).toStrictEqual(expectedInbox);
  });
});

describe('Tests for addressedOnlyToMe', () => {
  test('Check that the activity is only addressed to me', () => {
    jest.spyOn(ActivityPub, 'actor', 'get').mockReturnValue({ id: 'justin' });

    const activity = { to: ['justin'], cc: [] };

    expect(addressedOnlyToMe(activity)).toBe(true);
  });

  test('Check that the activity is addressed to someone that is not me', () => {
    jest.spyOn(ActivityPub, 'actor', 'get').mockReturnValue({ id: 'justin' });

    const activity = { to: ['jay'], cc: [] };

    expect(addressedOnlyToMe(activity)).toBe(false);
  });

  test('Check that the activity is addressed to more than just me', () => {
    jest.spyOn(ActivityPub, 'actor', 'get').mockReturnValue({ id: 'justin' });

    const activity = { to: ['justin'], cc: ['jay'] };

    expect(addressedOnlyToMe(activity)).toBe(false);
  });
});

describe('Tests for deleteObject', () => {});

describe('Tests for acceptDM', () => {});

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

describe('Tests for isFollowing', () => {
  test('Check with someone I am following', () => {
    jest.replaceProperty(storage, 'followingFile', testFileDirectoryPath + 'following.json');

    expect(isFollowing('justin')).toBe(true);
  });

  test('Check with someone I am not following,', () => {
    jest.replaceProperty(storage, 'followingFile', testFileDirectoryPath + 'following.json');

    expect(isFollowing('aditya')).toBe(false);
  });
});

describe('Tests for isFollower', () => {
  test('Check with someone that is a follower', () => {
    jest.replaceProperty(storage, 'followersFile', testFileDirectoryPath + 'followers.json');

    expect(isFollower('aditya')).toBe(true);
  });

  test('Check with someone that is not a follower', () => {
    jest.replaceProperty(storage, 'followersFile', testFileDirectoryPath + 'followers.json');

    expect(isFollower('justin')).toBe(false);
  });
});

describe('Tests for isMention', () => {
  test('Check with activity that is mention', () => {
    jest.spyOn(ActivityPub, 'actor', 'get').mockReturnValue({ id: 'justin' });

    const activity = { tag: [{ type: 'Mention', href: 'justin' }] };
    expect(isMention(activity)).toBe(true);
  });

  test('Check with activity that is not mention', () => {
    const activity = {};
    expect(isMention(activity)).toBe(undefined);
  });
});

describe('Tests for isReplyToMyPost', () => {
  test('Check with activity that is a reply to my post', () => {
    const { DOMAIN } = process.env;
    const activity = { inReplyTo: `https://${DOMAIN}/m/justin` };
    expect(isReplyToMyPost(activity)).toBe(true);
  });

  test('Check with activity that is not a reply to my post', () => {
    const activity = { inReplyTo: 'test' };
    expect(isReplyToMyPost(activity)).toBe(false);
  });
});

describe('Tests for isReplyToFollowing', () => {});

describe('Tests for createActor', () => {});

describe('Tests for createWebfinger', () => {});

describe('Tests for getOutboxPosts', () => {});

describe('Tests for addNotification', () => {});

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

describe('Tests for getNotifications', () => {
  test('Check successful', () => {
    jest.replaceProperty(storage, 'notificationsFile', testFileDirectoryPath + 'notifications.json');

    const expectedNotifications = { id: 'notifications' };
    expect(getNotifications()).toStrictEqual(expectedNotifications);
  });
});

describe('Tests for isBlocked', () => {});

describe('Tests for getBlocks', () => {});

describe('Tests for writeFollowers', () => {
  const followersPath = testFileDirectoryPath + 'followers.json';

  test('Check successful', () => {
    fs.unlinkSync(followersPath);
    expect(fs.existsSync(followersPath)).toBe(false);

    jest.replaceProperty(storage, 'followersFile', followersPath);

    const expectedFollowers = ['aditya', 'kashish'];
    writeFollowers(expectedFollowers);
    const jsonRaw = fs.readFileSync(followersPath);
    expect(JSON.parse(jsonRaw)).toStrictEqual(expectedFollowers);
  });
});

describe('Tests for getFollowers', () => {
  test('Check successful', () => {
    jest.replaceProperty(storage, 'followersFile', testFileDirectoryPath + 'followers.json');

    const expectedFollowers = ['aditya', 'kashish'];
    expect(getFollowers()).toStrictEqual(expectedFollowers);
  });
});

describe('Tests for writeFollowing', () => {
  const followingPath = testFileDirectoryPath + 'following.json';

  test('Check successful', () => {
    fs.unlinkSync(followingPath);
    expect(fs.existsSync(followingPath)).toBe(false);

    jest.replaceProperty(storage, 'followingFile', followingPath);

    const expectedFollowing = [{ actorId: 'justin' }, { actorId: 'jay' }];
    writeFollowing(expectedFollowing);
    const jsonRaw = fs.readFileSync(followingPath);
    expect(JSON.parse(jsonRaw)).toStrictEqual(expectedFollowing);
  });
});

describe('Tests for getFollowing', () => {
  test('Check successful', () => {
    jest.replaceProperty(storage, 'followingFile', testFileDirectoryPath + 'following.json');

    const expectedFollowing = [{ actorId: 'justin' }, { actorId: 'jay' }];
    expect(getFollowing()).toStrictEqual(expectedFollowing);
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

describe('Tests for getBoosts', () => {
  test('Check successful', () => {
    jest.replaceProperty(storage, 'boostsFile', testFileDirectoryPath + 'boosts.json');

    const expectedBoosts = { id: 'boosts' };
    expect(getBoosts()).toStrictEqual(expectedBoosts);
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

describe('Tests for getLikes', () => {
  test('Check successful', () => {
    jest.replaceProperty(storage, 'likesFile', testFileDirectoryPath + 'likes.json');

    const expectedLikes = { id: 'likes' };
    expect(getLikes()).toStrictEqual(expectedLikes);
  });
});

describe('Tests for getNote', () => {});

describe('Tests for sendCreateToFollowers', () => {});

describe('Tests for sendUpdateToFollowers', () => {});

describe('Tests for createNote', () => {});

describe('Tests for follow', () => {});

describe('Tests for addFollower', () => {});

describe('Tests for removeFollower', () => {});

describe('Tests for ensureAccount', () => {});

describe('Tests for updateAccount', () => {});

describe('Tests for getAccount', () => {
  test('Check successful', () => {
    jest.replaceProperty(storage, 'accountFile', testFileDirectoryPath + 'account.json');

    const expectedAccount = { id: 'account' };
    expect(getAccount()).toStrictEqual(expectedAccount);
  });
});
