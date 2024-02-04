import axios, { AxiosResponse } from 'axios';
import { Booking, MerlinCalendarDay, AirbnbApiConfig, AirbnbRequestVars, MerlinCalendarMonth } from './types';
import { restoreFromDb, debouncedSaveToDb } from './services/db.service';
import { debouncedSendEmail, formatDateForEmail, formatBookingForEmail } from './services/email.service';
import {
  INTERVAL,
  getIsoDate,
  getTodayIso,
  isCloseToHour,
  countDaysBetween,
  offsetDay,
  offsetMonth,
  getInBetweenBookings,
} from './date.helpers';

require('dotenv').config();
const { AIRBNB_API_KEY, AIRBNB_LISTING_ID, MONTHS } = process.env;

// ---------------------------- API Config ----------------------------- //
const sha256Hash = '8f08e03c7bd16fcad3c92a3592c19a8b559a0d0855a84028d1163d4733ed9ade';
const operationName = 'PdpAvailabilityCalendar';

const airbnbApiConfig: AirbnbApiConfig = {
  method: 'get',
  url: `https://www.airbnb.com/api/v3/${operationName}/${sha256Hash}`,
  headers: {
    'X-Airbnb-Api-Key': AIRBNB_API_KEY!,
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
// ------------------------------------------------------------------ //

let today: Date;

const setToday = (): string => {
  const todayIso = getTodayIso();
  today = new Date(todayIso);
  return todayIso;
};

let bookings: Booking[] = [];

let previousDatesStr: string;
let lastErrorMessage: string | null = null;

const sendErrorEmail = (message: string) => {
  const commonErrors = ['network socket disconnected'];

  if (message !== lastErrorMessage && !commonErrors.find((e) => message.toLowerCase().includes(e))) {
    sendEmail(message);
  }

  if (!lastErrorMessage) {
    // Send en email if error hasn't been resolved in 10 mins
    lastErrorMessage = message;
    setTimeout(() => {
      if (lastErrorMessage) {
        sendEmail(`<h4>The following error has not been resolved:</h4>${lastErrorMessage}`);
      }
    }, Math.max(INTERVAL * 2, 600000));
  }
};

const sendEmail = (message: string) => {
  const sorted = bookings.sort((a, b) => new Date(a.firstNight).valueOf() - new Date(b.firstNight).valueOf());
  debouncedSaveToDb(sorted);

  const currentBookings = bookings.filter((b) => b.lastNight >= offsetDay(today, -1));
  debouncedSendEmail(message, currentBookings);
};

const addBookings = (newBookings: Booking[]) => {
  newBookings.forEach((b) => {
    const alreadyExists = bookings.find((c) => {
      if (b.lastNight === c.lastNight) {
        const isSame = b.firstNight === c.firstNight;
        const isActive = b.firstNight === getIsoDate(today) && new Date(c.firstNight) < today;
        return isActive || isSame;
      }
    });
    if (!alreadyExists) {
      bookings.push(b);
      sendEmail(`<b>New Booking:</b> ${formatBookingForEmail(b)}`);
    }
  });
};

const checkAgainstExistingBookings = (firstNight: string, lastNight: string, minNights: number) => {
  const newBooking = { firstNight, lastNight };
  const newFirstNight = new Date(firstNight);
  const newLastNight = new Date(lastNight);
  const totalNights = countDaysBetween(newFirstNight, newLastNight) + 1;
  const encompassedBookings: Booking[] = [];

  if (totalNights >= minNights) {
    // Check against existing bookings
    for (let b of bookings) {
      const currentFirstNight = new Date(b.firstNight);
      const currentLastNight = new Date(b.lastNight);

      if (b.firstNight === firstNight) {
        if (b.lastNight === lastNight) {
          // Booking already exists
          return;
        }
        const endDateIsLater = newLastNight > currentLastNight;
        if (endDateIsLater && countDaysBetween(newLastNight, currentLastNight) >= minNights) {
          // New booking starts right after existing booking
          newBooking.firstNight = offsetDay(b.lastNight, 1);
          break;
        } else {
          // Existing booking has changed length
          const changeType = endDateIsLater ? 'Lengthened' : 'Shortened';
          sendEmail(
            `<b>Booking ${changeType}:</b> ${formatBookingForEmail(
              b
            )}<br>End Date is now: ${formatDateForEmail(offsetDay(lastNight, 1))}`
          );
          b.lastNight = lastNight;
          return;
        }
      } else if (b.lastNight === lastNight) {
        const startDateIsSooner = newFirstNight < currentFirstNight;
        if (startDateIsSooner && countDaysBetween(newFirstNight, currentFirstNight) >= minNights) {
          // New booking starts right before existing booking
          newBooking.lastNight = offsetDay(b.firstNight, -1);
          break;
        } else {
          if (currentFirstNight > today) {
            // Existing booking has changed length
            const changeType = startDateIsSooner ? 'Lengthened' : 'Shortened';
            sendEmail(
              `<b>Booking ${changeType}:</b> ${formatBookingForEmail(
                b
              )}<br>Start Date is now: ${formatDateForEmail(firstNight)}`
            );
            b.firstNight = firstNight;
          }
          return;
        }
      } else if (currentFirstNight > newFirstNight && currentLastNight < newLastNight) {
        // Newly found booking is actually encompassing several others
        encompassedBookings.push(b);
      }
    }

    if (encompassedBookings.length) {
      addBookings(getInBetweenBookings(newBooking, encompassedBookings));
    } else {
      addBookings([newBooking]);
    }
  }
};

const checkForNewBookings = (dates: MerlinCalendarDay[]) => {
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
        checkAgainstExistingBookings(currentBookingStart, currentBookingEnd, minNights);
        currentBookingStart = null;
        currentBookingEnd = null;
      }
    }
  });

  // Add a booking if a booking was in progress at the end of the loop
  if (currentBookingStart && currentBookingEnd) {
    checkAgainstExistingBookings(currentBookingStart, currentBookingEnd, minNights);
  }
};

