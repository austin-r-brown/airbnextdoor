import { Booking, ISODate } from './constants/Booking';
import { Calendar } from './constants/Calendar';
import { CalendarDay, BookingMap, NotificationBuffer, RunOptions, BookingChange } from './constants/types';
import { BookingChangeType } from './constants/enums';
import { countDaysBetween, offsetDay, getBookingDateRange } from './helpers/date.helper';
import { formatCurrentBookings, createNotifications } from './helpers/email.helper';
import { DbService } from './services/db.service';
import { EmailService } from './services/email.service';
import { LogService } from './services/log.service';
import { AirbnbService } from './services/airbnb.service';
import { DateService } from './services/date.service';
import { NOTIFY_DEBOUNCE_TIME } from './constants/constants';
import { WatchdogService } from './services/watchdog.service';
import { SchedulerService } from './services/scheduler.service';
import { iCalService } from './services/ical.service';

export class App {
  private isInitialized: boolean = false;

  private readonly date: DateService = new DateService();
  private readonly log: LogService = new LogService();
  private readonly email: EmailService = new EmailService(this.log);
  private readonly watchdog: WatchdogService = new WatchdogService(this.log, this.email);
  private readonly airbnb: AirbnbService = new AirbnbService(this.log, this.date, this.email);
  private readonly db: DbService = new DbService(this.log, this.airbnb);
  private readonly ical: iCalService = new iCalService(this.log, this.airbnb);
  private readonly scheduler: SchedulerService = new SchedulerService(this);

  /** All known bookings and blocked off periods */
  private bookings: Booking[] = [];

  /** Used for debouncing notifications sent and JSON backups saved */
  private notifyDebounceTimer?: NodeJS.Timeout;
  private notificationBuffer: NotificationBuffer = [];

  public async init() {
    await this.airbnb.init();
    this.ical.init();

    const savedBookings = this.db.load();
    if (savedBookings.length) {
      this.bookings = savedBookings;
      this.ical.updateEvents(savedBookings);
      this.log.info(`Loaded ${savedBookings.length} booking(s) from DB for ${this.airbnb.listingTitle}`);
    }

    await this.run({ isFirstRun: true });
    this.scheduler.schedule();
    this.isInitialized = true;
  }

  private handleBookingChange(changeType: BookingChangeType, booking: Booking, change?: BookingChange) {
    this.notify(changeType, booking, change);

    if (change) {
      Object.assign(booking, change);
    }

    if (changeType === BookingChangeType.New) {
      this.ical.addEvent(booking);
    } else {
      this.ical.updateEvents(this.bookings);
    }
  }

  /** Sends all notifications that have accumulated during debounce period */
  private notify(title: string, booking: Booking, change?: BookingChange) {
    this.log.notification(title, booking, change);

    if (!booking.isBlockedOff) {
      // Only send email if booking is not blocked off period
      this.notificationBuffer.push([title, new Booking(booking), change]);
    }

    clearTimeout(this.notifyDebounceTimer);

    this.notifyDebounceTimer = setTimeout(() => {
      const bookings = this.sortAndSaveBookings();
      const notifications = createNotifications(this.notificationBuffer);

      if (notifications.length) {
        const count = this.notificationBuffer.length;
        const subject = `${this.airbnb.listingTitle}: ${count} Notification${count > 1 ? 's' : ''}`;
        const currentBookings = bookings.filter((b) => !b.isBlockedOff && b.checkOut >= this.date.today);
        const footer = formatCurrentBookings(currentBookings);

        this.email.send(subject, notifications, footer);
        this.notificationBuffer = [];
      }
    }, NOTIFY_DEBOUNCE_TIME);
  }

  /** Sorts bookings by check in date, updates DB and iCal services with latest bookings */
  private sortAndSaveBookings(): Booking[] {
    const bookings = this.bookings.sort(
      (a, b) => new Date(a.firstNight).valueOf() - new Date(b.firstNight).valueOf()
    );
    this.db.save(bookings);
    return bookings;
  }

  /** Sets isBlockedOff property and sends cancelled notification */
  private changeToBlockedOff(booking: Booking) {
    this.handleBookingChange(BookingChangeType.Cancelled, booking, { isBlockedOff: true });
  }

  /** Adds new blocked off period and saves to DB */
  private addBlockedOff(booking: Booking) {
    booking.isBlockedOff = true;
    this.addBookings([booking]);
  }

  /** Adds new bookings and sends notification */
  private addBookings(bookings: Booking[]) {
    const createdAt = new Date();
    bookings.forEach((b) => {
      if (this.isInitialized) {
        // Creation date is unknown if booked when app was not running
        b.createdAt = createdAt;
      }
      this.bookings.push(b);
      this.handleBookingChange(BookingChangeType.New, b);
    });
  }

