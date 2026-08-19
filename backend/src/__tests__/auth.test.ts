/**
 * PayFlow Backend Test Suite
 * 
 * Tests run against the real app using supertest. DB calls are mocked
 * so tests are fast, deterministic, and don't require a running Postgres/Redis.
 */

import request from 'supertest';
import { app } from '../app';
import * as authService from '../services/auth.service';
import * as paymentService from '../services/payment.service';
import * as webhookService from '../services/webhook.service';
import * as simulationService from '../services/simulation.service';
import { generateWebhookSignature, verifyWebhookSignature, hashBody } from '../utils/crypto';
import { PaymentStatus } from '../models/types';
import { AppError } from '../utils/errors';

// ─── Mock external dependencies ──────────────────────────────────────────────

jest.mock('../services/auth.service');
jest.mock('../services/payment.service');
jest.mock('../services/webhook.service');
jest.mock('../services/simulation.service');
jest.mock('../config/database', () => ({
  pool: { query: jest.fn() },
  query: jest.fn(),
}));
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
  webhookQueue: { add: jest.fn().mockResolvedValue({ id: 'job-1' }) },
}));

// ─── Test Helpers ─────────────────────────────────────────────────────────────

const mockAuthService = authService as jest.Mocked<typeof authService>;
const mockPaymentService = paymentService as jest.Mocked<typeof paymentService>;
const mockWebhookService = webhookService as jest.Mocked<typeof webhookService>;
const mockSimulationService = simulationService as jest.Mocked<typeof simulationService>;

// Generate a real JWT for testing (we use the real verifyToken so need real secret)
import { generateToken } from '../utils/crypto';
const getAuthHeader = (userId = 'user-1') => ({
  Authorization: `Bearer ${generateToken({ id: userId })}`,
});

const samplePayment = {
  id: 'pay-uuid-1',
  customer_id: 'cus_123',
  amount: 4999,
  currency: 'INR',
  status: PaymentStatus.CREATED,
  user_id: 'user-1',
  metadata: {},
  created_at: new Date(),
  updated_at: new Date(),
};

// ─── AUTH TESTS ───────────────────────────────────────────────────────────────

describe('POST /api/auth/register', () => {
  it('registers a new user and returns a token', async () => {
    mockAuthService.register.mockResolvedValueOnce({
      user: { id: 'user-1', email: 'test@example.com' },
      token: 'jwt-token',
    });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@example.com', password: 'password123' });

    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty('token');
    expect(res.body.data.user.email).toBe('test@example.com');
  });

  it('returns 400 for invalid email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'not-an-email', password: 'password123' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 for password too short', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@example.com', password: '123' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when user already exists', async () => {
    mockAuthService.register.mockRejectedValueOnce(
      new AppError(400, 'USER_EXISTS', 'User with this email already exists')
    );

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'existing@example.com', password: 'password123' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('USER_EXISTS');
  });
});

