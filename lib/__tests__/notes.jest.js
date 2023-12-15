import fs from 'fs';
import {
  INDEX,
  deleteActivityFromIndex,
  addActivityToIndex,
  getLikesFileName,
  writeJSONDictionary
} from '../storage.js';
import { getLikesForNote, getReplyCountForNote, recordLike, recordBoost, recordUndoLike } from '../notes.js';

beforeEach(() => {
  jest.resetModules();
});

jest.mock('../storage', () => ({
  ...jest.requireActual('../storage'),
  getLikesFileName: jest.fn(() => 'lib/__tests__/files/likedata.json')
}));

describe('Tests for getLikesForNote', () => {
  test('Check if the output matches', () => {
    const mockDate = new Date('2023-01-01T00:00:00Z');
    const spy = jest.spyOn(global, 'Date').mockImplementation(() => mockDate);
    const id = 'abc';
    const attributedTo = 'justin';
    const published = '2023-01-01T00:00:00Z';
    const inReplyTo = 'ever';
    const note = { id: id, attributedTo: attributedTo, published: published, inReplyTo: inReplyTo };

    addActivityToIndex(note);

    const content = { id: 'abc', likes: [], boosts: [] };

    expect(getLikesForNote(id)).toStrictEqual(content);
    deleteActivityFromIndex(id);
    spy.mockRestore();
  });
});

describe('Tests for getReplyCountForNote', () => {
  test('Check on empty array', () => {
    INDEX.splice(0, INDEX.length);
    expect(getReplyCountForNote('A')).toBe(0);
  });

  test('Check with existing inReplyTo in INDEX', () => {
    INDEX.splice(0, INDEX.length);
    INDEX.push({ id: '1', inReplyTo: 'AB' }, { id: '2', inReplyTo: 'AB' }, { id: '3', inReplyTo: 'AC' });
    expect(getReplyCountForNote('AB')).toBe(2);
  });

  test('Check with non-existing inReplyTo in INDEX', () => {
    INDEX.splice(0, INDEX.length);
    INDEX.push({ id: '1', inReplyTo: 'AB' }, { id: '2', inReplyTo: 'CD' });
    expect(getReplyCountForNote('AC')).toBe(0);
  });
});

describe('Tests for recordLike', () => {
  test('Check for no actor like records', () => {
    const mockDate = new Date('2023-01-01T00:00:00Z');
    const spy = jest.spyOn(global, 'Date').mockImplementation(() => mockDate);
    const id = 'abc';
    const attributedTo = 'justin';
    const published = '2023-01-01T00:00:00Z';
    const inReplyTo = 'ever';
    const note = { id: id, attributedTo: attributedTo, published: published, inReplyTo: inReplyTo };

    addActivityToIndex(note);
    const request = { actor: 'Ever', object: id };

    const old_likes = getLikesForNote(id);

    expect(old_likes.likes.indexOf('Ever')).toBeLessThan(0);
    recordLike(request);

    const likes = getLikesForNote(id);
    expect(likes.likes.indexOf('Ever')).toBeGreaterThanOrEqual(0);

    const fileName = getLikesFileName(id);
    const fileContent = fs.readFileSync(fileName, 'utf-8');

    expect(fileContent).toMatch(JSON.stringify(likes, null, 2));
    deleteActivityFromIndex(id);

    spy.mockRestore();
  });
});

describe('Tests for recordBoost', () => {
  test('Check for no actor boost records', () => {
    const mockDate = new Date('2023-01-01T00:00:00Z');
    const spy = jest.spyOn(global, 'Date').mockImplementation(() => mockDate);
    const id = 'abc';
    const attributedTo = 'justin';
    const published = '2023-01-01T00:00:00Z';
    const inReplyTo = 'ever';
    const note = { id: id, attributedTo: attributedTo, published: published, inReplyTo: inReplyTo };

    addActivityToIndex(note);
    const request = { actor: 'def', object: id };

    const old_likes = getLikesForNote(id);

    expect(old_likes.boosts.indexOf('def')).toBeLessThan(0);
    recordBoost(request);

    const likes = getLikesForNote(id);
    expect(likes.boosts.indexOf('def')).toBeGreaterThanOrEqual(0);

    const fileName = getLikesFileName(id);
    const fileContent = fs.readFileSync(fileName, 'utf-8');

    expect(fileContent).toMatch(JSON.stringify(likes, null, 2));
    deleteActivityFromIndex(id);

    spy.mockRestore();
  });
});

describe('Tests for recordUndoLike', () => {
  test('Check when undoing a like', () => {
    const mockDate = new Date('2023-01-01T00:00:00Z');
    const spy = jest.spyOn(global, 'Date').mockImplementation(() => mockDate);
    const id = 'abc';
    const attributedTo = 'justin';
    const published = '2023-01-01T00:00:00Z';
    const inReplyTo = 'ever';
    const note = { id: id, attributedTo: attributedTo, published: published, inReplyTo: inReplyTo };

    addActivityToIndex(note);
    const request = { actor: 'Ever', object: id };

    recordUndoLike(request);

    const likes = getLikesForNote(id);
    expect(likes.likes.indexOf('Ever')).toBeLessThan(0);

    const fileName = getLikesFileName(id);
    const fileContent = fs.readFileSync(fileName, 'utf-8');

    expect(fileContent).toMatch(JSON.stringify(likes, null, 2));
    deleteActivityFromIndex(id);

    likes.boosts = [];
    writeJSONDictionary(fileName, likes);
    spy.mockRestore();
  });
});
