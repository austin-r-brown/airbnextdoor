import { EmailConfig } from '../constants/types';
import { API_BUFFER } from '../constants/constants';
import { LogService } from './log.service';
import * as fs from 'fs';
import * as path from 'path';

const SibApiV3Sdk = require('sib-api-v3-sdk');

/** Service for handling user notifications via email */
export class EmailService {
  private readonly api = new SibApiV3Sdk.TransactionalEmailsApi();
  private readonly css = fs.readFileSync(path.join('src', 'styles.css'), 'utf8');
  private readonly errorsSent = new Map<string, boolean>();

  private smtpConfig: EmailConfig | null;

  constructor(private readonly log: LogService) {
    const userConfig = this.validateUserInput();

    if (userConfig) {
      SibApiV3Sdk.ApiClient.instance.authentications['api-key'].apiKey = userConfig.apiKey;
    } else {
      this.log.warn(
        'Valid Email Addresses and API Key must be provided in .env file for emails to be sent. See README.md for more info.'
      );
    }

    this.smtpConfig = userConfig;
  }

  public send(subject: string, notifications: string[], footer?: string) {
    if (this.smtpConfig) {
      const footerHtml = footer ? `<div class="notification" id="footer">${footer}</div>` : '';
      const bodyHtml = notifications.map((n) => `<div class="notification">${n}</div>`).join(`
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
        (data: any) => {
          this.log.info(`Email sent successfully. Returned data: ${JSON.stringify(data)}`);
        },
        (err: any) => {
          const { message } = JSON.parse(err?.response?.text ?? '{}');
          this.log.error(`Unable to send email: ${message ? `"${message}"` : err}`);

          if (err?.status === 401) {
            this.smtpConfig = null;
          } else {
            setTimeout(() => this.send(subject, notifications, footer), API_BUFFER);
          }
        }
      );
    }
  }

  public sendError(message: string, details: any) {
    const email = `<span><b>Error:</b> ${message}</span>
      <br><br>
      <div class="error">${JSON.stringify(details).slice(0, 1000)}</div>`;

    const previouslySent = this.errorsSent.get(email);

    switch (previouslySent) {
      case undefined:
        // Save error to map if it hasn't been saved
        this.errorsSent.set(email, false);
        break;
      case false:
        // Send email if error has previously occurred but not yet sent
        this.send('Error Notification', [email]);
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
