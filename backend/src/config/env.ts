import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  databaseUrl: process.env.NODE_ENV === 'test' 
    ? (process.env.TEST_DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/payflow_test')
    : (process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/payflow'),
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  jwtSecret: process.env.JWT_SECRET || 'supersecretkey_change_in_prod',
  logLevel: process.env.LOG_LEVEL || 'info',
  nodeEnv: process.env.NODE_ENV || 'development'
};
