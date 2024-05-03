import { App } from '../app';
import { API_TIMEOUT, INTERVAL, MS_IN_DAY } from '../constants';
import { timeUntil } from '../helpers/date.helper';
import { Time24Hr } from '../types';

const PRE_MIDNIGHT: Time24Hr = [23, 59, 50]; // 11:59:50 PM
const POST_MIDNIGHT: Time24Hr = [0, 0, 10]; // 12:00:10 AM

/** Service for scheduling recurring processes in main App */
export class SchedulerService {
  public isPostMidnight: boolean = false;
  private isMidnightCheck: boolean = false;

  constructor(private readonly app: App) {}

  public schedule() {
    this.midnightCheck();
    this.nextRun();
    this.morningActivities();
  }

  /** Determines when app will run next and schedules it */
  private nextRun() {
    let nextRun = INTERVAL;

    if (this.isMidnightCheck) {
      nextRun += timeUntil(...POST_MIDNIGHT);
    }

    setTimeout(async () => {
      await this.app.run();
      this.nextRun();
    }, nextRun);
  }

  /** Schedules app to be ran just before and after midnight for comparison */
  private midnightCheck() {
    let timeUntilCheck = timeUntil(...PRE_MIDNIGHT) - (INTERVAL + API_TIMEOUT);

    if (timeUntilCheck <= 0) {
      timeUntilCheck += MS_IN_DAY;
    }

    setTimeout(async () => {
      this.isMidnightCheck = true;
      await this.waitUntil(...PRE_MIDNIGHT);
      await this.app.run();
      if (new Date().getHours() !== 0) {
        // Only proceed with check if midnight hasn't passed yet
        await this.waitUntil(...POST_MIDNIGHT);
        this.isPostMidnight = true;
        await this.app.run();
        this.isPostMidnight = false;
      }
      this.isMidnightCheck = false;
      this.midnightCheck();
    }, timeUntilCheck);
  }

  /** Schedules anything that should occur in the morning */
  private morningActivities() {
    const timeInMorning = 9;

    setTimeout(() => {
      this.app.guestChangeNotification();
      this.morningActivities();
    }, timeUntil(timeInMorning));
  }

  /** Returns a promise that resolves at specified time (24 hr) */
  private waitUntil(hour: number, minute?: number, seconds?: number): Promise<void> {
    const ms = timeUntil(hour, minute, seconds);
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        resolve();
      }, ms);
    });
  }
}
