import { Booking } from '../types';
const fs = require('fs');

const FILE_NAME: string = 'bookings.json';
const DEBOUNCE_TIME: number = 1000;

export class DbService {
  private saveDebounceTimer?: NodeJS.Timeout;

  public save(bookings: Booking[]) {
    clearTimeout(this.saveDebounceTimer);

    this.saveDebounceTimer = setTimeout(() => {
      if (bookings.length) {
        const jsonString = JSON.stringify(bookings, null, 2);

        fs.writeFile(FILE_NAME, jsonString, 'utf8', (err: any) => {
          if (err) {
            console.error('Error writing to DB file:', JSON.stringify(err));
          } else {
            console.info('Bookings saved to DB successfully');
          }
        });
      }
    }, DEBOUNCE_TIME);
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
      console.error('Error reading DB file:', err);
    }
    return result;
  }
}
