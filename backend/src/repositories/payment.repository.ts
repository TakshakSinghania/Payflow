import { pool } from '../config/database';
import { Pool, PoolClient } from 'pg';
import { Payment, PaymentStatus } from '../models/types';

export const createPayment = async (
  userId: string,
  customerId: string,
  amount: number,
  currency: string,
  metadata: Record<string, any> = {},
  queryable: PoolClient | Pool = pool
): Promise<Payment> => {
  const result = await queryable.query(
    `INSERT INTO payments (user_id, customer_id, amount, currency, metadata) 
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [userId, customerId, amount, currency, metadata]
  );
  return result.rows[0];
};

export const getPaymentById = async (
  id: string,
  userId: string,
  queryable: PoolClient | Pool = pool
): Promise<Payment | null> => {
  const result = await queryable.query(
    'SELECT * FROM payments WHERE id = $1 AND user_id = $2',
    [id, userId]
  );
  return result.rows[0] || null;
};

/**
 * Reads and acquires an exclusive row-level lock (FOR UPDATE)
 * on a payment record within an active transaction.
 */
export const getPaymentByIdForUpdate = async (
  id: string,
  userId: string,
  queryable: PoolClient | Pool = pool
): Promise<Payment | null> => {
  const result = await queryable.query(
    'SELECT * FROM payments WHERE id = $1 AND user_id = $2 FOR UPDATE',
    [id, userId]
  );
  return result.rows[0] || null;
};

export const updatePaymentStatus = async (
  id: string,
  status: PaymentStatus,
  queryable: PoolClient | Pool = pool
): Promise<Payment> => {
  const result = await queryable.query(
    'UPDATE payments SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
    [status, id]
  );
  return result.rows[0];
};

export const listPayments = async (
  userId: string,
  limit = 10,
  offset = 0,
  queryable: PoolClient | Pool = pool
): Promise<Payment[]> => {
  const result = await queryable.query(
    'SELECT * FROM payments WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
    [userId, limit, offset]
  );
  return result.rows;
};