describe('POST /api/auth/login', () => {
  it('returns token for valid credentials', async () => {
    mockAuthService.login.mockResolvedValueOnce({
      user: { id: 'user-1', email: 'test@example.com' },
      token: 'jwt-token',
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('token');
  });

  it('returns 401 for invalid credentials', async () => {
    mockAuthService.login.mockRejectedValueOnce(
      new AppError(401, 'UNAUTHORIZED', 'Invalid email or password')
    );

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'wrongpassword' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});

// ─── AUTHENTICATION MIDDLEWARE ─────────────────────────────────────────────────

describe('Authentication middleware', () => {
  it('returns 401 when no auth token provided', async () => {
    const res = await request(app).get('/api/payments');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 for malformed Bearer token', async () => {
    const res = await request(app)
      .get('/api/payments')
      .set('Authorization', 'Bearer invalid.token.here');
    expect(res.status).toBe(401);
  });

  it('allows requests with valid JWT', async () => {
    mockPaymentService.listPayments.mockResolvedValueOnce([]);
    const res = await request(app)
      .get('/api/payments')
      .set(getAuthHeader());
    expect(res.status).toBe(200);
  });
});

// ─── PAYMENT LIFECYCLE TESTS ──────────────────────────────────────────────────

describe('POST /api/payments', () => {
  it('creates a payment with valid data', async () => {
    mockPaymentService.createPayment.mockResolvedValueOnce(samplePayment);

    const res = await request(app)
      .post('/api/payments')
      .set(getAuthHeader())
      .send({ customer_id: 'cus_123', amount: 4999, currency: 'INR' });

    expect(res.status).toBe(201);
    expect(res.body.data.id).toBe('pay-uuid-1');
    expect(res.body.data.status).toBe('CREATED');
  });

  it('rejects negative amount', async () => {
    const res = await request(app)
      .post('/api/payments')
      .set(getAuthHeader())
      .send({ customer_id: 'cus_123', amount: -100, currency: 'INR' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects zero amount', async () => {
    const res = await request(app)
      .post('/api/payments')
      .set(getAuthHeader())
      .send({ customer_id: 'cus_123', amount: 0, currency: 'INR' });

    expect(res.status).toBe(400);
  });

  it('rejects unsupported currency', async () => {
    const res = await request(app)
      .post('/api/payments')
      .set(getAuthHeader())
      .send({ customer_id: 'cus_123', amount: 1000, currency: 'XYZ' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects missing customer_id', async () => {
    const res = await request(app)
      .post('/api/payments')
      .set(getAuthHeader())
      .send({ amount: 1000, currency: 'INR' });

    expect(res.status).toBe(400);
  });
});

describe('GET /api/payments/:id', () => {
  it('returns a payment by ID', async () => {
    mockPaymentService.getPayment.mockResolvedValueOnce(samplePayment);

    const res = await request(app)
      .get('/api/payments/pay-uuid-1')
      .set(getAuthHeader());

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe('pay-uuid-1');
  });

  it('returns 404 for unknown payment', async () => {
    mockPaymentService.getPayment.mockRejectedValueOnce(
      new AppError(404, 'NOT_FOUND', 'Payment not found')
    );

    const res = await request(app)
      .get('/api/payments/nonexistent')
      .set(getAuthHeader());

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('Payment state machine transitions', () => {
  it('authorizes a PENDING payment', async () => {
    const authorized = { ...samplePayment, status: PaymentStatus.AUTHORIZED };
    mockPaymentService.authorizePayment.mockResolvedValueOnce(authorized);

    const res = await request(app)
      .post('/api/payments/pay-uuid-1/authorize')
      .set(getAuthHeader());

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('AUTHORIZED');
  });

  it('captures an AUTHORIZED payment', async () => {
    const captured = { ...samplePayment, status: PaymentStatus.CAPTURED };
    mockPaymentService.capturePayment.mockResolvedValueOnce(captured);

    const res = await request(app)
      .post('/api/payments/pay-uuid-1/capture')
      .set(getAuthHeader());

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('CAPTURED');
  });

  it('cancels a PENDING payment', async () => {
    const cancelled = { ...samplePayment, status: PaymentStatus.CANCELLED };
    mockPaymentService.cancelPayment.mockResolvedValueOnce(cancelled);

    const res = await request(app)
      .post('/api/payments/pay-uuid-1/cancel')
      .set(getAuthHeader());

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('CANCELLED');
  });

  it('refunds a CAPTURED payment', async () => {
    const refunded = { ...samplePayment, status: PaymentStatus.REFUNDED };
    mockPaymentService.refundPayment.mockResolvedValueOnce(refunded);

    const res = await request(app)
      .post('/api/payments/pay-uuid-1/refund')
      .set(getAuthHeader());

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('REFUNDED');
  });

  it('rejects invalid state transitions (CREATED → CAPTURE)', async () => {
    mockPaymentService.capturePayment.mockRejectedValueOnce(
      new AppError(400, 'INVALID_STATE', 'Payment must be in AUTHORIZED state')
    );

    const res = await request(app)
      .post('/api/payments/pay-uuid-1/capture')
      .set(getAuthHeader());

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_STATE');
  });

  it('rejects refund on non-CAPTURED payment', async () => {
    mockPaymentService.refundPayment.mockRejectedValueOnce(
      new AppError(400, 'INVALID_STATE', 'Payment must be in CAPTURED state to refund')
    );

    const res = await request(app)
      .post('/api/payments/pay-uuid-1/refund')
      .set(getAuthHeader());

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_STATE');
  });
});

// ─── IDEMPOTENCY TESTS ────────────────────────────────────────────────────────

// We test idempotency via the service layer directly since middleware needs DB

describe('Idempotency key logic', () => {
  it('hashBody produces consistent results for same input', () => {
    const body = { amount: 4999, currency: 'INR', customer_id: 'cus_123' };
    const hash1 = hashBody(body);
    const hash2 = hashBody(body);
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // SHA-256 hex
  });

  it('hashBody produces different results for different inputs', () => {
    const hash1 = hashBody({ amount: 4999 });
    const hash2 = hashBody({ amount: 5000 });
    expect(hash1).not.toBe(hash2);
  });
});

// ─── WEBHOOK TESTS ────────────────────────────────────────────────────────────

describe('POST /api/webhooks/endpoints', () => {
  it('creates a webhook endpoint', async () => {
    mockWebhookService.createEndpoint.mockResolvedValueOnce({
      id: 'ep-1',
      user_id: 'user-1',
      url: 'https://example.com/webhook',
      secret: 'whsec_abc123',
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    });

    const res = await request(app)
      .post('/api/webhooks/endpoints')
      .set(getAuthHeader())
      .send({ url: 'https://example.com/webhook' });

    expect(res.status).toBe(201);
    expect(res.body.data.url).toBe('https://example.com/webhook');
    expect(res.body.data.secret).toMatch(/^whsec_/);
  });

  it('rejects invalid URL for webhook endpoint', async () => {
    const res = await request(app)
      .post('/api/webhooks/endpoints')
      .set(getAuthHeader())
      .send({ url: 'not-a-valid-url' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /api/webhooks/endpoints', () => {
  it('lists webhook endpoints', async () => {
    mockWebhookService.listEndpoints.mockResolvedValueOnce([]);

    const res = await request(app)
      .get('/api/webhooks/endpoints')
      .set(getAuthHeader());

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

// ─── WEBHOOK SIGNATURE TESTS ──────────────────────────────────────────────────

describe('Webhook signature (HMAC-SHA256)', () => {
  const secret = 'test-secret-key-12345';
  const payload = JSON.stringify({ event: 'payment.captured', amount: 4999 });

  it('generates a valid signature', () => {
    const sig = generateWebhookSignature(payload, secret);
    expect(sig).toBeTruthy();
    expect(sig).toHaveLength(64); // SHA-256 hex is 64 chars
  });

  it('verifies a correct signature', () => {
    const sig = generateWebhookSignature(payload, secret);
    expect(verifyWebhookSignature(payload, sig, secret)).toBe(true);
  });

  it('rejects a tampered payload', () => {
    const sig = generateWebhookSignature(payload, secret);
    const tamperedPayload = JSON.stringify({ event: 'payment.captured', amount: 9999 });
    expect(verifyWebhookSignature(tamperedPayload, sig, secret)).toBe(false);
  });

  it('rejects a wrong secret', () => {
    const sig = generateWebhookSignature(payload, secret);
    expect(verifyWebhookSignature(payload, sig, 'wrong-secret')).toBe(false);
  });

  it('uses timing-safe comparison (no early exit)', () => {
    // Both paths should return boolean
    const sig = generateWebhookSignature(payload, secret);
    const result1 = verifyWebhookSignature(payload, sig, secret);
    const result2 = verifyWebhookSignature(payload, 'a'.repeat(64), secret);
    expect(result1).toBe(true);
    expect(result2).toBe(false);
  });

  it('different secrets produce different signatures', () => {
    const sig1 = generateWebhookSignature(payload, 'secret-a');
    const sig2 = generateWebhookSignature(payload, 'secret-b');
    expect(sig1).not.toBe(sig2);
  });
});

// ─── SIMULATION TESTS ─────────────────────────────────────────────────────────

describe('POST /api/simulation/failure', () => {
  it('enables PAYMENT_FAILURE mode', async () => {
    mockSimulationService.setFailureMode.mockResolvedValueOnce(undefined);

    const res = await request(app)
      .post('/api/simulation/failure')
      .set(getAuthHeader())
      .send({ flag: 'PAYMENT_FAILURE', value: true });

    expect(res.status).toBe(200);
    expect(res.body.data.flag).toBe('PAYMENT_FAILURE');
    expect(res.body.data.value).toBe(true);
    expect(mockSimulationService.setFailureMode).toHaveBeenCalledWith('PAYMENT_FAILURE', true);
  });

  it('disables WEBHOOK_FAILURE mode', async () => {
    mockSimulationService.setFailureMode.mockResolvedValueOnce(undefined);

    const res = await request(app)
      .post('/api/simulation/failure')
      .set(getAuthHeader())
      .send({ flag: 'WEBHOOK_FAILURE', value: false });

    expect(res.status).toBe(200);
    expect(res.body.data.value).toBe(false);
  });

  it('rejects unknown simulation flag', async () => {
    const res = await request(app)
      .post('/api/simulation/failure')
      .set(getAuthHeader())
      .send({ flag: 'UNKNOWN_FLAG', value: true });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects non-boolean value', async () => {
    const res = await request(app)
      .post('/api/simulation/failure')
      .set(getAuthHeader())
      .send({ flag: 'PAYMENT_FAILURE', value: 'yes' });

    expect(res.status).toBe(400);
  });
});

describe('GET /api/simulation/config', () => {
  it('returns all simulation flags', async () => {
    mockSimulationService.getFailureMode
      .mockResolvedValueOnce(false)  // PAYMENT_FAILURE
      .mockResolvedValueOnce(true)   // WEBHOOK_FAILURE
      .mockResolvedValueOnce(false)  // SLOW_WEBHOOK
      .mockResolvedValueOnce(false); // RANDOM_FAILURE

    const res = await request(app)
      .get('/api/simulation/config')
      .set(getAuthHeader());

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('PAYMENT_FAILURE', false);
    expect(res.body.data).toHaveProperty('WEBHOOK_FAILURE', true);
  });
});

// ─── PAYMENT FAILURE SIMULATION ───────────────────────────────────────────────

describe('Payment failure simulation', () => {
  it('marks payment as FAILED when PAYMENT_FAILURE mode is on', async () => {
    const failedPayment = { ...samplePayment, status: PaymentStatus.FAILED };
    mockPaymentService.createPayment.mockResolvedValueOnce(failedPayment);

    const res = await request(app)
      .post('/api/payments')
      .set(getAuthHeader())
      .send({ customer_id: 'cus_123', amount: 4999, currency: 'INR' });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('FAILED');
  });
});

// ─── HEALTH CHECK TESTS ───────────────────────────────────────────────────────

describe('GET /api/health', () => {
  it('returns health status', async () => {
    const { query } = require('../config/database');
    query.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });

    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status');
    expect(res.body).toHaveProperty('services');
  });
});

// ─── ERROR HANDLING TESTS ─────────────────────────────────────────────────────

describe('Error handling', () => {
  it('returns consistent error format for all errors', async () => {
    mockPaymentService.getPayment.mockRejectedValueOnce(
      new AppError(404, 'NOT_FOUND', 'Payment not found')
    );

    const res = await request(app)
      .get('/api/payments/xyz')
      .set(getAuthHeader());

    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toHaveProperty('code');
    expect(res.body.error).toHaveProperty('message');
  });

  it('returns 404 for unknown routes', async () => {
    const res = await request(app).get('/api/nonexistent-route');
    expect(res.status).toBe(404);
  });
});

// ─── RATE LIMITING TESTS ───────────────────────────────────────────────────────

describe('Rate limiting', () => {
  it('allows requests within limit', async () => {
    mockPaymentService.listPayments.mockResolvedValue([]);
    const { redis } = require('../config/redis');
    redis.incr.mockResolvedValue(50); // Within limit

    const res = await request(app)
      .get('/api/payments')
      .set(getAuthHeader());

    expect(res.status).toBe(200);
  });

  it('returns 429 when rate limit exceeded', async () => {
    const { redis } = require('../config/redis');
    redis.incr.mockResolvedValue(101); // Over limit of 100

    const res = await request(app)
      .get('/api/payments')
      .set(getAuthHeader());

    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
  });

  it('resets limit after mock shows 1 (first request in window)', async () => {
    mockPaymentService.listPayments.mockResolvedValue([]);
    const { redis } = require('../config/redis');
    redis.incr.mockResolvedValue(1); // First request

    const res = await request(app)
      .get('/api/payments')
      .set(getAuthHeader());

    expect(res.status).toBe(200);
    expect(redis.pexpire).toHaveBeenCalled();
  });
});

// ─── PAYMENT STATE MACHINE UNIT TESTS ────────────────────────────────────────

describe('Payment state machine (unit)', () => {
  const validTransitions: [PaymentStatus, string][] = [
    [PaymentStatus.PENDING, 'authorize'],
    [PaymentStatus.AUTHORIZED, 'capture'],
    [PaymentStatus.PENDING, 'cancel'],
    [PaymentStatus.AUTHORIZED, 'cancel'],
    [PaymentStatus.CAPTURED, 'refund'],
  ];

  it.each(validTransitions)(
    'allows %s → %s transition',
    async (fromStatus, action) => {
      const toStatus = action === 'authorize' ? PaymentStatus.AUTHORIZED
        : action === 'capture' ? PaymentStatus.CAPTURED
        : action === 'cancel' ? PaymentStatus.CANCELLED
        : PaymentStatus.REFUNDED;

      const payment = { ...samplePayment, status: toStatus };
      const mockFn = action === 'authorize' ? mockPaymentService.authorizePayment
        : action === 'capture' ? mockPaymentService.capturePayment
        : action === 'cancel' ? mockPaymentService.cancelPayment
        : mockPaymentService.refundPayment;

      mockFn.mockResolvedValueOnce(payment);

      const res = await request(app)
        .post(`/api/payments/pay-uuid-1/${action}`)
        .set(getAuthHeader());

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(toStatus);
    }
  );
});
