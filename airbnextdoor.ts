import axios, { AxiosResponse } from 'axios';
import {
  Booking,
  MerlinCalendarDay,
  AirbnbApiConfig,
  AirbnbRequestVars,
  MerlinCalendarMonth,
  BookingChangeType,
} from './types';
import {
  INTERVAL,
  isCloseToHour,
  countDaysBetween,
  offsetDay,
  offsetMonth,
  getInBetweenBookings,
  Today,
} from './helpers/date.helper';
import { DbService } from './services/db.service';
import { EmailService } from './services/email.service';
require('dotenv').config();

const { AIRBNB_URL, MONTHS } = process.env;
const operationName = 'PdpAvailabilityCalendar';
const sha256Hash = '8f08e03c7bd16fcad3c92a3592c19a8b559a0d0855a84028d1163d4733ed9ade';

class App {
  private readonly db: DbService = new DbService();
  private readonly email: EmailService = new EmailService();

  private readonly today: Today = new Today();

  private bookings: Booking[] = [];
  private previousDatesStr?: string;

  private months: number;
  private listingId: string;

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
    const listingId = this.getListingId();

    if (!listingId) {
      throw new Error('Valid Airbnb URL or Listing ID must be provided in .env file.');
    }

    this.listingId = listingId;
    this.months = Number(MONTHS) || 3;

    const previousBookings = this.db.restore();
    if (previousBookings.length) {
      this.bookings = previousBookings;
      console.info('Restored previous bookings:', this.bookings);
    }

