import { redis } from '../config/redis';

export const setFailureMode = async (flag: string, value: boolean) => {
  if (value) {
    await redis.set(`simulation:${flag}`, 'true');
  } else {
    await redis.del(`simulation:${flag}`);
  }
};

export const getFailureMode = async (flag: string): Promise<boolean> => {
  const value = await redis.get(`simulation:${flag}`);
  return value === 'true';
};
