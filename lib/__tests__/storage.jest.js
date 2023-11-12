const { isMyPost, INDEX, isIndexed, fromIndex, readJSONDictionary, CACHE } = require('../storage');

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
    INDEX.splice(0, INDEX.length);
    expect(isIndexed('abc')).toBe(false);
  });

  test('Check with existing id in array', () => {
    INDEX.splice(0, INDEX.length);
    INDEX.push({ id: 'abc' });
    expect(isIndexed('abc')).toBe(true);
  });

  test('Check with non-existing id in array', () => {
    INDEX.splice(0, INDEX.length);
    INDEX.push({ id: 'abc' });
    expect(isIndexed('def')).toBe(false);
  });
});

describe('Tests for fromIndex', () => {
  test('Check on empty array', () => {
    INDEX.splice(0, INDEX.length);
    expect(fromIndex('abc')).toBe(false);
  });

  test('Check with existing id in array', () => {
    INDEX.splice(0, INDEX.length);
    INDEX.push({ id: 'abc' });
    expect(fromIndex('abc')).toStrictEqual({ id: 'abc' });
  });

  test('Check with non-existing id in array', () => {
    INDEX.splice(0, INDEX.length);
    INDEX.push({ id: 'abc' });
    expect(fromIndex('def')).toBe(false);
  });
});

describe('Tests for readJSONDictionary', () => {
  test('Check with non-existing path', () => {
    const mockDate = new Date('2023-01-01T00:00:00Z');
    const spy = jest.spyOn(global, 'Date').mockImplementation(() => mockDate);

    const path = 'files/garbage';

    readJSONDictionary(path);

    expect(CACHE[path]).toStrictEqual({ time: mockDate.getTime(), lastAccess: mockDate.getTime(), contents: [] });
    spy.mockRestore();
  });

  test('Check with existing path and no cache hit', () => {
    const mockDate = new Date('2023-01-01T00:00:00Z');
    const spy = jest.spyOn(global, 'Date').mockImplementation(() => mockDate);

    const path = 'lib/__tests__/files/readJSONDictionary.json';

    readJSONDictionary(path);

    const jsonString = '{"id": "test"}';

    expect(CACHE[path]).toStrictEqual({
      time: mockDate.getTime(),
      lastAccess: mockDate.getTime(),
      contents: JSON.parse(jsonString)
    });
    spy.mockRestore();
  });

  test('Check with existing path and cache hit', () => {
    const mockDate = new Date('2022-01-01T00:00:00Z');
    const cachedDate = new Date('2023-01-01T00:00:00Z');
    const spy = jest.spyOn(global, 'Date').mockImplementation(() => mockDate);

    const path = 'lib/__tests__/files/readJSONDictionary.json';

    readJSONDictionary(path);

    const jsonString = '{"id": "test"}';

    expect(CACHE[path]).toStrictEqual({
      time: cachedDate.getTime(),
      lastAccess: mockDate.getTime(),
      contents: JSON.parse(jsonString)
    });
    spy.mockRestore();
  });
});
