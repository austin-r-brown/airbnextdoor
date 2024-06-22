import { MS_IN_DAY } from './constants';

export type ISODate = `${string}-${string}-${string}`;

export class Booking {
  firstNight: ISODate;
  lastNight: ISODate;
  isBlockedOff?: boolean;
  createdAt?: Date;

  constructor(booking: Partial<Booking>) {
    if (!booking.firstNight || !booking.lastNight) {
      throw 'Cannot create booking without first and last nights';
    }
    this.firstNight = booking.firstNight;
    this.lastNight = booking.lastNight;
    this.isBlockedOff = booking.isBlockedOff;
    this.createdAt = booking.createdAt;
  }

  get isActive(): boolean {
    const today = new Date(new Date().toLocaleDateString());
    const yesterday = new Date(today.valueOf() - MS_IN_DAY);
    return new Date(this.firstNight) <= today && new Date(this.lastNight) >= yesterday;
  }
}
