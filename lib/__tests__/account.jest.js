import {
  getInboxIndex,
  writeInboxIndex,
  getInbox,
  addressedOnlyToMe,
  acceptDM,
  isMyPost,
  isFollowing,
  isFollower,
  isMention,
  isReplyToMyPost,
  createActor,
  createWebfinger,
  addNotification,
  writeNotifications,
  getNotifications,
  getBoosts,
  writeBoosts,
  isBlocked,
  getBlocks,
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
import path from 'path';
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

    const expectedInboxIndex = {
      id: 'inboxes',
      'justin@shuttlecraft.com': {
        lastRead: 1672531200000,
        latest: 1672531200000
      }
    };
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

    const expectedInbox = ['firstMessage'];
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

describe('Tests for acceptDM', () => {
  test('Check accepting DM', () => {
    jest.replaceProperty(storage, 'pathToDMs', testFileDirectoryPath + 'dms/');
    jest.spyOn(ActivityPub, 'actor', 'get').mockReturnValue({ id: 'justin' });

    const dm = { message: 'hello', attributedTo: 'jay' };
    const inboxUser = 'justin@shuttlecraft.com';
    acceptDM(dm, inboxUser);
    const inbox = getInbox(inboxUser);
    expect(inbox).toStrictEqual(['firstMessage', { message: 'hello', attributedTo: 'jay' }]);
    inbox.pop();
    const inboxPath = path.resolve(storage.pathToDMs, `${inboxUser}.json`);
    storage.writeJSONDictionary(inboxPath, inbox);
  });

  test('Check sending outbound DM', () => {
    jest.replaceProperty(storage, 'pathToDMs', testFileDirectoryPath + 'dms/');
    jest.spyOn(ActivityPub, 'actor', 'get').mockReturnValue({ id: 'justin' });
    const mockDate = new Date('2023-01-01T00:00:00Z');
    jest.spyOn(global, 'Date').mockImplementation(() => mockDate);

    const dm = { message: 'hi', attributedTo: 'justin' };
    const inboxUser = 'justin@shuttlecraft.com';
    acceptDM(dm, inboxUser);
    const inbox = getInbox(inboxUser);
    expect(inbox).toStrictEqual(['firstMessage', { message: 'hi', attributedTo: 'justin' }]);
    inbox.pop();
    const inboxPath = path.resolve(storage.pathToDMs, `${inboxUser}.json`);
    storage.writeJSONDictionary(inboxPath, inbox);

    const expectedInboxIndex = {
      id: 'inboxes',
      'justin@shuttlecraft.com': {
        lastRead: 1672531200000,
        latest: 1672531200000
      }
    };
    expect(getInboxIndex()).toStrictEqual(expectedInboxIndex);
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

describe('Tests for createActor', () => {
  test('Check successful', () => {
    const expectedActor = {
      '@context': ['https://www.w3.org/ns/activitystreams', 'https://w3id.org/security/v1'],
      bio: 'hello',
      followers: 'https://shuttlecraft.com/u/justin/followers',
      icon: {
        mediaType: 'image/jpg',
        type: 'Image',
        url: 'https://www.shutterstock.com/image-vector/user-profile-icon-vector-avatar-600nw-2247726673.jpg'
      },
      id: 'https://shuttlecraft.com/u/justin',
      image: {
        mediaType: 'image/png',
        type: 'Image',
        url: 'https://static.vecteezy.com/system/resources/thumbnails/011/125/580/small/torn-light-blue-paper-with-white-copyspace-for-your-message-png.png'
      },
      inbox: 'https://shuttlecraft.com/api/inbox',
      name: 'justin',
      outbox: 'https://shuttlecraft.com/api/outbox',
      preferredUsername: 'justin',
      publicKey: {
        id: 'https://shuttlecraft.com/u/justin#main-key',
        owner: 'https://shuttlecraft.com/u/justin',
        publicKeyPem: 'testPublicKey'
      },
      type: 'Person',
      url: 'https://shuttlecraft.com/'
    };
    const createdActor = createActor('justin', 'shuttlecraft.com', 'testPublicKey', 'hello');
    expect(createdActor).toStrictEqual(expectedActor);
  });
});

describe('Tests for createWebfinger', () => {
  test('Check successful', () => {
    const expectedWebfinger = {
      subject: 'acct:justin@shuttlecraft.com',
      links: [
        {
          rel: 'self',
          type: 'application/activity+json',
          href: 'https://shuttlecraft.com/u/justin'
        }
      ]
    };

    expect(createWebfinger('justin', 'shuttlecraft.com')).toStrictEqual(expectedWebfinger);
  });
});

describe('Tests for getOutboxPosts', () => {});

describe('Tests for addNotification', () => {
  test('Check successful', () => {
    jest.replaceProperty(storage, 'notificationsFile', testFileDirectoryPath + 'notifications.json');
    const mockDate = new Date('2023-01-01T00:00:00Z');
    jest.spyOn(global, 'Date').mockImplementation(() => mockDate);

    const notificationToAdd = { message: 'testNotification' };
    addNotification(notificationToAdd);

    const expectedNotifications = [
      'notification',
      {
        time: 1672531200000,
        notification: { message: 'testNotification' }
      }
    ];
    expect(getNotifications()).toStrictEqual(expectedNotifications);
  });
});

describe('Tests for writeNotifications', () => {
  const notificationsPath = testFileDirectoryPath + 'notifications.json';

  test('Check successful', () => {
    fs.unlinkSync(notificationsPath);
    expect(fs.existsSync(notificationsPath)).toBe(false);

    jest.replaceProperty(storage, 'notificationsFile', notificationsPath);

    const expectedNotifications = ['notification'];
    writeNotifications(expectedNotifications);
    const jsonRaw = fs.readFileSync(notificationsPath);
    expect(JSON.parse(jsonRaw)).toStrictEqual(expectedNotifications);
  });
});

describe('Tests for getNotifications', () => {
  test('Check successful', () => {
    jest.replaceProperty(storage, 'notificationsFile', testFileDirectoryPath + 'notifications.json');

    const expectedNotifications = ['notification'];
    expect(getNotifications()).toStrictEqual(expectedNotifications);
  });
});

describe('Tests for isBlocked', () => {
  test('Check actor that is a banned user', () => {
    jest.replaceProperty(storage, 'blocksFile', testFileDirectoryPath + 'blocks.json');

    const actor = 'aditya';
    expect(isBlocked(actor)).toBe(true);
  });

  test('Check actor that is from a banned domain', () => {
    jest.replaceProperty(storage, 'blocksFile', testFileDirectoryPath + 'blocks.json');

    const actor = 'https://blockedDomain.com/enze';
    expect(isBlocked(actor)).toBe(true);
  });

  test('Check actor that is not a banned user', () => {
    jest.replaceProperty(storage, 'blocksFile', testFileDirectoryPath + 'blocks.json');

    const actor = 'justin';
    expect(isBlocked(actor)).toBe(false);
  });
});

describe('Tests for getBlocks', () => {
  test('Check successful', () => {
    jest.replaceProperty(storage, 'blocksFile', testFileDirectoryPath + 'blocks.json');

    const expectedBlocks = ['aditya', 'kashish', 'https://blockedDomain.com'];
    expect(getBlocks()).toStrictEqual(expectedBlocks);
  });
});

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
