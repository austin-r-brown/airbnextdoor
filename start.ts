import { LogService } from './services/log.service';
import { CoreService } from './services/core.service';

export const startApp = () => {
  const log = new LogService();

  process.env.AIRBNB_URL?.trim()
    .split(',')
    .forEach((url) => {
      new CoreService(url, log);
    });
};
