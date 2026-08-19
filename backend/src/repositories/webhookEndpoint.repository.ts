import { pool } from '../config/database';
import { Pool, PoolClient } from 'pg';
import { WebhookEndpoint } from '../models/types';

export const createWebhookEndpoint = async (
  userId: string,
  url: string,
  secret: string,
  queryable: PoolClient | Pool = pool
): Promise<WebhookEndpoint> => {
  const result = await queryable.query(
    'INSERT INTO webhook_endpoints (user_id, url, secret) VALUES ($1, $2, $3) RETURNING *',
    [userId, url, secret]
  );
  return result.rows[0];
};

export const getWebhookEndpointsByUserId = async (
  userId: string,
  queryable: PoolClient | Pool = pool
): Promise<WebhookEndpoint[]> => {
  const result = await queryable.query(
    'SELECT * FROM webhook_endpoints WHERE user_id = $1 AND is_active = TRUE',
    [userId]
  );
  return result.rows;
};
