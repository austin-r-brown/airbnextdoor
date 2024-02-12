export type Booking = {
  firstNight: ISODate;
  lastNight: ISODate;
};

export enum BookingChange {
  New = 'New Booking',
  Cancelled = 'Booking Cancelled',
  Extended = 'Booking Extended',
  Shortened = 'Booking Shortened',
}

export type ISODate = `${string}-${string}-${string}`;

export type CalendarDay = {
  booked: boolean;
  date: ISODate;
  minNights: number;
};

export type BookingsMap = Map<ISODate, Booking>;

export type DateType = Date | ISODate;

export type EmailConfig = {
  sender: { email: string };
  to: { email: string }[];
  subject: string;
  htmlContent?: string;
};

export type AirbnbApiConfig = {
  method: string;
  maxBodyLength?: number;
  url: string;
  headers: {
    'X-Airbnb-Api-Key': string;
  };
  params: {
    operationName: string;
    locale: string;
    currency: string;
    variables?: string;
    extensions: string;
  };
};

export type AirbnbRequest = {
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
