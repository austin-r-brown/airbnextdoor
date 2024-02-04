# airbnextdoor

This application is designed to send email updates when the booked dates change on a specified Airbnb listing. To use, you will first need to install the latest version of Node (https://nodejs.org/en/download).

Next, you will need to create a .env file.

Here is the .env structure:

```
AIRBNB_API_KEY=Api Key Goes Here
SIB_API_KEY=Api Key Goes Here

AIRBNB_LISTING_ID=Listing Id Goes Here
MONTHS=Number Of Months From Todays Date That Will Be Checked
INTERVAL_MINS=Number of Minutes Between Each Check
SEND_FROM_EMAIL=email.to.send.from@domain.com
SEND_TO_EMAILS=email.to.send.to.@domain.com
```

 ### For the Airbnb API Key:
- Go to to any Airbnb Listing in a Desktop Web browser
- Open up the developer console and find a GET request that shows a `MerlinQuery` in the preview. (Object will look something like `data.merlin.__typename: "MerlinQuery"`)
- Use the value from the request header called `X-Airbnb-Api-Key`

### For the SIB (Email) Api Key:
- Sign up for a Brevo account at https://brevo.com (I was able to do a free account for this)
- Go to the API keys page (https://app.brevo.com/settings/keys/api) and click 'Generate a new API key'

### For the Send To Emails:
- Either single email address or multiple emails separated by comma can be specified here for the notifications to be sent to


That's it. After running `npm install` and `npm start` the application should be ready to go. You'll want it running on a machine that is always on. I have this running on my Plex Server. The booking data retrieved from Airbnb is saved to the hard disk and will be restored automatically if the script should be restarted.

### A couple other things to note
This is a beta application in very early testing stages, and it is only a best approximation using the data from the calendar shown when booking your stay. For example, if multiple stays are already booked back to back before running this for the first time, or if multiple stays are booked back to back within however many minutes that the interval is set to, then the application will register it as a single booking.
