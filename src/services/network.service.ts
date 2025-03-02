import axios from 'axios';
import os from 'os';
import { LogService } from './log.service';
import { waitFor } from '../helpers/date.helper';

const NETWORK_TIMEOUT = 5000;

export class NetworkService {
  private lastOnlineCheckTime: number = 0;
  private lastOnlineCheckResult: boolean = false;

  constructor(private readonly log: LogService) {}

  public get ipAddress(): string {
    const interfaces = os.networkInterfaces();
    for (const iface in interfaces) {
      const ifaceInfo = interfaces[iface];
      if (ifaceInfo) {
        for (const alias of ifaceInfo) {
          if (alias.family === 'IPv4' && !alias.internal && alias.address.startsWith('192.168')) {
            return alias.address;
          }
        }
      }
    }
    return '127.0.0.1';
  }

  public async waitUntilOnline() {
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
      await axios.get('https://www.google.com', { timeout: NETWORK_TIMEOUT });
      result = true;
    } catch {}

    this.lastOnlineCheckResult = result;
    this.lastOnlineCheckTime = Date.now();

    return result;
  }
}
