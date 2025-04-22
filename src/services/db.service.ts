import { Booking } from '../constants/Booking';
import { BackupFile } from '../constants/types';
import { AirbnbService } from './airbnb.service';
import { LogService } from './log.service';
import * as fs from 'fs';
import * as path from 'path';

const DB_ROOT_DIR = 'db';
const BACKUPS_ROOT_DIR = 'backups';

/** Service for saving and restoring persisted data */
export class DbService {
  private readonly filepath: string;
  private readonly backupsDir: string;
  private lastSavedFile?: string;

  constructor(private readonly log: LogService, private readonly airbnb: AirbnbService) {
    this.filepath = path.join(DB_ROOT_DIR, `${this.airbnb.listingId}.json`);
    this.backupsDir = path.join(DB_ROOT_DIR, BACKUPS_ROOT_DIR, this.airbnb.listingId);
    this.createFolders();
  }

  public async save(bookings: Booking[]): Promise<void> {
    if (bookings.length) {
      await this.backup();
      const serialized = bookings.map((b) => b.toJSON());
      const jsonString = JSON.stringify(serialized, null, 2);

      fs.writeFile(this.filepath, jsonString, 'utf8', (err: any) => {
        if (err) {
          this.log.error(`Error writing to DB file: "${err}"`);
        } else {
          this.log.info('Data saved to DB successfully');
          this.lastSavedFile = jsonString;
          this.backup();
        }
      });
    }
  }

  public load(): Booking[] {
    let result: Booking[] = [];
    try {
      if (fs.existsSync(this.filepath)) {
        const data = fs.readFileSync(this.filepath, 'utf8');
        const jsonData = JSON.parse(data);

        if (Array.isArray(jsonData)) {
          result = jsonData;
        }
      }
    } catch (e: any) {
      this.log.error(`Error reading DB file: "${e}"`);
    }

    if (!result.length) {
      const backup = this.restoreBackup();
      if (backup) {
        result = backup;
      }
    }

    if (result.length) {
      const lastBooking = result[result.length - 1];
      this.airbnb.setCalendarRange(lastBooking.lastNight);

      this.log.info(`Loaded ${result.length} booking(s) from DB for ${this.airbnb.listingTitle}`);
    }

    return result.map((b) => new Booking(b));
  }

  private backup(): Promise<void> {
    return new Promise<void>((resolve) => {
      if (this.lastSavedFile) {
        fs.copyFile(this.filepath, path.join(this.backupsDir, `${Date.now()}.json`), (err: any) => {
          if (err) {
            this.log.error(`Error creating backup of DB file: "${err}"`);
          } else {
            this.cleanupBackupFiles();
          }
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  private loadBackupFiles(): BackupFile[] {
    if (fs.existsSync(this.backupsDir)) {
      return fs
        .readdirSync(this.backupsDir)
        .filter((f: string) => f.endsWith('.json'))
        .map((filename: string) => ({
          path: path.join(this.backupsDir, filename),
          createdAt: this.getDateFromFile(filename),
        }))
        .sort((a: BackupFile, b: BackupFile) => b.createdAt.valueOf() - a.createdAt.valueOf());
    }
    return [];
  }

  private restoreBackup(): Booking[] | null {
    const backupFiles = this.loadBackupFiles();
    for (const file of backupFiles) {
      try {
        const backupJson = JSON.parse(fs.readFileSync(file.path, 'utf8'));

        if (Array.isArray(backupJson) && backupJson.length) {
          const date = file.createdAt.toLocaleString();
          this.log.info(`Successfully restored ${date} backup`);
          return backupJson;
        }
      } catch (e: any) {
        this.log.error(`Error reading backup file ${file}: "${e}"`);
      }
    }
    return null;
  }

  private cleanupBackupFiles(): void {
    const oldBackups = this.loadBackupFiles().slice(10);
    oldBackups.forEach((file) => fs.unlinkSync(file.path));
  }

  private getDateFromFile(filename: string): Date {
    const dateFromName = new Date(Number(filename.split('.')[0]));
    if (dateFromName && !isNaN(dateFromName.getTime())) {
      return dateFromName;
    } else {
      return new Date(fs.statSync(path.join(this.backupsDir, filename)).mtime.getTime());
    }
  }

  private createFolders(): void {
    const parts = this.backupsDir.split(path.sep);
    try {
      for (let i = 1; i <= parts.length; i++) {
        const dir = path.join(...parts.slice(0, i));

        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir);
        }
      }
    } catch (e: any) {
      this.log.error(`Error creating folder: "${e.message}"`);
    }
  }
}
