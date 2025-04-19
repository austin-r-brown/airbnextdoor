import { App } from '../app';
import { INTERVAL } from '../constants/constants';
import { SchedulerEvent } from '../constants/types';
import { DateService } from './date.service';

/** Service for scheduling recurring processes in main App */
export class SchedulerService {
  private nextEvent: SchedulerEvent | null = null;

  constructor(private readonly app: App, private readonly date: DateService) {}

  public schedule() {
    this.scheduleNextRun();
    this.scheduleMorningNotification();
  }

  /** Determines when app will run next and schedules it */
  private scheduleNextRun(delay: number = INTERVAL) {
    if (this.nextEvent) {
      clearTimeout(this.nextEvent.timer);
    }

    this.nextEvent = {
      timer: setTimeout(async () => {
        await this.app.run();

        this.nextEvent = null;
        this.scheduleNextRun();
      }, delay),
      date: Date.now() + delay,
    };
  }

  /** Schedules anything that should occur in the morning */
  private scheduleMorningNotification() {
    setTimeout(() => {
      this.app.guestChangeNotification();
      this.scheduleMorningNotification();
    }, this.date.timeUntil([9] /* 9:00 AM */));
  }
}
