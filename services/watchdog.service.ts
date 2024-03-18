import { MS_IN_MINUTE, WATCHDOG_TIMEOUT } from '../constants';
import { EmailService } from './email.service';
import { LogService } from './log.service';

/** Service for monitoring app for consistent successful completion */
export class WatchdogService {
  private lastSuccessfulRun: number = 0;

  constructor(private readonly log: LogService, private readonly email: EmailService) {
    this.monitor();
  }

  public success() {
    this.email.clearErrors();
    this.log.success();
    this.lastSuccessfulRun = Date.now();
  }

  private monitor() {
    setInterval(() => {
      const timeSinceLastRun = Date.now() - this.lastSuccessfulRun;

      if (timeSinceLastRun >= WATCHDOG_TIMEOUT) {
        const error = 'Application has not successfully run';
        const minutes = Math.round(timeSinceLastRun / MS_IN_MINUTE);
        const message = (this.lastSuccessfulRun ? `${error} within past ${minutes} minutes` : error) + '.';
        this.log.error(message);
        this.email.sendTimeoutError(message);
      }
    }, WATCHDOG_TIMEOUT);
  }
}
