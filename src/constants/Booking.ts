import { getIsoDate, offsetDay } from '../helpers/date.helper';
import { BookingSerialized } from './types';

export type ISODate = `${string}-${string}-${string}`;

export class Booking {
  firstNight: ISODate;
  isBlockedOff?: boolean;
  createdAt?: Date;

  private _lastNight: ISODate;
  private _checkOut: ISODate;

  constructor({ firstNight, lastNight, isBlockedOff, createdAt }: Partial<Booking>) {
    if (!firstNight || !lastNight) {
      throw 'Cannot create booking without first and last nights';
    }
    this.firstNight = firstNight;
    this._lastNight = lastNight;
    this._checkOut = offsetDay(lastNight, 1);
    this.isBlockedOff = isBlockedOff;
    this.createdAt = createdAt;
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
    const today = getIsoDate(new Date(new Date().toLocaleDateString()));
    return this.checkIn <= today && this.checkOut >= today;
  }

  toJSON(): BookingSerialized {
    return {
      firstNight: this.firstNight,
      lastNight: this.lastNight,
      isBlockedOff: this.isBlockedOff,
      createdAt: this.createdAt,
    };
  }
}
