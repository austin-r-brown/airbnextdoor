import { App } from '../app';
import { API_TIMEOUT, INTERVAL, MS_IN_DAY } from '../constants';
import { timeUntilHour } from '../helpers/date.helper';

/** Service for scheduling recurring processes in main App */
export class SchedulerService {
  public isPreMidnight: boolean = false;
  public isPostMidnight: boolean = false;

  constructor(private readonly app: App) {
    this.scheduleMidnightRun();
    this.scheduleNextRun();
    this.scheduleGuestChangeNotification();
  }

  /** Determines when app will run next and schedules it */
  private scheduleNextRun() {
    let nextRun = INTERVAL;
    if (this.isPreMidnight || this.isPostMidnight) {
      const postMidnight = timeUntilHour(24) + API_TIMEOUT;
      nextRun += postMidnight;
    }

    setTimeout(() => {
      this.app.run();
      this.scheduleNextRun();
    }, nextRun);
  }

  /** Schedules a check to be ran just before and after midnight */
  private scheduleMidnightRun() {
    const timeUntilMidnight = timeUntilHour(24);
    let preMidnight = timeUntilMidnight - API_TIMEOUT;
    let postMidnight = timeUntilMidnight + API_TIMEOUT;
    let setIsPreMidnight = preMidnight - (INTERVAL + API_TIMEOUT);

    if (setIsPreMidnight <= 0) {
      preMidnight += MS_IN_DAY;
      postMidnight += MS_IN_DAY;
      setIsPreMidnight += MS_IN_DAY;
    }

    // Set isPreMidnight to true prior to doing the check so that scheduleNextRun knows to skip during that period
    setTimeout(() => (this.isPreMidnight = true), setIsPreMidnight);

    setTimeout(() => {
      this.app.run();
      this.isPreMidnight = false;
    }, preMidnight);

    setTimeout(() => {
      this.isPostMidnight = true;
      this.app.run();
      this.isPostMidnight = false;
      this.scheduleMidnightRun();
    }, postMidnight);
  }

  private scheduleGuestChangeNotification() {
    setTimeout(() => {
      this.app.guestChangeNotification();
      this.scheduleGuestChangeNotification();
    }, timeUntilHour(9));
  }
}
