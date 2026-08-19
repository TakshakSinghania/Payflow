import { Router } from 'express';
import authRoutes from './auth.routes';
import paymentRoutes from './payment.routes';
import webhookRoutes from './webhook.routes';
import simulationRoutes from './simulation.routes';
import healthRoutes from './health.routes';
import eventRoutes from './event.routes';
import metricsRoutes from './metrics.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/payments', paymentRoutes);
router.use('/webhooks', webhookRoutes);
router.use('/simulation', simulationRoutes);
router.use('/health', healthRoutes);
router.use('/events', eventRoutes);
router.use('/metrics', metricsRoutes);

export default router;
