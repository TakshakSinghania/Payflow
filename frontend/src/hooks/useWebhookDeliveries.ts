import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { WebhookDelivery } from '../types';

export const useWebhookDeliveries = (page = 1, limit = 50) => {
  const offset = (page - 1) * limit;
  return useQuery({
    queryKey: ['webhook-deliveries', page, limit],
    queryFn: async () => {
      const { data } = await api.get<{ data: { deliveries: WebhookDelivery[]; total: number } }>(
        `/webhooks/deliveries?limit=${limit}&offset=${offset}`
      );
      return data.data;
    },
    refetchInterval: 10000,
  });
};
