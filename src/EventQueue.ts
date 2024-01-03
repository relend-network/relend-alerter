import { Result } from 'ethers';

export const EventQueue: EventData[] = [];

export interface EventData {
  txHash: string;
  eventName: string;
  eventArgs: string[];
  block: number;
  originArgs: Result;
}
