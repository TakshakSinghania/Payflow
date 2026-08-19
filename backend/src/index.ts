import { app } from './app';
import { config } from './config/env';
import { logger } from './utils/logger';
import { runMigrations } from './database/migrations';

const start = async () => {
  try {
    await runMigrations();
    app.listen(config.port, () => {
      logger.info(`Server listening on port ${config.port}`);
    });
  } catch (error) {
    logger.error(error, 'Failed to start server');
    process.exit(1);
  }
};

if (require.main === module) {
  start();
}
