import { ethers, Contract, Interface } from 'ethers';
import WebSocket from 'ws';
import dotenv from 'dotenv';
import { metamorphoAbi } from './abis/MetaMorphoAbi';
import { EventQueue } from './EventQueue';
dotenv.config();

const WSS_URL: string | undefined = process.env.WSS_PROVIDER;
const METAMORPHO_ADDRESS: string | undefined = process.env.METAMORPHO_ADDRESS;

let provider = new ethers.WebSocketProvider(createWebSocket());

function createWebSocket() {
  if (!WSS_URL) {
    throw new Error('No WSS_URL found in env');
  }
  const ws = new WebSocket(WSS_URL);

  ws.on('close', () => {
    console.log('Disconnected. Reconnecting...');
    setTimeout(() => {
      provider = new ethers.WebSocketProvider(createWebSocket());
      startListening();
    }, 1000);
  });

  ws.on('error', (error) => {
    console.log('WebSocket error: ', error);
  });

  return ws;
}

function startListening() {
  if (!METAMORPHO_ADDRESS) {
    throw new Error('No METAMORPHO_ADDRESS found in env');
  }
  console.log('Started the event listener');
  const metamorphoContract = new Contract(METAMORPHO_ADDRESS, metamorphoAbi, provider);

  const iface = new Interface(metamorphoAbi);

  metamorphoContract.removeAllListeners();

  metamorphoContract.on('*', (event) => {
    // The `event.log` has the entire EventLog
    const parsed = iface.parseLog(event.log);

    if (!parsed) {
      console.log('Could not parse event', { event });
      return;
    }

    EventQueue.push({
      eventName: parsed.name,
      eventArgs: parsed.args.map((_) => _.toString()),
      block: event.log.blockNumber,
      originArgs: parsed.args
    });
  });
}

startListening();
