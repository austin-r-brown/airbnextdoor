import { Html } from '../helpers/email.helper';
import { EmailConfig } from '../types';
import { LogService } from './log.service';
import { EMAIL_TIMEOUT, MS_IN_MINUTE } from '../constants';

const SibApiV3Sdk = require('sib-api-v3-sdk');
const { SIB_API_KEY, SEND_FROM_EMAIL, SEND_TO_EMAILS } = process.env;

/** Service for handling user notifications */
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

  constructor(private readonly log: LogService) {
    SibApiV3Sdk.ApiClient.instance.authentications['api-key'].apiKey = SIB_API_KEY?.trim();
  }

  public send(messages: string[], isError: boolean = false) {
    const joinedMessages = messages.join(Html.blankline);

    this.log.info(
      '*********************** Sending Email: ***********************',
      Html.remove(joinedMessages),
      '**************************************************************'
    );

    if (SIB_API_KEY && SEND_FROM_EMAIL && SEND_TO_EMAILS) {
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
          this.log.error(`Error occurred sending email: ${message ? `"${message}"` : err}`);
        }
      );
    } else {
      this.log.error('SIB API Key and Email Addresses must be provided in .env file to send emails.');
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
      ? Html.h4('Recent Errors:') + Html.list(Array.from(this.errorsSent.keys()))
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
