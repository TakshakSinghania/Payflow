import { PaymentStatus } from '../models/types';
import { idempotencyMiddleware } from '../middleware/idempotency';
import { hashBody } from '../utils/crypto';
import { Request, Response } from 'express';

jest.mock('../config/database', () => {
  const localClient = {
    query: jest.fn().mockResolvedValue({ rows: [] }),
    release: jest.fn(),
  };

  return {
    pool: {
      connect: jest.fn().mockResolvedValue(localClient),
      query: jest.fn().mockResolvedValue({ rows: [] }),
    },
    query: jest.fn().mockResolvedValue({ rows: [] }),
    withTransaction: jest.fn(async (callback) => {
      await localClient.query('BEGIN');
      try {
        const result = await callback(localClient);
        await localClient.query('COMMIT');
        return result;
      } catch (err) {
        await localClient.query('ROLLBACK');
        throw err;
      } finally {
        localClient.release();
      }
    }),
  };
});

jest.mock('../config/redis', () => ({
  redis: {
    incr: jest.fn().mockResolvedValue(1),
    pexpire: jest.fn().mockResolvedValue(1),
    pttl: jest.fn().mockResolvedValue(60000),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    quit: jest.fn().mockResolvedValue('OK'),
  },
}));

jest.mock('../config/queue', () => ({
  webhookQueue: {
    add: jest.fn().mockResolvedValue({ id: 'mock-job-1' }),
  },
}));

import { withTransaction, pool } from '../config/database';
import * as paymentService from '../services/payment.service';
import * as paymentRepo from '../repositories/payment.repository';
import * as eventRepo from '../repositories/paymentEvent.repository';
import * as webhookService from '../services/webhook.service';
import * as simulationService from '../services/simulation.service';
import * as idempotencyRepo from '../repositories/idempotencyKey.repository';

describe('Database Transactions & Atomicity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('commits transaction when all operations succeed', async () => {
    const client = await pool.connect();
    const operation = jest.fn().mockResolvedValue('success_result');

    const result = await withTransaction(operation);

    expect(client.query).toHaveBeenNthCalledWith(1, 'BEGIN');
    expect(operation).toHaveBeenCalledWith(client);
    expect(client.query).toHaveBeenNthCalledWith(2, 'COMMIT');
    expect(client.release).toHaveBeenCalled();
    expect(result).toBe('success_result');
  });

  it('rolls back transaction and releases client when an operation fails', async () => {
    const client = await pool.connect();
    const failingOperation = jest.fn().mockRejectedValue(new Error('DB Constraint Violation'));

    await expect(withTransaction(failingOperation)).rejects.toThrow('DB Constraint Violation');

    expect(client.query).toHaveBeenNthCalledWith(1, 'BEGIN');
    expect(client.query).toHaveBeenNthCalledWith(2, 'ROLLBACK');
    expect(client.release).toHaveBeenCalled();
  });
});

describe('Payment Concurrency & State Row-Locking (SELECT FOR UPDATE)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('executes SELECT FOR UPDATE to lock row prior to status update', async () => {
    const client = await pool.connect();
    const existingPayment = {
      id: 'pay-123',
      user_id: 'usr-1',
      customer_id: 'cus-1',
      amount: 5000,
      currency: 'INR',
      status: PaymentStatus.AUTHORIZED,
      metadata: {},
      created_at: new Date(),
      updated_at: new Date(),
    };

    jest.spyOn(paymentRepo, 'getPaymentByIdForUpdate').mockResolvedValue(existingPayment);
    jest.spyOn(paymentRepo, 'updatePaymentStatus').mockResolvedValue({
      ...existingPayment,
      status: PaymentStatus.CAPTURED,
    });
    jest.spyOn(eventRepo, 'createPaymentEvent').mockResolvedValue({
      id: 'evt-1',
      payment_id: 'pay-123',
      event_type: 'payment.captured',
      payload: {},
      created_at: new Date(),
    });
    jest.spyOn(webhookService, 'recordWebhookDeliveries').mockResolvedValue(['del-1']);
    jest.spyOn(webhookService, 'dispatchWebhookJobs').mockResolvedValue();

    const captured = await paymentService.capturePayment('pay-123', 'usr-1');

    expect(paymentRepo.getPaymentByIdForUpdate).toHaveBeenCalledWith('pay-123', 'usr-1', client);
    expect(paymentRepo.updatePaymentStatus).toHaveBeenCalledWith('pay-123', PaymentStatus.CAPTURED, client);
    expect(captured.status).toBe(PaymentStatus.CAPTURED);
  });

  it('prevents double capture by rejecting non-AUTHORIZED status after lock', async () => {
    const alreadyCapturedPayment = {
      id: 'pay-123',
      user_id: 'usr-1',
      customer_id: 'cus-1',
      amount: 5000,
      currency: 'INR',
      status: PaymentStatus.CAPTURED, // Already captured
      metadata: {},
      created_at: new Date(),
      updated_at: new Date(),
    };

    jest.spyOn(paymentRepo, 'getPaymentByIdForUpdate').mockResolvedValue(alreadyCapturedPayment);

    await expect(paymentService.capturePayment('pay-123', 'usr-1')).rejects.toThrow(
      'Payment cannot transition to CAPTURED from current state: CAPTURED'
    );
  });
});

