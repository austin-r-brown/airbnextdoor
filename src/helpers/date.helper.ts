import { ISODate, Booking } from '../constants/Booking';
import { MS_IN_DAY } from '../constants/constants';

/** Converts Date object to 'YYYY-MM-DD' formatted string */
export const getIsoDate = (date: Date): ISODate => date.toISOString().split('T')[0] as ISODate;

/** Converts 'YYYY-MM-DD' formatted string to 'MM/DD/YY' for better readability */
export const formatIsoDate = (date: string): string => {
  const [y, m, d] = date.split('-');
  return `${Number(m)}/${Number(d)}/${y.slice(2)}`;
};

/** Returns number of ms until specified time (24 hr) */
export const timeUntil = (hour: number, minute?: number, seconds?: number): number => {
  const now = new Date();
  const target = new Date(now);
  target.setHours(hour, minute ?? 0, seconds ?? 0, 0);
  if (target.getTime() < now.getTime()) {
    target.setDate(target.getDate() + 1);
  }

  return target.getTime() - now.getTime();
};

/** Returns a promise that resolves at specified time (24 hr) */
export const waitUntil = (hour: number, minute?: number, seconds?: number): Promise<void> => {
  const ms = timeUntil(hour, minute, seconds);
  return new Promise<void>((resolve) => {
    setTimeout(() => {
      resolve();
    }, ms);
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

/** Returns array of ISO dates which includes all nights occupied in specified booking */
export const getBookingDateRange = (booking: Booking): ISODate[] => {
  const dateArray: ISODate[] = [];
  let currentDate = new Date(booking.firstNight);

  while (currentDate <= new Date(booking.lastNight)) {
    dateArray.push(getIsoDate(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return dateArray;
};
