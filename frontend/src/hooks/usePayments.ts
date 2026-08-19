import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Payment } from '../types';

export const usePayments = (page = 1, limit = 10) => {
  const offset = (page - 1) * limit;
  return useQuery({
    queryKey: ['payments', page, limit],
    queryFn: async () => {
      const { data } = await api.get<{ data: Payment[] }>(
        `/payments?limit=${limit}&offset=${offset}`
      );
      return data.data;
    },
    refetchInterval: 15000,
  });
};

export const useCreatePayment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      customer_id: string;
      amount: number;
      currency: string;
      metadata?: Record<string, unknown>;
    }) => {
      const { data } = await api.post<{ data: Payment }>('/payments', payload);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['metrics'] });
    },
  });
};
