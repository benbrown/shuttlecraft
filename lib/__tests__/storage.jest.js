const { isMyPost } = require('../storage');

beforeEach(() => {
  jest.resetModules();
});

describe('Tests for isMyPost', () => {
  test('Check if a post is my post', () => {
    const { DOMAIN } = process.env;
    const activityId = `https://${DOMAIN}/m/`;

    expect(isMyPost(activityId)).toBe(true);
  });

  test('Check if a post is not my post', () => {
    const activityId = `https://garbage/m/`;

    expect(isMyPost(activityId)).toBe(false);
  });
});

describe('Tests for isIndexed', () => {
  test('Check on empty array', () => {
    jest.mock('../storage', () => {
      const originalModule = jest.requireActual('../storage');
      const INDEX = [];
      return {
        __esModule: true,
        ...originalModule,
        isIndexed: jest.fn(id => {
          return INDEX.some(p => id === p.id);
        })
      };
    });

    const mockedModule = require('../storage');
    expect(mockedModule.isIndexed('abc')).toBe(false);
  });

  test('Check with existing id in array', () => {
    jest.mock('../storage', () => {
      const originalModule = jest.requireActual('../storage');
      const INDEX = [{ id: 'abc' }];
      return {
        __esModule: true,
        ...originalModule,
        isIndexed: jest.fn(id => {
          return INDEX.some(p => id === p.id);
        })
      };
    });

    const mockedModule = require('../storage');
    expect(mockedModule.isIndexed('abc')).toBe(true);
  });

  test('Check with non-existing id in array', () => {
    jest.mock('../storage', () => {
      const originalModule = jest.requireActual('../storage');
      const INDEX = [{ id: 'abc' }];
      return {
        __esModule: true,
        ...originalModule,
        isIndexed: jest.fn(id => {
          return INDEX.some(p => id === p.id);
        })
      };
    });

    const mockedModule = require('../storage');
    expect(mockedModule.isIndexed('def')).toBe(false);
  });
});