describe('RANDOM_FAILURE Simulation Mode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('triggers payment failure when RANDOM_FAILURE is enabled and random check < 0.5', async () => {
    jest.spyOn(simulationService, 'getFailureMode').mockImplementation(async (flag) => {
      if (flag === 'RANDOM_FAILURE') return true;
      return false;
    });

    const initialPayment = {
      id: 'pay-random-1',
      user_id: 'usr-1',
      customer_id: 'cus-1',
      amount: 1000,
      currency: 'INR',
      status: PaymentStatus.CREATED,
      metadata: {},
      created_at: new Date(),
      updated_at: new Date(),
    };

    jest.spyOn(paymentRepo, 'createPayment').mockResolvedValue(initialPayment);
    jest.spyOn(eventRepo, 'createPaymentEvent').mockResolvedValue({
      id: 'evt-fail',
      payment_id: 'pay-random-1',
      event_type: 'payment.failed',
      payload: { reason: 'Simulation random 50% failure' },
      created_at: new Date(),
    });
    jest.spyOn(paymentRepo, 'updatePaymentStatus').mockResolvedValue({
      ...initialPayment,
      status: PaymentStatus.FAILED,
    });
    jest.spyOn(webhookService, 'recordWebhookDeliveries').mockResolvedValue([]);
    jest.spyOn(webhookService, 'dispatchWebhookJobs').mockResolvedValue();

    // Deterministically inject random value < 0.5 (triggers failure)
    const result = await paymentService.createPayment(
      'usr-1',
      'cus-1',
      1000,
      'INR',
      {},
      () => 0.2
    );

    expect(result.status).toBe(PaymentStatus.FAILED);
  });

  it('succeeds when RANDOM_FAILURE is enabled and random check >= 0.5', async () => {
    jest.spyOn(simulationService, 'getFailureMode').mockImplementation(async (flag) => {
      if (flag === 'RANDOM_FAILURE') return true;
      return false;
    });

    const initialPayment = {
      id: 'pay-random-2',
      user_id: 'usr-1',
      customer_id: 'cus-1',
      amount: 1000,
      currency: 'INR',
      status: PaymentStatus.CREATED,
      metadata: {},
      created_at: new Date(),
      updated_at: new Date(),
    };

    jest.spyOn(paymentRepo, 'createPayment').mockResolvedValue(initialPayment);
    jest.spyOn(paymentRepo, 'updatePaymentStatus').mockResolvedValue({
      ...initialPayment,
      status: PaymentStatus.PENDING,
    });
    jest.spyOn(eventRepo, 'createPaymentEvent').mockResolvedValue({
      id: 'evt-pending',
      payment_id: 'pay-random-2',
      event_type: 'payment.pending',
      payload: {},
      created_at: new Date(),
    });
    jest.spyOn(webhookService, 'recordWebhookDeliveries').mockResolvedValue([]);
    jest.spyOn(webhookService, 'dispatchWebhookJobs').mockResolvedValue();

    // Deterministically inject random value >= 0.5 (succeeds)
    const result = await paymentService.createPayment(
      'usr-1',
      'cus-1',
      1000,
      'INR',
      {},
      () => 0.8
    );

    expect(result.status).toBe(PaymentStatus.PENDING);
  });
});

describe('Idempotency 23505 Race Condition Handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('re-fetches existing key and returns cached response on Postgres 23505 unique collision', async () => {
    const payload = { amount: 5000, currency: 'INR' };
    const computedHash = hashBody(payload);

    const req: any = {
      method: 'POST',
      header: jest.fn().mockReturnValue('key-race-1'),
      user: { id: 'user-race-1' },
      body: payload,
      path: '/api/payments',
    };
    const res: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    // First lookup finds nothing (race before insert)
    jest.spyOn(idempotencyRepo, 'getIdempotencyKey')
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'key-id-1',
        idempotency_key: 'key-race-1',
        user_id: 'user-race-1',
        request_path: '/api/payments',
        request_body_hash: computedHash,
        response_status: 201,
        response_body: { id: 'pay-cached-1', status: 'PENDING' },
        created_at: new Date(),
      });

    // Concurrent insert throws 23505 unique violation
    const pgError: any = new Error('duplicate key value violates unique constraint');
    pgError.code = '23505';
    jest.spyOn(idempotencyRepo, 'createIdempotencyKey').mockRejectedValue(pgError);

    await idempotencyMiddleware(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ id: 'pay-cached-1', status: 'PENDING' });
  });

  it('returns 409 Conflict if concurrent request is still in-flight during 23505 recovery', async () => {
    const payload = { amount: 5000, currency: 'INR' };
    const computedHash = hashBody(payload);

    const req: any = {
      method: 'POST',
      header: jest.fn().mockReturnValue('key-in-flight'),
      user: { id: 'user-race-1' },
      body: payload,
      path: '/api/payments',
    };
    const res: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    jest.spyOn(idempotencyRepo, 'getIdempotencyKey')
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'key-id-2',
        idempotency_key: 'key-in-flight',
        user_id: 'user-race-1',
        request_path: '/api/payments',
        request_body_hash: computedHash,
        response_status: null, // Still processing
        response_body: null,
        created_at: new Date(),
      });

    const pgError: any = new Error('duplicate key value violates unique constraint');
    pgError.code = '23505';
    jest.spyOn(idempotencyRepo, 'createIdempotencyKey').mockRejectedValue(pgError);

    await idempotencyMiddleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 409,
        code: 'CONFLICT',
      })
    );
  });
});
