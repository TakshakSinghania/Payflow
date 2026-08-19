import { Request, Response, NextFunction } from 'express';
import * as simulationService from '../services/simulation.service';
import { z } from 'zod';

const flags = ['PAYMENT_FAILURE', 'WEBHOOK_FAILURE', 'SLOW_WEBHOOK', 'RANDOM_FAILURE'] as const;

export const setFailureMode = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      flag: z.enum(flags),
      value: z.boolean(),
    });
    const data = schema.parse(req.body);
    await simulationService.setFailureMode(data.flag, data.value);
    res.json({ data: { success: true, flag: data.flag, value: data.value } });
  } catch (err) {
    next(err);
  }
};

/** GET /api/simulation/config - returns all simulation flag states */
export const getSimulationConfig = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const config: Record<string, boolean> = {};
    for (const flag of flags) {
      config[flag] = await simulationService.getFailureMode(flag);
    }
    res.json({ data: config });
  } catch (err) {
    next(err);
  }
};

/** POST /api/simulation/config - bulk update simulation flags */
export const updateSimulationConfig = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.record(z.enum(flags), z.boolean());
    const data = schema.parse(req.body);
    for (const [flag, value] of Object.entries(data)) {
      await simulationService.setFailureMode(flag, value);
    }
    // Return current config
    const config: Record<string, boolean> = {};
    for (const flag of flags) {
      config[flag] = await simulationService.getFailureMode(flag);
    }
    res.json({ data: config });
  } catch (err) {
    next(err);
  }
};
