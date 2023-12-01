import { ActivityPub } from '../ActivityPub';

describe('Tests for ActivityPubClient', () => {
  test('Initial state', () => {
    expect(ActivityPub.account).toBe(undefined);
  });
});
