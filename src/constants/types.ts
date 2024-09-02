import { ISODate, Booking } from './Booking';
import { ConsoleType } from './enums';

export type Time = [number, number?, number?];

export type BookingMap = Map<ISODate, Booking>;

export type BookingSerialized = Omit<Booking, 'checkIn' | 'checkOut' | 'isActive' | 'isEqualTo' | 'toJSON'>;

export type BookingChange = Partial<BookingSerialized>;

export type NotificationBuffer = [string, Booking, BookingChange?][];

export type CalendarDay = {
  booked: boolean;
  date: ISODate;
  minNights: number;
};

export type EmailConfig = {
  sender: { email: string };
  to: { email: string }[];
  subject?: string;
  htmlContent?: string;
  apiKey: string;
};

export type AirbnbApiConfig = {
  method: string;
  url: string;
  headers: {
    'X-Airbnb-Api-Key': string;
  };
  params: {
    operationName: string;
    locale: string;
    currency?: string;
    variables?: string;
    extensions: string;
  };
};

export type AirbnbRequestVariables = {
  request: {
    count: number;
    listingId: string;
    month: number;
    year: number;
  };
};

export type MerlinCalendarDay = {
  bookable: boolean;
  calendarDate: ISODate;
  minNights: number;
};

export type MerlinCalendarMonth = {
  month: number;
  year: number;
  days: MerlinCalendarDay[];
};

export type LogItem = [any[], ConsoleType];

export type RunOptions = {
  isPreMidnightRun?: boolean;
  isPostMidnightRun?: boolean;
  isReCheck?: boolean;
};

export type SchedulerEvent = {
  timer: NodeJS.Timeout;
  date: number;
};

export type BackupFile = {
  path: string;
  createdAt: Date;
};
