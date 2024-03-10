import { Booking } from '../types';
import { AirbnbService } from './airbnb.service';
import { LogService } from './log.service';
import fs from 'fs';
import path from 'path';

/** Service for saving and restoring persisted data */
export class DbService {
  private filename: string;
  private backupsDir: string;
  private fileCreated: boolean = false;

  constructor(private readonly log: LogService, private readonly airbnb: AirbnbService) {
    const backupsRootDir = 'backups';
    this.filename = `${this.airbnb.listingId}.json`;
    this.backupsDir = path.join(backupsRootDir, this.airbnb.listingId);

    [backupsRootDir, this.backupsDir].forEach((dir) => {
      if (!fs.existsSync(dir)) {
        try {
          fs.mkdirSync(dir);
        } catch (err: any) {
          this.log.error(`Error creating folder: "${err.message}"`);
        }
      }
    });
  }

  public async save(bookings: Booking[]) {
    if (bookings.length) {
      await this.backup();
      const jsonString = JSON.stringify(bookings, null, 2);

      fs.writeFile(this.filename, jsonString, 'utf8', (err: any) => {
        if (err) {
          this.log.error(`Error writing to DB file: "${err}"`);
        } else {
          this.log.info('Data saved to DB successfully');
          this.fileCreated = true;
          this.backup();
        }
      });
    }
  }

  public load(): Booking[] {
    let result: Booking[] = [];
    try {
      if (fs.existsSync(this.filename)) {
        const data = fs.readFileSync(this.filename, 'utf8');
        const jsonData = JSON.parse(data);

        if (Array.isArray(jsonData)) {
          result = jsonData;
        }
      }
    } catch (err) {
      this.log.error(`Error reading DB file: "${err}"`);
    }
    if (!result.length) {
      const backup = this.restoreBackup();
      if (backup) {
        result = backup;
        this.save(backup);
      }
    }
    return result;
  }

  private backup(): Promise<void> {
    return new Promise<void>((resolve) => {
      if (this.fileCreated) {
        fs.copyFile(this.filename, path.join(this.backupsDir, `${Date.now()}.json`), (err: any) => {
          if (err) {
            this.log.error(`Error creating backup of DB file: "${err}"`);
          }
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  private restoreBackup(): Booking[] | null {
    if (fs.existsSync(this.backupsDir)) {
      const backupFiles: string[] = fs
        .readdirSync(this.backupsDir)
        .filter((f: string) => f.endsWith('.json'));
      backupFiles.sort((a, b) => this.getDateFromFile(b).valueOf() - this.getDateFromFile(a).valueOf());

      for (const file of backupFiles) {
        try {
          const backupData = fs.readFileSync(path.join(this.backupsDir, file), 'utf8');
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

  private getDateFromFile(filename: string): Date {
    const dateFromName = new Date(Number(filename.split('.')[0]));
    if (dateFromName && !isNaN(dateFromName.getTime())) {
      return dateFromName;
    } else {
      return new Date(fs.statSync(path.join(this.backupsDir, filename)).mtime.getTime());
    }
  }
}
