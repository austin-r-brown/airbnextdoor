import { AxiosError, AxiosResponse } from 'axios';
import { AirbnbApiConfig, MerlinCalendarDay, MerlinCalendarMonth, Time } from '../constants/types';
import { Calendar } from '../constants/Calendar';
import { LOCALE } from '../constants/constants';
import { ISODate } from '../constants/Booking';
import { LogService } from './log.service';
import { WatchdogService } from './watchdog.service';
import { DateService } from './date.service';
import { getTimeFromString } from '../helpers/date.helper';
import { NetworkService } from './network.service';
import puppeteer from 'puppeteer';

const API_CONSTANTS = {
  operationName: 'PdpAvailabilityCalendar',
  hash: '8f08e03c7bd16fcad3c92a3592c19a8b559a0d0855a84028d1163d4733ed9ade',
  key: 'd306zoyjsyarp7ifhu67rjxn52tv0t20',
};

const SELECTORS = {
  title: 'h1',
  policiesSection: '[data-section-id="POLICIES_DEFAULT"] section'
}

/** Service for fetching and processing data from Airbnb API */
export class AirbnbService {
  public readonly listingId: string;
  public readonly listingUrl: string;
  public listingTitle: string = 'Airbnb';

  public checkInTime: Time = [15];
  public checkOutTime: Time = [11];

  public readonly isAfterCheckInTime = (): boolean => this.date.isTimeAfter(this.checkInTime);

  private previousResponse?: string;

  /** Furthest date in the future ever known to be bookable */
  private calendarRange?: ISODate;

  private readonly apiConfig: AirbnbApiConfig = {
    method: 'get',
    url: `https://www.airbnb.com/api/v3/${API_CONSTANTS.operationName}/${API_CONSTANTS.hash}`,
    headers: {
      'X-Airbnb-Api-Key': API_CONSTANTS.key,
    },
    params: {
      operationName: API_CONSTANTS.operationName,
      locale: LOCALE,
      extensions: JSON.stringify({
        persistedQuery: {
          version: 1,
          sha256Hash: API_CONSTANTS.hash,
        },
      }),
    },
  };

  constructor(
    private readonly log: LogService,
    private readonly date: DateService,
    private readonly watchdog: WatchdogService,
    private readonly network: NetworkService,
  ) {
    const listingId = this.validateListingId();
    if (!listingId) {
      throw new Error(
        'Valid Airbnb URL or Listing ID must be provided in .env file. See README.md for more info.',
      );
    }
    this.listingId = listingId;
    this.listingUrl = `https://www.airbnb.com/rooms/${listingId}`;
  }

  public async init(): Promise<void> {
    let listingTitle,
      checkInTime,
      checkOutTime,
      throwErrors = [];

    try {
      const browser = await puppeteer.launch();
      const page = await browser.newPage();

      await page.goto(this.listingUrl);
      await page.waitForSelector(SELECTORS.policiesSection);

      listingTitle = await page.$eval(SELECTORS.title, element => element?.textContent?.trim());

      const policiesSection = await page.$eval(SELECTORS.policiesSection, element => element?.textContent?.trim());
      const checkInString = policiesSection?.match(/check[\s-]?in(.*)/i)?.[1]?.trim();
      const checkOutString = policiesSection?.match(/check[\s-]?out(.*)/i)?.[1]?.trim();

      if (checkInString) checkInTime = getTimeFromString(checkInString);
      if (checkOutString) checkOutTime = getTimeFromString(checkOutString);

      await browser.close();

      if (listingTitle) this.listingTitle = listingTitle;
      else throwErrors.push('Title');

      if (checkInTime) this.checkInTime = checkInTime;
      else throwErrors.push('Check In Time');

      if (checkOutTime) this.checkOutTime = checkOutTime;
      else throwErrors.push('Check Out Time');

      if (throwErrors.length) throw new Error(`Unable to find the following: ${throwErrors.join(', ')}`);
    } catch (e: any) {
      this.log.error(`Error fetching Airbnb listing details for ID ${this.listingId}:`, e?.message);
    }
  }

  public setCalendarRange(date: ISODate) {
    if (!this.calendarRange || date > this.calendarRange) {
      this.calendarRange = date;
    }
  }

  /**
   * Sends Airbnb request for calendar and builds Calendar object from response.
   * Returns empty calendar if no changes were found from previous response, null if request is unsuccessful
   */
  public async fetchCalendar(): Promise<Calendar | null> {
    this.apiConfig.params.variables = JSON.stringify({
      request: {
        count: 12,
        listingId: this.listingId,
        month: this.date.month,
        year: this.date.year,
      },
    });

    let result: Calendar | null = null;

    await this.network
      .sendRequest(this.apiConfig)
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

              if (calendarDate < this.date.today) break;

              if (bookable) this.setCalendarRange(calendarDate);

              if (this.calendarRange && calendarDate <= this.calendarRange)
                calendar.unshift({
                  booked: !bookable,
                  date: calendarDate,
                  minNights: Number(minNights),
                });
            }
            this.previousResponse = apiResponseStr;
          }
          result = calendar;
        } catch (e: any) {
          const errors = response?.data?.errors;

          if (errors?.length) {
            errors.forEach((err: any) => {
              const message = err?.extensions?.response?.body?.error_message || err?.message;
              this.handleFetchError(message ? { message } : err);
            });
          } else {
            this.handleFetchError(e, response);
          }
        }
      })
      .catch(this.handleFetchError);

    return result;
  }

  /** Validates user input for Airbnb URL. Returns ID from URL if value is URL, trimmed ID if value is ID, otherwise undefined */
  private validateListingId(): string | void {
    const airbnbUrl = process.env.AIRBNB_URL?.trim();

    if (airbnbUrl) {
      const isId = /^\d+$/.test(airbnbUrl);
      const [, idFromUrl] = !isId ? (airbnbUrl.match(/airbnb\.com\/rooms\/(\d+)(\?.*)?$/) ?? []) : [];
      return isId ? airbnbUrl : idFromUrl;
    }
  }

  private readonly handleFetchError = (err: AxiosError, response?: AxiosResponse): void => {
    let description, details;

    if (response) {
      description = 'Airbnb API response is in unexpected format';
      details = response.data;
    } else {
      description = err.isAxiosError ? 'Unable to reach Airbnb API' : 'Airbnb API responded with an error';
      details = err?.message || err;
    }

    this.watchdog.handleApplicationError(description, details);
  };
}
