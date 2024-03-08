import { ConsoleType, LogItem } from '../types';

/** Service for handling console log messages */
export class LogService {
  private logged: LogItem[] = [];

  private readonly timestamp = () => `(${new Date().toLocaleString()})`;

  private display(values: any[], type: ConsoleType) {
    values.forEach((val: any) => console[type]?.(val));
    console[type]?.('');
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
    console.clear();
    // Only display one success message at a time
    const successItem: LogItem = [[`Airbnb API Request Successful ${this.timestamp()}`], ConsoleType.Info];
    [...this.logged, successItem].forEach((item) => this.display(...item));
  }

  public start() {
    console.clear();
    this.info('Starting application...');
  }
}
