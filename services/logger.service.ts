import { ConsoleType, LogItem } from '../types';

export class Logger {
  private logged: LogItem[] = [];

  private display(values: any[], type: ConsoleType) {
    values.forEach((val: any) => console[type]?.(val));
    console[type]?.('');
  }

  private log(values: any[], type: ConsoleType) {
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

  public success() {
    console.clear();
    const successItem: LogItem = [
      [`Airbnb API Request Successful at ${new Date().toLocaleString()}`],
      ConsoleType.Info,
    ];
    [...this.logged, successItem].forEach((item) => this.display(...item));
  }
}
