require('dotenv').config();

export const MS_IN_DAY: number = 86400000;
export const MS_IN_MINUTE: number = 60000;

export const LOCALE: string = 'en';
export const API_TIMEOUT: number = 10000;
export const SEND_DEBOUNCE_TIME: number = 1000;
export const INTERVAL: number = Math.max(
  // Default interval of 5 minutes, minimum of 30 seconds
  (Number(process.env.INTERVAL_MINS) || 5) * MS_IN_MINUTE,
  API_TIMEOUT * 3
);
export const WATCHDOG_TIMEOUT: number = Math.max(INTERVAL * 3 + API_TIMEOUT, 600000);
