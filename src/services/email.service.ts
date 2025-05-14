import { EmailConfig } from '../constants/types';
import { NETWORK_TIMEOUT } from '../constants/constants';
import { LogService } from './log.service';
import * as fs from 'fs';
import * as path from 'path';
import * as SibApiV3Sdk from '@sendinblue/client';
import { NetworkService } from './network.service';

/** Service for generating and sending email notifications */
export class EmailService {
  private readonly api = new SibApiV3Sdk.TransactionalEmailsApi();
  private readonly css = fs.readFileSync(path.join('src', 'styles.css'), 'utf8');

  private readonly smtpConfig: EmailConfig | null;

  constructor(private readonly log: LogService, private readonly network: NetworkService) {
    const userConfig = this.validateUserInput();

    if (userConfig) {
      this.api.setApiKey(SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey, userConfig.apiKey);
    } else {
      this.log.warn(
        'Valid Email Addresses and API Key must be provided in .env file for emails to be sent. See README.md for more info.'
      );
    }

    this.smtpConfig = userConfig;
  }

  public async send(subject: string, notifications: string[], footer?: string): Promise<void> {
    if (this.smtpConfig) {
      await this.network.waitUntilOnline();

      const footerHtml = footer ? `<div class="notification" id="footer">${footer}</div>` : '';
      const bodyHtml = notifications.map((n) => `<div class="notification main">${n}</div>`).join(`
      `);

      this.smtpConfig.subject = subject;
      this.smtpConfig.htmlContent = `<!DOCTYPE html>
        <html lang="en">
          <head>
            <style>
              ${this.css}
            </style>
          </head>
          <body>
            ${bodyHtml}
            ${footerHtml}
          </body>
        </html>`;

      this.api.sendTransacEmail(this.smtpConfig).then(
        (data) => this.log.info(`Email sent successfully. ${data.body.messageId}`),
        (err: any) => {
          const { message } = err?.response?.body ?? {};
          this.log.error(`Unable to send email: ${message ? `"${message}"` : JSON.stringify(err)}`);

          if (err?.response?.statusCode !== 401) {
            this.log.error(`Retrying in ${NETWORK_TIMEOUT / 1000} seconds...`);
            setTimeout(() => this.send(subject, notifications, footer), NETWORK_TIMEOUT);
          }
        }
      );
    }
  }

  private validateUserInput(): EmailConfig | null {
    const apiKey: string = process.env.SIB_API_KEY?.trim() ?? '';
    const sendFromEmail: string = process.env.SEND_FROM_EMAIL?.trim() ?? '';
    const sendToEmails: string[] = (process.env.SEND_TO_EMAILS ?? '')
      .trim()
      .split(',')
      .map((e) => e.trim());
    const allEmails: string[] = [sendFromEmail, ...sendToEmails];

    const apiKeyValid = apiKey.length >= 32 && /^[a-zA-Z0-9-]+$/.test(apiKey);
    const emailsValid =
      allEmails.length > 1 &&
      allEmails.every((e) => /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(e.trim()));

    if (apiKeyValid && emailsValid) {
      return {
        sender: { email: sendFromEmail },
        to: sendToEmails.map((email) => ({ email })),
        apiKey,
      };
    }

    return null;
  }
}
