import { DateService } from '../services/date.service';
import { Booking, BookingChange } from '../types';
import { offsetDay } from './date.helper';

export const formatDate = (date: string): string => {
  const [y, m, d] = date.split('-');
  return `${Number(m)}/${Number(d)}/${y.slice(2)}`;
};

export const formatBooking = (
  { firstNight, lastNight }: Booking,
  cssClass?: string,
  change?: Partial<Booking>
): string => {
  const [checkIn, checkOut] = [firstNight, offsetDay(lastNight, 1)].map(formatDate);

  const bookingClass = (change ? '' : cssClass)?.toLowerCase();

  const bookingHtml = `<div class="booking ${bookingClass ?? ''}">
      <div class="left half">
        <span class="text">Check In:</span>
        <span class="text date">${checkIn}</span>
      </div>
      <div class="right half">
        <span class="text">Check Out:</span>
        <span class="text date">${checkOut}</span>
      </div>
    </div>`;

  if (change) {
    const changeHtml = `
        <div class="booking change ${change.firstNight ? 'check-in' : 'check-out'}">
        ${change.firstNight ? '<div class="v-line"></div>' : ''}
        <div class="left half">
          ${
            change.firstNight
              ? `<span class="text">Check In:</span>
          <span class="text date">${formatDate(change.firstNight)}</span>`
              : ''
          }
        </div>
        ${change.lastNight ? '<div class="v-line"></div>' : ''}
        <div class="right half">
          ${
            change.lastNight
              ? `<span class="text">Check Out:</span>
          <span class="text date">${formatDate(offsetDay(change.lastNight, 1))}</span>`
              : ''
          }
        </div>
      </div>`;
    return bookingHtml + changeHtml;
  } else {
    return bookingHtml;
  }
};

export const formatCurrentBookings = (bookings: Booking[], date: DateService): string => {
  const formattedBookings = bookings
    .map((b) => {
      const isActive = b.firstNight <= date.today && b.lastNight >= date.yesterday;
      return isActive ? formatBooking(b, 'today') : formatBooking(b);
    })
    .join(' ');

  return `<div class="notification">
    <h4>Current Bookings:</h4>
      ${formattedBookings}
    </div>`;
};

export const createNotification = (title: string, booking: Booking, change?: Partial<Booking>): string => {
  const [changeType] = Object.entries(BookingChange).find(([, c]) => c === title) ?? [];
  const body = formatBooking(booking, changeType, change);

  return `<div class="notification">
    <h4>${title}:</h4>
      ${body}
    </div>`;
};

export const createEmailBody = (notifications: string[]): string =>
  `<!DOCTYPE html>
  <html lang="en">
    <head>
      <style>
        ${CSS}
      </style>
    </head>
    <body>
      ${notifications.join(`
      `)}
    </body>
  </html>`;

export const createHtmlList = (items: string[]): string =>
  '<ul>' + items.map((li) => `<li>${li}</li>`).join('<br>') + '</ul>';

export const CSS = `
  body {
    font-family: Arial, sans-serif;
    background-color: #f2f2f2;
    margin: 0px 5px;
    min-width: 355px;
  }

  h4 {
    margin-top: 10px;
    margin-bottom: 15px;
    text-align: center;
  }

  .notification {
    margin: 15px 0px;
    padding: 4px 10px;
    background-color: #fff;
    border-radius: 10px;
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
    justify-content: center;
    display: grid;
  }

  .booking {
    display: flex;
    margin-bottom: 10px;
    position: relative;
  }

  .half {
    display: flex;
    padding: 8px 0px;
    border: 1px solid #525252;
    background-color: #fcfcfc;
    color: #383838;
    font-weight: bold;
    padding-left: 10px;
    z-index: 2;
  }

  .left {
    width: 155px;
    border-top-left-radius: 8px;
    border-bottom-left-radius: 8px;
    border-right-width: 0.5px;
  }

  .right {
    width: 165px;
    border-top-right-radius: 8px;
    border-bottom-right-radius: 8px;
    border-left-width: 0.5px;
  }

  .text {
    white-space: nowrap;
    width: 50%;
  }

  .text.date {
    padding-left: 6px;
    font-weight: normal;
    text-align: center;
    padding-right: 4px;
  }

  .booking.new .half {
    border-color: #27ae60;
    background-color: #eafaf1;
    color: #333;
  }

  .booking.cancelled .half {
    border-color: #ff0000;
    background-color: #ffe6e6;
    color: #333;
  }

  .booking.change {
    .half {
      border-color: #ffd700;
      background-color: #fffacd;
      color: #333;
    }
    &.check-in {
      .right {
        z-index: -1;
      }
      .v-line {
        position: absolute;
        bottom: 36px;
        left: 85px;
        border-left: 1px solid #333;
        height: 15px;
      }
    }
    &.check-out {
      .left {
        z-index: -1;
      }
      .v-line {
        position: absolute;
        bottom: 36px;
        right: 90px;
        border-left: 1px solid #333;
        height: 15px;
      }
    }
  }

  .booking.today .half {
    border-color: #41b0fa;
    color: black;
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
  }`;
