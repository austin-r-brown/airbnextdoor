const fs = require('fs');
const { exec } = require('child_process');
const os = require('os');

const fileName = '.env';

const env =
  `SIB_API_KEY=\r\n` +
  `AIRBNB_URL=\r\n` +
  `SEND_FROM_EMAIL=\r\n` +
  `SEND_TO_EMAILS=\r\n` +
  `INTERVAL_MINS=5\r\n`;

const getOpenCommand = () => {
  switch (os.platform()) {
    case 'win32': // Windows
      return 'start';
    case 'darwin': // macOS
      return 'open';
    default: // Linux
      return 'xdg-open';
  }
};

(() => {
  if (!fs.existsSync(fileName)) {
    fs.writeFile(fileName, env, (err) => {
      if (err) {
        console.error('Error writing .env file:', JSON.stringify(err));
      } else {
        console.info('.env file created successfully');

        const command = `${getOpenCommand()} ${fileName}`;
        exec(command, (err) => {
          if (err) {
            console.error('Error opening .env file:', JSON.stringify(err));
          } else {
            console.info('.env file opened successfully');
          }
        });
      }
    });
  }
})();
