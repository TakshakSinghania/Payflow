import { Request, Response, NextFunction } from 'express';
import { query } from '../config/database';

/**
 * GET /api/events
 * Returns paginated payment events across all payments for the authenticated user.
 */
export const listEvents = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;

    const countResult = await query(
      `SELECT COUNT(*) FROM payment_events pe
       JOIN payments p ON pe.payment_id = p.id
       WHERE p.user_id = $1`,
      [userId]
    );

    const result = await query(
      `SELECT pe.*, p.customer_id, p.amount, p.currency, p.status as payment_status
       FROM payment_events pe
       JOIN payments p ON pe.payment_id = p.id
       WHERE p.user_id = $1
       ORDER BY pe.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    res.json({
      data: {
        events: result.rows,
        total: parseInt(countResult.rows[0].count),
        page,
        limit,
      },
    });
  } catch (err) {
    next(err);
  }
};
