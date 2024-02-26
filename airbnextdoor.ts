import axios, { AxiosResponse } from 'axios';
import {
  Booking,
  MerlinCalendarDay,
  AirbnbApiConfig,
  AirbnbRequest,
  MerlinCalendarMonth,
  BookingChange,
  ISODate,
  CalendarDay,
  BookingsMap,
} from './types';
import {
  INTERVAL,
  isCloseToHour,
  countDaysBetween,
  offsetDay,
  offsetMonth,
  Today,
  getBookingDateRange,
  Calendar,
  isBookingInCalendarRange,
} from './helpers/date.helper';
import { DbService } from './services/db.service';
import { EMAIL_TIMEOUT, EmailService } from './services/email.service';
import { Logger } from './services/logger.service';
require('dotenv').config();

const { AIRBNB_URL, MONTHS } = process.env;
const SEND_DEBOUNCE_TIME: number = 1000;

const operationName = 'PdpAvailabilityCalendar';
const sha256Hash = '8f08e03c7bd16fcad3c92a3592c19a8b559a0d0855a84028d1163d4733ed9ade';

class App {
  private readonly today: Today = new Today();
  private readonly logger: Logger = new Logger();
  private readonly db: DbService = new DbService(this.logger);
  private readonly email: EmailService = new EmailService(this.today, this.logger);

  private bookings: Booking[] = [];

  /** Used for debouncing notifications sent and JSON backups saved */
  private sendDebounceTimer?: NodeJS.Timeout;
  private notificationBuffer: string[] = [];

  /** Used for preliminary checking of changes in API response */
  private apiResponseStr?: string;

  /** Used for sending notification if app appears to have stalled */
  private successTimer?: NodeJS.Timeout;

  /** Used for Airbnb API request */
  private listingId: string;
  private monthsFromNow: number;
  private apiConfig: AirbnbApiConfig = {
    method: 'get',
    url: `https://www.airbnb.com/api/v3/${operationName}/${sha256Hash}`,
    headers: {
      'X-Airbnb-Api-Key': 'd306zoyjsyarp7ifhu67rjxn52tv0t20',
    },
    params: {
      operationName,
      locale: 'en',
      currency: 'USD',
      extensions: JSON.stringify({
        persistedQuery: {
          version: 1,
          sha256Hash,
        },
      }),
    },
  };

  constructor() {
    this.logger.info('Starting application...');
    const listingId = this.getListingId();

    if (!listingId) {
      throw new Error('Valid Airbnb URL or Listing ID must be provided in .env file.');
    }

    this.listingId = listingId;
    this.monthsFromNow = Number(MONTHS) || 3;

    const previousBookings = this.db.restore();
    if (previousBookings.length) {
      this.bookings = previousBookings;
      this.logger.info(['Restored previous bookings:', this.bookings]);
    }

    this.run();
    setInterval(this.run, INTERVAL);
  }

  /** Extracts Airbnb listing ID from URL, or returns original value if already ID */
  private getListingId(): string | void {
    if (AIRBNB_URL) {
      const trimmed = AIRBNB_URL.trim();
      const isId = Array.from(trimmed).every((c) => Number.isInteger(Number.parseInt(c)));
      const [, idFromUrl] = !isId ? trimmed.match(/airbnb\.com\/rooms\/(\d+)(\?.*)?/) ?? [] : [];
      return isId ? trimmed : idFromUrl;
    }
  }

  /** Sends all notifications that have been attempted within past second, sorts bookings and saves to DB */
  private send(message?: string) {
    clearTimeout(this.sendDebounceTimer);
    if (message) {
      this.notificationBuffer.push(message);
    }

    this.sendDebounceTimer = setTimeout(() => {
      const bookings = this.bookings.sort(
        (a, b) => new Date(a.firstNight).valueOf() - new Date(b.firstNight).valueOf()
      );
      this.db.save(bookings);

      if (this.notificationBuffer.length) {
        const currentBookings = bookings.filter(
          (b) => !b.isBlockedOff && b.lastNight >= this.today.dayBefore
        );
        if (currentBookings.length) {
          this.notificationBuffer.push(this.email.formatCurrentBookings(currentBookings));
        }
        this.email.send(this.notificationBuffer);

        this.notificationBuffer = [];
      }
    }, SEND_DEBOUNCE_TIME);
  }

