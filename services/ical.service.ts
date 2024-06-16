import ical, { ICalCalendar, ICalCalendarMethod } from 'ical-generator';
import { AirbnbService } from './airbnb.service';
import { Booking } from '../types';
import { offsetDay } from '../helpers/date.helper';
import { LogService } from './log.service';
import express from 'express';

const PORT = 3000;

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
        const start = new Date(`${booking.firstNight}T15:00:00`);
        const end = new Date(`${offsetDay(booking.lastNight, 1)}T11:00:00`);

        this.calendar.createEvent({
          start: start.toUTCString(),
          end: end.toUTCString(),
          summary: `Airbnb Booking`,
          location: this.airbnb.listingTitle,
          url: this.airbnb.listingUrl,
        });
      }
    });
  }

  private startServer() {
    this.server.get('/calendar.ics', (req, res) => {
      res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="calendar.ics"');
      res.send(this.calendar.toString());
    });

    this.server.listen(PORT, () => {
      this.log.info(`iCal server is running at http://127.0.0.1:${PORT}`);
    });
  }
}
