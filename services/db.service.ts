import { Booking } from '../types';
const fs = require('fs');
const path = require('path');

const fileName: string = 'bookings.json';
const filePath: string = path.join(__dirname, fileName);

const saveToDb = (bookings: Booking[]) => {
  if (bookings.length) {
    const jsonString = JSON.stringify(bookings, null, 2);

    fs.writeFile(filePath, jsonString, 'utf8', (err: any) => {
      if (err) {
        console.error('Error writing to DB file:', JSON.stringify(err));
      } else {
        console.info('Bookings saved to DB successfully');
      }
    });
  }
};

const debouncedSave = (delay: number) => {
  let timer: NodeJS.Timeout;
  let latestData: Booking[];

  return (jsonData: Booking[]) => {
    clearTimeout(timer);
    latestData = jsonData;

    timer = setTimeout(() => {
      saveToDb.apply(this, [latestData]);
    }, delay);
  };
};

export const restoreFromDb = (): Booking[] => {
  let result: Booking[] = [];
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      const jsonData = JSON.parse(data);

      if (Array.isArray(jsonData)) {
        result = jsonData;
      }
    }
  } catch (err) {
    console.error('Error reading DB file:', err);
  }
  return result;
};

export const debouncedSaveToDb = debouncedSave(1000);
