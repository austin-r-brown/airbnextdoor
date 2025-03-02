import { Booking, ISODate } from './Booking';
import { CalendarDay } from './types';

/** Calendar object used for mapping response from Airbnb */
export class Calendar {
  private keyOrder: ISODate[] = [];
  private map = new Map<ISODate, CalendarDay>();

  get size(): number {
    return this.map.size;
  }

  get first(): ISODate {
    return this.keyOrder[0];
  }

  get last(): ISODate {
    return this.keyOrder[this.keyOrder.length - 1];
  }

  get days(): CalendarDay[] {
    return this.keyOrder.map((key) => this.map.get(key) as CalendarDay);
  }

  get isFullyBooked(): boolean {
    return this.days.every((day) => day.booked);
  }

  addUnsorted(days: CalendarDay[]) {
    days.forEach((day) => {
      if (!this.map.has(day.date)) {
        this.keyOrder.push(day.date);
      }
      this.map.set(day.date, day);
    });
    this.keyOrder.sort();
  }

  push(day: CalendarDay) {
    this.map.set(day.date, day);
    this.keyOrder.push(day.date);
  }

  unshift(day: CalendarDay) {
    this.map.set(day.date, day);
    this.keyOrder.unshift(day.date);
  }

  get(date: ISODate): CalendarDay | undefined {
    return this.map.get(date);
  }

  /**
   * Returns true if at least one date in booking is within calendar date range, otherwise false.
   * Extends calendar to include all dates from booking if booking dates are already partially included in calendar
   */
  isBookingInRange(booking: Booking): boolean {
    const firstDate = this.first;
    const lastDate = this.last;

    if (booking.firstNight < firstDate) {
      if (booking.lastNight < firstDate) {
        return false;
      } else {
        const pastDays = booking
          .getDateRange()
          .filter((d) => d < firstDate)
          .map((d) => ({ date: d, booked: true, minNights: 1 }));
        this.addUnsorted(pastDays);
      }
    }
    if (booking.lastNight > lastDate) {
      if (booking.firstNight > lastDate) {
        return false;
      } else {
        const futureDays = booking
          .getDateRange()
          .filter((d) => d > lastDate)
          .map((d) => ({ date: d, booked: true, minNights: 1 }));
        this.addUnsorted(futureDays);
      }
    }
    return true;
  }
}
