import { ISODate } from '../constants/Booking';

/** Service for keeping track of today's date */
export class DateService {
  public date!: Date;
  public today!: ISODate;
  public month!: number;
  public year!: number;

  public set(): boolean {
    const [m, d, y] = new Date()
      .toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' })
      .split('/');
    const todayIso: ISODate = `${y}-${m}-${d}`;
    const dateChanged = todayIso !== this.today;
    if (dateChanged) {
      this.date = new Date(todayIso);
      this.today = todayIso;
      this.month = Number(m);
      this.year = Number(y);
    }
    return dateChanged;
  }

  constructor() {
    this.set();
  }
}
