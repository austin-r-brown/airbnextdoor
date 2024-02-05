# airbnextdoor

This application is designed to send email updates when the booked dates change on a specified Airbnb listing. 

- To use, you will first need to install the latest version of Node (https://nodejs.org/en/download).

- Next, you will need to run the `npm install` command from your terminal. If on Windows, you may simply open the `Install.bat` file in the folder labeled 'setup' and this command will be run automatically.

- After running the install command, there should now be a file called `.env` in the main folder. (If it is not visible, try opening the main folder in a text editor like Sublime Text (https://www.sublimetext.com) and then selecting `.env` from the left pane)

- Here is what the file contents should look like. Some of these values will need to be filled in which I will guide you through below.

```
AIRBNB_API_KEY=
SIB_API_KEY=

AIRBNB_LISTING_ID=
MONTHS=3
INTERVAL_MINS=5
SEND_FROM_EMAIL=
SEND_TO_EMAILS=
```

### AIRBNB_API_KEY
This is the API key needed for the app to talk to Airbnb. You do not need to be signed in to Airbnb to retrieve this. 
- Go to to any Airbnb Listing in a desktop Chrome browser
- Open up the Chrome Developer console and select the Network tab
- In the 'Filter' box, type `method:GET` and click Fetch/XHR
- Refresh the page. There should now be a list of items below the filtering you just set. Click any of the filtered items that appear
- Scroll nearly all the way to the bottom of the Headers tab until you find something labeled `X-Airbnb-Api-Key`
- To the right of that label should be a long string of numbers and letters. Copy and paste this immediately to the right of the equals sign for `AIRBNB_API_KEY` in your .env file

![alt text](https://i.ibb.co/y6L000j/Screenshot-2024-02-05-at-10-46-49-AM.png)


### SIB_API_KEY
This is the API key needed for the app to send notification emails.
- Sign up for a Brevo account at https://brevo.com (I was able to do a free account for this)
- Go to the API keys page (https://app.brevo.com/settings/keys/api) and click 'Generate a new API key'
- Copy and paste the API key your created immediately to the right of the equals sign for `SIB_API_KEY` in your .env file


### AIRBNB_LISTING_ID
This is the ID for the Airbnb listing that you would like to track
- Copy the part of the URL after the `airbnb.com/rooms/` and before the first question mark. (`www.airbnb.com/rooms/{THIS IS THE LISTING ID}?...`)


### MONTHS
This number determines how many months from today's date that will be checked for booked dates. Depending on the listing, dates may be blocked off after a certain number of months in the future. Since it is specific to the listing and I haven't yet found a good way to determine this number, you may have to just manually check to see how many months in advance your desired Airbnb listing allows you to book. Otherwise, if the dates are blocked off and the app is checking those dates, it will register as a booking that keeps getting longer every day.


### INTERVAL_MINS
This number determines how many minutes the app will wait between each time it checks for new bookings.


### SEND_FROM_EMAIL
The email address you would like the emails to appear to have been sent from.


### SEND_TO_EMAILS
The email address you would like the notifications to be sent to. Either single email address or multiple emails separated by comma can be entered here.


That's it. The application should be ready to go. Now you may run the `npm start` command from your terminal, or if on Windows simply open the `Start.bat` file in the folder labeled 'setup'. You'll want it running on a machine that is always on. I have this running on my Plex Server. The booking data retrieved from Airbnb is saved to the hard disk and will be restored automatically should the application be restarted.


### A couple other things to note
- This is a beta application in very early testing stages, and it is only a best approximation using the data from the calendar shown when booking your stay.
- If multiple stays are already booked back to back before running this for the first time, or if multiple stays are booked back to back within however many minutes that the interval is set to, then the application will register it as a single booking.
