import { Queue } from 'bullmq';
import { redis } from './redis';

export const webhookQueue = new Queue('webhook-deliveries', {
  connection: redis,
});
