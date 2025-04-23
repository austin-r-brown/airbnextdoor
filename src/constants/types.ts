import { ISODate, Booking } from './Booking';

export type Time = [number, number?, number?];

export type BookingMap = Map<ISODate, Booking>;

export type BookingJSON = Omit<
  Booking,
  'checkIn' | 'checkOut' | 'isActive' | 'getDateRange' | 'isSameAs' | 'toJSON'
>;

export type BookingChange = Partial<BookingJSON>;

export type NotificationQueue = [string, Booking, BookingChange?][];

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

export type SchedulerEvent = {
  timer: NodeJS.Timeout;
  date: number;
};

export type BackupFile = {
  path: string;
  createdAt: Date;
};
