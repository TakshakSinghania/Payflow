import { Request, Response } from 'express';
import { pool } from '../config/database';

export const healthCheck = async (_req: Request, res: Response) => {
  let dbStatus = 'ok';
  let redisStatus = 'ok';

  try {
    await pool.query('SELECT 1');
  } catch {
    dbStatus = 'error';
  }

  const status = dbStatus === 'ok' && redisStatus === 'ok' ? 'ok' : 'degraded';
  const code = status === 'ok' ? 200 : 503;

  res.status(code).json({
    status,
    timestamp: new Date().toISOString(),
    services: {
      database: dbStatus,
      redis: redisStatus,
    },
    version: '1.0.0',
  });
};
