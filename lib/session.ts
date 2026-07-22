import { cookies } from 'next/headers';
import crypto from 'crypto';

const COOKIE_NAME = 'ewo_session';

type SessionData = { id: string; ad_soyad: string; rol: 'admin' | 'personel' };

function sign(payload: string) {
  const secret = process.env.SESSION_SECRET!;
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

export function createSessionCookieValue(data: SessionData) {
  const payload = Buffer.from(JSON.stringify(data)).toString('base64url');
  const sig = sign(payload);
  return `${payload}.${sig}`;
}

export function readSession(): SessionData | null {
  const raw = cookies().get(COOKIE_NAME)?.value;
  if (!raw) return null;
  const [payload, sig] = raw.split('.');
  if (!payload || !sig) return null;
  if (sign(payload) !== sig) return null;
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
