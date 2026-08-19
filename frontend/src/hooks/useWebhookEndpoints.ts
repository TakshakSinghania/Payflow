import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { WebhookEndpoint } from '../types';

export const useWebhookEndpoints = () => {
  return useQuery({
    queryKey: ['webhook-endpoints'],
    queryFn: async () => {
      const { data } = await api.get<{ data: WebhookEndpoint[] }>('/webhooks/endpoints');
      return data.data;
    },
  });
};

export const useCreateWebhookEndpoint = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { url: string }) => {
      const { data } = await api.post<{ data: WebhookEndpoint }>('/webhooks/endpoints', payload);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhook-endpoints'] });
    },
  });
};
