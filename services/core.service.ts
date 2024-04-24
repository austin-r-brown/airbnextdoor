import { App } from '../app';
import { EmailConfig } from '../types';
import { AirbnbService } from './airbnb.service';
import { LogService } from './log.service';

const { SIB_API_KEY, SEND_FROM_EMAIL, SEND_TO_EMAILS } = process.env;

export class CoreService {
  public listingId: string;
  public listingTitle: string = 'Airbnb';

  public isEmailValid: boolean;

  private readonly emailConfig: EmailConfig = {
    sender: { email: (SEND_FROM_EMAIL ?? '').trim() },
    to: (SEND_TO_EMAILS ?? '')
      .trim()
      .split(',')
      .map((e) => ({ email: e.trim() })),
  };

  constructor(url: string, private readonly log: LogService) {
    const listingId = this.getListingId(url);

    if (!listingId) {
      throw 'Valid Airbnb URLs or Listing IDs must be provided in .env file. See README.md for more info.';
    }
    this.listingId = listingId;

    this.isEmailValid = this.validateEmail();
    if (!this.isEmailValid) {
      log.warn(
        'Valid Email Addresses and API Key must be provided in .env file for emails to be sent. See README.md for more info.'
      );
    }

    this.instantiate();
  }

  public logInfoMessage(...args: any) {
    this.log.info(...this.addListingTitle(...args));
  }

  public logErrorMessage(...args: any) {
    this.log.error(...this.addListingTitle(...args));
  }

  public logSuccessMessage(...args: any) {
    this.log.error(...this.addListingTitle(...args));
  }

  private addListingTitle(...args: any) {
    const values = [...args];
    const title = `(${this.listingTitle})`;

    const [first] = values;
    if (values.length === 1 && typeof first === 'string') {
      values[0] = `${first} ${title}`;
    } else {
      values.push(title);
    }
    return values;
  }

  /** Validates user input for Airbnb URL. Returns ID from URL if value is URL, trimmed ID if value is ID, otherwise undefined */
  private getListingId(url: string): string | void {
    if (url) {
      const trimmed = url.trim();
      const isId = Array.from(trimmed).every((c) => Number.isInteger(Number.parseInt(c)));
      const [, idFromUrl] = !isId ? trimmed.match(/airbnb\.com\/rooms\/(\d+)(\?.*)?/) ?? [] : [];
      return isId ? trimmed : idFromUrl;
    }
  }

  private validateEmail(): boolean {
    const { sender, to } = this.emailConfig;
    const emails = [sender.email, ...to.map((t) => t.email)];

    const apiKeyValid = /^(?!.*\s).{32,}$/.test(SIB_API_KEY ?? '');
    const emailsValid = emails.every((e) => /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g.test(e));

    return apiKeyValid && emailsValid;
  }

  private instantiate() {
    AirbnbService.fetchTitle(this.listingId).then((title) => {
      if (title) {
        this.listingTitle = title;
      }
      new App(this, this.log);
    });
  }
}
