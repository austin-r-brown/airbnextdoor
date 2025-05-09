import { MS_IN_MINUTE, WATCHDOG_TIMEOUT } from '../constants/constants';
import { createHtmlList } from '../helpers/email.helper';
import { EmailService } from './email.service';
import { LogService } from './log.service';

/** Service for monitoring the app for errors */
export class WatchdogService {
  private lastSuccessfulRun: number = 0;
  private notificationSent: boolean = false;

  constructor(private readonly log: LogService, private readonly email: EmailService) {
    this.monitor();
  }

  public success(): void {
    this.email.clearErrors();
    this.log.success();
    this.lastSuccessfulRun = Date.now();
    this.notificationSent = false;
  }

  private monitor(): void {
    setInterval(() => {
      const timeSinceLastRun = Date.now() - this.lastSuccessfulRun;

      if (timeSinceLastRun >= WATCHDOG_TIMEOUT) {
        const error = 'Application has not successfully run';
        const minutes = Math.round(timeSinceLastRun / MS_IN_MINUTE);
        const message = (this.lastSuccessfulRun ? `${error} within past ${minutes} minutes` : error) + '.';
        this.log.error(message);
        if (!this.notificationSent) {
          this.sendNotification(message);
        }
      }
    }, WATCHDOG_TIMEOUT);
  }

  private sendNotification(message: string): void {
    const errorsSent = this.email.getRecentErrors();
    const recentErrors = errorsSent.length
      ? ['<span class="title">Recent Errors:</span>' + createHtmlList(errorsSent)]
      : [];

    this.email.send('Error Notification', [message, ...recentErrors]);

    this.notificationSent = true;
  }
}
