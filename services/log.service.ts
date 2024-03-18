import { Booking, ConsoleType, LogItem } from '../types';

const START_MSG = 'Starting application...';
const SUCCESS_MSG = 'Airbnb API request successful';

/** Service for handling console log messages */
export class LogService {
  private logged: LogItem[] = [];

  private readonly timestamp = () => `(${new Date().toLocaleString()})`;

  private display(values: any[], type: ConsoleType) {
    values.forEach((val: any) => console[type]?.(val));
    console[type]?.('');
  }

  private resetConsole() {
    console.clear();
    this.logged.forEach((item) => this.display(...item));
  }

  private log(values: any[], type: ConsoleType) {
    const [first] = values;
    if (values.length === 1 && typeof first === 'string') {
      values[0] = `${first} ${this.timestamp()}`;
    } else {
      values.push(this.timestamp());
    }

    const item: LogItem = [
      values.map((val) => (typeof val === 'object' ? JSON.parse(JSON.stringify(val)) : val)),
      type,
    ];
    this.display(...item);
    this.logged.push(item);
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
    if (lastItem[0].startsWith(SUCCESS_MSG)) {
      // Only display one success message at a time
      lastItem[0] = `${SUCCESS_MSG} ${this.timestamp()}`;
      this.resetConsole();
    } else {
      this.info(SUCCESS_MSG);
    }
  }

  public start() {
    this.logged.unshift([[`${START_MSG} ${this.timestamp()}`], ConsoleType.Info]);
    this.resetConsole();
  }

  public notification(title: string, booking: Booking, change?: Partial<Booking>) {
    const titleMsg = booking.isBlockedOff ? title.replace('Booking', 'Blocked Off Period') : title;
    const bookingMsg = `[First Night: ${booking.firstNight}, Last Night: ${booking.lastNight}]`;
    const changeMsg = change
      ? [change.firstNight ? `New First Night: ${change.firstNight}` : `New Last Night: ${change.lastNight}`]
      : [];

    this.info(...[titleMsg, bookingMsg, ...changeMsg]);
  }
}
