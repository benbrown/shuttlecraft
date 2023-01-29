/**
 * This is a VERY BASIC implementation of a queue for outgoing requests.
 * This separates the sending of the messages, which could take a while, require retries, etc from the response to the server or UI.
 */

import Queue from 'queue-promise';
import debug from 'debug';
const logger = debug('ono:queue');

export const queue = new Queue({
  concurrent: 4,
  interval: 250
  //   concurrent: 1,
  //   interval: 2000
});

queue.on('start', () => logger('QUEUE STARTING'));
queue.on('stop', () => logger('QUEUE STOPPING'));
queue.on('end', () => logger('QUEUE ENDING'));
queue.on('dequeue', () => logger('DEQUEUING!', queue.size));

queue.on('resolve', data => {
  if (data.url) {
    logger(`SEND STATUS ${data.status} ${data.statusText} FOR  ${data.url} `);
  } else {
    logger(data);
  }
});
queue.on('reject', error => console.error(error));

while (queue.shouldRun) {
  try {
    await queue.dequeue();
  } catch (err) {
    console.error(err);
  }
}
