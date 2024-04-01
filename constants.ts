require('dotenv').config();

export const MS_IN_DAY: number = 86400000;
export const MS_IN_MINUTE: number = 60000;

export const LOCALE: string = 'en';

/** Longest amount of time expected for API calls */
export const API_TIMEOUT: number = 10000;

/** Debounce time used for sending notifcations and saving to DB */
export const SEND_DEBOUNCE_TIME: number = 1000;

/** Interval at which the app runs */
export const INTERVAL: number = Math.min(
  // Default of 5 minutes, minimum of 30 seconds, maximum of 12 hours
  Math.max((Number(process.env.INTERVAL_MINS) || 5) * MS_IN_MINUTE, API_TIMEOUT * 3),
  720 * MS_IN_MINUTE
);

/** Amount of time app is considered timed out after no activity */
export const WATCHDOG_TIMEOUT: number = Math.max(INTERVAL * 3, 600000);
