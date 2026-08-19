import pino from 'pino';
import { config } from '../config/env';

export const logger = pino({
  level: config.logLevel,
  transport: config.nodeEnv !== 'production' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
    },
  } : undefined,
});
