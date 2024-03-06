require('dotenv').config();

export const MS_IN_DAY: number = 86400000;
export const MS_IN_MINUTE: number = 60000;

export const LOCALE: string = 'en';
export const INTERVAL: number = (Number(process.env.INTERVAL_MINS) || 5) * MS_IN_MINUTE;
export const SEND_DEBOUNCE_TIME: number = 1000;
export const EMAIL_TIMEOUT: number = 10000;
export const SUCCESS_TIMEOUT: number = Math.max(INTERVAL * 3 + EMAIL_TIMEOUT, 600000);
