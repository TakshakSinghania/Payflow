import { Worker } from 'bullmq';
import { redis } from './config/redis';
import {
  getWebhookDeliveryById,
  updateWebhookDelivery,
} from './repositories/webhookDelivery.repository';
import { getFailureMode } from './services/simulation.service';
import { logger } from './utils/logger';
import { generateWebhookSignature } from './utils/crypto';
import { query } from './config/database';

export const processDelivery = async (job: any) => {
  const { deliveryId } = job.data;
  const delivery = await getWebhookDeliveryById(deliveryId);

  if (!delivery) {
    logger.warn({ deliveryId }, 'Delivery record not found');
    return;
  }

  const endpointResult = await query('SELECT * FROM webhook_endpoints WHERE id = $1', [
    delivery.endpoint_id,
  ]);
  const endpoint = endpointResult.rows[0];

  if (!endpoint || !endpoint.is_active) {
    logger.warn({ endpointId: delivery.endpoint_id }, 'Webhook endpoint inactive or not found');
    return;
  }

  const isFailure = await getFailureMode('WEBHOOK_FAILURE');
  const isSlow = await getFailureMode('SLOW_WEBHOOK');

  if (isSlow) {
    await new Promise((res) => setTimeout(res, 5000));
  }

  await updateWebhookDelivery(deliveryId, {
    attempt_count: delivery.attempt_count + 1,
    status: 'PENDING',
  });

  const payloadStr = JSON.stringify(delivery.payload);
  const signature = generateWebhookSignature(payloadStr, endpoint.secret);

  try {
    if (isFailure) {
      throw new Error('Simulation webhook endpoint returned 500 Internal Server Error');
    }

    const response = await fetch(endpoint.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-PayFlow-Signature': signature,
      },
      body: payloadStr,
    });

    const bodyText = await response.text();

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} body: ${bodyText.slice(0, 200)}`);
    }

    await updateWebhookDelivery(deliveryId, {
      status: 'SUCCESS',
      last_response_status: response.status,
      last_response_body: bodyText.slice(0, 1000),
    });

    logger.info({ deliveryId, status: response.status }, 'Webhook delivery succeeded');
  } catch (error: any) {
    logger.error({ deliveryId, error: error.message }, 'Webhook delivery attempt failed');

    await updateWebhookDelivery(deliveryId, {
      error_message: error.message,
    });

    throw error; // Rethrow so BullMQ schedules exponential retry
  }
};

const worker = new Worker('webhook-deliveries', processDelivery, { connection: redis });

worker.on('failed', async (job: any, err) => {
  if (job && job.attemptsMade >= (job.opts?.attempts ?? 5)) {
    logger.error(
      { deliveryId: job.data.deliveryId, attempts: job.attemptsMade },
      'Webhook exhausted all retry attempts, moving to FAILED state'
    );
    await updateWebhookDelivery(job.data.deliveryId, {
      status: 'FAILED',
      error_message: `Exhausted all retries: ${err.message}`,
    });
  }
});

logger.info('Webhook worker started and listening for jobs');

export { worker };
