import { Booking, BookingChange, ISODate, CalendarDay, BookingsMap, NotificationBuffer } from './types';
import {
  countDaysBetween,
  offsetDay,
  getBookingDateRange,
  Calendar,
  isBookingInCalendarRange,
} from './helpers/date.helper';
import { formatCurrentBookings, createNotifications } from './helpers/email.helper';
import { DbService } from './services/db.service';
import { EmailService } from './services/email.service';
import { LogService } from './services/log.service';
import { AirbnbService } from './services/airbnb.service';
import { DateService } from './services/date.service';
import { SEND_DEBOUNCE_TIME } from './constants';
import { WatchdogService } from './services/watchdog.service';
import { SchedulerService } from './services/scheduler.service';

export class App {
  private readonly date: DateService = new DateService();
  private readonly log: LogService = new LogService();
  private readonly email: EmailService = new EmailService(this.log);
  private readonly watchdog: WatchdogService = new WatchdogService(this.log, this.email);
  private readonly airbnb: AirbnbService = new AirbnbService(this.log, this.date, this.email);
  private readonly db: DbService = new DbService(this.log, this.airbnb);
  private readonly scheduler: SchedulerService = new SchedulerService(this);

  /** Array of all known bookings and blocked off periods */
  private bookings: Booking[] = [];

  /** Used for debouncing notifications sent and JSON backups saved */
  private sendDebounceTimer?: NodeJS.Timeout;
  private notificationBuffer: NotificationBuffer = [];

  constructor() {
    this.log.start();

    const previousBookings = this.db.load();
    if (previousBookings.length) {
      this.bookings = previousBookings;
      this.log.info(`Loaded ${this.bookings.length} booking(s) from DB for listing ${this.airbnb.listingId}`);
    }

    this.run();
  }

  /** Sends all notifications that have been attempted within debounce period */
  private notify(title: string, booking: Booking, change?: Partial<Booking>) {
    this.log.notification(title, booking, change);

    if (!booking.isBlockedOff) {
      // Only send email if booking is not blocked off period
      this.notificationBuffer.push([title, booking, change]);
    }

    clearTimeout(this.sendDebounceTimer);

    this.sendDebounceTimer = setTimeout(() => {
      const bookings = this.sortAndUpdateBookings();
      const notifications = createNotifications(this.notificationBuffer);

      if (notifications.length) {
        const currentBookings = bookings.filter((b) => !b.isBlockedOff && b.lastNight >= this.date.yesterday);
        const footer = formatCurrentBookings(currentBookings);

        this.email.send(notifications, footer);
        this.notificationBuffer = [];
      }
    }, SEND_DEBOUNCE_TIME);
  }

  /** Sorts bookings by check in date, sets isActive property based on current date and saves to DB */
  private sortAndUpdateBookings(): Booking[] {
    const bookings = this.bookings.sort(
      (a, b) => new Date(a.firstNight).valueOf() - new Date(b.firstNight).valueOf()
    );
    bookings.forEach(
      (b) => (b.isActive = b.firstNight <= this.date.today && b.lastNight >= this.date.yesterday)
    );
    this.db.save(bookings);
    return bookings;
  }

  /** Sets isBlockedOff property on booking to true and sends cancelled notification */
  private changeToBlockedOff(booking: Booking) {
    this.notify(BookingChange.Cancelled, booking);
    booking.isBlockedOff = true;
  }

  /** Adds new blocked off period and saves to DB */
  private addBlockedOff(booking: Booking) {
    booking.isBlockedOff = true;
    this.bookings.push(booking);
    this.notify(BookingChange.New, booking);
  }

  /** Adds new bookings and sends notification */
  private addBookings(bookings: Booking[]) {
    bookings.forEach((b) => {
      this.bookings.push(b);
      this.notify(BookingChange.New, b);
    });
  }

  /** Validates changes in booking length, updates booking accordingly and sends notification */
  private changeBookingLength(booking: Booking, change: Partial<Booking>) {
    let changeType: BookingChange | undefined;
    const { firstNight, lastNight } = change;

    if (firstNight && firstNight !== booking.firstNight) {
      changeType = firstNight < booking.firstNight ? BookingChange.Extended : BookingChange.Shortened;
      delete change.lastNight;
    } else if (lastNight && lastNight !== booking.lastNight) {
      changeType = lastNight > booking.lastNight ? BookingChange.Extended : BookingChange.Shortened;
      delete change.firstNight;
    }

    if (changeType) {
      this.notify(changeType, booking, change);
      Object.assign(booking, change);
    }
  }

  /** Removes bookings by index and sends notification */
  private cancelBookings(indexes: number[]) {
    indexes.forEach((index, i) => {
      const currentIndex = index - i;
      const booking: Booking = this.bookings[currentIndex];
      this.notify(BookingChange.Cancelled, booking);
      this.bookings.splice(currentIndex, 1);
    });
  }

