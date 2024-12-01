import { offsetDay } from '../helpers/date.helper';
import { formatIsoDate } from '../helpers/date.helper';
import { Booking } from '../constants/Booking';
import { BookingChange, LogItem } from '../constants/types';
import { ConsoleType } from '../constants/enums';
import { readFileSync } from 'fs';

const START_MSG = 'Starting application';
const SUCCESS_MSG = 'Airbnb dates checked successfully';

/** Service for handling console log messages */
export class LogService {
  private readonly logged: LogItem[] = [];

  private get timestamp(): string {
    return `[${new Date().toLocaleString()}]`;
  }

  private get isLinuxService(): boolean {
    return process.env.INVOCATION_ID !== undefined;
  }

  constructor() {
    const { version } = JSON.parse(readFileSync('package.json', 'utf-8'));
    this.info(`${START_MSG} v${version}`);
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

  public info(...args: any) {
    this.log(args, ConsoleType.Info);
  }

  public error(...args: any) {
    this.log(args, ConsoleType.Error);
  }

  public warn(...args: any) {
    this.log(args, ConsoleType.Warn);
  }

  public success() {
    process.stdout.write(`\r${SUCCESS_MSG} ${this.timestamp}`);

    if (this.isLinuxService) {
      const [[lastItem]] = this.logged[this.logged.length - 1];
      if (typeof lastItem === 'string' && lastItem.startsWith(SUCCESS_MSG)) console.info('');
      else this.info(SUCCESS_MSG);
    }
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
