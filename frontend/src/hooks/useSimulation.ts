import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export interface SimulationConfig {
  PAYMENT_FAILURE: boolean;
  WEBHOOK_FAILURE: boolean;
  SLOW_WEBHOOK: boolean;
  RANDOM_FAILURE: boolean;
}

export const useSimulationConfig = () => {
  return useQuery({
    queryKey: ['simulation-config'],
    queryFn: async () => {
      const { data } = await api.get<{ data: SimulationConfig }>('/simulation/config');
      return data.data;
    },
  });
};

export const useUpdateSimulationConfig = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (config: Partial<SimulationConfig>) => {
      const { data } = await api.post<{ data: SimulationConfig }>('/simulation/config', config);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['simulation-config'] });
    },
  });
};
