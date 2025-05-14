import { MS_IN_MINUTE, WATCHDOG_TIMEOUT } from '../constants/constants';
import { createHtmlList } from '../helpers/email.helper';
import { EmailService } from './email.service';
import { LogService } from './log.service';

/** Service for monitoring the app for errors */
export class WatchdogService {
  private lastSuccessfulRun: number = 0;
  private timeoutNotificationSent: boolean = false;

  private readonly errors = new Map<string, { isSent: boolean; email: string }>();

  constructor(private readonly log: LogService, private readonly email: EmailService) {
    this.monitor();
  }

  public success(): void {
    this.errors.clear();
    this.log.success();
    this.lastSuccessfulRun = Date.now();
    this.timeoutNotificationSent = false;
  }

  public handleApplicationError(message: string, details: any): void {
    this.log.error(`${message}:`, details);
    if (this.timeoutNotificationSent) return;

    const email = `<span><b>Error:</b> ${message}</span>
      <br><br>
      <div class="error">${JSON.stringify(details).slice(0, 1000)}</div>`;

    const key = email.replace(/\d+/g, '#');
    const previousError = this.errors.get(key);

    switch (previousError?.isSent) {
      case undefined:
        // Save error to map if it hasn't been saved
        this.errors.set(key, { isSent: false, email });
        break;
      case false:
        // Send email if error has previously occurred but not yet sent
        this.email.send('Error Notification', [email]);
        this.errors.set(key, { isSent: true, email });
        break;
    }
  }

  private handleTimeoutError(message: string): void {
    this.log.error(message);
    if (this.timeoutNotificationSent) return;

    const errorsSent = Array.from(this.errors.values()).map((e) => e.email);
    const recentErrors = errorsSent.length
      ? ['<span class="title">Recent Errors:</span>' + createHtmlList(errorsSent)]
      : [];

    this.email.send('Error Notification', [message, ...recentErrors]);

    this.timeoutNotificationSent = true;
  }

  private monitor(): void {
    setInterval(() => {
      const timeSinceLastRun = Date.now() - this.lastSuccessfulRun;

      if (timeSinceLastRun >= WATCHDOG_TIMEOUT) {
        const error = 'Application has not successfully run';
        const minutes = Math.round(timeSinceLastRun / MS_IN_MINUTE);
        const message = (this.lastSuccessfulRun ? `${error} within past ${minutes} minutes` : error) + '.';

        this.handleTimeoutError(message);
      }
    }, WATCHDOG_TIMEOUT);
  }
}