  /** Validates changes in booking length, updates booking accordingly and sends notification */
  private changeBookingLength(booking: Booking, change: BookingChange) {
    let changeType: BookingChangeType | undefined;
    const { firstNight, lastNight } = change;

    if (firstNight && firstNight !== booking.firstNight) {
      changeType = firstNight < booking.firstNight ? BookingChangeType.Extended : BookingChangeType.Shortened;
      delete change.lastNight;
    } else if (lastNight && lastNight !== booking.lastNight) {
      changeType = lastNight > booking.lastNight ? BookingChangeType.Extended : BookingChangeType.Shortened;
      delete change.firstNight;
    }

    if (changeType) {
      this.handleBookingChange(changeType, booking, change);
    }
  }

  /** Removes bookings by index and sends notification */
  private cancelBookings(indexes: number[]) {
    indexes.forEach((index, i) => {
      const [booking] = this.bookings.splice(index - i, 1);
      this.handleBookingChange(BookingChangeType.Cancelled, booking);
    });
  }

  /** Returns tuple of newly found bookings and newly found gaps that are too short to be bookings */
  private checkForNewBookings(calendar: Calendar, existingBookings: BookingMap): [Booking[], Booking[]] {
    const bookings: Booking[] = [];
    const gaps: Booking[] = [];

    const push = (b: Booking, minNights?: number) => {
      const min = minNights ?? calendar.get(b.firstNight)?.minNights ?? 1;
      const totalNights = countDaysBetween(b.checkIn, b.checkOut);

      if (totalNights >= min) {
        bookings.push(b);
      } else {
        gaps.push(b);
      }
    };

    let firstNight: ISODate | null = null;
    let lastNight: ISODate | null = null;

    calendar.days.forEach((day) => {
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
        push(new Booking({ firstNight, lastNight }), day.minNights);
        firstNight = null;
        lastNight = null;
      }
    });

    // Add a booking if a booking was in progress at the end of the loop
    if (firstNight && lastNight) {
      push(new Booking({ firstNight, lastNight }));
    }
    return [bookings, gaps];
  }

  /** Sends notification when guests are arriving or leaving today */
  public guestChangeNotification() {
    let startingToday;
    let endingToday;

    for (const b of this.bookings) {
      if (!b.isBlockedOff) {
        if (b.checkIn === this.date.today) {
          startingToday = b;
        } else if (b.checkOut === this.date.today) {
          endingToday = b;
        }
      }
      if (b.checkIn > this.date.today) {
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
  private checkAdjacentBookings(gaps: Booking[], existingBookings: BookingMap) {
    gaps.forEach((gap) => {
      let preceding;
      let succeeding;

      const precedingDate = offsetDay(gap.firstNight, -1);
      const precedingBooking = existingBookings.get(precedingDate);
      if (precedingBooking?.lastNight === precedingDate && !precedingBooking.isBlockedOff) {
        preceding = precedingBooking;
      }

      const succeedingBooking = existingBookings.get(gap.checkOut);
      if (succeedingBooking?.checkIn === gap.checkOut && !succeedingBooking.isBlockedOff) {
        succeeding = succeedingBooking;
      }

      if (preceding && !succeeding) {
        this.changeBookingLength(preceding, { lastNight: gap.lastNight });
      } else if (!preceding && succeeding) {
        this.changeBookingLength(succeeding, { firstNight: gap.firstNight });
      } else {
        // Gaps that are either adjacent to two bookings or none at all are most likely blocked off
        this.addBlockedOff(gap);
      }
    });
  }

  /** Handles changes if existing bookings have shortened or cancelled, returns map of updated existing bookings */
  private checkExistingBookings(calendar: Calendar): BookingMap {
    const existingBookings: BookingMap = new Map();
    const cancelledBookings: number[] = [];

    this.bookings.forEach((b, i) => {
      if (!calendar.isBookingInRange(b)) {
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

        dates.forEach((date) => {
          existingBookings.set(date, b);
        });
      }
    });

    this.cancelBookings(cancelledBookings);
    return existingBookings;
  }

  public run = async (options: RunOptions = {}) => {
    this.date.set(); // Set today's date
    const calendar = await this.airbnb.fetchCalendar(); // Fetch latest data from Airbnb

    if (calendar) {
      if (calendar.size) {
        // Check for new or altered bookings
        const existingBookings = this.checkExistingBookings(calendar);
        const [newBookings, gaps] = this.checkForNewBookings(calendar, existingBookings);

        if (options.isPostMidnightRun || (newBookings.length > 1 && calendar.days.every((d) => d.booked))) {
          // If new booking appears right after midnight, or if suddenly the entire calendar is booked, it is most likely blocked off
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
