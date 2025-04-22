import axios from 'axios';
import os from 'os';
import { LogService } from './log.service';
import { waitFor } from '../helpers/date.helper';
import { NETWORK_TIMEOUT } from '../constants/constants';

/** Service for monitoring network details */
export class NetworkService {
  private lastOnlineCheckTime: number = 0;
  private lastOnlineCheckResult: boolean = false;

  constructor(private readonly log: LogService) {}

  public get ipAddress(): string {
    const interfaces = os.networkInterfaces();
    const addresses = Object.values(interfaces)
      .flatMap((ifaceInfos) => ifaceInfos || [])
      .filter((alias) => alias.family === 'IPv4' && !alias.internal)
      .map((alias) => alias.address);

    const preferred = addresses.find((a) => a.startsWith('192.168'));

    return preferred || addresses[0] || '127.0.0.1';
  }

  public async waitUntilOnline(): Promise<void> {
    let online = await this.isOnline();

    while (!online) {
      this.log.warn('No internet connection detected. Retrying in 30 seconds...');
      await waitFor(30000);
      online = await this.isOnline();
    }
  }

  private async isOnline(): Promise<boolean> {
    const timeSinceLastCheck = Date.now() - this.lastOnlineCheckTime;

    if (timeSinceLastCheck < NETWORK_TIMEOUT) {
      return this.lastOnlineCheckResult;
    }

    let result = false;
    try {
      await axios.get('https://www.cloudflare.com', { timeout: NETWORK_TIMEOUT });
      result = true;
    } catch {}

    this.lastOnlineCheckResult = result;
    this.lastOnlineCheckTime = Date.now();

    return result;
  }
}
