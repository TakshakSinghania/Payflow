import { Request, Response, NextFunction } from 'express';
import { register, login } from '../services/auth.service';
import { registerSchema, loginSchema } from '../utils/validators';

export const registerHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = registerSchema.parse(req.body);
    const result = await register(data.email, data.password);
    res.status(201).json({ data: result });
  } catch (err) {
    next(err);
  }
};

export const loginHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = loginSchema.parse(req.body);
    const result = await login(data.email, data.password);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
};

export const getMeHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;
    const { getMe } = await import('../services/auth.service');
    const user = await getMe(userId);
    res.json({ data: { user } });
  } catch (err) {
    next(err);
  }
};

