import { Router } from 'express';
import { listEvents } from '../controllers/event.controller';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);
router.get('/', listEvents);

export default router;
