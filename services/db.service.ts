import { Booking } from '../types';
const fs = require('fs');

const FILE_NAME: string = 'bookings.json';

export class DbService {
  public save(bookings: Booking[]) {
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
