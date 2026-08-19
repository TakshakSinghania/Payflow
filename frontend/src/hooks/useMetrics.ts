import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export interface DashboardMetrics {
  payments: {
    total: number;
    successful: number;
    failed: number;
    refunded: number;
    totalAmount: number;
    successRate: number;
  };
  webhooks: {
    total: number;
    delivered: number;
    failed: number;
    deliveryRate: number;
  };
  dailyStats: Array<{ date: string; count: number; amount: number }>;
}

export const useMetrics = () => {
  return useQuery({
    queryKey: ['metrics'],
    queryFn: async () => {
      const { data } = await api.get<{ data: DashboardMetrics }>('/metrics');
      return data.data;
    },
    refetchInterval: 30000,
  });
};
