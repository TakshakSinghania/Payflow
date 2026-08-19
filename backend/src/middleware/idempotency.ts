import { Request, Response, NextFunction } from 'express';
import {
  getIdempotencyKey,
  createIdempotencyKey,
  updateIdempotencyResponse,
} from '../repositories/idempotencyKey.repository';
import { hashBody } from '../utils/crypto';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';

export const idempotencyMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  if (req.method !== 'POST') return next();

  const idempotencyKey = req.header('Idempotency-Key');
  if (!idempotencyKey) return next();

  const userId = (req as any).user?.id;
  if (!userId) return next();

  const bodyHash = hashBody(req.body ?? {});

  try {
    const existing = await getIdempotencyKey(idempotencyKey, userId);

    if (existing) {
      if (existing.request_body_hash !== bodyHash) {
        return next(
          new AppError(400, 'IDEMPOTENCY_MISMATCH', 'Idempotency key used with different payload')
        );
      }

      if (existing.response_status) {
        return res.status(existing.response_status).json(existing.response_body);
      }
      return next(new AppError(409, 'CONFLICT', 'Request is already being processed'));
    }

    let keyRecord;
    try {
      keyRecord = await createIdempotencyKey(idempotencyKey, userId, req.path, bodyHash);
    } catch (insertError: any) {
      // Handle PostgreSQL 23505 unique violation caused by concurrent duplicate requests
      if (insertError.code === '23505') {
        const concurrentRecord = await getIdempotencyKey(idempotencyKey, userId);
        if (concurrentRecord) {
          if (concurrentRecord.request_body_hash !== bodyHash) {
            return next(
              new AppError(
                400,
                'IDEMPOTENCY_MISMATCH',
                'Idempotency key used with different payload'
              )
            );
          }
          if (concurrentRecord.response_status) {
            return res
              .status(concurrentRecord.response_status)
              .json(concurrentRecord.response_body);
          }
          return next(new AppError(409, 'CONFLICT', 'Request is already being processed'));
        }
        return next(new AppError(409, 'CONFLICT', 'Concurrent request collision on idempotency key'));
      }
      throw insertError;
    }

    const originalJson = res.json.bind(res);
    res.json = (body: any) => {
      updateIdempotencyResponse(keyRecord.id, res.statusCode, body).catch((err) => {
        logger.error({ err, keyId: keyRecord.id }, 'Failed to persist idempotency response');
      });
      return originalJson(body);
    };

    next();
  } catch (error) {
    next(error);
  }
};
