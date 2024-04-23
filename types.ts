export type ISODate = `${string}-${string}-${string}`;

export type Time24Hr = [number, number?, number?];

export type Booking = {
  firstNight: ISODate;
  lastNight: ISODate;
  isBlockedOff?: boolean;
  isActive?: boolean;
};

export type BookingsMap = Map<ISODate, Booking>;

export type NotificationBuffer = [string, Booking, Partial<Booking>?][];

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
  availableForCheckin: boolean;
  availableForCheckout: boolean;
  calendarDate: ISODate;
  minNights: number;
};

export type MerlinCalendarMonth = {
  month: number;
  year: number;
  days: MerlinCalendarDay[];
};

export type LogItem = [any[], ConsoleType];

export enum ConsoleType {
  Info = 'info',
  Error = 'error',
  Warn = 'warn',
}

export enum BookingChange {
  New = 'New Booking',
  Cancelled = 'Cancelled Booking',
  Extended = 'Booking Extended',
  Shortened = 'Booking Shortened',
}
