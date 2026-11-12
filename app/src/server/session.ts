import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto';
import type { NextRequest, NextResponse } from 'next/server';
export type UniversitySession = {
  id: string;
  authenticated: boolean;
  expires: number;
  registration?: string;
  password?: string;
  remember?: boolean;
};
export const SESSION_COOKIE = 'acadence_session_v2';
export function sessionKey() {
  const key = process.env.SESSION_SECRET;
  if (!key || key.length < 32 || key.startsWith('replace-with-'))
    throw Error('Set a random SESSION_SECRET of at least 32 characters.');
  return createHash('sha256').update(key).digest();
}
export function encrypt(value: unknown) {
  const iv = randomBytes(12),
    cipher = createCipheriv('aes-256-gcm', sessionKey(), iv);
  const bytes = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), bytes]).toString('base64url');
}
export function decrypt<T>(value: string): T {
  const bytes = Buffer.from(value, 'base64url');
  const cipher = createDecipheriv('aes-256-gcm', sessionKey(), bytes.subarray(0, 12));
  cipher.setAuthTag(bytes.subarray(12, 28));
  return JSON.parse(Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]).toString());
}
export function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/api',
    maxAge,
  };
}
export function readSession(req: NextRequest): UniversitySession | null {
  const value = req.cookies.get(SESSION_COOKIE)?.value ?? req.cookies.get('acadence_portal')?.value;
  if (!value) return null;
  try {
    const s = decrypt<UniversitySession>(value);
    return s.expires > Date.now() ? s : null;
  } catch {
    return null;
  }
}
export function writeSession(response: NextResponse, session: UniversitySession) {
  const age = Math.max(0, Math.floor((session.expires - Date.now()) / 1000));
  response.cookies.set(SESSION_COOKIE, encrypt(session), cookieOptions(age));
  if (session.authenticated && session.registration)
    response.cookies.set(
      'acadence_account_' + session.registration,
      encrypt(session),
      cookieOptions(age),
    );
  return response;
}
export function sameOrigin(req: NextRequest) {
  const origin = req.headers.get('origin');
  return (
    !!origin &&
    /^https?:\/\//.test(origin) &&
    URL.canParse(origin) &&
    new URL(origin).host === req.headers.get('host')
  );
}
export function isAdmin(registration: string, req?: NextRequest) {
  const configured = (process.env.ADMIN_REGISTRATIONS ?? '').split(',').map((x) => x.trim());
  return (
    configured.includes(registration) ||
    (!process.env.VERCEL &&
      !!req &&
      /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(req.headers.get('host') ?? ''))
  );
}
