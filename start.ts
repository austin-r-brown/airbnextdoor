import { LogService } from './services/log.service';
import { CoreService } from './services/core.service';

export const startApp = () => {
  //TODO instantiate more services here that don't need a new instance for every url
  const log = new LogService();

  process.env.AIRBNB_URL?.trim()
    .split(',')
    .forEach((url) => {
      new CoreService(url, log);
    });
};
