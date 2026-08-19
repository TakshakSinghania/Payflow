import { Router } from 'express';
import * as simulationController from '../controllers/simulation.controller';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

router.post('/failure', simulationController.setFailureMode);
router.get('/config', simulationController.getSimulationConfig);
router.post('/config', simulationController.updateSimulationConfig);

export default router;