  /** Sets isBlockedOff property on booking to true and sends cancelled notification */
  private changeToBlockedOff(booking: Booking) {
    booking.isBlockedOff = true;
    this.send(this.email.createEmail(BookingChange.Cancelled, booking));
  }

  /** Adds blocked off booking to this.bookings array and saves to DB */
  private addBlockedOff(booking: Booking) {
    booking.isBlockedOff = true;
    this.bookings.push(booking);
    this.send();
  }

  /** Adds new booking and sends notification if length requirement is met, returns bookings that weren't added */
  private addBookings(bookings: Booking[]) {
    bookings.forEach((b) => {
      this.bookings.push(b);
      this.send(this.email.createEmail(BookingChange.New, b));
    });
  }

  /** Validates changes in booking length, updates booking accordingly and sends notification */
  private changeBookingLength(booking: Booking, change: Partial<Booking>) {
    let changeType: BookingChange | undefined;

    if (change.lastNight) {
      if (change.lastNight > booking.lastNight) {
        changeType = BookingChange.Extended;
      } else if (change.lastNight < booking.lastNight) {
        changeType = BookingChange.Shortened;
      }
    } else if (change.firstNight) {
      if (change.firstNight < booking.firstNight) {
        changeType = BookingChange.Extended;
      } else if (change.firstNight > booking.firstNight) {
        changeType = BookingChange.Shortened;
      }
    }

    const lastNightChanged = change.lastNight && change.lastNight !== booking.lastNight;
    const firstNightChanged = change.firstNight && change.firstNight !== booking.firstNight;

    if (changeType && (lastNightChanged || firstNightChanged)) {
      const formattedDate = this.email.formatDate(
        lastNightChanged ? offsetDay(change.lastNight!, 1) : change.firstNight!
      );
      const dateType = lastNightChanged ? 'End' : 'Start';
      const email = this.email.createEmail(
        changeType,
        booking,
        `New ${dateType} Date: <b>${formattedDate}</b>`
      );
      this.send(email);
      Object.assign(booking, change);
    }
  }

  /** Takes an array of indexes from this.bookings array, splices them from the array and sends notification */
  private cancelBookings(indexes: number[]) {
    indexes.forEach((index, i) => {
      const booking = this.bookings[index];
      if (booking) {
        this.send(this.email.createEmail(BookingChange.Cancelled, booking));
        this.bookings.splice(index - i, 1);
      }
    });
  }

