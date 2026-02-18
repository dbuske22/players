import jwt from 'jsonwebtoken';
import type { Context, Next } from 'hono';

const JWT_SECRET = process.env.JWT_SECRET || 'sports-builds-market-secret-2026';

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  username: string;
}

export function signToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
}

export function verifyToken(token: string): JWTPayload {
  return jwt.verify(token, JWT_SECRET) as JWTPayload;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function authMiddleware(c: Context<any>, next: Next) {
  const auth = c.req.header('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  const token = auth.slice(7);
  try {
    const payload = verifyToken(token);
    c.set('user', payload);
    await next();
  } catch {
    return c.json({ error: 'Invalid token' }, 401);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function adminMiddleware(c: Context<any>, next: Next) {
  const user = c.get('user') as JWTPayload;
  if (!user || user.role !== 'admin') {
    return c.json({ error: 'Forbidden' }, 403);
  }
  await next();
}