  /** Returns tuple of newly found bookings and newly found gaps that are too short to be bookings */
  private checkForNewBookings(calendar: Calendar, existingBookings: BookingsMap): [Booking[], Booking[]] {
    const bookings: Booking[] = [];
    const gaps: Booking[] = [];

    const push = (b: Booking, minNights?: number) => {
      const min = minNights ?? calendar.get(b.firstNight)?.minNights ?? 1;
      const totalNights = countDaysBetween(b.firstNight, b.lastNight) + 1;
      if (totalNights >= min) {
        bookings.push(b);
      } else {
        gaps.push(b);
      }
    };

    let firstNight: ISODate | null = null;
    let lastNight: ISODate | null = null;

    calendar.days().forEach((day) => {
      if (day.booked && !existingBookings.has(day.date)) {
        // If a booking is in progress, update the end date
        if (firstNight !== null) {
          lastNight = day.date;
        } else {
          // Otherwise, start a new booking
          firstNight = day.date;
          lastNight = day.date;
        }
      } else if (firstNight && lastNight) {
        // If a booking was in progress and now it's not, save it
        push({ firstNight, lastNight }, day.minNights);
        firstNight = null;
        lastNight = null;
      }
    });

    // Add a booking if a booking was in progress at the end of the loop
    if (firstNight && lastNight) {
      push({ firstNight, lastNight });
    }
    return [bookings, gaps];
  }

  /** Sends notification when guests are arriving or leaving today */
  public guestChangeNotification() {
    let startingToday;
    let endingToday;

    for (const b of this.bookings) {
      if (!b.isBlockedOff) {
        if (b.firstNight === this.date.today) {
          startingToday = b;
        } else if (b.lastNight === this.date.yesterday) {
          endingToday = b;
        }
      }
      if (startingToday && endingToday) {
        break;
      }
    }

    if (endingToday) {
      this.notify('Ending Today', endingToday);
    }
    if (startingToday) {
      this.notify('Starting Today', startingToday);
    }
  }

  /** Extends adjacent booking with gap if one adjacent booking exists, otherwise blocks off gap from future bookings */
  private checkAdjacentBookings(gaps: Booking[], existingBookings: BookingsMap) {
    gaps.forEach((gap) => {
      let preceding;
      let succeeding;

      const precedingDate = offsetDay(gap.firstNight, -1);
      const precedingBooking = existingBookings.get(precedingDate);
      if (precedingBooking?.lastNight === precedingDate && !precedingBooking.isBlockedOff) {
        preceding = precedingBooking;
      }

      const succeedingDate = offsetDay(gap.lastNight, 1);
      const succeedingBooking = existingBookings.get(succeedingDate);
      if (succeedingBooking?.firstNight === succeedingDate && !succeedingBooking.isBlockedOff) {
        succeeding = succeedingBooking;
      }

      if (preceding && !succeeding) {
        this.changeBookingLength(preceding, { lastNight: gap.lastNight });
      } else if (succeeding && !preceding) {
        this.changeBookingLength(succeeding, { firstNight: gap.firstNight });
      } else {
        // Gap is either between two bookings or orphaned, save to exclude from adjacent future bookings
        this.addBlockedOff(gap);
      }
    });
  }

  /** Handles changes if existing bookings have shortened or cancelled, returns map of updated existing bookings */
  private checkExistingBookings(calendar: Calendar): BookingsMap {
    const existingBookings: BookingsMap = new Map();
    const cancelledBookings: number[] = [];

    this.bookings.forEach((b, i) => {
      if (!isBookingInCalendarRange(b, calendar)) {
        return;
      }
      const dates = getBookingDateRange(b);

      let newFirst: CalendarDay | undefined;
      let newLast: CalendarDay | undefined;
      // Consider cancelled if both first and last nights are no longer booked
      let cancelled = !(calendar.get(b.firstNight)?.booked || calendar.get(b.lastNight)?.booked);

      if (!cancelled) {
        let previousDay;

        for (const date of dates) {
          const currentDay = calendar.get(date);

          if (currentDay) {
            if (previousDay) {
              if (currentDay.booked && !previousDay.booked) {
                if (newLast) {
                  // Consider cancelled if there are dates in the middle that are no longer booked
                  cancelled = true;
                  break;
                } else {
                  // First night has been moved back
                  newFirst = currentDay;
                }
              } else if (!currentDay.booked && previousDay.booked) {
                // Last night has been moved up
                newLast = previousDay;
              }
            }
            previousDay = currentDay;
          }
        }
      }

      if (cancelled) {
        cancelledBookings.push(i);
      } else {
        if (newFirst || newLast) {
          const minNights = newFirst?.minNights ?? calendar.get(b.firstNight)?.minNights ?? 1;
          const firstNight = newFirst?.date ?? b.firstNight;
          const lastNight = newLast?.date ?? b.lastNight;
          const totalNights = countDaysBetween(firstNight, lastNight) + 1;

          if (totalNights >= minNights || b.isBlockedOff) {
            this.changeBookingLength(b, { firstNight, lastNight });
          } else {
            // Consider blocked off if booking is now shorter than minimum length requirement
            this.changeToBlockedOff(b);
          }
        }

        getBookingDateRange(b).forEach((date) => {
          existingBookings.set(date, b);
        });
      }
    });

    this.cancelBookings(cancelledBookings);
    return existingBookings;
  }

  public run = async () => {
    this.date.set(); // Set today's date
    const calendar = await this.airbnb.fetch(); // Fetch latest data from Airbnb

    if (calendar) {
      if (calendar.size) {
        // Check for new or altered bookings
        const existingBookings = this.checkExistingBookings(calendar);
        const [newBookings, gaps] = this.checkForNewBookings(calendar, existingBookings);

        if (this.scheduler.isPostMidnight) {
          // If new booking appears right after midnight it is most likely a gap
          gaps.concat(newBookings).forEach((gap) => this.addBlockedOff(gap));
        } else {
          this.addBookings(newBookings);
          this.checkAdjacentBookings(gaps, existingBookings);
        }
      }
      // Indicate process has successfully completed
      this.watchdog.success();
    }
  };
}

new App();
