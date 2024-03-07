import { DateService } from '../services/date.service';
import { Booking } from '../types';
import { offsetDay } from './date.helper';

export const formatDate = (date: string): string => {
  const [y, m, d] = date.split('-');
  return `${Number(m)}/${Number(d)}/${y.slice(2)}`;
};

export const formatBooking = ({ firstNight, lastNight, isBlockedOff }: Booking): string => {
  const [startDate, endDate] = [firstNight, isBlockedOff ? lastNight : offsetDay(lastNight, 1)].map(
    formatDate
  );
  return `[Start Date: ${startDate}, End Date: ${endDate}]`;
};

export const formatCurrentBookings = (bookings: Booking[], date: DateService): string => {
  return (
    Html.h3('Current Bookings:') +
    bookings
      .map((b) => {
        const isActive = b.firstNight <= date.today && b.lastNight >= date.yesterday;
        return isActive ? Html.bold(formatBooking(b)) : formatBooking(b);
      })
      .join(Html.newline)
  );
};

export const createEmail = (title: string, booking: Booking, details?: string): string => {
  const body = formatBooking(booking);
  const additional = details ? [details] : [];
  const email = [Html.bold(`${title}:`), body, ...additional];

  return email.join(Html.newline);
};

export class Html {
  public static readonly newline: string = '<br>';
  public static readonly blankline: string = '<br><br>';

  public static bold = (str: string): string => `<b>${str}</b>`;
  public static italic = (str: string): string => `<i>${str}</i>`;
  public static h3 = (str: string): string => `<h3>${str}</h3>`;
  public static h4 = (str: string): string => `<h4>${str}</h4>`;
  public static list = (items: string[]): string =>
    '<ul>' + items.map((li) => `<li>${li}</li>`).join(this.newline) + '</ul>';

  /** Remove html tags from string and replace with newlines where applicable */
  public static remove = (str: string): string =>
    str
      .replace(/(?:^|<\/?h[1-4]>|<\/?p>|<ul>)(?!$)/gi, '\n\n')
      .replace(/<br>|<\/li>|<\/ul>/gi, '\n')
      .replace(/<[^>]*>/g, '');
}
