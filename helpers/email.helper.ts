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
export const formatCurrentBookings = (bookings: Booking[]): string | undefined => {
  if (bookings.length) {
    const bookingsHtml = bookings.map((b) => {
      return formatBooking(b, b.isActive ? 'active' : '');
    }).join(`
      `);

    return `<span class="title">Current Bookings</span>
      ${bookingsHtml}`;
  }
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

/** Generates HTML for unordered list using array of strings */
export const createHtmlList = (items: string[]): string =>
  '<ul>' + items.map((li) => `<li>${li}</li>`).join('<br>') + '</ul>';
