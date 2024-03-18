import { EmailConfig } from '../types';
import { LogService } from './log.service';
import { EMAIL_TIMEOUT, MS_IN_MINUTE } from '../constants';
import { createEmailBody, createHtmlList } from '../helpers/email.helper';

const SibApiV3Sdk = require('sib-api-v3-sdk');
const { SIB_API_KEY, SEND_FROM_EMAIL, SEND_TO_EMAILS } = process.env;

/** Service for handling user notifications */
export class EmailService {
  private readonly api = new SibApiV3Sdk.TransactionalEmailsApi();

  private readonly smtpConfig: EmailConfig = {
    sender: { email: (SEND_FROM_EMAIL ?? '').trim() },
    to: (SEND_TO_EMAILS ?? '')
      .trim()
      .split(',')
      .map((e) => ({ email: e.trim() })),
    subject: 'Nextdoor Airbnb Updates',
  };

  private readonly errorsSent = new Map<string, boolean>();

  private isUserInputValid: boolean = false;

  constructor(private readonly log: LogService) {
    SibApiV3Sdk.ApiClient.instance.authentications['api-key'].apiKey = SIB_API_KEY?.trim();

    if (this.validateUserInput()) {
      this.isUserInputValid = true;
    } else {
      this.log.warn(
        'Valid Email Addresses and API Key must be provided in .env file for emails to be sent. See README.md for more info.'
      );
    }
  }

  public send(notifications: string[], isError: boolean = false) {
    if (this.isUserInputValid) {
      this.log.info('************** Sending Email **************');
      this.smtpConfig.htmlContent = createEmailBody(notifications);

      this.api.sendTransacEmail(this.smtpConfig).then(
        (data: any) => {
          if (isError) {
            // If successfully sent email was an error message, mark it as sent in the errorsSent map
            this.errorsSent.set(notifications[0], true);
          }
          this.log.info(`Email sent successfully. Returned data: ${JSON.stringify(data)}`);
        },
        (err: any) => {
          setTimeout(() => this.send(notifications, isError), EMAIL_TIMEOUT);
          const { message } = JSON.parse(err?.response?.text ?? '{}');
          this.log.error(`Error occurred sending email: ${message ? `"${message}"` : err}`);
        }
      );
    }
  }

  public sendError(description: string, details: any) {
    this.log.error(description, details);
    const message = `<b>Error:</b> ${description}.
      <br><br>
      <i>${JSON.stringify(details)}</i>`;

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
      ? ['<h4>Recent Errors:</h4>' + createHtmlList(Array.from(this.errorsSent.keys()))]
      : [];
    const message = `Application has not successfully run within past ${Math.round(minutes)} minutes.`;
    this.log.error(message);

    if (!this.errorsSent.has(message)) {
      this.send([message, ...recentErrors], true);
    }
  }

  public clearErrors() {
    this.errorsSent.clear();
  }

  private validateUserInput(): boolean {
    const { apiKey } = SibApiV3Sdk.ApiClient.instance.authentications['api-key'];
    const { sender, to } = this.smtpConfig;
    const emails = [sender.email, ...to.map((t) => t.email)];

    const apiKeyValid = apiKey?.length >= 32;
    const emailsValid = emails.every((e) => /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g.test(e));

    return apiKeyValid && emailsValid;
  }
}
