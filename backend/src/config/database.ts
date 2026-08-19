import { Pool, PoolClient } from 'pg';
import { config } from './env';

export const pool = new Pool({
  connectionString: config.databaseUrl,
});

export const query = (text: string, params?: any[]) => {
  return pool.query(text, params);
};

/**
 * Executes a callback within a managed PostgreSQL transaction.
 * Automatically handles client checkout, BEGIN, COMMIT on success,
 * ROLLBACK on error, and client release back to the pool.
 */
export const withTransaction = async <T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      // Log rollback failure if any, but propagate original error
      console.error('Failed to rollback transaction:', rollbackError);
    }
    throw error;
  } finally {
    client.release();
  }
};
