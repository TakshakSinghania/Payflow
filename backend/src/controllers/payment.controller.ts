import { Request, Response, NextFunction } from 'express';
import * as paymentService from '../services/payment.service';
import { createPaymentSchema } from '../utils/validators';
import { getPaymentEvents } from '../repositories/paymentEvent.repository';
import { getDeliveriesByPaymentId } from '../repositories/webhookDelivery.repository';

export const createPayment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createPaymentSchema.parse(req.body);
    const userId = (req as any).user.id;
    const payment = await paymentService.createPayment(
      userId,
      data.customer_id,
      data.amount,
      data.currency,
      data.metadata ?? {}
    );
    res.status(201).json({ data: payment });
  } catch (err) {
    next(err);
  }
};

export const getPayment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;
    const id = req.params.id as string;
    const payment = await paymentService.getPayment(id, userId);
    res.json({ data: payment });
  } catch (err) {
    next(err);
  }
};

export const listPayments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = parseInt(req.query.offset as string) || 0;
    const payments = await paymentService.listPayments(userId, limit, offset);
    res.json({ data: payments });
  } catch (err) {
    next(err);
  }
};

export const authorizePayment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;
    const id = req.params.id as string;
    const payment = await paymentService.authorizePayment(id, userId);
    res.json({ data: payment });
  } catch (err) {
    next(err);
  }
};

export const capturePayment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;
    const id = req.params.id as string;
    const payment = await paymentService.capturePayment(id, userId);
    res.json({ data: payment });
  } catch (err) {
    next(err);
  }
};

export const cancelPayment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;
    const id = req.params.id as string;
    const payment = await paymentService.cancelPayment(id, userId);
    res.json({ data: payment });
  } catch (err) {
    next(err);
  }
};

export const refundPayment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;
    const id = req.params.id as string;
    const payment = await paymentService.refundPayment(id, userId);
    res.json({ data: payment });
  } catch (err) {
    next(err);
  }
};

/** GET /api/payments/:id/events - timeline of events for a payment */
export const getPaymentEventsController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;
    const id = req.params.id as string;
    // Verify payment belongs to user
    await paymentService.getPayment(id, userId);
    const events = await getPaymentEvents(id);
    res.json({ data: { events } });
  } catch (err) {
    next(err);
  }
};

/** GET /api/payments/:id/deliveries - webhook deliveries for a payment */
export const getPaymentDeliveriesController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;
    const id = req.params.id as string;
    // Verify payment belongs to user
    await paymentService.getPayment(id, userId);
    const deliveries = await getDeliveriesByPaymentId(id);
    res.json({ data: { deliveries } });
  } catch (err) {
    next(err);
  }
};
