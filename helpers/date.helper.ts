import { Booking, CalendarDay, ISODate } from '../types';
import { INTERVAL, MS_IN_DAY } from '../constants';

/** Converts Date object to 'YYYY-MM-DD' formatted string */
export const getIsoDate = (date: Date): ISODate => date.toISOString().split('T')[0] as ISODate;

/** Retuns true if specified hour (24 hr time) will pass before next run, otherwise false */
export const timeIsAlmost = (hour: number): boolean => {
  const d = new Date();
  d.setHours(hour);
  d.setMinutes(0);
  const now = new Date();

  return now.getHours() < hour && d.valueOf() - now.valueOf() <= INTERVAL;
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

/**
 * Returns true if at least one date in booking is within calendar date range, otherwise false.
 * Extends calendar to include all dates from booking if booking dates are already partially included in calendar
 */
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

/** Calendar object used for mapping response from Airbnb */
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

  push(day: CalendarDay) {
    this.set(day.date, day);
    this.keyOrder.push(day.date);
  }

  unshift(day: CalendarDay) {
    this.set(day.date, day);
    this.keyOrder.unshift(day.date);
  }

  dates(): ISODate[] {
    return this.keyOrder;
  }

  days(): CalendarDay[] {
    return this.keyOrder.map((key) => this.get(key) as CalendarDay);
  }
}
