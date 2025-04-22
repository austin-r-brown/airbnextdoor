import { ISODate } from '../constants/Booking';
import { MS_IN_DAY } from '../constants/constants';
import { Time } from '../constants/types';

/** Service for keeping track of the date and time */
export class DateService {
  public get now(): Date {
    return new Date();
  }

  public today!: ISODate;
  public month!: number;
  public year!: number;

  constructor() {
    this.handleDateChange();
  }

  private readonly handleDateChange = (): void => {
    this.set();
    setTimeout(this.handleDateChange, this.timeUntil([24] /* Midnight */));
  };

  private set(): void {
    const [m, d, y] = this.now
      .toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' })
      .split('/');

    this.today = `${y}-${m}-${d}`;
    this.month = Number(m);
    this.year = Number(y);
  }

  /** Returns number of ms until specified time (24 hr) */
  public timeUntil([hour, minute, seconds]: Time): number {
    const target = this.now;
    const now = target.getTime();
    target.setHours(hour, minute ?? 0, seconds ?? 0, 0);
    if (target.getTime() < now) {
      target.setDate(target.getDate() + 1);
    }

    return target.getTime() - now || MS_IN_DAY;
  }

  /** Returns whether or not now is past a specified time (24 hr) */
  public isTimeAfter([hour, minute, seconds]: Time): boolean {
    const target = this.now;
    const now = target.getTime();
    target.setHours(hour, minute ?? 0, seconds ?? 0, 0);

    return target.getTime() < now;
  }
}
