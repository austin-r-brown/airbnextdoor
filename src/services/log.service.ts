import { offsetDay } from '../helpers/date.helper';
import { formatIsoDate } from '../helpers/date.helper';
import { Booking } from '../constants/Booking';
import { BookingChange, LogItem } from '../constants/types';
import { ConsoleType } from '../constants/enums';
import { readFileSync } from 'fs';

/** Service for handling console log messages */
export class LogService {
  private readonly logged: LogItem[] = [];

  private get timestamp() {
    return `[${new Date().toLocaleString()}]`;
  }

  constructor() {
    const { version } = JSON.parse(readFileSync('package.json', 'utf-8'));
    this.info(`Starting application v${version}`);
  }

  private log(values: any[], type: ConsoleType) {
    const [first] = values;
    if (values.length === 1 && typeof first === 'string') {
      values[0] = `${first} ${this.timestamp}`;
    } else {
      values.push(this.timestamp);
    }

    const item: LogItem = [
      values.map((val) => (typeof val === 'object' ? JSON.parse(JSON.stringify(val)) : val)),
      type,
    ];
    this.display(...item);
    this.logged.push(item);
  }

  private display(values: any[], type: ConsoleType) {
    values.forEach((val: any) => console[type]?.(val));
    console[type]?.('');
  }

  private resetConsole() {
    console.clear();
    this.logged.forEach((item) => this.display(...item));
  }

  public info(...args: any) {
    this.log(args, ConsoleType.Info);
  }

  public error(...args: any) {
    this.log(args, ConsoleType.Error);
  }

  public warn(...args: any) {
    this.log(args, ConsoleType.Warn);
  }

  public notification(title: string, booking: Booking, change?: BookingChange) {
    let start = 'Check In',
      end = 'Check Out',
      changeMsg: string[] = [];

    if (booking.isBlockedOff) {
      start = 'Start Date';
      end = 'End Date';
    }

    const bookingMsg = `(${start}: ${formatIsoDate(booking.checkIn)} | ${end}: ${formatIsoDate(
      booking.checkOut
    )})`;

    if (change?.firstNight) {
      changeMsg = [`New ${start}: ${formatIsoDate(change.firstNight)}`];
    } else if (change?.lastNight) {
      changeMsg = [`New ${end}: ${formatIsoDate(offsetDay(change.lastNight, 1))}`];
    }

    this.info(...[`${title}:`, bookingMsg, ...changeMsg]);
  }
}
