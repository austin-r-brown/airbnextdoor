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
  private sendNotification(title: string, booking: Booking, details?: string) {
    clearTimeout(this.sendDebounceTimer);
    const body = this.email.formatBooking(booking);
    const additional = details ? [details] : [];
    const message = [`<b>${title}:</b>`, body, ...additional].join('<br>');
    this.notificationBuffer.push(message);

    this.sendDebounceTimer = setTimeout(() => {
      const bookings = this.bookings.sort(
        (a, b) => new Date(a.firstNight).valueOf() - new Date(b.firstNight).valueOf()
      );
      this.db.save(bookings);

      const currentBookings = bookings.filter((b) => b.lastNight >= this.today.dayBefore);
      this.email.send(this.notificationBuffer, currentBookings);

      this.notificationBuffer = [];
    }, SEND_DEBOUNCE_TIME);
  }

  /** Adds new booking and sends notification if length requirement is met, otherwise considers it a gap */
  private addBooking(booking: Booking, minNights: number, existingBookings: BookingsMap) {
    if (booking.firstNight && booking.lastNight) {
      const totalNights = countDaysBetween(booking.firstNight, booking.lastNight) + 1;
      if (totalNights >= minNights) {
        this.bookings.push(booking);
        this.sendNotification(BookingChange.New, booking);
      } else {
        this.checkGapAdjacentBookings(booking, existingBookings);
      }
    }
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
      this.sendNotification(changeType, booking, `New ${dateType} Date: <b>${formattedDate}</b>`);
      Object.assign(booking, change);
    }
  }

  /** Takes an array of indexes from this.bookings array, splices them from the array and sends notification */
  private cancelBookings(indexes: number[]) {
    indexes.forEach((index, i) => {
      const booking = this.bookings[index];
      if (booking) {
        this.sendNotification(BookingChange.Cancelled, booking);
        this.bookings.splice(index - i, 1);
      }
    });
  }

  /** Checks for new bookings using calendar of current booked dates and map of known existing bookings */
  private checkNewBookings(calendar: Calendar, existingBookings: BookingsMap) {
    let minNights: number = 1;
    let firstNight: ISODate | null = null;
    let lastNight: ISODate | null = null;

    const days = calendar.days();

    days.forEach((day) => {
      if (day.booked && !existingBookings.has(day.date)) {
        // If a booking is in progress, update the end date
        if (firstNight !== null) {
          lastNight = day.date;
        } else {
          // Otherwise, start a new booking
          minNights = day.minNights;
          firstNight = day.date;
          lastNight = day.date;
        }
      } else {
        // If a booking was in progress and now it's not, save it
        this.addBooking({ firstNight, lastNight } as Booking, minNights, existingBookings);
        firstNight = null;
        lastNight = null;
      }
    });

    // Add a booking if a booking was in progress at the end of the loop
    if (firstNight && lastNight) {
      this.addBooking({ firstNight, lastNight }, minNights, existingBookings);
    }
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
      this.sendNotification('Bookings Ending Today', endingToday);
    }
    if (startingToday) {
      this.sendNotification('Bookings Starting Today', startingToday);
    }
  }

  /** Checks if blocked off gaps that are too short to be bookings belong to another booking */
  private checkGapAdjacentBookings(gap: Booking, existingBookings: BookingsMap) {
    let preceding;
    let succeeding;

    const precedingDate = offsetDay(gap.firstNight, -1);
    const precedingBooking = existingBookings.get(precedingDate);
    if (precedingBooking?.lastNight === precedingDate) {
      preceding = precedingBooking;
    }

    const succeedingDate = offsetDay(gap.lastNight, 1);
    const succeedingBooking = existingBookings.get(succeedingDate);
    if (succeedingBooking?.firstNight === succeedingDate) {
      succeeding = succeedingBooking;
    }

    if (preceding && succeeding) {
      // Gap is likely blocked off due to being in between two bookings
      return;
    } else if (preceding) {
      this.changeBookingLength(preceding, { lastNight: gap.lastNight });
    } else if (succeeding) {
      this.changeBookingLength(succeeding, { firstNight: gap.firstNight });
    }
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
      // Consider cancelled if both first and last nights are no longer booked
      let cancelled = !(calendar.get(b.firstNight)?.booked || calendar.get(b.lastNight)?.booked);

      if (!cancelled) {
        let newFirst: CalendarDay | undefined;
        let newLast: CalendarDay | undefined;
        let previousDay: CalendarDay | undefined;

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

        if (!cancelled && (newFirst || newLast)) {
          const minNights = newFirst?.minNights ?? calendar.get(b.firstNight)?.minNights ?? 1;
          const firstNight = newFirst?.date ?? b.firstNight;
          const lastNight = newLast?.date ?? b.lastNight;
          const totalNights = countDaysBetween(firstNight, lastNight) + 1;

          if (totalNights >= minNights) {
            this.changeBookingLength(b, { firstNight, lastNight });
          } else {
            // Consider cancelled if booking is now shorter than minimum length requirement
            cancelled = true;
          }
        }
      }

      if (!cancelled) {
        getBookingDateRange(b).forEach((date) => {
          existingBookings.set(date, b);
        });
      } else {
        cancelledBookings.push(i);
      }
    });

    this.cancelBookings(cancelledBookings);
    return existingBookings;
  }

  private handleSuccess = (calendar: Calendar) => {
    if (calendar.size) {
      const existingBookings = this.checkExistingBookings(calendar);
      this.checkNewBookings(calendar, existingBookings);
    }

    clearTimeout(this.successTimer);
    this.email.clearErrors();
    this.logger.success();
  };

  private handleError = (err: Error, response?: AxiosResponse) => {
    this.logger.error(err);
    if (response) {
      this.email.sendError(
        `<b>Error:</b> Airbnb API response is in unexpected format.<br><br><i>${JSON.stringify(
          response.data
        )}</i>`
      );
    } else {
      this.email.sendError(
        `<b>Error:</b> Airbnb API responded with an error.<br><br><i>${JSON.stringify(
          err?.message || err
        )}</i>`
      );
    }
  };

  /** Sends Airbnb request and builds Calendar object from response if there are differences from previous response */
  private run = () => {
    if (!this.successTimer) {
      const successTimeout = Math.max(INTERVAL * 3 + EMAIL_TIMEOUT, 600000);
      this.successTimer = setTimeout(() => this.email.sendTimeoutError(successTimeout), successTimeout);
    }

    this.today.set();

    if (isCloseToHour(9)) {
      this.guestChangeNotification();
    }

    const requestVariables: AirbnbRequest = {
      request: {
        count: this.monthsFromNow + 1,
        listingId: this.listingId,
        month: this.today.month,
        year: this.today.year,
      },
    };
    this.apiConfig.params.variables = JSON.stringify(requestVariables);

    axios
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

          this.handleSuccess(calendar);
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
  };
}

new App();
