import fs from 'fs';
import glob from 'glob';
import path from 'path';
import debug from 'debug';
const logger = debug('ono:storage');
import md5 from 'md5';
import dotenv from 'dotenv';
dotenv.config();

export const pathToFiles = path.resolve('./',`data/activitystream/`);
export const pathToPosts = path.resolve('./',`data/posts/`);
export const followersFile = path.resolve('./','data/followers.json');
export const followingFile = path.resolve('./','data/following.json');
export const notificationsFile = path.resolve('./','data/notifications.json');
export const likesFile = path.resolve('./','data/likes.json');
export const blocksFile = path.resolve('./','data/blocks.json');
export const accountFile = path.resolve('./','data/account.json');

const { DOMAIN } = process.env;

export const INDEX = [];
export const CACHE = {};
const cacheMax = 60*5*1000; // 5 minutes
const cacheMin = 30*1000; // 5 minutes

const zeroPad = (num) => {
  if (num < 10) { return `0${num}`; } else return num;
}

export const isMyPost = (activityId) => {
  return (activityId.startsWith(`https://${DOMAIN}/m/`));
}

export const isIndexed = (id) => {
  return INDEX.find((p)=>id===p.id);
}

export const addFailureToIndex = (note, type='fail') => {
  INDEX.push({
    type: type,
    id: note.id,
    published: note.time,
    status: note.status,
  });
}
export const addActivityToIndex = (note, type='activity') => {
  INDEX.push({
    type: type,
    id: note.id,
    actor: note.attributedTo || note.actor,
    published: new Date(note.published).getTime(),
    inReplyTo: note.inReplyTo,
  });
}

export const getFileName = (activityId) => {
  // // find the item in the index
    // first check cache!
  let meta;
  if (CACHE[activityId]) {
    meta = CACHE[activityId].contents;
  } else {
    meta = INDEX.find((m)=>m.id === activityId);
    if (!meta) {
      console.error('id not found in index!', activityId);
      throw new Error('id not found in index');
    }
  }

  const rootPath = isMyPost(activityId) ? pathToPosts : pathToFiles;

  // create a dated subfolder
  const datestamp = new Date(meta.published);
  const folder =  datestamp.getFullYear() + '/' + zeroPad((datestamp.getMonth()+1)) + '-' + zeroPad(datestamp.getDate());
  return path.resolve(rootPath, folder, `${ md5(meta.id) }.json`);
}

export const getLikesFileName = (activityId) => {
  // // find the item in the index
  // first check cache!
  let meta;
  if (CACHE[activityId]) {
    meta = CACHE[activityId].contents;
  } else {
    meta = INDEX.find((m)=>m.id === activityId);
    if (!meta) {
      console.error('id not found in index!', activityId);
      throw new Error('id not found in index');
    }
  }

  const rootPath = pathToPosts;

  // create a dated subfolder
  const datestamp = new Date(meta.published);
  const folder =  datestamp.getFullYear() + '/' + zeroPad((datestamp.getMonth()+1)) + '-' + zeroPad(datestamp.getDate());
  return path.resolve(rootPath, folder, `${ md5(meta.id) }.likes.json`);
}


export const createFileName = (activity) => {

  // create a dated subfolder
  const datestamp = new Date(activity.published);
  const folder =  datestamp.getFullYear() + '/' + zeroPad((datestamp.getMonth()+1)) + '-' + zeroPad(datestamp.getDate());

  const rootPath = isMyPost(activity.id) ? pathToPosts : pathToFiles;
  // ensure the subfolder is prsent
  if (!fs.existsSync(path.resolve(rootPath, folder))) {
    fs.mkdirSync(path.resolve(rootPath, folder),{ recursive: true });
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
    glob(path.join(pathToFiles,'**/*.json'), async (err, files) => {
        let res = [];
        for (const f of files) {
          try {
              const post = JSON.parse(fs.readFileSync(path.resolve(pathToFiles,f)));
              addActivityToIndex(post);
          } catch(err) {
              console.error('failed to parse',f);
              console.error(err);
          }
        }

        glob(path.join(pathToPosts,'**/*.json'), async (err, files) => {

            for (const f of files) {
                try {
                    if (!f.includes('likes')) {
                      const post = JSON.parse(fs.readFileSync(path.resolve(pathToFiles,f)));
                      addActivityToIndex(post, 'note');
                    }
                  } catch(err) {
                    console.error('failed to parse',f);
                    console.error(err);
                }
            }

            resolve(INDEX);
        });
     });
  });
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
  
export  const writeJSONDictionary = (path, data) => {
  const now = new Date().getTime();
  logger('write cache', path);
  CACHE[path] = {
    time: now,
    lastAccess: now,
    contents: data,
  }
  fs.writeFileSync(path, JSON.stringify(data,null,2));
}
  
logger('BUILDING INDEX');
buildIndex().then(() => {
  logger('INDEX BUILT!');
});