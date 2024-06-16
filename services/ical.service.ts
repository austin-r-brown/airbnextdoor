import ical, { ICalCalendar, ICalCalendarMethod } from 'ical-generator';
import { AirbnbService } from './airbnb.service';
import { Booking } from '../types';
import { getIsoDate, offsetDay } from '../helpers/date.helper';
import { LogService } from './log.service';
import express from 'express';
import os from 'os';
import { formatDate } from '../helpers/email.helper';

const PORT = 3000;
const ICS_FILE = 'calendar.ics';

export class iCalService {
  private readonly calendar: ICalCalendar = ical({ method: ICalCalendarMethod.REQUEST });
  private readonly server = express();

  constructor(private log: LogService, private airbnb: AirbnbService) {}

  public init() {
    this.calendar.name(`${this.airbnb.listingTitle} Calendar`);
    this.startServer();
  }

  public updateEvents(bookings: Booking[]) {
    this.calendar.clear();

    bookings.forEach((booking) => {
      if (!booking.isBlockedOff) {
        const checkIn = booking.firstNight;
        const checkOut = offsetDay(booking.lastNight, 1);
        const bookedOn = booking.createdAt ? new Date(booking.createdAt).toLocaleString() : '';
        const start = new Date(`${checkIn}T15:00:00`);
        const end = new Date(`${checkOut}T11:00:00`);

        this.calendar.createEvent({
          start: start.toUTCString(),
          end: end.toUTCString(),
          summary: `Airbnb Booking`,
          description: `Check In: ${formatDate(checkIn)}\nCheck Out: ${formatDate(
            checkOut
          )}\nBooked On: ${bookedOn}`,
          location: this.airbnb.listingTitle,
          url: this.airbnb.listingUrl,
        });
      }
    });
  }

  private startServer() {
    this.server.get(`/${ICS_FILE}`, (req, res) => {
      res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${ICS_FILE}"`);
      res.send(this.calendar.toString());
    });

    this.server.listen(PORT, () => {
      this.log.info(`iCal file available at http://${this.localIPAddress}:${PORT}/${ICS_FILE}`);
    });
  }

  private get localIPAddress(): string {
    const interfaces = os.networkInterfaces();
    for (const iface in interfaces) {
      const ifaceInfo = interfaces[iface];
      if (ifaceInfo) {
        for (const alias of ifaceInfo) {
          if (alias.family === 'IPv4' && !alias.internal && alias.address.startsWith('192.168')) {
            return alias.address;
          }
        }
      }
    }
    return '127.0.0.1';
  }
}
