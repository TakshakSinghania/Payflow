import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const loginSchema = registerSchema;

export const createPaymentSchema = z.object({
  customer_id: z.string().min(1),
  amount: z.number().int().positive(),
  currency: z.enum(['INR', 'USD', 'EUR', 'GBP']).default('INR'),
  metadata: z.any().optional(),
});

export const webhookEndpointSchema = z.object({
  url: z.string().url(),
});
