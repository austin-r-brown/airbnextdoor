import { offsetDay } from '../helpers/date.helper';
import { formatDate } from '../helpers/email.helper';
import { Booking, ConsoleType, LogItem } from '../types';

const START_MSG = 'Starting application...';
const SUCCESS_MSG = 'Airbnb dates checked successfully';

/** Service for handling console log messages */
export class LogService {
  private readonly logged: LogItem[] = [];

  private get timestamp() {
    return `[${new Date().toLocaleString()}]`;
  }

  constructor() {
    this.resetConsole();
    this.info(START_MSG);
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

  public success() {
    const [lastItem] = this.logged[this.logged.length - 1];
    if (typeof lastItem[0] === 'string' && lastItem[0].startsWith(SUCCESS_MSG)) {
      // Only display one success message at a time
      lastItem[0] = `${SUCCESS_MSG} ${this.timestamp}`;
      this.resetConsole();
    } else {
      this.info(SUCCESS_MSG);
    }
  }

  public notification(title: string, booking: Booking, change?: Partial<Booking>) {
    let titleMsg = title,
      start = 'Check In',
      end = 'Check Out',
      endDate = offsetDay(booking.lastNight, 1),
      changeMsg: string[] = [];

    if (booking.isBlockedOff) {
      titleMsg = title.replace('Booking', 'Blocked Off Period');
      start = 'Start Date';
      end = 'End Date';
      endDate = booking.lastNight;
    }

    const bookingMsg = `(${start}: ${formatDate(booking.firstNight)} | ${end}: ${formatDate(endDate)})`;

    if (change?.firstNight) {
      changeMsg = [`New ${start}: ${formatDate(change.firstNight)}`];
    } else if (change?.lastNight) {
      const changeDate = booking.isBlockedOff ? change.lastNight : offsetDay(change.lastNight, 1);
      changeMsg = [`New ${end}: ${formatDate(changeDate)}`];
    }

    this.info(...[`${titleMsg}:`, bookingMsg, ...changeMsg]);
  }
}
