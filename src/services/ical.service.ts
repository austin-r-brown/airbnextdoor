import ical, { ICalCalendar, ICalCalendarMethod, ICalEvent, ICalEventData } from 'ical-generator';
import { AirbnbService } from './airbnb.service';
import { Booking } from '../constants/Booking';
import { LogService } from './log.service';
import express from 'express';
import { NetworkService } from './network.service';

const PORT = 3001;
const ICS_FILENAME = 'calendar.ics';

/** Service for generating and serving iCal data for calendar subscription */
export class iCalService {
  private readonly calendar: ICalCalendar = ical({ method: ICalCalendarMethod.REQUEST });
  private readonly server = express();

  private bookingStartTime: string = '';
  private bookingEndTime: string = '';

  constructor(
    private readonly log: LogService,
    private readonly airbnb: AirbnbService,
    private readonly network: NetworkService
  ) {}

  public init(): void {
    this.calendar.name(`Airbnb: ${this.airbnb.listingTitle}`);

    const [checkInH, checkInM] = this.airbnb.checkInTime;
    const [checkOutH, checkOutM] = this.airbnb.checkOutTime;
    const [startH, startM, endH, endM] = [checkInH, checkInM, checkOutH, checkOutM].map((num) =>
      `${num ?? 0}`.padStart(2, '0')
    );
    this.bookingStartTime = `${startH}:${startM}`;
    this.bookingEndTime = `${endH}:${endM}`;

    this.startServer();
  }

  public updateEvents(bookings: Booking[]): void {
    this.calendar.clear();
    bookings.forEach((b) => this.addEvent(b));
  }

  public addEvent(booking: Booking): ICalEvent | undefined {
    if (booking.isBlockedOff) {
      return;
    }

    const start = new Date(`${booking.checkIn}T${this.bookingStartTime}:00`);
    const end = new Date(`${booking.checkOut}T${this.bookingEndTime}:00`);

    const event: ICalEventData = {
      start: start.toUTCString(),
      end: end.toUTCString(),
      summary: 'Airbnb Booking',
      location: this.airbnb.listingTitle,
      url: this.airbnb.listingUrl,
    };

    if (booking.createdAt) {
      event.description = `Booked On: ${new Date(booking.createdAt).toLocaleString(undefined, {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })}`;
    }

    return this.calendar.createEvent(event);
  }

  private startServer(): void {
    this.server.get(`/${ICS_FILENAME}`, (_, res) => {
      res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${ICS_FILENAME}"`);
      res.send(this.calendar.toString());
    });

    this.server.listen(PORT, () => {
      this.log.info(`iCal file available at http://${this.network.ipAddress}:${PORT}/${ICS_FILENAME}`);
    });
  }
}
