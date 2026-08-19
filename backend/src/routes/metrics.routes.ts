import { Router } from 'express';
import { getMetrics } from '../controllers/metrics.controller';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);
router.get('/', getMetrics);

export default router;
