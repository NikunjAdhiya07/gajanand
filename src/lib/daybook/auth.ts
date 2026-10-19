import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import User from '@/models/User';
import type { UserRef } from './types';

// Same cookie, secret and claim as /api/auth and /api/auth/verify.
const secret = new TextEncoder().encode(
  process.env.JWT_SECRET || 'default_secret_for_dev'
);

export async function getDaybookUser(): Promise<UserRef | null> {
  const token = (await cookies()).get('token')?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secret);
    const userId = typeof payload.userId === 'string' ? payload.userId : null;
    if (!userId) return null;

    const user = await User.findById(userId, { username: 1 }).lean<{ username: string } | null>();
    if (!user) return null;
    return { userId, username: user.username };
  } catch {
    return null;
  }
}