const removeCancelledBookings = (dates: MerlinCalendarDay[]) => {
  const toRemove: number[] = [];

  bookings.forEach((b, i) => {
    const isPastBooking = new Date(b.lastNight) < today;
    if (!isPastBooking) {
      const foundStartOrEnd = dates.find((day) => {
        const booked = !(day.availableForCheckin || day.availableForCheckout);
        return booked && [b.firstNight, b.lastNight].includes(day.calendarDate);
      });
      if (!foundStartOrEnd) {
        toRemove.push(i);
        sendEmail(`<b>Booking Cancelled:</b> ${formatBookingForEmail(b)}`);
      }
    }
  });

  toRemove.forEach((index, i) => bookings.splice(index - i, 1));
};

const handleSuccess = (dates: MerlinCalendarDay[]) => {
  const datesStr = JSON.stringify(dates);

  if (datesStr !== previousDatesStr) {
    removeCancelledBookings(dates);
    checkForNewBookings(dates);
    previousDatesStr = datesStr;
  }

  lastErrorMessage = null;
  console.info(`Airbnb API Request Successful at ${new Date().toLocaleString()}`);
};

const handleError = (err: Error, response?: AxiosResponse) => {
  console.error(err);
  if (response) {
    sendErrorEmail(
      `<b>Error:</b> Airbnb API response is in unexpected format.<br><br>${JSON.stringify(response.data)}`
    );
  } else {
    sendErrorEmail(
      `<b>Error:</b> Airbnb API responded with an error.<br><br>${JSON.stringify(err?.message || err)}`
    );
  }
};

const run = () => {
  const todayIso = setToday();

  if (isCloseToHour(9)) {
    const startingToday: Booking[] = [];
    const endingToday: Booking[] = [];
    bookings.forEach((b) => {
      if (b.firstNight === todayIso) {
        startingToday.push(b);
      } else if (offsetDay(b.lastNight, 1) === todayIso) {
        endingToday.push(b);
      }
    });

    if (endingToday.length) {
      sendEmail(`<b>Bookings Ending Today:</b> ${endingToday.map(formatBookingForEmail)}`);
    }
    if (startingToday.length) {
      sendEmail(`<b>Bookings Starting Today:</b> ${startingToday.map(formatBookingForEmail)}`);
    }
  }

  const months = Number(MONTHS || 3);
  const [y, m] = todayIso.split('-');
  const requestVariables: AirbnbRequestVars = {
    request: {
      count: months + 1,
      listingId: AIRBNB_LISTING_ID!,
      month: Number(m),
      year: Number(y),
    },
  };
  airbnbApiConfig.params.variables = JSON.stringify(requestVariables);

  axios
    .request(airbnbApiConfig)
    .then((response) => {
      try {
        const { calendarMonths } = response.data.data.merlin.pdpAvailabilityCalendar;
        const dates = calendarMonths
          .flatMap((m: MerlinCalendarMonth) => m.days)
          .filter((d: MerlinCalendarDay) => {
            const current = new Date(d.calendarDate);
            const xMonthsFromToday = new Date(offsetMonth(today, months));
            return current >= today && current < xMonthsFromToday;
          });

        handleSuccess(dates);
      } catch (err: any) {
        const errors = response?.data?.errors;

        if (errors?.length) {
          errors.forEach((e: any) => {
            const message = e?.extensions?.response?.body?.error_message || e?.message;
            handleError(message ? { message } : e);
          });
        } else {
          handleError(err, response);
        }
      }
    })
    .catch(handleError);
};

(() => {
  if (!AIRBNB_API_KEY || !AIRBNB_LISTING_ID) {
    console.error('Airbnb API Key and Listing ID must be provided in .env file.');
    return;
  }

  const previousBookings = restoreFromDb();
  if (previousBookings.length) {
    bookings = previousBookings;
    console.info('Restored previous bookings:', bookings);
  }

  run();
  setInterval(run, INTERVAL);
})();
