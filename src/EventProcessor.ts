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
    default:
      return `${buildMsgHeader(event)}\n` + event.eventArgs.join('\n');
    case 'updatelasttotalassets':
    case 'accrueinterest':
    case 'accruefee':
    case 'createmetamorpho':
    case 'transfer':
    case 'approval':
      // user facing events, no need for an alert
      return undefined;
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
    case 'withdraw': {
      // event Withdraw(address indexed sender,address indexed receiver,address indexed owner,uint256 assets,uint256 shares);
      const assetThreshold = process.env.ASSET_THRESHOLD;
      if (!assetThreshold) {
        console.log('ASSET_THRESHOLD not set, ignoring event');
        return undefined;
      }

      if (BigInt(event.eventArgs[3]) >= BigInt(assetThreshold)) {
        let amountNormalized = '';
        if (ASSET_DECIMALS && ASSET) {
          amountNormalized = `[${FriendlyFormatNumber(norm(event.eventArgs[3], Number(ASSET_DECIMALS)))} ${ASSET}]`;
        }

        return (
          `${buildMsgHeader(event, amountNormalized)}\n` +
          `sender: ${event.eventArgs[0]}\n` +
          `receiver: ${event.eventArgs[1]}\n` +
          `owner: ${event.eventArgs[2]}\n` +
          `assets: ${event.eventArgs[3]}\n` +
          `shares: ${event.eventArgs[4]}\n`
        );
      } else {
        console.log(`Ignoring withdraw event because assets < threshold. ${event.eventArgs[3]} < ${assetThreshold}`);
        return undefined;
      }
    }
    case 'submittimelock':
      // event SubmitTimelock(uint256 newTimelock);
      return `${buildMsgHeader(event)}\n` + `newTimelock: ${event.eventArgs[0]}\n`;
    case 'settimelock':
      // event SetTimelock(address indexed caller, uint256 newTimelock);
      return `${buildMsgHeader(event)}\n` + `caller: ${event.eventArgs[0]}\n` + `newTimelock: ${event.eventArgs[1]}\n`;
    case 'setskimrecipient':
      // event SetSkimRecipient(address indexed newSkimRecipient);
      return `${buildMsgHeader(event)}\n` + `newSkimRecipient: ${event.eventArgs[0]}\n`;
    case 'setfee':
      // event SetFee(address indexed caller, uint256 newFee);
      return `${buildMsgHeader(event)}\n` + `caller: ${event.eventArgs[0]}\n` + `newFee: ${event.eventArgs[1]}\n`;
    case 'setfeerecipient':
      // event SetFeeRecipient(address indexed newFeeRecipient);
      return `${buildMsgHeader(event)}\n` + `newFeeRecipient: ${event.eventArgs[0]}\n`;
    case 'submitguardian':
      // event SubmitGuardian(address indexed newGuardian);
      return `${buildMsgHeader(event)}\n` + `newGuardian: ${event.eventArgs[0]}\n`;
    case 'setguardian':
      // event SetGuardian(address indexed caller, address indexed guardian);
      return `${buildMsgHeader(event)}\n` + `caller: ${event.eventArgs[0]}\n` + `guardian: ${event.eventArgs[1]}\n`;
    case 'submitcap':
      // event SubmitCap(address indexed caller, Id indexed id, uint256 cap);
      return (
        `${buildMsgHeader(event)}\n` +
        `caller: ${event.eventArgs[0]}\n` +
        `id: ${event.eventArgs[1]}\n` +
        `cap: ${event.eventArgs[2]}\n`
      );

    case 'setcap':
      // event SetCap(address indexed caller, Id indexed id, uint256 cap);
      return (
        `${buildMsgHeader(event)}\n` +
        `caller: ${event.eventArgs[0]}\n` +
        `id: ${event.eventArgs[1]}\n` +
        `cap: ${event.eventArgs[2]}\n`
      );

    case 'submitmarketremoval':
      // event SubmitMarketRemoval(address indexed caller, Id indexed id);
      return `${buildMsgHeader(event)}\n` + `caller: ${event.eventArgs[0]}\n` + `id: ${event.eventArgs[1]}\n`;

    case 'setcurator':
      // event SetCurator(address indexed newCurator);
      return `${buildMsgHeader(event)}\n` + `newCurator: ${event.eventArgs[0]}\n`;

    case 'setisallocator':
      // event SetIsAllocator(address indexed allocator, bool isAllocator);
      return (
        `${buildMsgHeader(event)}\n` + `allocator: ${event.eventArgs[0]}\n` + `isAllocator: ${event.eventArgs[1]}\n`
      );

    case 'revokependingtimelock':
      // event RevokePendingTimelock(address indexed caller);
      return `${buildMsgHeader(event)}\n` + `caller: ${event.eventArgs[0]}\n`;

    case 'revokependingcap':
      // event RevokePendingCap(address indexed caller, Id indexed id);
      return `${buildMsgHeader(event)}\n` + `caller: ${event.eventArgs[0]}\n` + `id: ${event.eventArgs[1]}\n`;

    case 'revokependingguardian':
      // event RevokePendingGuardian(address indexed caller);
      return `${buildMsgHeader(event)}\n` + `caller: ${event.eventArgs[0]}\n`;

    case 'revokependingmarketremoval':
      // event RevokePendingMarketRemoval(address indexed caller, Id indexed id);
      return `${buildMsgHeader(event)}\n` + `caller: ${event.eventArgs[0]}\n` + `id: ${event.eventArgs[1]}\n`;

    case 'setsupplyqueue':
      // event SetSupplyQueue(address indexed caller, Id[] newSupplyQueue);
      return (
        `${buildMsgHeader(event)}\n` +
        `caller: ${event.eventArgs[0]}\n` +
        `newSupplyQueue: ${event.originArgs[1].map((_: any) => _.toString()).join(', ')}\n`
      );

    case 'setwithdrawqueue':
      // event SetWithdrawQueue(address indexed caller, Id[] newWithdrawQueue);
      return (
        `${buildMsgHeader(event)}\n` +
        `caller: ${event.eventArgs[0]}\n` +
        `newWithdrawQueue:\n${event.originArgs[1].map((_: any) => '- ' + _.toString()).join('\n')}\n`
      );
    case 'reallocatesupply': {
      // event ReallocateSupply(address indexed caller, Id indexed id, uint256 suppliedAssets, uint256 suppliedShares);
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
          `caller: ${event.eventArgs[0]}\n` +
          `id: ${event.eventArgs[1]}\n` +
          `suppliedAssets: ${event.eventArgs[2]}\n` +
          `suppliedShares: ${event.eventArgs[3]}\n`
        );
      } else {
        console.log(
          `Ignoring reallocate supply event because assets < threshold. ${event.eventArgs[2]} < ${assetThreshold}`
        );
        return undefined;
      }
    }
    case 'reallocatewithdraw': {
      // event ReallocateWithdraw(address indexed caller, Id indexed id, uint256 withdrawnAssets, uint256 withdrawnShares);
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
          `caller: ${event.eventArgs[0]}\n` +
          `id: ${event.eventArgs[1]}\n` +
          `withdrawnAssets: ${event.eventArgs[2]}\n` +
          `withdrawnShares: ${event.eventArgs[3]}\n`
        );
      } else {
        console.log(
          `Ignoring reallocate withdraw event because assets < threshold. ${event.eventArgs[2]} < ${assetThreshold}`
        );
        return undefined;
      }
    }
    case 'skim':
      // event Skim(address indexed caller, address indexed token, uint256 amount);
      return (
        `${buildMsgHeader(event)}\n` +
        `caller: ${event.eventArgs[0]}\n` +
        `token: ${event.eventArgs[1]}\n` +
        `amount: ${event.eventArgs[2]}\n`
      );
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
