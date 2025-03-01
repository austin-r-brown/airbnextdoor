import { Booking, ISODate } from './constants/Booking';
import { Calendar } from './constants/Calendar';
import { CalendarDay, BookingMap, NotificationBuffer, RunOptions, BookingChange } from './constants/types';
import { BookingChangeType } from './constants/enums';
import { countDaysBetween, offsetDay, getBookingDateRange, waitFor } from './helpers/date.helper';
import { formatCurrentBookings, createNotifications } from './helpers/email.helper';
import { DbService } from './services/db.service';
import { EmailService } from './services/email.service';
import { LogService } from './services/log.service';
import { AirbnbService } from './services/airbnb.service';
import { DateService } from './services/date.service';
import { API_BUFFER, INTERVAL, MS_IN_MINUTE, NOTIFY_DEBOUNCE_TIME } from './constants/constants';
import { WatchdogService } from './services/watchdog.service';
import { SchedulerService } from './services/scheduler.service';
import { iCalService } from './services/ical.service';
import { isOnline } from './helpers/network.helper';

export class App {
  private isInitialized: boolean = false;

  private readonly date: DateService = new DateService();
  private readonly email: EmailService = new EmailService(this.log);
  private readonly watchdog: WatchdogService = new WatchdogService(this.log, this.email);
  private readonly airbnb: AirbnbService = new AirbnbService(this.log, this.date, this.email);
  private readonly db: DbService = new DbService(this.log, this.airbnb);
  private readonly ical: iCalService = new iCalService(this.log, this.airbnb);
  private readonly scheduler: SchedulerService = new SchedulerService(this, this.date);

  /** All known bookings and blocked off periods */
  private bookings: Booking[] = [];

  /** Used for debouncing notifications sent and JSON backups saved */
  private notifyDebounceTimer?: NodeJS.Timeout;
  private notificationBuffer: NotificationBuffer = [];

  constructor(private readonly log: LogService = new LogService()) {}

  public async init() {
    await this.waitUntilOnline();
    await this.airbnb.init();
    this.ical.init();

    const savedBookings = this.db.load();
    if (savedBookings.length) {
      this.bookings = savedBookings;
      this.ical.updateEvents(savedBookings);
      this.log.info(`Loaded ${savedBookings.length} booking(s) from DB for ${this.airbnb.listingTitle}`);
    }

    await this.run();
    this.scheduler.schedule();
    this.isInitialized = true;
  }

