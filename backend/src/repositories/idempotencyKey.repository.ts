import { query } from '../config/database';
import { IdempotencyKey } from '../models/types';

export const getIdempotencyKey = async (
  key: string,
  userId: string
): Promise<IdempotencyKey | null> => {
  const result = await query(
    'SELECT * FROM idempotency_keys WHERE idempotency_key = $1 AND user_id = $2',
    [key, userId]
  );
  return result.rows[0] || null;
};

export const createIdempotencyKey = async (
  key: string,
  userId: string,
  requestPath: string,
  requestBodyHash: string
): Promise<IdempotencyKey> => {
  const result = await query(
    `INSERT INTO idempotency_keys (idempotency_key, user_id, request_path, request_body_hash)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [key, userId, requestPath, requestBodyHash]
  );
  return result.rows[0];
};

export const updateIdempotencyResponse = async (
  id: string,
  status: number,
  body: Record<string, any>
): Promise<void> => {
  await query(
    'UPDATE idempotency_keys SET response_status = $1, response_body = $2 WHERE id = $3',
    [status, body, id]
  );
};
