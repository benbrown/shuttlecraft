import { once, EventEmitter } from 'events';
import debug from 'debug';

const logger = debug('ono:event');

/**
 * UserEvent - a class for handling real-time event updates
 */
export class UserEventClient {

  constructor() {
    this.emitter = new EventEmitter();
  }

  sendEvent(e, data) {
    logger('SENDING EVENT ' + data);
    this.emitter.emit('poll', data);
  }

  async waitForEvent() {
    const [data] = await once(this.emitter, 'poll');
    logger('RECEIVED EVENT ' + data);
  }

}

export const UserEvent = new UserEventClient();

