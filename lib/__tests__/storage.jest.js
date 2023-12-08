import {
  pathToFiles,
  pathToPosts,
  isMyPost,
  INDEX,
  isIndexed,
  fromIndex,
  readJSONDictionary,
  writeJSONDictionary,
  CACHE,
  deleteJSONDictionary,
  addFailureToIndex,
  addActivityToIndex,
  deleteActivityFromIndex,
  getFileName,
  getLikesFileName,
  createFileName
} from '../storage.js';
import fs from 'fs';
import path from 'path';
import md5 from 'md5';

const zeroPad = num => {
  if (num < 10) {
    return `0${num}`;
  } else return num;
};

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
    deleteActivityFromIndex('abc');
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

describe('Tests for writeJSONDictionary', () => {
  test('Check successful', () => {
    const mockDate = new Date('2023-01-01T00:00:00Z');
    const spy = jest.spyOn(global, 'Date').mockImplementation(() => mockDate);

    const path = 'lib/__tests__/files/writeJSONDictionary.json';
    const data = { id: 'test' };

    writeJSONDictionary(path, data);

    expect(CACHE[path]).toEqual({
      time: mockDate.getTime(),
      lastAccess: mockDate.getTime(),
      contents: data
    });
    const fileContent = fs.readFileSync(path, 'utf-8');
    expect(fileContent).toMatch(JSON.stringify(data, null, 2));
    spy.mockRestore();
  });
});

describe('Tests for deleteJSONDictionary', () => {
  test('Check with existing path', () => {
    const path = 'lib/__tests__/files/writeJSONDictionary.json';

    deleteJSONDictionary(path);

    expect(fs.existsSync(path)).toBe(false);
    expect(CACHE[path]).toBe(undefined);
  });
});

describe('Tests for addFailureToIndex', () => {
  test('Check successful', () => {
    const mockDate = new Date('2023-01-01T00:00:00Z');
    const id = 'def';

    const note = { id: id, time: mockDate.getTime(), status: 'error' };

    addFailureToIndex(note);

    const failure = fromIndex(id);
    expect(failure.type).toBe('fail');
    expect(failure.id).toBe(id);
    expect(failure.published).toBe(mockDate.getTime());
    expect(failure.status).toBe('error');

    deleteActivityFromIndex(id);
  });
});

describe('Tests for addActivityToIndex', () => {
  test('Check successful', () => {
    const mockDate = new Date('2023-01-01T00:00:00Z');
    const id = 'ghi';
    const attributedTo = 'justin';
    const published = '2023-01-01T00:00:00Z';
    const inReplyTo = 'ever';
    const note = { id: id, attributedTo: attributedTo, published: published, inReplyTo: inReplyTo };

    addActivityToIndex(note);

    const activity = fromIndex(id);
    expect(activity.type).toBe('activity');
    expect(activity.id).toBe(id);
    expect(activity.actor).toBe(attributedTo);
    expect(activity.published).toBe(mockDate.getTime());
    expect(activity.inReplyTo).toBe(inReplyTo);

    deleteActivityFromIndex(id);
  });
});

describe('Tests for deleteActivityFromIndex', () => {
  test('Check successful', () => {
    const mockDate = new Date('2023-01-01T00:00:00Z');
    const id = 'jkl';
    const attributedTo = 'justin';
    const published = '2023-01-01T00:00:00Z';
    const inReplyTo = 'ever';
    const note = { id: id, attributedTo: attributedTo, published: published, inReplyTo: inReplyTo };

    addActivityToIndex(note);

    const activity = fromIndex(id);
    expect(activity.type).toBe('activity');
    expect(activity.id).toBe(id);
    expect(activity.actor).toBe(attributedTo);
    expect(activity.published).toBe(mockDate.getTime());
    expect(activity.inReplyTo).toBe(inReplyTo);

    deleteActivityFromIndex(id);

    expect(INDEX.findIndex(idx => idx.id === id)).toBe(-1);
  });
});

describe('Tests for getFileName', () => {
  test('Check when file not cached', () => {
    const mockDate = new Date('2023-01-01T00:00:00Z');
    const id = 'abc';
    const attributedTo = 'justin';
    const published = '2023-01-01T00:00:00Z';
    const inReplyTo = 'ever';
    const note = { id: id, attributedTo: attributedTo, published: published, inReplyTo: inReplyTo };

    addActivityToIndex(note);

    const folder = mockDate.getFullYear() + '/' + zeroPad(mockDate.getMonth() + 1) + '-' + zeroPad(mockDate.getDate());

    expect(getFileName(id)).toBe(path.resolve(pathToFiles, folder, `${md5(id)}.json`));
  });
  test('Check when file is cached', () => {
    const mockDate = new Date('2023-01-01T00:00:00Z');
    const id = 'abc';

    const folder = mockDate.getFullYear() + '/' + zeroPad(mockDate.getMonth() + 1) + '-' + zeroPad(mockDate.getDate());

    expect(getFileName(id)).toBe(path.resolve(pathToFiles, folder, `${md5(id)}.json`));
    deleteActivityFromIndex(id);
  });
});

describe('Tests for getLikesFileName', () => {
  test('Check when file not cached', () => {
    const mockDate = new Date('2023-01-01T00:00:00Z');
    const id = 'abc';
    const attributedTo = 'justin';
    const published = '2023-01-01T00:00:00Z';
    const inReplyTo = 'ever';
    const note = { id: id, attributedTo: attributedTo, published: published, inReplyTo: inReplyTo };

    addActivityToIndex(note);

    const folder = mockDate.getFullYear() + '/' + zeroPad(mockDate.getMonth() + 1) + '-' + zeroPad(mockDate.getDate());

    expect(getLikesFileName(id)).toBe(path.resolve(pathToPosts, folder, `${md5(id)}.likes.json`));
  });
  test('Check when file is cached', () => {
    const mockDate = new Date('2023-01-01T00:00:00Z');
    const id = 'abc';

    const folder = mockDate.getFullYear() + '/' + zeroPad(mockDate.getMonth() + 1) + '-' + zeroPad(mockDate.getDate());

    expect(getLikesFileName(id)).toBe(path.resolve(pathToPosts, folder, `${md5(id)}.likes.json`));
    deleteActivityFromIndex(id);
  });
});

describe('Tests for createFileName', () => {
  test('Check successful', () => {
    const mockDate = new Date('2023-01-01T00:00:00Z');
    const id = 'jkl';
    const attributedTo = 'justin';
    const published = '2023-01-01T00:00:00Z';
    const inReplyTo = 'ever';
    const note = { id: id, attributedTo: attributedTo, published: published, inReplyTo: inReplyTo };

    addActivityToIndex(note);

    const activity = fromIndex(id);

    const folder = mockDate.getFullYear() + '/' + zeroPad(mockDate.getMonth() + 1) + '-' + zeroPad(mockDate.getDate());

    expect(createFileName(activity)).toBe(path.resolve(pathToFiles, folder, `${md5(id)}.json`));
    expect(fs.existsSync(path.resolve(pathToFiles, folder))).toBe(true);
    deleteActivityFromIndex(id);
  });
});

describe('Tests for searchKnownUsers', () => {});
