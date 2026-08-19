import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/crypto';
import { AppError } from '../utils/errors';

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError(401, 'UNAUTHORIZED', 'Missing or invalid token');
    }
    
    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    (req as any).user = decoded;
    next();
  } catch (error) {
    next(new AppError(401, 'UNAUTHORIZED', 'Unauthorized'));
  }
};
