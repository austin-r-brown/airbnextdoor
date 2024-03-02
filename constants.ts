require('dotenv').config();

export const MS_IN_DAY: number = 86400000;
export const MS_IN_MINUTE: number = 60000;

export const LOCALE: string = 'en';
export const INTERVAL: number = (Number(process.env.INTERVAL_MINS) || 5) * MS_IN_MINUTE;
export const SEND_DEBOUNCE_TIME: number = 1000;
export const EMAIL_TIMEOUT = 10000;
export const SUCCESS_TIMEOUT: number = Math.max(INTERVAL * 3 + EMAIL_TIMEOUT, 600000);

export const API_BASE_URL: string = 'https://www.airbnb.com/api/v3';
export const API_OPERATION: string = 'PdpAvailabilityCalendar';
export const API_HASH: string = '8f08e03c7bd16fcad3c92a3592c19a8b559a0d0855a84028d1163d4733ed9ade';
export const API_KEY: string = 'd306zoyjsyarp7ifhu67rjxn52tv0t20';
