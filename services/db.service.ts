import { Booking } from '../types';
import { Logger } from './logger.service';
const fs = require('fs');

const FILE_NAME: string = 'bookings.json';

export class DbService {
  constructor(private readonly log: Logger) {}

  public save(bookings: Booking[]) {
    if (bookings.length) {
      const jsonString = JSON.stringify(bookings, null, 2);

      fs.writeFile(FILE_NAME, jsonString, 'utf8', (err: any) => {
        if (err) {
          this.log.error(`Error writing to DB file: ${JSON.stringify(err)}`);
        } else {
          this.log.info('Bookings saved to DB successfully');
        }
      });
    }
  }

  public restore(): Booking[] {
    let result: Booking[] = [];
    try {
      if (fs.existsSync(FILE_NAME)) {
        const data = fs.readFileSync(FILE_NAME, 'utf8');
        const jsonData = JSON.parse(data);

        if (Array.isArray(jsonData)) {
          result = jsonData;
        }
      }
    } catch (err) {
      this.log.error(`Error reading DB file: ${err}`);
    }
    return result;
  }
}