  /** Checks for new bookings using calendar of current booked dates and map of known existing bookings */
  private checkForNewBookings(calendar: Calendar, existingBookings: BookingsMap): [Booking[], Booking[]] {
    let firstNight: ISODate | null = null;
    let lastNight: ISODate | null = null;

    const bookings: Booking[] = [];
    const gaps: Booking[] = [];

    const save = (b: Booking, minNights?: number) => {
      const min = minNights ?? calendar.get(b.firstNight)?.minNights ?? 1;
      const totalNights = countDaysBetween(b.firstNight, b.lastNight) + 1;
      if (totalNights >= min) {
        bookings.push(b);
      } else {
        gaps.push(b);
      }
    };

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
        save({ firstNight, lastNight }, day.minNights);
        firstNight = null;
        lastNight = null;
      }
    });

    // Add a booking if a booking was in progress at the end of the loop
    if (firstNight && lastNight) {
      save({ firstNight, lastNight });
    }
    return [bookings, gaps];
  }

  /** Sends notification when guests are arriving or leaving today */
  private guestChangeNotification() {
    let startingToday;
    let endingToday;

    for (const b of this.bookings) {
      if (b.firstNight > this.today.iso) {
        break;
      } else if (b.firstNight === this.today.iso) {
        startingToday = b;
      } else if (b.lastNight === this.today.dayBefore) {
        endingToday = b;
      }
    }

    if (endingToday) {
      this.send(this.email.createEmail('Bookings Ending Today', endingToday));
    }
    if (startingToday) {
      this.send(this.email.createEmail('Bookings Starting Today', startingToday));
    }
  }

  /** Extends adjacent booking with gap if one adjacent booking exists, otherwise blocks off dates from calendar */
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

  /** Uses calendar of current booked dates to check for changes in existing bookings, returns map of updated existing bookings  */
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
                  // First night has been moved up
                  newFirst = currentDay;
                }
              } else if (!currentDay.booked && previousDay.booked) {
                // Last night has been moved back
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

  private handleError = (err: Error, response?: AxiosResponse) => {
    let description, details;

    if (response) {
      description = 'Airbnb API response is in unexpected format.';
      details = response.data;
    } else {
      description = 'Airbnb API responded with an error.';
      details = err?.message || err;
    }

    const errorMsg = [`<b>Error:</b> ${description}`, `<i>${JSON.stringify(details)}</i>`].join('<br><br>');

    this.logger.error(`Error: ${details}`);
    this.email.sendError(errorMsg);
  };

  /** Sends Airbnb request and builds Calendar object from response if there are differences from previous response */
  private async pollAirbnb(): Promise<Calendar | null> {
    const requestVariables: AirbnbRequest = {
      request: {
        count: this.monthsFromNow + 1,
        listingId: this.listingId,
        month: this.today.month,
        year: this.today.year,
      },
    };
    this.apiConfig.params.variables = JSON.stringify(requestVariables);

    let result: Calendar | null = null;

    await axios
      .request(this.apiConfig)
      .then((response) => {
        try {
          const { calendarMonths } = response.data.data.merlin.pdpAvailabilityCalendar;
          const apiResponse: MerlinCalendarDay[] = calendarMonths.flatMap((m: MerlinCalendarMonth) => m.days);
          const apiResponseStr = JSON.stringify(apiResponse);
          const calendar = new Calendar();

          if (apiResponseStr !== this.apiResponseStr) {
            const xMonthsFromNow = offsetMonth(this.today.date, this.monthsFromNow);

            apiResponse.forEach(({ calendarDate, availableForCheckin, availableForCheckout, minNights }) => {
              if (calendarDate >= this.today.iso && calendarDate <= xMonthsFromNow) {
                calendar.addSorted({
                  booked: !(availableForCheckin || availableForCheckout),
                  date: calendarDate,
                  minNights: Number(minNights),
                });
              }
            });
            this.apiResponseStr = apiResponseStr;
          }
          result = calendar;
        } catch (err: any) {
          const errors = response?.data?.errors;

          if (errors?.length) {
            errors.forEach((e: any) => {
              const message = e?.extensions?.response?.body?.error_message || e?.message;
              this.handleError(message ? { message } : e);
            });
          } else {
            this.handleError(err, response);
          }
        }
      })
      .catch(this.handleError);

    return result;
  }

  /** Starts timer to monitor timeouts and kicks of entire Airbnb check process */
  private run = async () => {
    if (!this.successTimer) {
      const successTimeout = Math.max(INTERVAL * 3 + EMAIL_TIMEOUT, 600000);
      this.successTimer = setTimeout(() => this.email.sendTimeoutError(successTimeout), successTimeout);
    }

    this.today.set();

    if (isCloseToHour(9)) {
      this.guestChangeNotification();
    }

    const calendar = await this.pollAirbnb();

    if (calendar) {
      if (calendar.size) {
        const existingBookings = this.checkExistingBookings(calendar);
        const [newBookings, gaps] = this.checkForNewBookings(calendar, existingBookings);
        this.addBookings(newBookings);
        this.checkAdjacentBookings(gaps, existingBookings);
      }

      clearTimeout(this.successTimer);
      this.email.clearErrors();
      this.logger.success();
    }
  };
}

new App();
