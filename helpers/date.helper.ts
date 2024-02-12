import { Booking, CalendarDay, DateType, ISODate } from '../types';
require('dotenv').config();

const { INTERVAL_MINS } = process.env;
const MS_IN_DAY: number = 86400000;
export const INTERVAL: number = (Number(INTERVAL_MINS) || 5) * 60000;

export class Today {
  public date!: Date;
  public iso!: ISODate;
  public dayBefore!: ISODate;
  public dayAfter!: ISODate;
  public month!: number;
  public year!: number;

  private getTodayIso(): ISODate {
    const [m, d, y] = new Date()
      .toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' })
      .split('/');
    return `${y}-${m}-${d}`;
  }

  public set(): boolean {
    const todayIso = this.getTodayIso();
    const dateChanged = todayIso !== this.iso;
    const [y, m] = todayIso.split('-');
    this.date = new Date(todayIso);
    this.iso = todayIso;
    this.dayBefore = offsetDay(todayIso, -1);
    this.dayAfter = offsetDay(todayIso, 1);
    this.month = Number(m);
    this.year = Number(y);
    return dateChanged;
  }

  constructor() {
    this.set();
  }
}

export class Calendar {
  private map: Map<ISODate, CalendarDay>;
  private keyOrder: ISODate[] = [];

  constructor() {
    this.map = new Map();
    this.keyOrder = [];
  }

  prepend(key: ISODate, value: CalendarDay) {
    this.map.set(key, value);
    this.keyOrder.unshift(key);
  }

  keys(): ISODate[] {
    return this.keyOrder;
  }

  values(): CalendarDay[] {
    return this.keyOrder.map((key) => this.map.get(key) as CalendarDay);
  }

  set(key: ISODate, value: CalendarDay) {
    this.map.set(key, value);
    this.keyOrder.push(key);
    return this;
  }

  get = (key: ISODate): CalendarDay | undefined => this.map.get(key);
  has = (key: ISODate): boolean => this.map.has(key);
}

export const getIsoDate = (date: Date): ISODate => date.toISOString().split('T')[0] as ISODate;

export const isCloseToHour = (hour: number): boolean => {
  const d = new Date();
  d.setHours(hour);
  d.setMinutes(0);
  const now = new Date();

  return now.getHours() < hour && d.valueOf() - now.valueOf() <= INTERVAL;
};

export const countDaysBetween = (dateA: DateType, dateB: DateType): number =>
  Math.abs(new Date(dateB).valueOf() - new Date(dateA).valueOf()) / MS_IN_DAY;

export const offsetDay = (date: DateType, days: number): ISODate => {
  const dateObject = new Date(date);
  const ms = days * MS_IN_DAY;
  return getIsoDate(new Date(dateObject.valueOf() + ms));
};

export const offsetMonth = (date: DateType, months: number): ISODate => {
  const isoDate = getIsoDate(new Date(date));
  const [y, m, d] = isoDate.split('-');
  const addedMonths = Number(m) + months;
  const newYear = Number(y) + Math.floor(addedMonths / 12);
  const newMonth = addedMonths % 12;
  return getIsoDate(new Date(`${newYear}-${newMonth}-${d}`));
};

export const getBookingDateRange = (booking: Booking): ISODate[] => {
  const dateArray: ISODate[] = [];
  let currentDate = new Date(booking.firstNight);

  while (currentDate <= new Date(booking.lastNight)) {
    dateArray.push(getIsoDate(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return dateArray;
};

export const isBookingInCalendarRange = (booking: Booking, calendar: Calendar): boolean => {
  const days = Array.from(calendar.keys());
  const [firstDay] = days;
  const lastDay = days[days.length - 1];

  if (booking.firstNight < firstDay) {
    if (booking.lastNight < firstDay) {
      return false;
    } else {
      const pastDates = getBookingDateRange(booking).filter((d) => d < firstDay);
      pastDates.reverse().forEach((d) => calendar.prepend(d, { date: d, booked: true, minNights: 1 }));
    }
  }
  if (booking.lastNight > lastDay) {
    if (booking.firstNight > lastDay) {
      return false;
    } else {
      const futureDates = getBookingDateRange(booking).filter((d) => d > lastDay);
      futureDates.forEach((d) => calendar.set(d, { date: d, booked: true, minNights: 1 }));
    }
  }
  return true;
};
