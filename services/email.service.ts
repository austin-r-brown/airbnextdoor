const SibApiV3Sdk = require('sib-api-v3-sdk');
import { offsetDay, getTodayIso } from '../date.helpers';
import { Booking, EmailConfig } from '../types';

require('dotenv').config();
const { SIB_API_KEY, SEND_FROM_EMAIL, SEND_TO_EMAILS } = process.env;
const emailApi = new SibApiV3Sdk.TransactionalEmailsApi();
SibApiV3Sdk.ApiClient.instance.authentications['api-key'].apiKey = SIB_API_KEY?.trim();

const smtpEmailConfig: EmailConfig = {
  sender: { email: SEND_FROM_EMAIL?.trim() ?? '' },
  to: SEND_TO_EMAILS?.trim().split(',').map((e) => ({ email: e.trim() })) ?? [],
  subject: 'Nextdoor Airbnb Updates',
};

export const formatDateForEmail = (date: string): string => {
  const [y, m, d] = date.split('-');
  return `${Number(m)}/${Number(d)}/${y.slice(2)}`;
};

export const formatBookingForEmail = (booking: Booking): string => {
  const [startDate, endDate] = [booking.firstNight, offsetDay(booking.lastNight, 1)].map(formatDateForEmail);
  return `[Start Date: ${startDate}, End Date: ${endDate}]`;
};

const debouncedSend = (delay: number) => {
  let timer: NodeJS.Timeout;
  let emailsBuffer: string[] = [];
  let latestBookings: Booking[];

  return (email: string, bookings: Booking[]) => {
    clearTimeout(timer);

    emailsBuffer = emailsBuffer.concat(email);
    latestBookings = bookings;

    timer = setTimeout(() => {
      sendEmail.apply(this, [emailsBuffer, latestBookings]);
      emailsBuffer = [];
    }, delay);
  };
};

const sendEmail = (emails: string[], bookings: Booking[]) => {
  const currentBookings = bookings.length
    ? '<h3>Current Bookings:</h3>' +
      bookings
        .map((b) => {
          const today = getTodayIso();
          const isActive = b.firstNight <= today && b.lastNight >= offsetDay(today, -1);
          return isActive ? `<b>${formatBookingForEmail(b)}</b>` : formatBookingForEmail(b);
        })
        .join('<br>')
    : '';

  const joinedEmails = [...emails, currentBookings].join('<br><br>');

  console.info('******************** Sending Emails: ********************');
  console.info(joinedEmails);

  if (!SIB_API_KEY || !SEND_FROM_EMAIL || !SEND_TO_EMAILS) {
    console.error(`
    SIB API Key and Email Addresses must be provided in .env file to send emails.
    `);
  } else {
    smtpEmailConfig.htmlContent = joinedEmails;

    emailApi.sendTransacEmail(smtpEmailConfig).then(
      (data: any) => {
        console.info(`Email Sent successfully. Returned data: ${JSON.stringify(data)}`);
      },
      (err: Error) => {
        console.error(err);
      }
    );
  }
};

export const debouncedSendEmail = debouncedSend(1000);
