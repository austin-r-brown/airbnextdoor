const fs = require('fs');

const fileName = '.env';

const env = `AIRBNB_API_KEY=\r\n` +
    `SIB_API_KEY=\r\n` + `\r\n` +
    `AIRBNB_LISTING_ID=\r\n` +
    `MONTHS=3\r\n` +
    `INTERVAL_MINS=5\r\n` +
    `SEND_FROM_EMAIL=\r\n` +
    `SEND_TO_EMAILS=\r\n`;

const createEnv = () => {
  if (!fs.existsSync(fileName)) {
    fs.writeFile(fileName, env, (err) => {
      if (err) {
        console.error('Error writing .env file:', JSON.stringify(err));
      } else {
        console.info('.env file created successfully');
      }
    });
  }
};

createEnv();
