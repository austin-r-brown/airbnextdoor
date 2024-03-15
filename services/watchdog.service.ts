import { WATCHDOG_TIMEOUT } from '../constants';
import { EmailService } from './email.service';
import { LogService } from './log.service';

/** Service for monitoring app for consistent successful completion */
export class WatchdogService {
  private lastRunSuccessful: boolean = true;

  constructor(private readonly log: LogService, private readonly email: EmailService) {
    this.monitor();
  }

  public success() {
    this.lastRunSuccessful = true;
    this.log.success();
    this.email.clearErrors();
  }

  private monitor() {
    setInterval(() => {
      if (this.lastRunSuccessful) {
        this.lastRunSuccessful = false;
      } else {
        this.email.sendTimeoutError(WATCHDOG_TIMEOUT);
      }
    }, WATCHDOG_TIMEOUT);
  }
}
