import { ISODate } from '../constants/Booking';
import { MS_IN_DAY } from '../constants/constants';
import { Time } from '../constants/types';

/** Converts Date object to 'YYYY-MM-DD' formatted string used by Airbnb API */
export const getIsoDate = (date: Date = new Date()): ISODate => date.toISOString().split('T')[0] as ISODate;

/** Converts 'YYYY-MM-DD' formatted string to 'MM/DD/YY' for better readability in notifications */
export const formatIsoDate = (date: ISODate): string => {
  const [y, m, d] = date.split('-');
  return `${Number(m)}/${Number(d)}/${y.slice(2)}`;
};

/** Returns a promise that resolves after a specified number of miliseconds */
export const waitFor = (ms: number): Promise<void> => {
  return new Promise<void>((resolve) => {
    setTimeout(() => resolve(), ms);
  });
};

/** Returns total number of days between two dates */
export const countDaysBetween = (dateA: ISODate, dateB: ISODate): number =>
  Math.abs(new Date(dateB).valueOf() - new Date(dateA).valueOf()) / MS_IN_DAY;

/** Adds or subtracts specified number of days to provided date, returns ISO date */
export const offsetDay = (date: Date | ISODate, days: number): ISODate => {
  const dateObject = new Date(date);
  const ms = days * MS_IN_DAY;
  return getIsoDate(new Date(dateObject.valueOf() + ms));
};

export const getTimeFromString = (str: string): Time | null => {
  const timeMatch = str.match(/(?<!\d)\d{1,2}:\d{2}(?!\d)/g);

  if (timeMatch) {
    const time = timeMatch[0];
    let [h, m] = time.split(':').map((str) => Number(str));

    const timeEndIndex = str.indexOf(time) + time.length;
    const remainder = str.slice(timeEndIndex);
    if (remainder.trim().toLowerCase().startsWith('p') && h < 12) {
      h += 12;
    }

    return [h, m];
  }

  return null;
};
