import { Router } from 'express';
import * as webhookController from '../controllers/webhook.controller';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

// Endpoints
router.post('/endpoints', webhookController.createEndpoint);
router.get('/endpoints', webhookController.listEndpoints);

// Deliveries
router.get('/deliveries', webhookController.listDeliveriesController);

export default router;
