import { App } from '../app';
import { INTERVAL } from '../constants/constants';
import { SchedulerEvent } from '../constants/types';
import { DateService } from './date.service';
import { EmailService } from './email.service';
import { LogService } from './log.service';
import { WatchdogService } from './watchdog.service';

/** Service for scheduling and executing recurring processes that make the app function */
export class SchedulerService {
  private nextEvent: SchedulerEvent | null = null;
  private readonly watchdog: WatchdogService = new WatchdogService(this.log, this.email);

  private readonly runApp = async () => {
    let success = false;
    try {
      success = await this.app.poll();
    } catch (e: any) {
      this.log.error('Application Error:', e);
    }
    if (success) this.watchdog.success();
  };

  constructor(
    private readonly app: App,
    private readonly log: LogService,
    private readonly date: DateService,
    private readonly email: EmailService
  ) {}

  public async init() {
    this.scheduleDateChange();
    this.scheduleNextRun();
    this.scheduleMorningNotification();
    await this.runApp();
  }

  /** Schedules the date service to update its values each day at midnight */
  private scheduleDateChange(): void {
    setTimeout(() => {
      this.date.set();
      this.scheduleDateChange();
    }, this.date.timeUntil([24] /* Midnight */));
  }

  /** Determines when app will run next and schedules it */
  private scheduleNextRun(delay: number = INTERVAL): void {
    if (this.nextEvent) {
      clearTimeout(this.nextEvent.timer);
    }

    this.nextEvent = {
      timer: setTimeout(() => {
        this.runApp();
        this.nextEvent = null;
        this.scheduleNextRun();
      }, delay),
      executesAt: Date.now() + delay,
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
