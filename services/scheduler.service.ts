import { App } from '../app';
import { API_TIMEOUT, INTERVAL, MS_IN_DAY } from '../constants';
import { timeUntilHour } from '../helpers/date.helper';

/** Service for scheduling recurring processes in main App */
export class SchedulerService {
  public isMidnightCheck: boolean = false;
  public isPostMidnight: boolean = false;

  constructor(private readonly app: App) {
    this.midnightCheck();
    this.nextRun();
    this.morningActivities();
  }

  /** Determines when app will run next and schedules it */
  private nextRun() {
    let nextRun = INTERVAL;

    if (this.isMidnightCheck) {
      const postMidnight = timeUntilHour(24) + API_TIMEOUT;
      nextRun += postMidnight;
    }

    setTimeout(() => {
      this.app.run();
      this.nextRun();
    }, nextRun);
  }

  /** Schedules app to be ran just before and after midnight for comparison */
  private midnightCheck() {
    const timeUntilMidnight = timeUntilHour(24);
    let preMidnight = timeUntilMidnight - API_TIMEOUT;
    let postMidnight = timeUntilMidnight + API_TIMEOUT;
    let setIsMidnightCheck = preMidnight - (INTERVAL + API_TIMEOUT);

    if (setIsMidnightCheck <= 0) {
      preMidnight += MS_IN_DAY;
      postMidnight += MS_IN_DAY;
      setIsMidnightCheck += MS_IN_DAY;
    }

    // Set isMidnightCheck to true prior to doing the check so that no overlapping runs occur
    setTimeout(() => (this.isMidnightCheck = true), setIsMidnightCheck);

    setTimeout(this.app.run, preMidnight);

    setTimeout(async () => {
      this.isPostMidnight = true;
      await this.app.run();
      this.isPostMidnight = false;
      this.isMidnightCheck = false;
      this.midnightCheck();
    }, postMidnight);
  }

  /** Schedules anything that should occur in the morning */
  private morningActivities() {
    const timeInMorning = timeUntilHour(9);

    setTimeout(() => {
      this.app.guestChangeNotification();
      this.morningActivities();
    }, timeInMorning);
  }
}
