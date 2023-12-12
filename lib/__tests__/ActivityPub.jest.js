import { ActivityPubClient, ActivityPub } from '../ActivityPub';
import crypto from 'crypto';

jest.mock('node-fetch');

import fetch from 'node-fetch';

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Tests for ActivityPubClient constructor', () => {
  test('Check successful initialization of account', () => {
    const expectedAccount = { actor: 'justin' };
    const activityPubClient = new ActivityPubClient(expectedAccount);
    expect(activityPubClient.account).toStrictEqual(expectedAccount);
  });
});

describe('Tests for ActivityPubClient set and get actor', () => {
  test('Check successful setting and getting of actor', () => {
    const activityPubClient = new ActivityPubClient({ actor: 'justin' });
    expect(activityPubClient.actor).toBe('justin');
    activityPubClient.actor = 'jay';
    expect(activityPubClient.actor).toBe('jay');
  });
});

describe('Tests for ActivityPubClient set and get account', () => {
  test('Check successful setting and getting of account', () => {
    const activityPubClient = new ActivityPubClient();
    expect(activityPubClient.account).toBe(undefined);
    const expectedAccount = { actor: 'justin' };
    activityPubClient.account = expectedAccount;
    expect(activityPubClient.account).toStrictEqual(expectedAccount);
    expect(activityPubClient.actor).toBe('justin');
  });
});

describe('Tests for ActivityPubClient webfinger', () => {
  test('Check successful fetching webfinger', async () => {
    fetch.mockReturnValue(
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ testWebfinger: 'testWebfinger' })
      })
    );

    const activityPubClient = new ActivityPubClient();
    const webfinger = await activityPubClient.webfinger('justin@shuttlecraft.com');
    expect(webfinger).toStrictEqual({ testWebfinger: 'testWebfinger' });
  });

  test('Check error when fetching webfinger', async () => {
    fetch.mockReturnValue(
      Promise.resolve({
        ok: false,
        json: () => Promise.resolve({ testWebfinger: 'testWebfinger' })
      })
    );

    const activityPubClient = new ActivityPubClient();
    try {
      await activityPubClient.webfinger('justin@shuttlecraft.com');
    } catch (e) {
      expect(e).toMatchObject(
        new Error(
          'could not get webfinger https://shuttlecraft.com/.well-known/webfinger?resource=acct:justin@shuttlecraft.com: undefined'
        )
      );
    }
  });
});

describe('Tests for ActivityPubClient fetchActor', () => {
  test('Check successful fetching actor', async () => {
    fetch.mockReturnValue(
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ testActor: 'testActor' })
      })
    );

    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'pkcs1',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs1',
        format: 'pem'
      }
    });

    jest
      .spyOn(ActivityPub, 'account', 'get')
      .mockReturnValue({ actor: { publicKey: { id: publicKey } }, privateKey: privateKey });
    jest.spyOn(ActivityPub, 'actor', 'get').mockReturnValue({ publicKey: { id: publicKey } });

    const actor = await ActivityPub.fetchActor('https://shuttlecraft.com/justin');
    expect(actor).toStrictEqual({ testActor: 'testActor' });
  });

  test('Check error when fetching actor', async () => {
    fetch.mockReturnValue(
      Promise.resolve({
        ok: false,
        json: () => Promise.resolve({ testActor: 'testActor' })
      })
    );

    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'pkcs1',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs1',
        format: 'pem'
      }
    });

    jest
      .spyOn(ActivityPub, 'account', 'get')
      .mockReturnValue({ actor: { publicKey: { id: publicKey } }, privateKey: privateKey });
    jest.spyOn(ActivityPub, 'actor', 'get').mockReturnValue({ publicKey: { id: publicKey } });

    try {
      await ActivityPub.fetchActor('https://shuttlecraft.com/justin');
    } catch (e) {
      expect(e).toMatchObject(new Error('failed to load actor'));
    }
  });
});

describe('Tests for ActivityPubClient fetch', () => {
  test('Check successful', async () => {
    fetch.mockReturnValue(
      Promise.resolve({
        fetch: 'fetch'
      })
    );

    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'pkcs1',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs1',
        format: 'pem'
      }
    });

    const activityPubClient = new ActivityPubClient({
      actor: { publicKey: { id: publicKey } },
      privateKey: privateKey
    });
    const fetchResult = await activityPubClient.fetch('https://shuttlecraft.com/justin', {});
    expect(fetchResult).toStrictEqual({ fetch: 'fetch' });
  });
});

describe('Tests for ActivityPubClient sendLike', () => {
  test('Check successful', async () => {
    const activityPubClient = new ActivityPubClient({ actor: { id: 'justin' } });
    const post = { id: 'post' };
    const recipient = { inbox: 'justin@shuttlecraft.com' };

    const sendLikeResult = await activityPubClient.sendLike(post, recipient);
    expect(sendLikeResult['@context']).toBe('https://www.w3.org/ns/activitystreams');
    expect(sendLikeResult.type).toBe('Like');
    expect(sendLikeResult.actor).toBe('justin');
    expect(sendLikeResult.object).toBe('post');
  });
});

describe('Tests for ActivityPubClient sendUndoLike', () => {
  test('Check successful', async () => {
    const activityPubClient = new ActivityPubClient({ actor: { id: 'justin' } });
    const post = { id: 'post' };
    const recipient = { inbox: 'justin@shuttlecraft.com' };

    const sendUndoLikeResult = await activityPubClient.sendUndoLike(post, recipient, 'originalId');
    console.log(sendUndoLikeResult);
    expect(sendUndoLikeResult['@context']).toBe('https://www.w3.org/ns/activitystreams');
    expect(sendUndoLikeResult.id).toBe('originalId/undo');
    expect(sendUndoLikeResult.type).toBe('Undo');
    expect(sendUndoLikeResult.actor).toBe('justin');
    expect(sendUndoLikeResult.object).toStrictEqual({
      id: 'originalId',
      type: 'Like',
      actor: 'justin',
      object: 'post'
    });
  });
});

describe('Tests for ActivityPubClient getUsernameDomain', () => {
  test('Check when userIdorName is not passed as an argument', () => {
    const activityPubClient = new ActivityPubClient();
    expect(activityPubClient.getUsernameDomain()).toStrictEqual({ username: '', targetDomain: '' });
  });

  test('Check when userIdorName starts with https://', () => {
    const activityPubClient = new ActivityPubClient();
    const expectedUsernameDomain = { username: 'justin', targetDomain: 'shuttlecraft.com' };
    expect(activityPubClient.getUsernameDomain('https://shuttlecraft.com/justin')).toStrictEqual(
      expectedUsernameDomain
    );
  });

  test('Check when userIdorName starts without https://', () => {
    const activityPubClient = new ActivityPubClient();
    const expectedUsernameDomain = { username: 'justin', targetDomain: 'shuttlecraft.com' };
    expect(activityPubClient.getUsernameDomain('justin@shuttlecraft.com')).toStrictEqual(expectedUsernameDomain);
  });
});

describe('Tests for ActivityPubClient getUsername', () => {
  test('Check getting username successfully', () => {
    const activityPubClient = new ActivityPubClient();
    expect(activityPubClient.getUsername('https://shuttlecraft.com/justin')).toStrictEqual('justin@shuttlecraft.com');
  });
});
