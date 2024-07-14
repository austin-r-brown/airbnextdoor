import { App } from '../app';
import { API_TIMEOUT, INTERVAL, MS_IN_DAY } from '../constants/constants';
import { timeUntil, waitUntil } from '../helpers/date.helper';
import { Time } from '../constants/types';

const PRE_MIDNIGHT: Time = [23, 59, 50]; // 11:59:50 PM
const POST_MIDNIGHT: Time = [0, 0, 10]; // 12:00:10 AM
const MORNING: Time = [9]; // 9:00 AM

/** Service for scheduling recurring processes in main App */
export class SchedulerService {
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
      nextRun += timeUntil(POST_MIDNIGHT);
    }

    setTimeout(async () => {
      await this.app.run();
      this.nextRun();
    }, nextRun);
  }

  /** Schedules app to be ran just before and after midnight for comparison */
  private midnightCheck() {
    let timeUntilCheck = timeUntil(PRE_MIDNIGHT) - (INTERVAL + API_TIMEOUT);

    if (timeUntilCheck <= 0) {
      timeUntilCheck += MS_IN_DAY;
    }

    setTimeout(async () => {
      this.isMidnightCheck = true;
      await waitUntil(PRE_MIDNIGHT);
      await this.app.run();
      if (new Date().getHours() !== 0) {
        // Only proceed with check if midnight hasn't passed yet
        await waitUntil(POST_MIDNIGHT);
        await this.app.run({ isPostMidnightRun: true });
      }
      this.isMidnightCheck = false;
      this.midnightCheck();
    }, timeUntilCheck);
  }

  /** Schedules anything that should occur in the morning */
  private morningActivities() {
    setTimeout(() => {
      this.app.guestChangeNotification();
      this.morningActivities();
    }, timeUntil(MORNING));
  }
}
