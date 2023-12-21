import { EventData, EventQueue } from './EventQueue';

async function startEventProcessor() {
  console.log('Started the event processor');
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (EventQueue.length > 0) {
      const event = EventQueue.shift();
      if (event) {
        await ProcessAsync(event);
      }
    } else {
      await sleep(1000);
    }
  }
}

async function ProcessAsync(event: EventData) {
  console.log(`NEW EVENT DETECTED AT BLOCK ${event.block}: ${event.eventName}`, { args: event.eventArgs });
}

/**
 *
 * @param {number} ms milliseconds to sleep
 * @returns async promise
 */
async function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

startEventProcessor();
