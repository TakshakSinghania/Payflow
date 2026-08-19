import { pool } from '../config/database';
import { Pool, PoolClient } from 'pg';
import { WebhookDelivery } from '../models/types';

export const createWebhookDelivery = async (
  endpointId: string,
  eventType: string,
  paymentId: string,
  payload: Record<string, any>,
  queryable: PoolClient | Pool = pool
): Promise<WebhookDelivery> => {
  const result = await queryable.query(
    `INSERT INTO webhook_deliveries (endpoint_id, event_type, payment_id, payload)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [endpointId, eventType, paymentId, payload]
  );
  return result.rows[0];
};

export const getWebhookDeliveryById = async (
  id: string,
  queryable: PoolClient | Pool = pool
): Promise<WebhookDelivery | null> => {
  const result = await queryable.query('SELECT * FROM webhook_deliveries WHERE id = $1', [id]);
  return result.rows[0] || null;
};

export const updateWebhookDelivery = async (
  id: string,
  updates: Partial<WebhookDelivery>,
  queryable: PoolClient | Pool = pool
): Promise<WebhookDelivery> => {
  const setClauses: string[] = [];
  const values: any[] = [];
  let index = 1;

  for (const [key, value] of Object.entries(updates)) {
    setClauses.push(`${key} = $${index}`);
    values.push(value);
    index++;
  }

  setClauses.push(`updated_at = NOW()`);
  values.push(id);

  const result = await queryable.query(
    `UPDATE webhook_deliveries SET ${setClauses.join(', ')} WHERE id = $${index} RETURNING *`,
    values
  );
  return result.rows[0];
};

export const getDeliveriesByPaymentId = async (
  paymentId: string,
  queryable: PoolClient | Pool = pool
): Promise<WebhookDelivery[]> => {
  const result = await queryable.query(
    `SELECT wd.*, we.url as endpoint_url 
     FROM webhook_deliveries wd
     LEFT JOIN webhook_endpoints we ON wd.endpoint_id = we.id
     WHERE wd.payment_id = $1 ORDER BY wd.created_at DESC`,
    [paymentId]
  );
  return result.rows;
};

export const listDeliveries = async (
  userId: string,
  limit = 50,
  offset = 0,
  queryable: PoolClient | Pool = pool
): Promise<{ deliveries: WebhookDelivery[]; total: number }> => {
  const countResult = await queryable.query(
    `SELECT COUNT(*) FROM webhook_deliveries wd
     JOIN webhook_endpoints we ON wd.endpoint_id = we.id
     WHERE we.user_id = $1`,
    [userId]
  );
  const deliveries = await queryable.query(
    `SELECT wd.*, we.url as endpoint_url 
     FROM webhook_deliveries wd
     JOIN webhook_endpoints we ON wd.endpoint_id = we.id
     WHERE we.user_id = $1 
     ORDER BY wd.created_at DESC LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );
  return { deliveries: deliveries.rows, total: parseInt(countResult.rows[0].count) };
};
