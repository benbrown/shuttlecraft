import { once, EventEmitter } from 'events';
import debug from 'debug';

const logger = debug('ono:event');

/**
 * UserEvent - a class for handling real-time event updates
 */
export class UserEventClient {

  constructor() {
    this.emitter = new EventEmitter();
    this.ac = new AbortController();
  }

  sendEvent(e, data) {
    logger('SENDING EVENT ' + data);
    this.emitter.emit('poll', data);
  }

  abort() {
    this.ac.abort();
    this.ac = new AbortController();
  }

  async waitForEvent() {
    const [data] = await once(this.emitter, 'poll', { signal: this.ac.signal });
    logger('RECEIVED EVENT ' + data);
  }

}

export const UserEvent = new UserEventClient();

