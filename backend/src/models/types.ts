export interface User {
  id: string;
  email: string;
  password_hash: string;
  created_at: Date;
  updated_at: Date;
}

export enum PaymentStatus {
  CREATED = 'CREATED',
  PENDING = 'PENDING',
  AUTHORIZED = 'AUTHORIZED',
  CAPTURED = 'CAPTURED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
}

export interface Payment {
  id: string;
  customer_id: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  user_id: string;
  metadata: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface PaymentEvent {
  id: string;
  payment_id: string;
  event_type: string;
  payload: Record<string, any>;
  created_at: Date;
}

export interface IdempotencyKey {
  id: string;
  idempotency_key: string;
  user_id: string;
  request_path: string;
  request_body_hash: string;
  response_status: number | null;
  response_body: Record<string, any> | null;
  created_at: Date;
}

export interface WebhookEndpoint {
  id: string;
  user_id: string;
  url: string;
  secret: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface WebhookDelivery {
  id: string;
  endpoint_id: string;
  event_type: string;
  payment_id: string;
  payload: Record<string, any>;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  attempt_count: number;
  next_retry_at: Date | null;
  last_response_status: number | null;
  last_response_body: string | null;
  error_message: string | null;
  created_at: Date;
  updated_at: Date;
}
