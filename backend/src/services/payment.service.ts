import {
  createPayment as createPaymentRepo,
  getPaymentById,
  getPaymentByIdForUpdate,
  updatePaymentStatus,
  listPayments as listPaymentsRepo,
} from '../repositories/payment.repository';
import { createPaymentEvent } from '../repositories/paymentEvent.repository';
import { Payment, PaymentStatus } from '../models/types';
import { AppError } from '../utils/errors';
import { recordWebhookDeliveries, dispatchWebhookJobs } from './webhook.service';
import { getFailureMode } from './simulation.service';
import { withTransaction } from '../config/database';

/**
 * Atomically transitions a payment from an allowed status to a new status.
 * Uses PostgreSQL row-level locking (SELECT ... FOR UPDATE) and explicit
 * transaction management (BEGIN/COMMIT/ROLLBACK) to prevent race conditions.
 */
const transitionPaymentState = async (
  paymentId: string,
  userId: string,
  allowedStatuses: PaymentStatus[],
  newStatus: PaymentStatus,
  payload: Record<string, any> = {}
): Promise<Payment> => {
  const { updated, webhookJobIds } = await withTransaction(async (client) => {
    // 1. Acquire row lock within transaction to prevent concurrent modifications
    const payment = await getPaymentByIdForUpdate(paymentId, userId, client);
    if (!payment) {
      throw new AppError(404, 'NOT_FOUND', 'Payment not found');
    }

    // 2. Validate state machine rule on locked row
    if (!allowedStatuses.includes(payment.status)) {
      throw new AppError(
        400,
        'INVALID_STATE',
        `Payment cannot transition to ${newStatus} from current state: ${payment.status}`
      );
    }

    // 3. Update payment status
    const updatedPayment = await updatePaymentStatus(payment.id, newStatus, client);

    // 4. Insert immutable audit event
    const event = await createPaymentEvent(
      payment.id,
      `payment.${newStatus.toLowerCase()}`,
      payload,
      client
    );

    // 5. Record webhook delivery records in DB before commit
    const webhookJobIds = await recordWebhookDeliveries(
      payment.user_id,
      event.event_type,
      payment.id,
      event.payload,
      client
    );

    return { updated: updatedPayment, webhookJobIds };
  });

  // 6. Enqueue BullMQ jobs only after transaction successfully commits
  await dispatchWebhookJobs(webhookJobIds);

  return updated;
};

export const createPayment = async (
  userId: string,
  customerId: string,
  amount: number,
  currency: string,
  metadata: Record<string, any> = {},
  randomSource: () => number = Math.random
): Promise<Payment> => {
  // Check simulation failure flags
  const isForceFailure = await getFailureMode('PAYMENT_FAILURE');
  const isRandomFailureEnabled = await getFailureMode('RANDOM_FAILURE');
  const isRandomFailureTriggered = isRandomFailureEnabled && randomSource() < 0.5;

  const shouldFail = isForceFailure || isRandomFailureTriggered;
  const failureReason = isForceFailure
    ? 'Simulation mode forced failure'
    : 'Simulation random 50% failure';

  const { payment, webhookJobIds } = await withTransaction(async (client) => {
    const createdPayment = await createPaymentRepo(
      userId,
      customerId,
      amount,
      currency,
      metadata,
      client
    );

    await createPaymentEvent(createdPayment.id, 'payment.created', { amount, currency }, client);

    if (shouldFail) {
      const failedPayment = await updatePaymentStatus(
        createdPayment.id,
        PaymentStatus.FAILED,
        client
      );
      const failEvent = await createPaymentEvent(
        createdPayment.id,
        'payment.failed',
        { reason: failureReason },
        client
      );
      const webhookJobIds = await recordWebhookDeliveries(
        userId,
        failEvent.event_type,
        createdPayment.id,
        failEvent.payload,
        client
      );
      return { payment: failedPayment, webhookJobIds };
    }

    const pendingPayment = await updatePaymentStatus(
      createdPayment.id,
      PaymentStatus.PENDING,
      client
    );
    const pendingEvent = await createPaymentEvent(
      createdPayment.id,
      'payment.pending',
      { amount, currency },
      client
    );
    const webhookJobIds = await recordWebhookDeliveries(
      userId,
      pendingEvent.event_type,
      createdPayment.id,
      pendingEvent.payload,
      client
    );

    return { payment: pendingPayment, webhookJobIds };
  });

  // Dispatch background webhook delivery jobs after commit
  await dispatchWebhookJobs(webhookJobIds);

  return payment;
};

export const getPayment = async (id: string, userId: string): Promise<Payment> => {
  const payment = await getPaymentById(id, userId);
  if (!payment) throw new AppError(404, 'NOT_FOUND', 'Payment not found');
  return payment;
};

export const listPayments = async (userId: string, limit = 10, offset = 0): Promise<Payment[]> => {
  return listPaymentsRepo(userId, limit, offset);
};

export const authorizePayment = async (id: string, userId: string): Promise<Payment> => {
  return transitionPaymentState(id, userId, [PaymentStatus.PENDING], PaymentStatus.AUTHORIZED);
};

export const capturePayment = async (id: string, userId: string): Promise<Payment> => {
  return transitionPaymentState(id, userId, [PaymentStatus.AUTHORIZED], PaymentStatus.CAPTURED);
};

export const cancelPayment = async (id: string, userId: string): Promise<Payment> => {
  return transitionPaymentState(
    id,
    userId,
    [PaymentStatus.PENDING, PaymentStatus.AUTHORIZED],
    PaymentStatus.CANCELLED
  );
};

export const refundPayment = async (id: string, userId: string): Promise<Payment> => {
  return transitionPaymentState(id, userId, [PaymentStatus.CAPTURED], PaymentStatus.REFUNDED);
};
