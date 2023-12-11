import { ActivityPubClient } from '../ActivityPub';

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

describe('Tests for ActivityPubClient fetchActor', () => {});

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
