import { pool } from '../config/database';
import { Pool, PoolClient } from 'pg';
import { PaymentEvent } from '../models/types';

export const createPaymentEvent = async (
  paymentId: string,
  eventType: string,
  payload: Record<string, any> = {},
  queryable: PoolClient | Pool = pool
): Promise<PaymentEvent> => {
  const result = await queryable.query(
    'INSERT INTO payment_events (payment_id, event_type, payload) VALUES ($1, $2, $3) RETURNING *',
    [paymentId, eventType, payload]
  );
  return result.rows[0];
};

export const getPaymentEvents = async (
  paymentId: string,
  queryable: PoolClient | Pool = pool
): Promise<PaymentEvent[]> => {
  const result = await queryable.query(
    'SELECT * FROM payment_events WHERE payment_id = $1 ORDER BY created_at ASC',
    [paymentId]
  );
  return result.rows;
};
