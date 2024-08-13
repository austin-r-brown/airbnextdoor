import { App } from '../app';
import { INTERVAL } from '../constants/constants';
import { timeUntil } from '../helpers/date.helper';
import { RunOptions, SchedulerEvent, Time } from '../constants/types';

const PRE_MIDNIGHT_BUFFER: Time = [23, 59, 40]; // 11:59:40 PM
const PRE_MIDNIGHT: Time = [23, 59, 50]; // 11:59:50 PM
const POST_MIDNIGHT: Time = [0, 0, 10]; // 12:00:10 AM
const MORNING: Time = [9]; // 9:00 AM

/** Service for scheduling recurring processes in main App */
export class SchedulerService {
  private nextEvent: SchedulerEvent | null = null;
  private reCheckUntil: number | null = null;

  constructor(private readonly app: App) {}

  public schedule() {
    this.setNextRun();
    this.midnightCheck();
    this.morningActivities();
  }

  /** Determines when app will run next and schedules it */
  private setNextRun(delay: number = INTERVAL, options: RunOptions = {}) {
    if (this.nextEvent) {
      clearTimeout(this.nextEvent.timer);
    }

    this.nextEvent = {
      timer: setTimeout(async () => {
        if (this.reCheckUntil && Date.now() < this.reCheckUntil) {
          // If re-check is in progress, set the re-check flag
          options.isReCheck = true;
        }

        const success = await this.app.run(options);
        // If pre midnight run just completed and it is not yet midnight, schedule the post midnight run
        const isPostMidnightRun = success && options.isPreMidnightRun && new Date().getHours() !== 0;
        const nextDelay = isPostMidnightRun ? timeUntil(POST_MIDNIGHT) : INTERVAL;

        this.nextEvent = null;
        this.setNextRun(nextDelay, { isPostMidnightRun });
      }, delay),
      date: Date.now() + delay,
    };
  }

  public setReCheck(delay: number | null): boolean {
    this.reCheckUntil = delay && Date.now() + delay;
    return Boolean(delay);
  }

  /** Schedules app to be ran just before and after midnight for comparison */
  private midnightCheck() {
    setTimeout(() => {
      this.setNextRun(timeUntil(PRE_MIDNIGHT), { isPreMidnightRun: true });
      this.midnightCheck();
    }, timeUntil(PRE_MIDNIGHT_BUFFER));
  }

  /** Schedules anything that should occur in the morning */
  private morningActivities() {
    setTimeout(() => {
      this.app.guestChangeNotification();
      this.morningActivities();
    }, timeUntil(MORNING));
  }
}
