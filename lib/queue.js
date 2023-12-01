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
});

queue.on('start', () => logger('QUEUE STARTING'));
queue.on('stop', () => logger('QUEUE STOPPING'));
queue.on('end', () => logger('QUEUE ENDING'));
queue.on('dequeue', () => logger('DEQUEUING!', queue.size));

/* The code block you provided is setting up event listeners for the `resolve` and `reject` events of
the `queue` object, and then starting a loop that continuously dequeues items from the queue until
`queue.shouldRun` is false. */
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
    (async () => {
      await queue.dequeue();
    })();
  } catch (err) {
    console.error(err);
  }
}
