import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.post('/register', authController.registerHandler);
router.post('/login', authController.loginHandler);
router.get('/me', authMiddleware, authController.getMeHandler);

export default router;