  private handleBookingChange(changeType: BookingChangeType, booking: Booking, change?: BookingChange) {
    const title = `${changeType} ${booking.isBlockedOff ? 'Blocked Off Period' : 'Booking'}`;
    let notifiedChange;
    if ([BookingChangeType.Shortened, BookingChangeType.Extended].includes(changeType)) {
      notifiedChange = change;
    }

    this.notify(title, booking, notifiedChange);

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

    if (!booking.isHidden) {
      this.notificationBuffer.push([title, new Booking(booking), change]);
    }

    clearTimeout(this.notifyDebounceTimer);

    this.notifyDebounceTimer = setTimeout(() => {
      this.sortAndSaveBookings();
      const notifications = createNotifications(this.notificationBuffer);

      if (notifications.length) {
        const count = this.notificationBuffer.length;
        const subject = `${this.airbnb.listingTitle}: ${
          // If there is single notification, use its title for the email subject
          count === 1 ? this.notificationBuffer[0][0] : `${count} Notifications`
        }`;
        this.email.send(subject, notifications, this.getFooter());
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

  private getFooter(): string | undefined {
    let currentBookings = this.bookings.filter((b) => {
      if (b.isHidden || b.checkOut <= this.date.today)
        // Omit bookings that are hidden or have already ended
        return false;
      if (b.checkIn <= this.date.today && this.notificationBuffer.find(([, n]) => n.isSameAs(b)))
        // Omit currently active booking if it is included in the notifications
        return false;

      return true;
    });

    if (currentBookings.every((b) => this.notificationBuffer.find(([, n]) => n.isSameAs(b))))
      // Omit all bookings from footer if all current bookings are included in notifications
      currentBookings = [];

    return formatCurrentBookings(currentBookings);
  }

  /** Adds new bookings and sends notification */
  private addBookings(bookings: Booking[], patch?: BookingChange) {
    const createdAt = new Date();
    bookings.forEach((b) => {
      if (this.isInitialized) {
        // Creation date is unknown if booked when app was not running
        b.createdAt = createdAt;
      }
      if (patch) {
        Object.assign(b, patch);
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

  /** Returns newly found bookings and newly found blocked off gaps that are too short to be bookings */
  private checkForNewBookings(
    calendar: Calendar,
    existingBookings: BookingMap
  ): { bookings: Booking[]; gaps: Booking[] } {
    const bookings: Booking[] = [];
    const gaps: Booking[] = [];

    const push = (b: Booking, minNights?: number) => {
      const min = minNights ?? calendar.get(b.firstNight)?.minNights ?? 1;
      const totalNights = countDaysBetween(b.checkIn, b.checkOut);

      if (
        totalNights === min + 1 && // Just long enough to be a booking
        b.checkIn === this.date.today &&
        this.airbnb.isAfterCheckInTime() && // It appeared last second
        existingBookings.get(b.checkOut) // Another booking immediately follows it
      ) {
        // Edge case for Airbnb listings that don't allow same day booking past a certain time
        gaps.push(b);
      } else if (totalNights >= min) {
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
    return { bookings, gaps };
  }

  /** Sends notification when guests are arriving or leaving today */
  public guestChangeNotification() {
    let startingToday;
    let endingToday;

    for (const b of this.bookings) {
      if (!b.isHidden) {
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

  /** Checks the assumed blocked off gaps in Calendar to see if any may be extensions of existing bookings */
  private checkGaps(gaps: Booking[], existingBookings: BookingMap) {
    gaps.forEach((gap) => {
      const precedingDate = offsetDay(gap.firstNight, -1);

      const precedingBooking = existingBookings.get(precedingDate);
      const succeedingBooking = existingBookings.get(gap.checkOut);

      if (gap.firstNight === this.date.today) {
        if (this.airbnb.isAfterCheckInTime()) {
          // Any gaps starting today and appearing after check in time are most likely not bookings
          this.addBookings([gap], { isBlockedOff: true, isHidden: true });
        } else if (succeedingBooking) {
          this.changeBookingLength(succeedingBooking, { firstNight: gap.firstNight });
        } else {
          this.addBookings([gap], { isBlockedOff: true });
        }
      } else if (succeedingBooking && precedingBooking) {
        // Blocked off gap between two bookings is most likely not a booking
        this.addBookings([gap], { isBlockedOff: true, isHidden: true });
      } else if (precedingBooking) {
        // If there is only one booking (preceding or succeeding) assume that it is being extended
        this.changeBookingLength(precedingBooking, { lastNight: gap.lastNight });
      } else if (succeedingBooking) {
        this.changeBookingLength(succeedingBooking, { firstNight: gap.firstNight });
      } else {
        // Orphaned future gap may be actual booking
        this.addBookings([gap], { isBlockedOff: true });
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
            // Hide/cancel booking if it is now shorter than minimum length requirement
            this.handleBookingChange(BookingChangeType.Cancelled, b, {
              isBlockedOff: true,
              isHidden: true,
              firstNight,
              lastNight,
            });
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

  private async waitUntilOnline() {
    let online = await isOnline();
    while (!online) {
      this.log.warn('No internet connection detected. Retrying in 30 seconds...');
      await waitFor(30000);
      online = await isOnline();
    }
  }

  public run = async (options: RunOptions = {}): Promise<boolean> => {
    if (this.isInitialized) await this.waitUntilOnline(); // Verify internet connection
    this.date.set(); // Set today's date
    const calendar = await this.airbnb.fetchCalendar(); // Fetch latest data from Airbnb

    if (!calendar) {
      return false;
    }

    if (calendar.size) {
      // Check for new or altered bookings
      const existingBookings = this.checkExistingBookings(calendar);
      const { bookings, gaps } = this.checkForNewBookings(calendar, existingBookings);

      if (calendar.isFullyBooked) {
        if (!options.isReCheck && calendar.size - existingBookings.size > 10) {
          // If suddenly the entire calendar is booked, wait at least 20 mins to confirm that these are actual bookings
          const reCheckTime = Math.max(20 * MS_IN_MINUTE, INTERVAL + API_BUFFER);
          options.isReCheck = this.scheduler.setReCheck(reCheckTime);
        }
      } else if (options.isReCheck) {
        // If the calendar is no longer fully booked during the re-check period, disable re-check flag
        options.isReCheck = this.scheduler.setReCheck(null);
      }

      if (!options.isReCheck) {
        this.addBookings(bookings);
        this.checkGaps(gaps, existingBookings);
      }
    }
    // Indicate process has successfully completed
    this.watchdog.success();
    return true;
  };
}
