import { EventData, EventQueue } from './EventQueue';
import { FriendlyFormatNumber, norm, sleep } from './Utils';
import { SendTelegramMessage } from './TelegramHelper';
import { ethers } from 'ethers';

const TG_BOT_ID: string | undefined = process.env.TG_BOT_ID;
const TG_CHAT_ID: string | undefined = process.env.TG_CHAT_ID;
const METAMORPHO_NAME: string | undefined = process.env.METAMORPHO_NAME;
const EXPLORER_URI: string | undefined = process.env.EXPLORER_URI;
const ASSET_DECIMALS: string | undefined = process.env.ASSET_DECIMALS;
const ASSET: string | undefined = process.env.ASSET;

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
  if (!TG_BOT_ID) {
    throw new Error('No TG_BOT_ID found in env');
  }

  if (!TG_CHAT_ID) {
    throw new Error('No TG_BOT_ID found in env');
  }

  console.log(`NEW EVENT DETECTED AT BLOCK ${event.block}: ${event.eventName}`, { args: event.eventArgs });
  if (process.env.FILTER_AUTHOR && process.env.FILTER_AUTHOR.toLowerCase() == 'true') {
    if (
      event.eventName.toLowerCase() === 'reallocatewithdraw' ||
      event.eventName.toLowerCase() === 'reallocatesupply'
    ) {
      const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
      const transaction = await provider.getTransaction(event.txHash);
      if (transaction && transaction.from.toLowerCase() === '0xf404dbb34f7f16bfa315daaa9a8c33c7abe94ed1') {
        console.log(`Ignoring event - ${event.eventName} - from address 0xF404dBb34f7F16BfA315daaA9a8C33c7aBe94eD1`);
        return;
      }
    }
  }
  const msgToSend: string | undefined = buildMessageFromEvent(event);
  if (!msgToSend) {
    console.log('Nothing to send to TG');
  } else {
    await SendTelegramMessage(TG_CHAT_ID, TG_BOT_ID, msgToSend, false);
  }
}

function buildMessageFromEvent(event: EventData): string | undefined {
  switch (event.eventName.toLowerCase()) {
    case 'deposit': {
      // event Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares);
      const assetThreshold = process.env.ASSET_THRESHOLD;
      if (!assetThreshold) {
        console.log('ASSET_THRESHOLD not set, ignoring event');
        return undefined;
      }

      if (BigInt(event.eventArgs[2]) >= BigInt(assetThreshold)) {
        let amountNormalized = '';
        if (ASSET_DECIMALS && ASSET) {
          amountNormalized = `[${FriendlyFormatNumber(norm(event.eventArgs[2], Number(ASSET_DECIMALS)))} ${ASSET}]`;
        }
        return (
          `${buildMsgHeader(event, amountNormalized)}\n` +
          `sender: ${event.eventArgs[0]}\n` +
          `owner: ${event.eventArgs[1]}\n` +
          `asset: ${event.eventArgs[2]}\n` +
          `shares: ${event.eventArgs[3]}\n`
        );
      } else {
        console.log(`Ignoring deposit event because assets < threshold. ${event.eventArgs[2]} < ${assetThreshold}`);
        return undefined;
      }
    }
    case 'updatelasttotalassets':
    case 'accrueinterest':
    case 'accruefee':
    case 'createmetamorpho':
    case 'transfer':
    case 'approval':
    case 'withdraw':
    case 'submittimelock':
    case 'settimelock':
    case 'setskimrecipient':
    case 'setfee':
    case 'setfeerecipient':
    case 'submitguardian':
    case 'setguardian':
    case 'submitcap':
    case 'setcap':
    case 'submitmarketremoval':
    case 'setcurator':
    case 'setisallocator':
    case 'revokependingtimelock':
    case 'revokependingcap':
    case 'revokependingguardian':
    case 'revokependingmarketremoval':
    case 'setsupplyqueue':
    case 'setwithdrawqueue':
    case 'reallocatesupply':
    case 'reallocatewithdraw':
    case 'skim':
    default:
      return undefined;
  }
}

function buildMsgHeader(event: EventData, headerAddMsg = ''): string {
  return (
    `[${METAMORPHO_NAME}] [${event.eventName}] ${headerAddMsg}\n` +
    `tx: ${buildTxUrl(event.txHash)}\n` +
    `Detected on block ${event.block}:`
  );
}

function buildTxUrl(txhash: string): string {
  return `${EXPLORER_URI}/tx/${txhash}`;
}

startEventProcessor();
