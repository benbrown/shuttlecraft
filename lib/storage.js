import fs from 'fs';
import glob from 'glob';
import path from 'path';

const pathToFiles = path.resolve('./',`data/activitystream/`);
const pathToPosts = path.resolve('./',`data/posts/`);

export const INDEX = [];


const buildIndex = () => {
  return new Promise((resolve, reject) => {
    glob(path.join(pathToFiles,'*.json'), async (err, files) => {
        let res = [];
        for (const f of files) {
          try {
              const post = JSON.parse(fs.readFileSync(path.resolve(pathToFiles,f)));
              INDEX.push({
                type: 'activity', // someone else
                id: post.id,
                actor: post.attributedTo || post.actor, // boosts do not have attributedTo
                published: new Date(post.published).getTime(),
                inReplyTo: post.inReplyTo,
              });
          } catch(err) {
              console.error('failed to parse',f);
              console.error(err);
          }
        }

        glob(path.join(pathToPosts,'*.json'), async (err, files) => {

            for (const f of files) {
                try {
                    if (!f.includes('likes')) {
                      const post = JSON.parse(fs.readFileSync(path.resolve(pathToFiles,f)));
                      INDEX.push({
                        type: 'note', // someone else
                        id: post.id,
                        actor: post.attributedTo,
                        published: new Date(post.published).getTime(),
                        inReplyTo: post.inReplyTo,
                      });
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



export const readJSONDictionary = (path) => {
    let jsonRaw = '[]';
    if (fs.existsSync(path)) {
       jsonRaw = fs.readFileSync(path);
    }
    const results = JSON.parse(jsonRaw) || [];
    return results;
  }
  
export  const writeJSONDictionary = (path, data) => {
    fs.writeFileSync(path, JSON.stringify(data,null,2));
  }
  

console.log('BUILDING INDEX', buildIndex());