import { EmailConfig } from '../types';
import { LogService } from './log.service';
import { API_TIMEOUT } from '../constants';
import { EMAIL_CSS } from '../helpers/email.helper';

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

  public send(notifications: string[], footer?: string) {
    if (this.isUserInputValid) {
      const footerHtml = footer ? `<div class="notification" id="footer">${footer}</div>` : '';
      const bodyHtml = notifications.map((n) => `<div class="notification">${n}</div>`).join(`
      `);

      this.smtpConfig.htmlContent = `<!DOCTYPE html>
        <html lang="en">
          <head>
            <style>
              ${EMAIL_CSS}
            </style>
          </head>
          <body>
            ${bodyHtml}
            ${footerHtml}
          </body>
        </html>`;

      this.api.sendTransacEmail(this.smtpConfig).then(
        (data: any) => {
          this.log.info(`Email sent successfully. Returned data: ${JSON.stringify(data)}`);
        },
        (err: any) => {
          const { message } = JSON.parse(err?.response?.text ?? '{}');
          this.log.error(`Unable to send email: ${message ? `"${message}"` : err}`);

          if (err?.status === 401) {
            this.isUserInputValid = false;
          } else {
            setTimeout(() => this.send(notifications, footer), API_TIMEOUT);
          }
        }
      );
    }
  }

  public sendError(message: string, details: any) {
    const email = `<span><b>Error:</b> ${message}</span>
      <br><br>
      <i>${JSON.stringify(details).slice(0, 1000)}</i>`;

    const previouslySent = this.errorsSent.get(email);

    switch (previouslySent) {
      case undefined:
        // Save error to map if it hasn't been saved
        this.errorsSent.set(email, false);
        break;
      case false:
        // Send email if error has previously occurred but not yet sent
        this.send([email]);
        this.errorsSent.set(email, true);
        break;
    }
  }

  public getRecentErrors() {
    return Array.from(this.errorsSent.keys());
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
