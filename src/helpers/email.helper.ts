import { Booking } from '../constants/Booking';
import { BookingChangeType } from '../constants/enums';
import { BookingChange, NotificationBuffer } from '../constants/types';
import { formatIsoDate, offsetDay } from './date.helper';

/** Generates HTML for booking, with optional CSS class or partial booking to indicate a change to a booking */
export const formatBooking = (booking: Booking, cssClass?: string, change?: BookingChange): string => {
  const [checkIn, checkOut] = [booking.checkIn, booking.checkOut].map(formatIsoDate);

  if (!cssClass && booking.isActive) {
    cssClass = 'active';
  }

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
          <span class="text date">${formatIsoDate(change.firstNight)}</span>`
              : ''
          }
        </div>
        ${change.lastNight ? '<div class="v-line"></div>' : ''}
        <div class="right half">
          ${
            change.lastNight
              ? `<span class="text">Check Out:</span>
          <span class="text date">${formatIsoDate(offsetDay(change.lastNight, 1))}</span>`
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
export const formatCurrentBookings = (bookings: Booking[]): string | undefined => {
  if (bookings.length) {
    const bookingsHtml = bookings.map((b) => formatBooking(b)).join(`
      `);

    return `<span class="title">Current Bookings</span>
      ${bookingsHtml}`;
  }
};

/** Groups notifications from notification buffer by title and returns array of HTML notification strings */
export const createNotifications = (buffer: NotificationBuffer): string[] => {
  const notifications: string[] = [];
  const grouped: Record<string, Booking[]> = {};

  buffer.forEach(([title, booking, change]) => {
    if (change?.firstNight || change?.lastNight) {
      notifications.push(formatNotification(title, [booking], change));
    } else {
      const current = grouped[title] ?? [];
      grouped[title] = current.concat(booking);
    }
  });

  Object.entries(grouped).forEach(([title, bookings]) =>
    notifications.push(formatNotification(title, bookings))
  );

  return notifications;
};

/** Generates HTML for a notification to be sent via email */
export const formatNotification = (title: string, bookings: Booking[], change?: BookingChange): string => {
  const [changeType] = Object.entries(BookingChangeType).find(([, c]) => c === title) ?? [];
  // Use BookingChange enum keys as CSS class names
  const bookingHtml = bookings.map((b) => formatBooking(b, changeType?.toLowerCase(), change)).join(`
    `);

  return `<span class="title">${bookings.length > 1 ? title.replace('Booking', 'Bookings') : title}</span>
    ${bookingHtml}`;
};

/** Generates HTML for unordered list using array of strings */
export const createHtmlList = (items: string[]): string =>
  '<ul>' + items.map((li) => `<li>${li}</li>`).join('<br>') + '</ul>';
