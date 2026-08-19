import { createUser, getUserByEmail } from '../repositories/user.repository';
import { hashPassword, comparePassword, generateToken } from '../utils/crypto';
import { AppError } from '../utils/errors';

export const register = async (email: string, password: string) => {
  const existingUser = await getUserByEmail(email);
  if (existingUser) {
    throw new AppError(400, 'USER_EXISTS', 'User with this email already exists');
  }

  const hashedPassword = await hashPassword(password);
  const user = await createUser(email, hashedPassword);

  const token = generateToken({ id: user.id });
  return { user: { id: user.id, email: user.email }, token };
};

export const login = async (email: string, password: string) => {
  const user = await getUserByEmail(email);
  if (!user) {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid email or password');
  }

  const isValid = await comparePassword(password, user.password_hash);
  if (!isValid) {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid email or password');
  }

  const token = generateToken({ id: user.id });
  return { user: { id: user.id, email: user.email }, token };
};

export const getMe = async (userId: string) => {
  const { getUserById } = await import('../repositories/user.repository');
  const user = await getUserById(userId);
  if (!user) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  }
  return { id: user.id, email: user.email };
};

