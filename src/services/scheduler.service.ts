import { App } from '../app';
import { INTERVAL } from '../constants/constants';
import { RunOptions, SchedulerEvent } from '../constants/types';
import { DateService } from './date.service';

/** Service for scheduling recurring processes in main App */
export class SchedulerService {
  private nextEvent: SchedulerEvent | null = null;
  private reCheckUntil: number | null = null;

  constructor(private readonly app: App, private readonly date: DateService) {}

  public schedule() {
    this.scheduleNextRun();
    this.scheduleMorningNotification();
  }

  /** Determines when app will run next and schedules it */
  private scheduleNextRun(delay: number = INTERVAL, options: RunOptions = {}) {
    if (this.nextEvent) {
      clearTimeout(this.nextEvent.timer);
    }

    this.nextEvent = {
      timer: setTimeout(async () => {
        if (this.reCheckUntil && Date.now() < this.reCheckUntil) {
          // If re-check is in progress, set the re-check flag
          options.isReCheck = true;
        }
        await this.app.run(options);

        this.nextEvent = null;
        this.scheduleNextRun();
      }, delay),
      date: Date.now() + delay,
    };
  }

  public setReCheck(delay: number | null): boolean {
    this.reCheckUntil = delay && Date.now() + delay;
    return Boolean(delay);
  }

  /** Schedules anything that should occur in the morning */
  private scheduleMorningNotification() {
    setTimeout(() => {
      this.app.guestChangeNotification();
      this.scheduleMorningNotification();
    }, this.date.timeUntil([9] /* 9:00 AM */));
  }
}
