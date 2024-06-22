import { ISODate } from './Booking';
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
}
