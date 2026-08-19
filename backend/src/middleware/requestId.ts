import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const reqId = crypto.randomUUID();
  (req as any).reqId = reqId;
  res.setHeader('X-Request-ID', reqId);
  next();
};
