# PayFlow - Payment Processing Infrastructure Simulator

```text
██████╗  █████╗ ██╗   ██╗███████╗██╗      ██████╗ ██╗    ██╗
██╔══██╗██╔══██╗╚██╗ ██╔╝██╔════╝██║     ██╔═══██╗██║    ██║
██████╔╝███████║ ╚████╔╝ █████╗  ██║     ██║   ██║██║ █╗ ██║
██╔═══╝ ██╔══██║  ╚██╔╝  ██╔══╝  ██║     ██║   ██║██║███╗██║
██║     ██║  ██║   ██║   ██║     ███████╗╚██████╔╝╚███╔███╔╝
╚═╝     ╚═╝  ╚═╝   ╚═╝   ╚═╝     ╚══════╝ ╚═════╝  ╚══╝╚══╝ 
```

[![CI](https://github.com/payflow/payflow/actions/workflows/ci.yml/badge.svg)](https://github.com/payflow/payflow/actions/workflows/ci.yml)
[![Node.js Version](https://img.shields.io/badge/Node.js-v20+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791.svg)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D.svg)](https://redis.io/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED.svg)](https://www.docker.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> [!IMPORTANT]
> **SIMULATION DISCLAIMER**  
> **PayFlow is a payment infrastructure simulator.** No real financial transactions are executed. It is designed to demonstrate full-stack software engineering concepts: finite state machines, database row locking, atomic transactions, idempotency handling, asynchronous event queues, exponential retry backoff, cryptographic webhook signing, and rate limiting.

---

## Table of Contents

- [System Architecture](#system-architecture)
- [Tech Stack](#tech-stack)
- [Core Engineering Features](#core-engineering-features)
- [Database Schema](#database-schema)
- [Payment State Machine & Concurrency Control](#payment-state-machine--concurrency-control)
- [Idempotency Engine & Race Condition Handling](#idempotency-engine--race-condition-handling)
- [Asynchronous Webhook Queue & Worker](#asynchronous-webhook-queue--worker)
- [Failure Simulation Engine](#failure-simulation-engine)
- [Rate Limiting (Redis Fixed-Window)](#rate-limiting-redis-fixed-window)
- [Security & HMAC Signatures](#security--hmac-signatures)
- [API Reference](#api-reference)
- [Docker & Local Setup](#docker--local-setup)
- [Automated Testing](#automated-testing)

---

## System Architecture

```text
+-----------------------------------------------------------------------------------+
|                                  CLIENT LAYER                                     |
|                                                                                   |
|   +--------------------------+                 +------------------------------+   |
|   |  React + Vite Dashboard  |                 |  External API Consumer       |   |
|   |  (Port 3000 via Nginx)   |                 |  (cURL / Postman / HTTP)     |   |
|   +------------+-------------+                 +--------------+---------------+   |
+----------------|----------------------------------------------|-------------------+
                 |                                              |
                 v                                              v
+-----------------------------------------------------------------------------------+
|                                 CORE API SERVER                                   |
|                             (Express.js + TypeScript)                             |
|                                                                                   |
|  - Request Tracing (UUID)                  - Fixed-Window Rate Limiter (Redis)    |
|  - JWT Authentication Middleware           - Database Idempotency Guard (SHA-256) |
|  - Zod Input Validation                    - Managed SQL Transactions (ACID)      |
+------------------------+-----------------------------------+----------------------+
                         |                                   |
                         v                                   v
+-----------------------------------+     +-----------------------------------------+
|      POSTGRESQL 16 (DATABASE)     |     |        REDIS 7 (CACHE & BROKER)         |
|                                   |     |                                         |
|  - users                          |     |  - Rate Limit Counters (TTL 60s)        |
|  - payments (Row Lock / UPDATE)   |     |  - Simulation Flags                     |
|  - payment_events (Append-only)   |     |  - BullMQ Queue ('webhook-deliveries')  |
|  - idempotency_keys (Unique Key)  |     +--------------------+--------------------+
|  - webhook_endpoints & deliveries |                          |
+-----------------------------------+                          v
                                          +-----------------------------------------+
                                          |         BULLMQ WEBHOOK WORKER           |
                                          |          (Separate Node Process)        |
                                          |                                         |
                                          |  - Consumes delivery jobs               |
                                          |  - HMAC-SHA256 Payload Signing          |
                                          |  - Exponential Backoff (1s -> 16s)      |
                                          |  - Dead-Letter State Tracking           |
                                          +--------------------+--------------------+
                                                               |
                                                               v
                                          +-----------------------------------------+
                                          |       TARGET WEBHOOK ENDPOINTS          |
                                          |       (Headers: X-PayFlow-Signature)    |
                                          +-----------------------------------------+
```

---

## Tech Stack

| Component | Technology | Description |
|---|---|---|
| **Backend API** | Node.js 20, Express.js, TypeScript | Layered REST API with strict typing |
| **Database** | PostgreSQL 16 | Relational storage with raw SQL queries and atomic transactions |
| **Caching / Queue** | Redis 7 + BullMQ 5.x | In-memory atomic rate limit counters & job queue broker |
| **Worker Process** | Node.js 20 + BullMQ Worker | Decoupled asynchronous webhook delivery processor |
| **Frontend** | React 18, Vite, TypeScript, Tailwind CSS | Single Page Application with TanStack Query & Recharts |
| **Testing** | Jest, Supertest | 58 unit and API integration tests |
| **Containerization** | Docker, Docker Compose, Nginx | 5-service container architecture with health checks |
| **CI/CD** | GitHub Actions | Automated lint, typecheck, test, and build pipeline |

---

## Core Engineering Features

1. **Atomic State Transitions**: Multi-step operations (`payments` update + `payment_events` insertion + `webhook_deliveries` staging) run within managed PostgreSQL `BEGIN ... COMMIT / ROLLBACK` transactions using a dedicated `withTransaction` client checkout pattern.
2. **Pessimistic Row-Level Locking (`SELECT FOR UPDATE`)**: Eliminates race conditions on concurrent state transitions (`authorize`, `capture`, `cancel`, `refund`).
3. **Idempotency with Race Recovery**: Computes SHA-256 payload hashes, stores cached responses, and handles PostgreSQL `23505` unique constraint races gracefully without `500` server errors.
4. **Asynchronous Webhook Queue**: Decouples API latency from third-party webhook delivery times by offloading delivery jobs to BullMQ.
5. **Exponential Retry Scheduling**: Retries failed webhook calls up to 5 times ($1\text{s}, 2\text{s}, 4\text{s}, 8\text{s}, 16\text{s}$) before marking delivery as `FAILED`.
6. **Cryptographic HMAC-SHA256 Signing**: Signs outbound webhook payloads with endpoint secrets, providing timing-safe verification via `crypto.timingSafeEqual`.
7. **Simulation Studio**: Live toggles for `PAYMENT_FAILURE`, `RANDOM_FAILURE` (50% random failure rate), `WEBHOOK_FAILURE`, and `SLOW_WEBHOOK` (5-second artificial latency).
8. **Fixed-Window Redis Rate Limiter**: IP-based rate limiter enforcing 100 requests per minute with standard headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `Retry-After`).

---

## Database Schema

All database migrations are defined in [`backend/src/database/migrations.ts`](backend/src/database/migrations.ts) using raw SQL:

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id TEXT NOT NULL,
    amount INTEGER NOT NULL CHECK (amount > 0),
    currency TEXT NOT NULL DEFAULT 'INR',
    status TEXT NOT NULL DEFAULT 'CREATED',
    user_id UUID REFERENCES users(id),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE payment_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID REFERENCES payments(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    payload JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE idempotency_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idempotency_key TEXT NOT NULL,
    user_id UUID REFERENCES users(id),
    request_path TEXT NOT NULL,
    request_body_hash TEXT NOT NULL,
    response_status INTEGER,
    response_body JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(idempotency_key, user_id)
);

CREATE TABLE webhook_endpoints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    url TEXT NOT NULL,
    secret TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE webhook_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    endpoint_id UUID REFERENCES webhook_endpoints(id),
    event_type TEXT NOT NULL,
    payment_id UUID REFERENCES payments(id),
    payload JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING',
    attempt_count INTEGER DEFAULT 0,
    next_retry_at TIMESTAMPTZ,
    last_response_status INTEGER,
    last_response_body TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_customer_id ON payments(customer_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payment_events_payment_id ON payment_events(payment_id);
CREATE INDEX idx_webhook_deliveries_endpoint_id ON webhook_deliveries(endpoint_id);
CREATE INDEX idx_webhook_deliveries_status ON webhook_deliveries(status);
```

---

## Payment State Machine & Concurrency Control

```text
                  [ CREATED ]
                       │
                       ▼
                  [ PENDING ]
                 ┌─────┴─────┐
                 ▼           ▼
           [ AUTHORIZED ] [ CANCELLED ]
                 ┌─────┴─────┐
                 ▼           ▼
            [ CAPTURED ]  [ CANCELLED ]
                 │
                 ▼
            [ REFUNDED ]
```

### Transition Invariants & Row-Level Locking
State changes are guarded by `SELECT ... FOR UPDATE` inside `withTransaction`:
- **`authorizePayment`**: Requires `status === PENDING` $\rightarrow$ transitions to `AUTHORIZED`.
- **`capturePayment`**: Requires `status === AUTHORIZED` $\rightarrow$ transitions to `CAPTURED`.
- **`cancelPayment`**: Requires `status IN (PENDING, AUTHORIZED)` $\rightarrow$ transitions to `CANCELLED`.
- **`refundPayment`**: Requires `status === CAPTURED` $\rightarrow$ transitions to `REFUNDED`.
- **Atomic Rollback**: If event insertion or webhook staging fails, the entire transaction rolls back and no status is mutated.

---

## Idempotency Engine & Race Condition Handling

1. **Header**: Clients pass `Idempotency-Key: <unique_string>` on `POST /api/payments`.
2. **Payload Hash**: Computes SHA-256 hash of incoming JSON request body.
3. **Cache Playback**: If the key was previously processed with the **same payload**, the cached HTTP status code and response body are returned immediately.
4. **Mismatch Rejection**: If the key is reused with a **different payload**, the request is rejected with `400 IDEMPOTENCY_MISMATCH`.
5. **In-Flight Conflict**: If a duplicate request arrives while the original is still executing, the API responds with `409 CONFLICT` ("Request is already being processed").
6. **Concurrent Race Recovery**: When two identical requests arrive simultaneously before either inserts, the second request encounters a PostgreSQL `23505` unique constraint violation. The middleware catches this specific error, re-queries the row, and returns the appropriate in-flight or completed response rather than a `500` error.

---

## Asynchronous Webhook Queue & Worker

- **Queue**: BullMQ queue named `webhook-deliveries` backed by Redis.
- **Worker**: Standalone worker process (`npm run worker`) that processes deliveries independently.
- **Signing Header**: Outbound requests include the canonical `X-PayFlow-Signature` HTTP header.
- **Exponential Backoff**: Configured with `attempts: 5, backoff: { type: 'exponential', delay: 1000 }`.
- **Dead-Letter State**: When all 5 attempts are exhausted, the delivery status is marked `FAILED` with the exact error stored in `webhook_deliveries.error_message`.

---

## Failure Simulation Engine

Configure simulation behavior via `POST /api/simulation/failure` or the dashboard UI:

| Flag | Behavior |
|---|---|
| `PAYMENT_FAILURE` | All new payments immediately transition to `FAILED` with status `payment.failed`. |
| `RANDOM_FAILURE` | 50% random chance of payment creation failure for chaos testing. |
| `WEBHOOK_FAILURE` | Simulates target webhook server returning 500 error, triggering the retry worker. |
| `SLOW_WEBHOOK` | Introduces an artificial 5-second delay before webhook dispatch. |

---

## Rate Limiting (Redis Fixed-Window)

- Implemented via Redis atomic `INCR` + `PEXPIRE` key expiry (60-second window).
- Enforces 100 requests per minute per IP address.
- Attaches standard response headers:
  - `X-RateLimit-Limit: 100`
  - `X-RateLimit-Remaining: <remaining_requests>`
  - `X-RateLimit-Reset: <unix_timestamp>`
  - `Retry-After: <seconds>` (on HTTP 429)

---

## Security & HMAC Signatures

### HMAC-SHA256 Payload Verification
Endpoints receive a dedicated secret `whsec_<48_hex_chars>`. The signature is computed over the raw stringified payload:

```typescript
import crypto from 'crypto';

export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}
```

---

## API Reference

### Auth
* `POST /api/auth/register` — Register a new account (`email`, `password`)
* `POST /api/auth/login` — Sign in and obtain a JWT (`email`, `password`)
* `GET /api/auth/me` — Get current user profile

### Payments (Authenticated)
* `POST /api/payments` — Create payment (supports `Idempotency-Key` header)
* `GET /api/payments` — List user's payments (`?limit=15&offset=0`)
* `GET /api/payments/:id` — Get payment details
* `GET /api/payments/:id/events` — Get payment lifecycle event audit trail
* `GET /api/payments/:id/deliveries` — Get webhook delivery attempts for payment
* `POST /api/payments/:id/authorize` — Authorize a `PENDING` payment
* `POST /api/payments/:id/capture` — Capture an `AUTHORIZED` payment
* `POST /api/payments/:id/cancel` — Cancel a `PENDING` or `AUTHORIZED` payment
* `POST /api/payments/:id/refund` — Refund a `CAPTURED` payment

### Webhooks & Simulation
* `POST /api/webhooks/endpoints` — Register an HTTPS webhook URL
* `GET /api/webhooks/endpoints` — List registered webhook endpoints
* `GET /api/webhooks/deliveries` — Global webhook delivery log
* `POST /api/simulation/failure` — Toggle a failure flag (`{ flag, value }`)
* `GET /api/simulation/config` — Get all simulation flags
* `POST /api/simulation/config` — Bulk update simulation configuration
* `GET /api/events` — Paginated global audit events log
* `GET /api/metrics` — Dashboard aggregate analytics
* `GET /api/health` — System health check

---

## Docker & Local Setup

### Running with Docker Compose (Recommended)

```bash
# Clone and enter project directory
cd payflow

# Start all 5 services
docker compose up --build
```

* **Frontend Dashboard**: [http://localhost:3000](http://localhost:3000)
* **Backend API**: [http://localhost:4000/api/health](http://localhost:4000/api/health)

### Running Locally Without Docker

```bash
# 1. Start PostgreSQL & Redis locally

# 2. Backend setup
cd backend
cp .env.example .env
npm install --legacy-peer-deps
npm run migrate
npm run dev

# 3. Webhook worker (separate terminal)
cd backend
npm run worker

# 4. Frontend setup (separate terminal)
cd frontend
cp .env.example .env
npm install
npm run dev
```

---

## Automated Testing

```bash
cd backend
npm test
```

Executes 58 tests across:
* JWT authentication & password hashing
* State machine transitions & invalid transition guards
* PostgreSQL transactions & atomic rollback
* Row-level locking concurrency safety (`SELECT FOR UPDATE`)
* Idempotency payload hashing & 23505 race condition recovery
* `RANDOM_FAILURE` simulation deterministic execution
* HMAC-SHA256 signature verification & `timingSafeEqual`
* Fixed-window rate limiting & HTTP 429 header assertions
