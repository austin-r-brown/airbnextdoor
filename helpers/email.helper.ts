import { Booking, BookingChange, NotificationBuffer } from '../types';
import { offsetDay } from './date.helper';

/** Converts 'YYYY-MM-DD' formatted string to 'MM/DD/YY' for email readability */
export const formatDate = (date: string): string => {
  const [y, m, d] = date.split('-');
  return `${Number(m)}/${Number(d)}/${y.slice(2)}`;
};

/** Generates HTML for booking, with optional CSS class or partial booking to indicate a change to a booking */
export const formatBooking = (
  { firstNight, lastNight }: Booking,
  cssClass?: string,
  change?: Partial<Booking>
): string => {
  const [checkIn, checkOut] = [firstNight, offsetDay(lastNight, 1)].map(formatDate);

  const bookingHtml = `<div class="booking ${change ? '' : cssClass ?? ''}">
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
    // If booking dates change, add a second half-booking beneath it to show the new dates
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

/** Generates HTML for Current Bookings summary that is appended to each email */
export const formatCurrentBookings = (bookings: Booking[]): string => {
  const bookingsHtml = bookings.map((b) => {
    return formatBooking(b, b.isActive ? 'active' : '');
  }).join(`
    `);

  return `<span class="title">Current Bookings</span>
    ${bookingsHtml}`;
};

/** Groups notifications from notification buffer by title and returns array of HTML notification strings */
export const createNotifications = (buffer: NotificationBuffer): string[] => {
  const notifications: string[] = [];
  const grouped: Record<string, Booking[]> = {};

  buffer.forEach((n) => {
    const [title, booking, change] = n;
    if (!change) {
      const current = grouped[title] ?? [];
      grouped[title] = current.concat(booking);
    } else {
      notifications.push(formatNotification(title, [booking], change));
    }
  });

  Object.entries(grouped).forEach(([title, bookings]) =>
    notifications.push(formatNotification(title, bookings))
  );

  return notifications;
};

/** Generates HTML for a notification to be sent via email */
export const formatNotification = (title: string, bookings: Booking[], change?: Partial<Booking>): string => {
  const [changeType] = Object.entries(BookingChange).find(([, c]) => c === title) ?? [];
  // Use BookingChange enum keys as CSS class names
  const bookingHtml = bookings.map((b) => {
    const cssClass = changeType?.toLowerCase() ?? (b.isActive ? 'active' : '');
    return formatBooking(b, cssClass, change);
  }).join(`
  `);

  return `<span class="title">${bookings.length > 1 ? title.replace('Booking', 'Bookings') : title}</span>
    ${bookingHtml}`;
};

/** Generates HTML for entire email body using previously created notifications */
export const createEmailBody = (notifications: string[]): string =>
  `<!DOCTYPE html>
  <html lang="en">
    <head>
      <style>
        ${CSS}
      </style>
    </head>
    <body>
      ${notifications.map((n) => `<div class="notification">${n}</div>`).join(`
      `)}
    </body>
  </html>`;

/** Generates HTML for unordered list using array of strings */
export const createHtmlList = (items: string[]): string =>
  '<ul>' + items.map((li) => `<li>${li}</li>`).join('<br>') + '</ul>';

/** CSS used for email body */
const CSS = `
  body {
    font-family: Arial, sans-serif;
    background-color: #f2f2f2;
    margin: 0px 5px;
    min-width: 355px;
  }

  .title {
    margin-bottom: 4px;
    text-align: center;
    font-weight: bold;
    font-size: 16.5px;
  }

  ul {
    margin-bottom: 0px;
  }

  .notification {
    margin: 15px 0px;
    padding: 15px 10px;
    background-color: #fff;
    border-radius: 10px;
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
    justify-content: center;
    display: grid;
  }

  .booking {
    display: flex;
    margin-top: 10px;
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

  .booking.active .half {
    border-color: #41b0fa;
    color: black;
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
  }`;
