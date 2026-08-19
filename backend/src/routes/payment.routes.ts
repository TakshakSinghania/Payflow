import { Router } from 'express';
import * as paymentController from '../controllers/payment.controller';
import { authMiddleware } from '../middleware/auth';
import { idempotencyMiddleware } from '../middleware/idempotency';

const router = Router();

router.use(authMiddleware);

router.post('/', idempotencyMiddleware, paymentController.createPayment);
router.get('/', paymentController.listPayments);
router.get('/:id', paymentController.getPayment);
router.get('/:id/events', paymentController.getPaymentEventsController);
router.get('/:id/deliveries', paymentController.getPaymentDeliveriesController);
router.post('/:id/authorize', paymentController.authorizePayment);
router.post('/:id/capture', paymentController.capturePayment);
router.post('/:id/cancel', paymentController.cancelPayment);
router.post('/:id/refund', paymentController.refundPayment);

export default router;
