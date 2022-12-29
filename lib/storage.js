import fs from 'fs';
import glob from 'glob';
import path from 'path';
import debug from 'debug';
const logger = debug('ono:storage');
import md5 from 'md5';
import dotenv from 'dotenv';
import { getHashtagsFromNote } from './notes.js';
dotenv.config();

export const dataDir = path.resolve('./', '.data/');
export const pathToFiles = path.resolve(dataDir, 'activitystream/');
export const pathToPosts = path.resolve(dataDir, 'posts/');
export const pathToUsers = path.resolve(dataDir, 'users/');
export const pathToDMs = path.resolve(dataDir, 'dms/');
export const pathToMedia = path.resolve(dataDir, 'media/');

export const followersFile = path.resolve(dataDir, 'followers.json');
export const followingFile = path.resolve(dataDir, 'following.json');
export const notificationsFile = path.resolve(dataDir, 'notifications.json');
export const likesFile = path.resolve(dataDir, 'likes.json');
export const boostsFile = path.resolve(dataDir, 'boosts.json');
export const blocksFile = path.resolve(dataDir, 'blocks.json');
export const accountFile = path.resolve(dataDir, 'account.json');

const {
  DOMAIN
} = process.env;

export const INDEX = [];
export const CACHE = {};
const cacheMax = 60 * 5 * 1000; // 5 minutes
const cacheMin = 30 * 1000; // 5 minutes

const zeroPad = (num) => {
  if (num < 10) {
    return `0${num}`;
  } else return num;
}

export const isMyPost = (activityId) => {
  return (activityId.startsWith(`https://${DOMAIN}/m/`));
}

export const isIndexed = (id) => {
  return INDEX.some((p) => id === p.id);
}

export const addFailureToIndex = (note, type = 'fail') => {
  INDEX.push({
    type: type,
    id: note.id,
    published: note.time,
    status: note.status,
  });
}
export const addActivityToIndex = (note, type = 'activity') => {
  INDEX.push({
    type: type,
    id: note.id,
    actor: note.attributedTo || note.actor,
    published: new Date(note.published).getTime(),
    inReplyTo: note.inReplyTo,
    hashtags: getHashtagsFromNote(note)
  });
}
export const deleteActivityFromIndex = (id, type = 'activity') => {
  let n = null;
  for (let i=0;i<INDEX.length;i++) {
    if (INDEX[i].id === id) {
      n = i;
      break;
    }
  }
  if (n) {
    INDEX.splice(n, 1);
  }
}

export const getFileName = (activityId) => {
  // // find the item in the index
  // first check cache!
  let meta;
  if (CACHE[activityId]) {
    meta = CACHE[activityId].contents;
  } else {
    meta = INDEX.find((m) => m.id === activityId);
    if (!meta) {
      console.error('id not found in index!', activityId);
      throw new Error('id not found in index');
    }
  }

  const rootPath = isMyPost(activityId) ? pathToPosts : pathToFiles;

  // create a dated subfolder
  const datestamp = new Date(meta.published);
  const folder = datestamp.getFullYear() + '/' + zeroPad((datestamp.getMonth() + 1)) + '-' + zeroPad(datestamp.getDate());
  return path.resolve(rootPath, folder, `${ md5(meta.id) }.json`);
}

export const getLikesFileName = (activityId) => {
  // // find the item in the index
  // first check cache!
  let meta;
  if (CACHE[activityId]) {
    meta = CACHE[activityId].contents;
  } else {
    meta = INDEX.find((m) => m.id === activityId);
    if (!meta) {
      console.error('id not found in index!', activityId);
      throw new Error('id not found in index');
    }
  }

  const rootPath = pathToPosts;

  // create a dated subfolder
  const datestamp = new Date(meta.published);
  const folder = datestamp.getFullYear() + '/' + zeroPad((datestamp.getMonth() + 1)) + '-' + zeroPad(datestamp.getDate());
  return path.resolve(rootPath, folder, `${ md5(meta.id) }.likes.json`);
}


export const createFileName = (activity) => {

  // create a dated subfolder
  const datestamp = new Date(activity.published);
  const folder = datestamp.getFullYear() + '/' + zeroPad((datestamp.getMonth() + 1)) + '-' + zeroPad(datestamp.getDate());

  const rootPath = isMyPost(activity.id) ? pathToPosts : pathToFiles;
  // ensure the subfolder is prsent
  if (!fs.existsSync(path.resolve(rootPath, folder))) {
    fs.mkdirSync(path.resolve(rootPath, folder), {
      recursive: true
    });
  }
  return path.resolve(rootPath, folder, `${ md5(activity.id) }.json`);
}


