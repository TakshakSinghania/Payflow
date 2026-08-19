import { createWebhookEndpoint, getWebhookEndpointsByUserId } from '../repositories/webhookEndpoint.repository';
import { createWebhookDelivery } from '../repositories/webhookDelivery.repository';
import crypto from 'crypto';
import { webhookQueue } from '../config/queue';
import { Pool, PoolClient } from 'pg';
import { pool } from '../config/database';

export const createEndpoint = async (userId: string, url: string) => {
  const secret = 'whsec_' + crypto.randomBytes(24).toString('hex');
  return createWebhookEndpoint(userId, url, secret);
};

export const listEndpoints = async (userId: string) => {
  return getWebhookEndpointsByUserId(userId);
};

/**
 * Inserts webhook delivery records into the database within an active transaction,
 * and returns delivery descriptors for queueing once the transaction commits.
 */
export const recordWebhookDeliveries = async (
  userId: string,
  eventType: string,
  paymentId: string,
  payload: Record<string, any>,
  queryable: PoolClient | Pool = pool
): Promise<string[]> => {
  const endpoints = await getWebhookEndpointsByUserId(userId, queryable);
  const deliveryIds: string[] = [];
  for (const endpoint of endpoints) {
    const delivery = await createWebhookDelivery(endpoint.id, eventType, paymentId, payload, queryable);
    deliveryIds.push(delivery.id);
  }
  return deliveryIds;
};

/**
 * Enqueues delivery jobs to BullMQ after database records have been committed.
 */
export const dispatchWebhookJobs = async (deliveryIds: string[]): Promise<void> => {
  for (const deliveryId of deliveryIds) {
    await webhookQueue.add(
      'deliver-webhook',
      { deliveryId },
      {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      }
    );
  }
};

/**
 * Combined helper for standalone non-transactional callers.
 */
export const enqueueWebhookDelivery = async (
  userId: string,
  eventType: string,
  paymentId: string,
  payload: Record<string, any>
) => {
  const deliveryIds = await recordWebhookDeliveries(userId, eventType, paymentId, payload, pool);
  await dispatchWebhookJobs(deliveryIds);
};
