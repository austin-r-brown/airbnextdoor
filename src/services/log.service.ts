import { offsetDay } from '../helpers/date.helper';
import { formatIsoDate } from '../helpers/date.helper';
import { Booking } from '../constants/Booking';
import { BookingChange, LogItem } from '../constants/types';
import { ConsoleType } from '../constants/enums';
import packageInfo from '../../package.json';

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
    this.info(`Starting application v${packageInfo.version}`);
  }

  private log(values: any[], type: ConsoleType): void {
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

  private display(values: any[], type: ConsoleType): void {
    values.forEach((val: any) => console[type]?.(val));
    console[type]?.('');
  }

  public info(...args: any): void {
    this.log(args, ConsoleType.Info);
  }

  public error(...args: any): void {
    this.log(args, ConsoleType.Error);
  }

  public warn(...args: any): void {
    this.log(args, ConsoleType.Warn);
  }

  public success(): void {
    if (this.isLinuxService) {
      console.info(this.timestamp);
    } else {
      process.stdout.write(`\rAirbnb listing checked successfully ${this.timestamp}`);
    }
  }

  public notification(title: string, booking: Booking, change?: BookingChange): void {
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
