import axios, { AxiosResponse } from 'axios';
import { Calendar } from '../helpers/date.helper';
import {
  AirbnbApiConfig,
  AirbnbRequestVariables,
  ISODate,
  MerlinCalendarDay,
  MerlinCalendarMonth,
} from '../types';
import { LogService } from './logger.service';
import { EmailService } from './email.service';
import { DateService } from './date.service';
import { LOCALE } from '../constants';

const API_OPERATION = 'PdpAvailabilityCalendar';
const API_HASH = '8f08e03c7bd16fcad3c92a3592c19a8b559a0d0855a84028d1163d4733ed9ade';
const API_KEY = 'd306zoyjsyarp7ifhu67rjxn52tv0t20';

export class AirbnbService {
  private readonly apiConfig: AirbnbApiConfig = {
    method: 'get',
    url: `https://www.airbnb.com/api/v3/${API_OPERATION}/${API_HASH}`,
    headers: {
      'X-Airbnb-Api-Key': API_KEY,
    },
    params: {
      operationName: API_OPERATION,
      locale: LOCALE,
      currency: 'USD',
      extensions: JSON.stringify({
        persistedQuery: {
          version: 1,
          sha256Hash: API_HASH,
        },
      }),
    },
  };

  private listingId: string;
  /** Used to check for changes in each subsequent API response */
  private previousResponse?: string;
  /** Furthest date in the future known as having been available to book */
  private calendarRange?: ISODate;

  constructor(
    private readonly date: DateService,
    private readonly log: LogService,
    private readonly email: EmailService
  ) {
    const listingId = this.getListingId();
    if (!listingId) {
      throw new Error('Valid Airbnb URL or Listing ID must be provided in .env file.');
    }
    this.listingId = listingId;
  }

  /**
   * Sends Airbnb request and builds Calendar object from response.
   * Returns empty calendar if no changes were found from previous response, null if request is unsuccessful
   */
  public async fetch(): Promise<Calendar | null> {
    const requestVariables: AirbnbRequestVariables = {
      request: {
        count: 13,
        listingId: this.listingId,
        month: this.date.month,
        year: this.date.year,
      },
    };
    this.apiConfig.params.variables = JSON.stringify(requestVariables);

    let result: Calendar | null = null;

    await axios
      .request(this.apiConfig)
      .then((response) => {
        try {
          const { calendarMonths } = response.data.data.merlin.pdpAvailabilityCalendar;
          const apiResponse: MerlinCalendarDay[] = calendarMonths.flatMap((m: MerlinCalendarMonth) => m.days);
          const apiResponseStr = JSON.stringify(apiResponse);
          const calendar = new Calendar();

          if (apiResponseStr !== this.previousResponse) {
            apiResponse
              .reverse()
              .forEach(({ calendarDate, availableForCheckin, availableForCheckout, minNights }) => {
                if (calendarDate >= this.date.today) {
                  const available = availableForCheckin || availableForCheckout;

                  if (available && (!this.calendarRange || calendarDate > this.calendarRange)) {
                    this.calendarRange = calendarDate;
                  }

                  if (this.calendarRange && calendarDate <= this.calendarRange) {
                    calendar.unshift({
                      booked: !available,
                      date: calendarDate,
                      minNights: Number(minNights),
                    });
                  }
                }
              });
            this.previousResponse = apiResponseStr;
          }
          result = calendar;
        } catch (err: any) {
          const errors = response?.data?.errors;

          if (errors?.length) {
            errors.forEach((e: any) => {
              const message = e?.extensions?.response?.body?.error_message || e?.message;
              this.handleError(message ? { message } : e);
            });
          } else {
            this.handleError(err, response);
          }
        }
      })
      .catch(this.handleError);

    return result;
  }

  /** Validates AIRBNB_URL value, returns ID from URL if value is URL, trimmed ID if value is ID, otherwise undefined */
  private getListingId(): string | void {
    const { AIRBNB_URL } = process.env;
    if (AIRBNB_URL) {
      const trimmed = AIRBNB_URL.trim();
      const isId = Array.from(trimmed).every((c) => Number.isInteger(Number.parseInt(c)));
      const [, idFromUrl] = !isId ? trimmed.match(/airbnb\.com\/rooms\/(\d+)(\?.*)?/) ?? [] : [];
      return isId ? trimmed : idFromUrl;
    }
  }

  private handleError = (err: Error, response?: AxiosResponse) => {
    let description, details;

    if (response) {
      description = 'Airbnb API response is in unexpected format';
      details = response.data;
      this.log.error(`${description}:`, details);
    } else {
      description = 'Airbnb API responded with an error';
      details = err?.message || err;
      this.log.error(`${description}: "${details}"`);
    }

    const errorEmail = [`<b>Error:</b> ${description}.`, `<i>${JSON.stringify(details)}</i>`].join(
      '<br><br>'
    );
    this.email.sendError(errorEmail);
  };
}
