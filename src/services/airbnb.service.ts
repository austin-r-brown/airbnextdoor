import axios, { AxiosError, AxiosResponse } from 'axios';
import {
  AirbnbApiConfig,
  AirbnbRequestVariables,
  MerlinCalendarDay,
  MerlinCalendarMonth,
  Time,
} from '../constants/types';
import { Calendar } from '../constants/Calendar';
import { LOCALE } from '../constants/constants';
import { ISODate } from '../constants/Booking';
import { LogService } from './log.service';
import { EmailService } from './email.service';
import { DateService } from './date.service';
import { getTimeFromString } from '../helpers/date.helper';

const API_OPERATION = 'PdpAvailabilityCalendar';
const API_HASH = '8f08e03c7bd16fcad3c92a3592c19a8b559a0d0855a84028d1163d4733ed9ade';
const API_KEY = 'd306zoyjsyarp7ifhu67rjxn52tv0t20';

/** Service for interacting with Airbnb */
export class AirbnbService {
  public listingId: string;
  public listingUrl: string;
  public listingTitle: string = 'Airbnb';

  public checkInTime: Time = [11];
  public checkOutTime: Time = [15];

  private previousResponse?: string;

  /** Furthest date in the future ever known to be bookable */
  private calendarRange?: ISODate;

  private readonly apiConfig: AirbnbApiConfig = {
    method: 'get',
    url: `https://www.airbnb.com/api/v3/${API_OPERATION}/${API_HASH}`,
    headers: {
      'X-Airbnb-Api-Key': API_KEY,
    },
    params: {
      operationName: API_OPERATION,
      locale: LOCALE,
      extensions: JSON.stringify({
        persistedQuery: {
          version: 1,
          sha256Hash: API_HASH,
        },
      }),
    },
  };

  constructor(
    private readonly log: LogService,
    private readonly date: DateService,
    private readonly email: EmailService
  ) {
    const listingId = this.validateListingId();
    if (!listingId) {
      throw new Error(
        'Valid Airbnb URL or Listing ID must be provided in .env file. See README.md for more info.'
      );
    }
    this.listingId = listingId;
    this.listingUrl = `https://www.airbnb.com/rooms/${listingId}`;
  }

  public async init(): Promise<void> {
    try {
      const response = await axios.get(this.listingUrl);
      const match = response.data.match(/<script\s+id="data-deferred-state-0"\s+[^>]*>([\s\S]*?)<\/script>/i);

      if (match?.length > 1) {
        const json = JSON.parse(match[1]);
        const { sections } =
          json.niobeMinimalClientData[0][1].data.presentation.stayProductDetailPage.sections;
        const sectionsMap: Map<string, any> = new Map(
          sections.map((s: any) => s.section).map((s: any) => [s?.__typename, s])
        );

        const title = sectionsMap.get('AvailabilityCalendarSection')?.listingTitle;

        if (title) {
          this.listingTitle = title;
        }

        const houseRules = sectionsMap.get('PoliciesSection')?.houseRules.map((r: any) => r.title);
        const [checkInTime, checkOutTime] = houseRules.map(getTimeFromString).filter(Boolean);

        if (checkInTime) {
          this.checkInTime = checkInTime;
        }
        if (checkOutTime) {
          this.checkOutTime = checkOutTime;
        }
      }
    } catch (e: any) {
      this.log.error(`Error fetching Airbnb listing details for ID ${this.listingId}:`, e?.message);
    }
  }

  /**
   * Sends Airbnb request for calendar and builds Calendar object from response.
   * Returns empty calendar if no changes were found from previous response, null if request is unsuccessful
   */
  public async fetchCalendar(): Promise<Calendar | null> {
    const requestVariables: AirbnbRequestVariables = {
      request: {
        count: 12,
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
            // Iterate backwards to simultaneously find calendarRange and build Calendar object
            for (let i = apiResponse.length - 1; i >= 0; i--) {
              const { calendarDate, bookable, minNights } = apiResponse[i];

              if (calendarDate < this.date.today) {
                break;
              } else {
                if (bookable && (!this.calendarRange || calendarDate > this.calendarRange)) {
                  this.calendarRange = calendarDate;
                }

                if (this.calendarRange && calendarDate <= this.calendarRange) {
                  calendar.unshift({
                    booked: !bookable,
                    date: calendarDate,
                    minNights: Number(minNights),
                  });
                }
              }
            }
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

  /** Validates user input for Airbnb URL. Returns ID from URL if value is URL, trimmed ID if value is ID, otherwise undefined */
  private validateListingId(): string | void {
    const { AIRBNB_URL } = process.env;
    if (AIRBNB_URL) {
      const trimmed = AIRBNB_URL.trim();
      const isId = Array.from(trimmed).every((c) => Number.isInteger(Number.parseInt(c)));
      const [, idFromUrl] = !isId ? trimmed.match(/airbnb\.com\/rooms\/(\d+)(\?.*)?/) ?? [] : [];
      return isId ? trimmed : idFromUrl;
    }
  }

  private handleError = (err: AxiosError, response?: AxiosResponse) => {
    let description, details;

    if (response) {
      description = 'Airbnb API response is in unexpected format';
      details = response.data;
      this.log.error(`${description}:`, details);
    } else {
      description = err.isAxiosError ? 'Unable to reach Airbnb API' : 'Airbnb API responded with an error';
      details = err?.message || err;
      this.log.error(`${description}: "${details}"`);
    }

    this.email.sendError(description, details);
  };
}
