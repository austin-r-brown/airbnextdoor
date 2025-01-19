import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { App } from '../src/app';
import { LogService } from '../src/services/log.service';
import { airbnbGetResonse, generateCalendar } from './mock-data';
import { MS_IN_DAY, MS_IN_MINUTE, NOTIFY_DEBOUNCE_TIME } from '../src/constants/constants';
import { BookingChangeType } from '../src/constants/enums';

const mockListingId = '12345';
const envMock = {
  SIB_API_KEY: '000000000000000000000000000000000000000',
  AIRBNB_URL: `https://www.airbnb.com/rooms/${mockListingId}?adults=1&category_tag=Tag`,
  SEND_FROM_EMAIL: 'sender@none.com',
  SEND_TO_EMAILS: 'recipient1@none.com, recipient2@none.com',
  INTERVAL_MINS: '0.5',
};

describe('App', () => {
  let app: App;
  let intervalTime: number;
  let axiosMock: MockAdapter;
  let emailApiMock: jest.Mock;

  let logServiceSpy: jest.Mocked<LogService>;
  let icalInitSpy: jest.SpyInstance;
  let icalAddEventSpy: jest.SpyInstance;
  let icalUpdateEventsSpy: jest.SpyInstance;
  let dbLoadSpy: jest.SpyInstance;
  let dbSaveSpy: jest.SpyInstance;
  let watchdogSendSpy: jest.SpyInstance;

  const mockCalendarResponse = (
    startDaysFromToday: number = 0,
    bookingLength: number = 0,
    numberOfBookings: number = 0
  ) => {
    axiosMock
      .onGet(
        'https://www.airbnb.com/api/v3/PdpAvailabilityCalendar/8f08e03c7bd16fcad3c92a3592c19a8b559a0d0855a84028d1163d4733ed9ade'
      )
      .reply(200, {
        data: {
          merlin: {
            pdpAvailabilityCalendar: {
              calendarMonths: generateCalendar(startDaysFromToday, bookingLength, numberOfBookings),
            },
          },
        },
      });
  };

  beforeAll(() => {
    require('dotenv').config();
    jest.useFakeTimers();
  });

  // afterAll(() => {
  //   jest.restoreAllMocks();
  // });

  beforeEach(() => {
    process.env = envMock;
    intervalTime = Number(envMock.INTERVAL_MINS) * MS_IN_MINUTE;
    logServiceSpy = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      success: jest.fn(),
      notification: jest.fn(),
    } as unknown as jest.Mocked<LogService>;

    // jest.resetModules();
    // console.log(logServiceSpy.error.mock.calls);
    // console.log(mockAxios.history.get[0].data);

    axiosMock = new MockAdapter(axios);
    emailApiMock = jest.fn().mockResolvedValue({});

    app = new App(logServiceSpy);

    Object.assign(app['email'], { api: { sendTransacEmail: emailApiMock } });

    axiosMock.onGet(`https://www.airbnb.com/rooms/${mockListingId}`).reply(200, airbnbGetResonse);
    axiosMock.onGet('https://www.google.com').reply(200, {});

    icalInitSpy = jest.spyOn(app['ical'], 'init').mockImplementationOnce(() => {});
    icalAddEventSpy = jest.spyOn(app['ical'], 'addEvent').mockImplementation(() => undefined);
    icalUpdateEventsSpy = jest.spyOn(app['ical'], 'updateEvents').mockImplementation(() => {});
    dbLoadSpy = jest.spyOn(app['db'], 'load').mockImplementation(() => []);
    dbSaveSpy = jest.spyOn(app['db'], 'save').mockImplementation(async () => {});
    watchdogSendSpy = jest.spyOn(app['watchdog'], 'sendNotification' as any).mockImplementation(() => {});
  });

  afterEach(() => {
    axiosMock.reset();
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  it('should initialize the app with no errors', async () => {
    mockCalendarResponse();
    await app.init();

    expect(app['isInitialized']).toBe(true);
    expect(logServiceSpy.error).not.toHaveBeenCalled();
  });

  it('should intialize the airbnb service', async () => {
    await app.init();

    expect(app['airbnb'].listingTitle).toBe('Train at the X-Mansion');
    expect(app['airbnb'].listingId).toBe(mockListingId);
    expect(app['airbnb'].listingUrl).toBe(envMock.AIRBNB_URL.split('?')[0]);
    expect(app['airbnb'].checkInTime).toEqual([15, 0]);
    expect(app['airbnb'].checkOutTime).toEqual([11, 0]);
  });

  it('should send an email successfully', async () => {
    await app.init();
    const subject = 'Test Subject';
    const notifications = ['Notification 1', 'Notification 2'];
    const footer = 'Test Footer';

    app['email'].send(subject, notifications, footer);

    expect(emailApiMock).toHaveBeenCalledWith(
      expect.objectContaining({
        subject,
        apiKey: envMock.SIB_API_KEY,
        sender: { email: envMock.SEND_FROM_EMAIL },
        to: [{ email: 'recipient1@none.com' }, { email: 'recipient2@none.com' }],
        htmlContent: expect.stringContaining(footer),
      })
    );
  });

  it('should continuously check for new dates', async () => {
    const airbnbFetchSpy = jest.spyOn(app['airbnb'], 'fetchCalendar');
    await app.init();

    expect(airbnbFetchSpy).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(intervalTime);
    expect(airbnbFetchSpy).toHaveBeenCalledTimes(2);
  });

  it('should send emails about calendar changes', async () => {
    mockCalendarResponse(0, 5, 1);
    jest.spyOn(app, 'run');
    await app.init();
    jest.advanceTimersByTime(NOTIFY_DEBOUNCE_TIME);

    expect(app.run).toHaveBeenCalledTimes(1);
    expect(emailApiMock).toHaveBeenCalledWith(
      expect.objectContaining({
        htmlContent: expect.stringContaining(BookingChangeType.New),
      })
    );

    mockCalendarResponse(0, 0, 0);
    jest.advanceTimersByTime(intervalTime + NOTIFY_DEBOUNCE_TIME);
    expect(app.run).toHaveBeenCalledTimes(2);

    // expect(emailApiMock).toHaveBeenCalledWith(
    //   expect.objectContaining({
    //     htmlContent: expect.stringContaining(BookingChangeType.Cancelled),
    //   })
    // );
  });

  it('should send an email in the morning if a booking starts that day', async () => {
    const time = new Date();
    time.setHours(8);
    jest.setSystemTime(time);
    mockCalendarResponse(0, 5, 1);

    await app.init();
    jest.advanceTimersByTime(NOTIFY_DEBOUNCE_TIME);
    emailApiMock.mockClear();
    jest.advanceTimersByTime(MS_IN_MINUTE * 60);

    expect(emailApiMock).toHaveBeenCalledTimes(1);
    expect(emailApiMock).toHaveBeenCalledWith(
      expect.objectContaining({
        htmlContent: expect.stringContaining('<span class="title">Starting Today</span>'),
      })
    );
  });

  it('should send an email in the morning if a booking ends that day', async () => {
    mockCalendarResponse(0, 2, 1);
    await app.init();
    jest.advanceTimersByTime(NOTIFY_DEBOUNCE_TIME);
    emailApiMock.mockClear();

    const time = new Date(Date.now() + MS_IN_DAY * 2);
    time.setHours(8);
    jest.setSystemTime(time);
    jest.advanceTimersByTime(MS_IN_DAY);

    expect(emailApiMock).toHaveBeenCalledTimes(1);
    expect(emailApiMock).toHaveBeenCalledWith(
      expect.objectContaining({
        htmlContent: expect.stringContaining('<span class="title">Ending Today</span>'),
      })
    );
  });
});
