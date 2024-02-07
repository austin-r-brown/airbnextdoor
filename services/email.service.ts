import { offsetDay, Today } from '../helpers/date.helper';
import { Booking, EmailConfig } from '../types';
const SibApiV3Sdk = require('sib-api-v3-sdk');
require('dotenv').config();

const { SIB_API_KEY, SEND_FROM_EMAIL, SEND_TO_EMAILS } = process.env;
const DEBOUNCE_TIME: number = 1000;

export class EmailService {
  private readonly api = new SibApiV3Sdk.TransactionalEmailsApi();

  private readonly smtpConfig: EmailConfig = {
    sender: { email: SEND_FROM_EMAIL?.trim() ?? '' },
    to:
      SEND_TO_EMAILS?.trim()
        .split(',')
        .map((e) => ({ email: e.trim() })) ?? [],
    subject: 'Nextdoor Airbnb Updates',
  };

  private sendDebounceTimer?: NodeJS.Timeout;
  private emailsBuffer: string[] = [];

  private lastError: string | null = null;
  private lastSentEmail: string | null = null;

  public readonly formatDate = (date: string): string => {
    const [y, m, d] = date.split('-');
    return `${Number(m)}/${Number(d)}/${y.slice(2)}`;
  };

  public readonly formatBooking = (booking: Booking): string => {
    const [startDate, endDate] = [booking.firstNight, offsetDay(booking.lastNight, 1)].map(this.formatDate);
    return `[Start Date: ${startDate}, End Date: ${endDate}]`;
  };

  constructor() {
    SibApiV3Sdk.ApiClient.instance.authentications['api-key'].apiKey = SIB_API_KEY?.trim();
  }

  public send(email: string, bookings?: Booking[]) {
    clearTimeout(this.sendDebounceTimer);
    this.emailsBuffer.push(email);

    this.sendDebounceTimer = setTimeout(() => {
      const currentBookings = bookings?.length
        ? '<h3>Current Bookings:</h3>' +
          bookings
            .map((b) => {
              const today = new Today().iso;
              const isActive = b.firstNight <= today && b.lastNight >= offsetDay(today, -1);
              return isActive ? `<b>${this.formatBooking(b)}</b>` : this.formatBooking(b);
            })
            .join('<br>')
        : '';

      const joinedEmails = [...this.emailsBuffer, currentBookings].join('<br><br>');

      console.info('******************** Sending Emails: ********************');
      console.info(joinedEmails);

      if (!SIB_API_KEY || !SEND_FROM_EMAIL || !SEND_TO_EMAILS) {
        console.error(`
        SIB API Key and Email Addresses must be provided in .env file to send emails.
        `);
      } else {
        this.smtpConfig.htmlContent = joinedEmails;

        this.api.sendTransacEmail(this.smtpConfig).then(
          (data: any) => {
            console.info(`Email Sent successfully. Returned data: ${JSON.stringify(data)}`);
          },
          (err: Error) => {
            console.error(err);
          }
        );
      }

      this.emailsBuffer = [];
    }, DEBOUNCE_TIME);
  }

  public sendError(email: string) {
    // Only send same error once and only if it has occured more than once
    if (email === this.lastError && email !== this.lastSentEmail) {
      this.send(email);
      this.lastSentEmail = email;
      this.lastError = null;
    } else {
      this.lastError = email;
    }
  }

  public clearErrors() {
    this.lastError = null;
    this.lastSentEmail = null;
  }
}