const cacheExpire = () => {
  const now = new Date().getTime();
  for (const key in CACHE) {
    if (CACHE[key].lastAccess < (now - cacheMin)) {
      logger('clearing cache for', key);
      delete CACHE[key];
    }
  }
}

const garbageCollector = setInterval(() => {
  cacheExpire();
}, cacheMin);


const buildIndex = () => {
  return new Promise((resolve, reject) => {
    glob(path.join(pathToFiles, '**/*.json'), async (err, files) => {
      let res = [];
      for (const f of files) {
        try {
          const post = JSON.parse(fs.readFileSync(path.resolve(pathToFiles, f)));
          addActivityToIndex(post);
        } catch (err) {
          console.error('failed to parse', f);
          console.error(err);
        }
      }

      glob(path.join(pathToPosts, '**/*.json'), async (err, files) => {

        for (const f of files) {
          try {
            if (!f.includes('likes')) {
              const post = JSON.parse(fs.readFileSync(path.resolve(pathToFiles, f)));
              addActivityToIndex(post, 'note');
            }
          } catch (err) {
            console.error('failed to parse', f);
            console.error(err);
          }
        }

        resolve(INDEX);
      });
    });
  });
}


const ensureDataFolder = () => {
  if (!fs.existsSync(path.resolve(pathToPosts))) {
    logger('mkdir', pathToPosts);
    fs.mkdirSync(path.resolve(pathToPosts), {
      recursive: true
    });
  }
  if (!fs.existsSync(path.resolve(pathToFiles))) {
    logger('mkdir', pathToFiles);
    fs.mkdirSync(path.resolve(pathToFiles), {
      recursive: true
    });
  }
  if (!fs.existsSync(path.resolve(pathToUsers))) {
    logger('mkdir', pathToUsers);
    fs.mkdirSync(path.resolve(pathToUsers), {
      recursive: true
    });
  }
  if (!fs.existsSync(path.resolve(pathToDMs))) {
    logger('mkdir', pathToDMs);
    fs.mkdirSync(path.resolve(pathToDMs), {
      recursive: true
    });
  }
  if (!fs.existsSync(path.resolve(pathToMedia))) {
    logger('mkdir', pathToMedia);
    fs.mkdirSync(path.resolve(pathToMedia), {
      recursive: true
    });
  }
}


export const readJSONDictionary = (path, defaultVal = []) => {
  const now = new Date().getTime();
  if (CACHE[path] && (CACHE[path].time > (now - cacheMax))) {
    logger('cache hit for', path);
    CACHE[path].lastAccess = now;
    return CACHE[path].contents;
  } else {
    logger('read from disk', path);
    let jsonRaw = JSON.stringify(defaultVal);
    if (fs.existsSync(path)) {
      jsonRaw = fs.readFileSync(path);
    }
    const results = JSON.parse(jsonRaw) || defaultVal;
    CACHE[path] = {
      time: now,
      lastAccess: now,
      contents: results,
    }
    return results;
  }
}

// data is JSON stringified string containing {type: mimetype, data: base64}
export const writeMediaFile = (filename, attachment) => {
  logger('write media', filename);
  // write just the data part to file called <hash>
  fs.writeFileSync(path.join(pathToMedia, filename + '.' + attachment.type.split('/')[1]), attachment.data);
  delete attachment.data;
  // write the remaining metadata to <hash>.json
  fs.writeFileSync(path.join(pathToMedia, filename) + '.json', JSON.stringify(attachment));
}

// returns JSON stringified string containing {type: mimetype, data: base64}
export const readMediaFile = (filename) => {
  logger('read media', filename);
  // remove any .{ext} from filename
  let bareFilename = filename.replace(/\..*/, '');
  let attachment = JSON.parse(fs.readFileSync(path.join(pathToMedia, bareFilename) + '.json'));
  attachment.data = fs.readFileSync(path.join(pathToMedia, bareFilename + '.' + attachment.type.split('/')[1]));
  return attachment;
}

export const writeJSONDictionary = (path, data) => {
  const now = new Date().getTime();
  logger('write cache', path);
  CACHE[path] = {
    time: now,
    lastAccess: now,
    contents: data,
  }
  fs.writeFileSync(path, JSON.stringify(data, null, 2));
}

logger('BUILDING INDEX');
ensureDataFolder();
buildIndex().then(() => {
  logger('INDEX BUILT!');
});
