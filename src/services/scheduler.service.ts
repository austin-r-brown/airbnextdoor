import { App } from '../app';
import { INTERVAL } from '../constants/constants';
import { SchedulerEvent } from '../constants/types';
import { DateService } from './date.service';
import { EmailService } from './email.service';
import { LogService } from './log.service';
import { WatchdogService } from './watchdog.service';

/** Service for scheduling recurring processes in main App */
export class SchedulerService {
  private nextEvent: SchedulerEvent | null = null;
  private watchdog: WatchdogService = new WatchdogService(this.log, this.email);

  constructor(
    private readonly app: App,
    private readonly log: LogService,
    private readonly date: DateService,
    private readonly email: EmailService
  ) {}

  public schedule() {
    this.scheduleNextRun();
    this.scheduleMorningNotification();
  }

  /** Determines when app will run next and schedules it */
  private scheduleNextRun(delay: number = INTERVAL): void {
    if (this.nextEvent) {
      clearTimeout(this.nextEvent.timer);
    }

    this.nextEvent = {
      timer: setTimeout(async () => {
        let success = false;
        try {
          success = await this.app.run();
        } catch (e: any) {
          this.log.error('Application Error:', e);
        }
        this.nextEvent = null;
        this.scheduleNextRun();

        if (success) this.watchdog.success();
      }, delay),
      date: Date.now() + delay,
    };
  }

  /** Schedules anything that should occur in the morning */
  private scheduleMorningNotification(): void {
    setTimeout(() => {
      this.app.guestChangeNotification();
      this.scheduleMorningNotification();
    }, this.date.timeUntil([9] /* 9:00 AM */));
  }
}
