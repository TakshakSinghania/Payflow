import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { PaymentEvent } from '../types';

export const useEvents = (page = 1, limit = 50) => {
  return useQuery({
    queryKey: ['events', page, limit],
    queryFn: async () => {
      const { data } = await api.get<{ data: { events: PaymentEvent[]; total: number; page: number; limit: number } }>(
        `/events?page=${page}&limit=${limit}`
      );
      return data.data;
    },
    refetchInterval: 10000,
  });
};
