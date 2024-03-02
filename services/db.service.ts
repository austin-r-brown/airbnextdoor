import { Booking } from '../types';
import { Logger } from './logger.service';
import fs from 'fs';
import path from 'path';

const FILE_NAME: string = 'bookings.json';
const BACKUPS_DIR: string = 'backups';

export class DbService {
  constructor(private readonly log: Logger) {}

  public async save(bookings: Booking[]) {
    if (bookings.length) {
      if (fs.existsSync(FILE_NAME)) {
        await this.backup();
      }
      const jsonString = JSON.stringify(bookings, null, 2);

      fs.writeFile(FILE_NAME, jsonString, 'utf8', (err: any) => {
        if (err) {
          this.log.error(`Error writing to DB file: "${err}"`);
        } else {
          this.log.info('Data saved to DB successfully');
          this.backup();
        }
      });
    }
  }

  public load(): Booking[] {
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
      this.log.error(`Error reading DB file: "${err}"`);
      const backup = this.restoreBackup();
      if (backup) {
        result = backup;
      }
    }
    return result;
  }

  private backup(): Promise<void> {
    return new Promise<void>((resolve) => {
      fs.copyFile(FILE_NAME, path.join(BACKUPS_DIR, `${Date.now()}.json`), (err: any) => {
        if (err) {
          this.log.error(`Error creating backup of DB file: "${err}"`);
        }
        resolve();
      });
    });
  }

  private restoreBackup(): Booking[] | null {
    if (fs.existsSync(BACKUPS_DIR)) {
      const backupFiles: string[] = fs.readdirSync(BACKUPS_DIR).filter((f: string) => f.endsWith('.json'));
      backupFiles.sort((a, b) => this.getDateFromFile(b).valueOf() - this.getDateFromFile(a).valueOf());

      for (const file of backupFiles) {
        try {
          const backupData = fs.readFileSync(path.join(BACKUPS_DIR, file), 'utf8');
          const backupJsonData = JSON.parse(backupData);

          if (Array.isArray(backupJsonData) && backupJsonData.length) {
            const date = this.getDateFromFile(file).toLocaleString();
            this.log.info(`Successfully restored ${date} backup`);
            return backupJsonData;
          }
        } catch (err) {
          this.log.error(`Error reading backup file ${file}: "${err}"`);
        }
      }
    }
    return null;
  }

  private getDateFromFile(fileName: string): Date {
    const dateFromName = new Date(Number(fileName.split('.')[0]));
    if (dateFromName && !isNaN(dateFromName.getTime())) {
      return dateFromName;
    } else {
      return new Date(fs.statSync(path.join(BACKUPS_DIR, fileName)).mtime.getTime());
    }
  }
}
