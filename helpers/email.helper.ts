import { Booking } from '../types';
import { offsetDay } from './date.helper';

export const removeHtmlTags = (str: string) =>
  str.replace(/<br>|<\/h[1-4]>|<\/p>/g, '\n').replace(/<[^>]*>/g, '');

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

export const createEmail = (title: string, booking: Booking, details?: string): string => {
  const body = formatBooking(booking);
  const additional = details ? [details] : [];
  const email = [`<b>${title}:</b>`, body, ...additional];

  return email.join('<br>');
};
