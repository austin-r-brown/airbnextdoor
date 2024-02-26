import { MS_IN_MINUTE, offsetDay, Today } from '../helpers/date.helper';
import { Booking, EmailConfig } from '../types';
import { Logger } from './logger.service';
const SibApiV3Sdk = require('sib-api-v3-sdk');
require('dotenv').config();

const { SIB_API_KEY, SEND_FROM_EMAIL, SEND_TO_EMAILS } = process.env;
export const EMAIL_TIMEOUT = 10000;

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

  private readonly errorsSent = new Map<string, boolean>();

  public readonly formatDate = (date: string): string => {
    const [y, m, d] = date.split('-');
    return `${Number(m)}/${Number(d)}/${y.slice(2)}`;
  };

  public readonly formatBooking = (booking: Booking): string => {
    const [startDate, endDate] = [booking.firstNight, offsetDay(booking.lastNight, 1)].map(this.formatDate);
    return `[Start Date: ${startDate}, End Date: ${endDate}]`;
  };

  constructor(private readonly today: Today, private readonly log: Logger) {
    SibApiV3Sdk.ApiClient.instance.authentications['api-key'].apiKey = SIB_API_KEY?.trim();
  }

  public formatCurrentBookings(bookings: Booking[]) {
    return (
      '<h3>Current Bookings:</h3>' +
      bookings
        .map((b) => {
          const isActive = b.firstNight <= this.today.iso && b.lastNight >= this.today.dayBefore;
          return isActive ? `<b>${this.formatBooking(b)}</b>` : this.formatBooking(b);
        })
        .join('<br>')
    );
  }

  public createEmail(title: string, booking: Booking, details?: string) {
    if (!booking.isBlockedOff) {
      const body = this.formatBooking(booking);
      const additional = details ? [details] : [];
      return [`<b>${title}:</b>`, body, ...additional].join('<br>');
    }
  }

  public send(messages: string[], isError: boolean = false) {
    const joinedMessages = messages.join('<br><br>');

    this.log.info(
      '*********************** Sending Email: ***********************',
      joinedMessages,
      '**************************************************************'
    );

    if (!SIB_API_KEY || !SEND_FROM_EMAIL || !SEND_TO_EMAILS) {
      this.log.error('SIB API Key and Email Addresses must be provided in .env file to send emails.');
    } else {
      this.smtpConfig.htmlContent = joinedMessages;

      this.api.sendTransacEmail(this.smtpConfig).then(
        (data: any) => {
          if (isError) {
            // If successfully sent email was an error message, mark it as sent in the errorsSent map
            this.errorsSent.set(messages.toString(), true);
          }
          this.log.info(`Email sent successfully. Returned data: ${JSON.stringify(data)}`);
        },
        (err: any) => {
          setTimeout(() => this.send(messages, isError), EMAIL_TIMEOUT);
          const { message } = JSON.parse(err?.response?.text ?? '{}');
          this.log.error(`Error occurred sending email: ${message ? JSON.stringify(message) : err}`);
        }
      );
    }
  }

  public sendError(message: string) {
    if (this.errorsSent.get(message) === false) {
      // Send email if error has previously been logged but not yet sent
      this.send([message], true);
    } else if (!this.errorsSent.has(message)) {
      // Otherwise log it if hasn't been logged
      this.errorsSent.set(message, false);
    }
  }

  public sendTimeoutError(timeout: number) {
    const minutes = timeout / MS_IN_MINUTE;
    const recentErrors = this.errorsSent.size
      ? '<h4>Recent Errors:</h4> <ul>' +
        Array.from(this.errorsSent.keys())
          .map((e) => `<li>${e}</li>`)
          .join('<br>') +
        '</ul>'
      : '';

    this.send([
      `Application has not successfully run within past ${Math.round(minutes)} minutes.`,
      recentErrors,
    ]);
  }

  public clearErrors() {
    this.errorsSent.clear();
  }
}
