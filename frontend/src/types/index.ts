export type PaymentStatus = 'CREATED' | 'PENDING' | 'AUTHORIZED' | 'CAPTURED' | 'FAILED' | 'CANCELLED' | 'REFUNDED';

export interface Payment {
  id: string;
  customer_id: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  user_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface PaymentEvent {
  id: string;
  payment_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
  // Joined fields from payments table (when fetching via /events)
  customer_id?: string;
  amount?: number;
  currency?: string;
  payment_status?: string;
}

export interface WebhookEndpoint {
  id: string;
  user_id: string;
  url: string;
  secret: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WebhookDelivery {
  id: string;
  endpoint_id: string;
  event_type: string;
  payment_id: string;
  payload: Record<string, unknown>;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  attempt_count: number;
  next_retry_at: string | null;
  last_response_status: number | null;
  last_response_body: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  endpoint_url?: string;
}

export interface User {
  id: string;
  email: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}
