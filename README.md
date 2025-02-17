# airbnextdoor

This application is designed to keep track of a specified Airbnb listing's bookings by assuming check in and check out dates based on current booking availability. Notifications sent via email include:
- New, cancelled, extended or shortened bookings in real time
- Guests expected to be arriving or leaving
- Every notification includes a full list of current/future bookings

Additionally, an iCal file is hosted which can be used to view the bookings on your preferred calendar app.

### Installation

- To use, you will first need to install Node if you do not already have it (https://nodejs.org/en/download). The current known compatible versions are 18.15.0 - 20.10.0, but the latest version will most likely be fine.

- Next, you will need to run the `npm install` command from your terminal. If on Windows, you may simply open the `Install.bat` file in the folder labeled 'setup' and this command will be run automatically.

- After running the install command, there should now be a file called `.env` in the main folder which should open automatically after the installation completes. (If it does not and you are unable to find it, try opening the main folder in a text editor like Sublime Text (https://www.sublimetext.com) and then selecting `.env` from the left pane. On Windows, it can be opened with Notepad.)

- Here is what the file contents should look like. Some of these values will need to be filled in which I will guide you through below.

```
SIB_API_KEY=
AIRBNB_URL=
SEND_FROM_EMAIL=
SEND_TO_EMAILS=
INTERVAL_MINS=5
```

### Setup: The .env File

#### SIB_API_KEY

This is the API key needed for the app to send notification emails. If no API key is provided, the app will still run but no emails will be sent.

- Sign up for a Brevo account at https://brevo.com (I was able to do a free account for this)
- Go to the API keys page (https://app.brevo.com/settings/keys/api) and click 'Generate a new API key'
- Copy the API key you created and paste it to the right of the equals sign for `SIB_API_KEY` in your .env file

#### AIRBNB_URL

This is the URL for the Airbnb listing that you would like to track.

- Copy the URL and paste it to the right of the equals sign for `AIRBNB_URL` in your .env file
- Alternatively, if you have the listing ID you can use that here instead

#### SEND_FROM_EMAIL

The email address you would like the emails to appear to have been sent from. If no email address is provided, the app will still run but no emails will be sent.

#### SEND_TO_EMAILS

The email address you would like the notifications to be sent to. Either single email address or multiple emails separated by comma can be entered here. If no email address is provided, the app will still run but no emails will be sent.

#### INTERVAL_MINS

This number determines how many minutes the app will wait between each time it checks Airbnb for new bookings. By default, this value is 5 minutes, with a minimum of 30 seconds and a maximum of 12 hours.

### Starting The App

Once you've filled these in and saved to the .env file, the application should be ready to go. Now you may run the `npm start` command from your terminal, or if on Windows simply open the `Start.bat` file in the folder labeled 'setup'. You'll want it running on a machine that is always on. I personally use a Raspberry Pi to run it as a service. The booking data retrieved from Airbnb is saved to the hard disk and will be restored automatically should the application be restarted.

### Setup: iCal Calendar Events

After you start the app, there should be an iCal file hosted from your servers localhost at port 3001. This can be used to automatically update your preferred calendar app with events representing the Airbnb bookings. To set this up on an iPhone, simply add a new calendar on the Calendar app, choose the subscription option, and enter the url shown from the console where this app is running. Since it is being hosted locally, this will only work when both devices are on the same network. Port forwarding can be utilized for access outside the network.

### A couple other things to note

- This is a beta application providing only a best approximation using the data from the calendar shown when booking your stay via Airbnb.com.
- The application may register multiple bookings as a single booking if there are back to back bookings that are either booked while the application is not running or during the interval period (default 5 minutes).
- If dates are blocked off by Airbnb or the host for any other reason, the app may show inaccurate results.
