import { Request, Response, NextFunction } from 'express';
import * as webhookService from '../services/webhook.service';
import { webhookEndpointSchema } from '../utils/validators';
import { listDeliveries } from '../repositories/webhookDelivery.repository';

export const createEndpoint = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = webhookEndpointSchema.parse(req.body);
    const userId = (req as any).user.id;
    const endpoint = await webhookService.createEndpoint(userId, data.url);
    res.status(201).json({ data: endpoint });
  } catch (err) {
    next(err);
  }
};

export const listEndpoints = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;
    const endpoints = await webhookService.listEndpoints(userId);
    res.json({ data: endpoints });
  } catch (err) {
    next(err);
  }
};

export const listDeliveriesController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const result = await listDeliveries(userId, limit, offset);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
};
