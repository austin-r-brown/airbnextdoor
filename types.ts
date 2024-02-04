export type Booking = {
  firstNight: string;
  lastNight: string;
};

export type MerlinCalendarDay = {
  availableForCheckin: boolean;
  availableForCheckout: boolean;
  calendarDate: string;
  minNights: number;
};

export type MerlinCalendarMonth = {
  month: number;
  year: number;
  days: MerlinCalendarDay[];
};

export type DateString = Date | string;

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

export type AirbnbRequestVars = {
  request: {
    count: number;
    listingId: string;
    month: number;
    year: number;
  };
};
