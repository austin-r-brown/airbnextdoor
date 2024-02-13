import { Booking, CalendarDay, ISODate } from '../types';
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

export class Calendar extends Map<ISODate, CalendarDay> {
  private keyOrder: ISODate[] = [];

  constructor() {
    super();
  }

  first(): ISODate {
    return this.keyOrder[0];
  }

  last(): ISODate {
    return this.keyOrder[this.keyOrder.length - 1];
  }

  addUnsorted(days: CalendarDay[]) {
    days.forEach((day) => {
      if (!this.has(day.date)) {
        this.keyOrder.push(day.date);
      }
      this.set(day.date, day);
    });
    this.keyOrder.sort();
  }

  addSorted(day: CalendarDay) {
    this.set(day.date, day);
    this.keyOrder.push(day.date);
  }

  dates(): ISODate[] {
    return this.keyOrder;
  }

  days(): CalendarDay[] {
    return this.keyOrder.map((key) => this.get(key) as CalendarDay);
  }
}

export const getIsoDate = (date: Date): ISODate => date.toISOString().split('T')[0] as ISODate;

export const isCloseToHour = (hour: number): boolean => {
  const d = new Date();
  d.setHours(hour);
  d.setMinutes(0);
  const now = new Date();

  return now.getHours() < hour && d.valueOf() - now.valueOf() <= INTERVAL;
};

export const countDaysBetween = (dateA: Date | ISODate, dateB: Date | ISODate): number =>
  Math.abs(new Date(dateB).valueOf() - new Date(dateA).valueOf()) / MS_IN_DAY;

export const offsetDay = (date: Date | ISODate, days: number): ISODate => {
  const dateObject = new Date(date);
  const ms = days * MS_IN_DAY;
  return getIsoDate(new Date(dateObject.valueOf() + ms));
};

export const offsetMonth = (date: Date | ISODate, months: number): ISODate => {
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
  const firstDate = calendar.first();
  const lastDate = calendar.last();

  if (booking.firstNight < firstDate) {
    if (booking.lastNight < firstDate) {
      return false;
    } else {
      const pastDays = getBookingDateRange(booking)
        .filter((d) => d < firstDate)
        .map((d) => ({ date: d, booked: true, minNights: 1 }));
      calendar.addUnsorted(pastDays);
    }
  }
  if (booking.lastNight > lastDate) {
    if (booking.firstNight > lastDate) {
      return false;
    } else {
      const futureDays = getBookingDateRange(booking)
        .filter((d) => d > lastDate)
        .map((d) => ({ date: d, booked: true, minNights: 1 }));
      calendar.addUnsorted(futureDays);
    }
  }
  return true;
};
