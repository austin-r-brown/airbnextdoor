import { Booking, DateString } from './types';

require('dotenv').config();
const { INTERVAL_MINS } = process.env;

const MS_IN_DAY: number = 86400000;

export const INTERVAL: number = (Number(INTERVAL_MINS) || 5) * 60000;

export class Today {
  public date!: Date;
  public iso!: string;
  public month!: number;
  public year!: number;

  public set() {
    const todayIso = getIsoDate(new Date());
    const [y, m] = todayIso.split('-');
    this.date = new Date(todayIso);
    this.iso = todayIso;
    this.month = Number(m);
    this.year = Number(y);
  }

  constructor() {
    this.set();
  }
}

export const getIsoDate = (date: Date): string => date.toISOString().split('T')[0];

export const isCloseToHour = (hour: number): boolean => {
  const d = new Date();
  d.setHours(hour);
  d.setMinutes(0);
  const now = new Date();

  return now.getHours() < hour && d.valueOf() - now.valueOf() <= INTERVAL;
};

export const countDaysBetween = (firstNight: DateString, lastNight: DateString): number =>
  Math.abs(new Date(lastNight).valueOf() - new Date(firstNight).valueOf()) / MS_IN_DAY;

export const offsetDay = (date: DateString, days: number): string => {
  const dateObject = new Date(date);
  const ms = days * MS_IN_DAY;
  return getIsoDate(new Date(dateObject.valueOf() + ms));
};

export const offsetMonth = (date: DateString, months: number): string => {
  const isoDate = getIsoDate(new Date(date));
  const [y, m, d] = isoDate.split('-');
  const addedMonths = Number(m) + months;
  const newYear = Number(y) + Math.floor(addedMonths / 12);
  const newMonth = addedMonths % 12;
  return getIsoDate(new Date(`${newYear}-${newMonth}-${d}`));
};

export const getInBetweenBookings = (
  encompassingBooking: Booking,
  encompassedBookings: Booking[]
): Booking[] => {
  const inBetweenBookings: Booking[] = [];

  encompassedBookings.forEach((b, i) => {
    const isLast = i === encompassedBookings.length - 1;
    const previous = encompassedBookings[i - 1];

    if (previous || b.firstNight > encompassingBooking.firstNight) {
      const firstNight = previous ? offsetDay(previous.lastNight, 1) : encompassingBooking.firstNight;
      const lastNight = offsetDay(b.firstNight, -1);

      inBetweenBookings.push({ firstNight, lastNight });
    }

    if (isLast && b.lastNight < encompassingBooking.lastNight) {
      inBetweenBookings.push({
        firstNight: offsetDay(b.lastNight, 1),
        lastNight: encompassingBooking.lastNight,
      });
    }
  });

  return inBetweenBookings;
};
