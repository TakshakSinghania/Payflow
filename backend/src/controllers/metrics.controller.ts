import { Request, Response, NextFunction } from 'express';
import { query } from '../config/database';

/**
 * GET /api/metrics
 * Returns aggregate payment and webhook metrics for the authenticated user.
 */
export const getMetrics = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;

    // Payment stats
    const paymentStats = await query(
      `SELECT 
         COUNT(*) as total,
         COUNT(*) FILTER (WHERE status = 'CAPTURED') as successful,
         COUNT(*) FILTER (WHERE status = 'FAILED') as failed,
         COUNT(*) FILTER (WHERE status = 'REFUNDED') as refunded,
         COALESCE(SUM(amount) FILTER (WHERE status = 'CAPTURED'), 0) as total_amount
       FROM payments WHERE user_id = $1`,
      [userId]
    );

    const ps = paymentStats.rows[0];
    const total = parseInt(ps.total);
    const successful = parseInt(ps.successful);
    const failed = parseInt(ps.failed);
    const refunded = parseInt(ps.refunded);
    const totalAmount = parseInt(ps.total_amount);
    const successRate = total > 0 ? Math.round((successful / total) * 100) : 0;

    // Webhook delivery stats
    const webhookStats = await query(
      `SELECT 
         COUNT(*) as total,
         COUNT(*) FILTER (WHERE wd.status = 'SUCCESS') as delivered,
         COUNT(*) FILTER (WHERE wd.status = 'FAILED') as failed
       FROM webhook_deliveries wd
       JOIN webhook_endpoints we ON wd.endpoint_id = we.id
       WHERE we.user_id = $1`,
      [userId]
    );

    const ws = webhookStats.rows[0];
    const totalWebhooks = parseInt(ws.total);
    const deliveredWebhooks = parseInt(ws.delivered);
    const failedWebhooks = parseInt(ws.failed);
    const webhookDeliveryRate = totalWebhooks > 0 ? Math.round((deliveredWebhooks / totalWebhooks) * 100) : 0;

    // Payments per day (last 7 days)
    const dailyStats = await query(
      `SELECT 
         DATE(created_at) as date,
         COUNT(*) as count,
         COALESCE(SUM(amount) FILTER (WHERE status = 'CAPTURED'), 0) as amount
       FROM payments 
       WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '7 days'
       GROUP BY DATE(created_at)
       ORDER BY DATE(created_at) ASC`,
      [userId]
    );

    res.json({
      data: {
        payments: {
          total,
          successful,
          failed,
          refunded,
          totalAmount,
          successRate,
        },
        webhooks: {
          total: totalWebhooks,
          delivered: deliveredWebhooks,
          failed: failedWebhooks,
          deliveryRate: webhookDeliveryRate,
        },
        dailyStats: dailyStats.rows,
      },
    });
  } catch (err) {
    next(err);
  }
};
