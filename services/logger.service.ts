enum ConsoleType {
  Info = 'info',
  Error = 'error',
}

export class Logger {
  private logged: [any, ConsoleType][] = [];

  private display(item: any, type: ConsoleType) {
    console[type]?.(item);
    console[type]?.('');
  }

  private log(items: any[], type: ConsoleType) {
    items.forEach((item) => {
      const toLog = typeof item === 'object' ? JSON.parse(JSON.stringify(item)) : item;
      this.display(toLog, type);
      this.logged.push([toLog, type]);
    });
  }

  public info(items: any) {
    this.log(Array.isArray(items) ? items : [items], ConsoleType.Info);
  }

  public error(items: any) {
    this.log(Array.isArray(items) ? items : [items], ConsoleType.Error);
  }

  public success() {
    console.clear();
    this.logged.forEach(([item, type]) => this.display(item, type));
    console.info(`Airbnb API Request Successful at ${new Date().toLocaleString()}`);
  }
}