    this.run();
    setInterval(this.run, INTERVAL);
  }

  private getListingId(): string | void {
    if (AIRBNB_URL) {
      const trimmed = AIRBNB_URL.trim();
      const isId = Array.from(trimmed).every((c) => Number.isInteger(Number.parseInt(c)));
      const [, idFromUrl] = !isId ? trimmed.match(/airbnb\.com\/rooms\/(\d+)(\?.*)?/) ?? [] : [];
      return isId ? trimmed : idFromUrl;
    }
  }

  private sendEmail(message: string) {
    const sorted = this.bookings.sort(
      (a, b) => new Date(a.firstNight).valueOf() - new Date(b.firstNight).valueOf()
    );
    this.db.save(sorted);

    const currentBookings = this.bookings.filter((b) => b.lastNight >= offsetDay(this.today.date, -1));
    this.email.send(message, currentBookings);
  }

  private addBookings(newBookings: Booking[]) {
    newBookings.forEach((b) => {
      const alreadyExists = this.bookings.find((c) => {
        if (b.lastNight === c.lastNight) {
          const isSame = b.firstNight === c.firstNight;
          const isActive = b.firstNight === this.today.iso && c.firstNight < this.today.iso;
          return isActive || isSame;
        }
      });
      if (!alreadyExists) {
        this.bookings.push(b);
        this.sendEmail(`<b>New Booking:</b><br>${this.email.formatBooking(b)}`);
      }
    });
  }

  private changeBookingLength(booking: Booking, change: Partial<Booking>) {
    let newDate: string | undefined;
    let changeType: BookingChangeType | undefined;

    if (change.lastNight) {
      if (change.lastNight > booking.lastNight) {
        changeType = BookingChangeType.Lengthened;
        const overlappedBooking = this.bookings.find(
          (b) => b.lastNight === change.lastNight && b.firstNight > booking.firstNight
        );
        newDate = overlappedBooking ? offsetDay(overlappedBooking.firstNight, -1) : change.lastNight;
      } else if (change.lastNight < booking.lastNight) {
        changeType = BookingChangeType.Shortened;
        newDate = change.lastNight;
      }
    } else if (change.firstNight) {
      if (change.firstNight < booking.firstNight) {
        changeType = BookingChangeType.Lengthened;
        const overlappedBooking = this.bookings.find(
          (b) => b.firstNight === change.firstNight && b.lastNight < booking.lastNight
        );
        newDate = overlappedBooking ? offsetDay(overlappedBooking.lastNight, 1) : change.firstNight;
      } else if (change.firstNight > booking.firstNight) {
        changeType = BookingChangeType.Shortened;
        newDate = change.firstNight;
      }
    }

    if (newDate && changeType) {
      const emailDate = this.email.formatDate(change.lastNight ? offsetDay(newDate, 1) : newDate);
      const emailDateType = change.lastNight ? 'End' : 'Start';
      this.sendEmail(
        `<b>Booking ${changeType}:</b><br>${this.email.formatBooking(
          booking
        )}<br>New ${emailDateType} Date: <b>${emailDate}</b>`
      );
      Object.assign(booking, change);
    }
  }

  private checkAgainstExistingBookings(firstNight: string, lastNight: string, minNights: number) {
    const newBooking = { firstNight, lastNight };
    const newFirstNight = new Date(firstNight);
    const newLastNight = new Date(lastNight);
    const totalNights = countDaysBetween(newFirstNight, newLastNight) + 1;
    const encompassedBookings: Booking[] = [];

    if (firstNight === this.today.iso) {
      //TODO: set property for active booking and maybe find out earlier in the process when it finds the active booking, maybe even a specific set of things it only does when the day changes
      const activeBooking = this.bookings.find(
        (b) => b.firstNight <= this.today.iso && b.lastNight >= offsetDay(this.today.iso, -1)
      );
      if (activeBooking && lastNight !== activeBooking.lastNight) {
        this.changeBookingLength(activeBooking, { lastNight });
        return;
      }
    }

    if (totalNights >= minNights) {
      for (let b of this.bookings) {
        const currentFirstNight = new Date(b.firstNight);
        const currentLastNight = new Date(b.lastNight);

        if (b.firstNight === firstNight) {
          if (b.lastNight === lastNight) {
            // Booking already exists
            return;
          }
          if (
            newLastNight > currentLastNight &&
            countDaysBetween(newLastNight, currentLastNight) >= minNights
          ) {
            // New booking starts right after existing booking
            newBooking.firstNight = offsetDay(b.lastNight, 1);
            break;
          } else {
            // Existing booking has changed length
            this.changeBookingLength(b, { lastNight });
            return;
          }
        } else if (b.lastNight === lastNight) {
          if (
            newFirstNight < currentFirstNight &&
            countDaysBetween(newFirstNight, currentFirstNight) >= minNights
          ) {
            // New booking starts right before existing booking
            newBooking.lastNight = offsetDay(b.firstNight, -1);
            break;
          } else {
            if (currentFirstNight > this.today.date) {
              // Existing booking has changed length
              this.changeBookingLength(b, { firstNight });
            }
            return;
          }
        } else if (currentFirstNight > newFirstNight && currentLastNight < newLastNight) {
          // Newly found booking is actually encompassing several others
          encompassedBookings.push(b);
        }
      }

      if (encompassedBookings.length) {
        this.addBookings(getInBetweenBookings(newBooking, encompassedBookings));
      } else {
        this.addBookings([newBooking]);
      }
    }
  }

  private checkForNewBookings(dates: MerlinCalendarDay[]) {
    let minNights: number = 1;
    let currentBookingStart: string | null = null;
    let currentBookingEnd: string | null = null;

    dates.forEach((day) => {
      const booked = !(day.availableForCheckin || day.availableForCheckout);
      if (booked) {
        // If a booking is in progress, update the end date
        if (currentBookingStart !== null) {
          currentBookingEnd = day.calendarDate;
        } else {
          // Otherwise, start a new booking
          minNights = Number(day.minNights);
          currentBookingStart = day.calendarDate;
          currentBookingEnd = day.calendarDate;
        }
      } else {
        // If a booking was in progress and now it's not, save it
        if (currentBookingStart && currentBookingEnd) {
          this.checkAgainstExistingBookings(currentBookingStart, currentBookingEnd, minNights);
          currentBookingStart = null;
          currentBookingEnd = null;
        }
      }
    });

    // Add a booking if a booking was in progress at the end of the loop
    if (currentBookingStart && currentBookingEnd) {
      this.checkAgainstExistingBookings(currentBookingStart, currentBookingEnd, minNights);
    }
  }

  private removeCancelledBookings(dates: MerlinCalendarDay[]) {
    const toRemove: number[] = [];

    this.bookings.forEach((b, i) => {
      const isPastBooking = b.lastNight < this.today.iso;
      if (!isPastBooking) {
        const foundStartOrEnd = dates.find((day) => {
          const booked = !(day.availableForCheckin || day.availableForCheckout);
          const startedInPast = b.firstNight < this.today.iso;
          return startedInPast || (booked && [b.firstNight, b.lastNight].includes(day.calendarDate));
        });
        if (!foundStartOrEnd) {
          toRemove.push(i);
          this.sendEmail(`<b>Booking ${BookingChangeType.Cancelled}:</b><br>${this.email.formatBooking(b)}`);
        }
      }
    });

    toRemove.forEach((index, i) => this.bookings.splice(index - i, 1));
  }

  private guestChangeNotification() {
    const startingToday: Booking[] = [];
    const endingToday: Booking[] = [];
    this.bookings.forEach((b) => {
      if (b.firstNight === this.today.iso) {
        startingToday.push(b);
      } else if (offsetDay(b.lastNight, 1) === this.today.iso) {
        endingToday.push(b);
      }
    });

    if (endingToday.length) {
      this.sendEmail(`<b>Bookings Ending Today:</b><br>${endingToday.map(this.email.formatBooking)}`);
    }
    if (startingToday.length) {
      this.sendEmail(`<b>Bookings Starting Today:</b><br>${startingToday.map(this.email.formatBooking)}`);
    }
  }

  private handleSuccess = (dates: MerlinCalendarDay[]) => {
    const datesStr = JSON.stringify(dates);

    if (datesStr !== this.previousDatesStr) {
      this.removeCancelledBookings(dates);
      this.checkForNewBookings(dates);
      this.previousDatesStr = datesStr;
    }

    this.email.clearErrors();
    console.info(`Airbnb API Request Successful at ${new Date().toLocaleString()}`);
  };

  private handleError = (err: Error, response?: AxiosResponse) => {
    console.error(err);
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

  private run = () => {
    const dateChanged = this.today.set();

    if (isCloseToHour(9)) {
      this.guestChangeNotification();
    }

    const requestVariables: AirbnbRequestVars = {
      request: {
        count: this.months + 1,
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
          const dates = calendarMonths
            .flatMap((m: MerlinCalendarMonth) => m.days)
            .filter((d: MerlinCalendarDay) => {
              const xMonthsFromToday = offsetMonth(this.today.date, this.months);
              return d.calendarDate >= this.today.iso && d.calendarDate < xMonthsFromToday;
            });

          this.handleSuccess(dates);
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
