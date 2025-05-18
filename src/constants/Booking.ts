import { getIsoDate, offsetDay } from '../helpers/date.helper';
import { DateService } from '../services/date.service';
import { BookingJSON } from './types';

export type ISODate = `${string}-${string}-${string}`;

export class Booking {
  readonly createdAt: Date;

  firstNight: ISODate;
  isBlockedOff?: boolean;
  isHidden?: boolean;
  bookedAt?: Date;

  private _lastNight!: ISODate;
  private _checkOut!: ISODate;

  constructor({ firstNight, lastNight, isBlockedOff, bookedAt, createdAt, isHidden }: BookingJSON) {
    this.firstNight = firstNight;
    this.lastNight = lastNight;
    this.isBlockedOff = isBlockedOff;
    this.isHidden = isHidden;
    this.bookedAt = bookedAt;
    this.createdAt = createdAt ?? new Date();
  }

  get checkIn(): ISODate {
    return this.firstNight;
  }

  get checkOut(): ISODate {
    return this._checkOut;
  }

  get lastNight(): ISODate {
    return this._lastNight;
  }

  set lastNight(date: ISODate) {
    this._lastNight = date;
    this._checkOut = offsetDay(date, 1);
  }

  get isActive(): boolean {
    const { today } = new DateService();
    return this.checkIn <= today && this.checkOut >= today;
  }

  /** Returns array of ISO dates which includes all nights occupied in booking */
  getDateRange(): ISODate[] {
    const dateArray: ISODate[] = [];
    let currentDate = new Date(this.firstNight);

    while (currentDate <= new Date(this.lastNight)) {
      dateArray.push(getIsoDate(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return dateArray;
  }

  /** Bookings sharing at least one equal date (check in or check out) are considered equal */
  isSameAs(booking: Booking): boolean {
    return booking.firstNight === this.firstNight || booking.lastNight === this.lastNight;
  }

  toJSON(): BookingJSON {
    return {
      firstNight: this.firstNight,
      lastNight: this.lastNight,
      isBlockedOff: this.isBlockedOff,
      isHidden: this.isHidden,
      bookedAt: this.bookedAt,
      createdAt: this.createdAt,
    };
  }
}
