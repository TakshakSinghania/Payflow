import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Payment, PaymentEvent, WebhookDelivery } from '../types';

export const usePayment = (id: string) => {
  return useQuery({
    queryKey: ['payment', id],
    queryFn: async () => {
      const { data } = await api.get<{ data: Payment }>(`/payments/${id}`);
      return data.data;
    },
    refetchInterval: 5000,
    enabled: !!id,
  });
};

export const usePaymentEvents = (id: string) => {
  return useQuery({
    queryKey: ['payment-events', id],
    queryFn: async () => {
      const { data } = await api.get<{ data: { events: PaymentEvent[] } }>(`/payments/${id}/events`);
      return data.data.events;
    },
    refetchInterval: 5000,
    enabled: !!id,
  });
};

export const usePaymentDeliveries = (id: string) => {
  return useQuery({
    queryKey: ['payment-deliveries', id],
    queryFn: async () => {
      const { data } = await api.get<{ data: { deliveries: WebhookDelivery[] } }>(`/payments/${id}/deliveries`);
      return data.data.deliveries;
    },
    refetchInterval: 5000,
    enabled: !!id,
  });
};

export const useUpdatePaymentStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, action }: { id: string; action: string }) => {
      const { data } = await api.post<{ data: Payment }>(`/payments/${id}/${action}`);
      return data.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['payment', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['payment-events', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['metrics'] });
    },
  });
};
