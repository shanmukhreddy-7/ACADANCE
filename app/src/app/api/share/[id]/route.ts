import { NextRequest, NextResponse } from 'next/server';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { readState, mutateState, getBlob } from '@/server/store';
import { readSession, sameOrigin } from '@/server/session';
export const runtime = 'nodejs';
const json = (b: unknown, status = 200) =>
  NextResponse.json(b, { status, headers: { 'Cache-Control': 'no-store' } });
function matches(value: string, hash: string) {
  const [salt, stored] = hash.split(':');
  const expected = Buffer.from(stored, 'hex'),
    actual = scryptSync(value, salt, 32);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const token = req.nextUrl.searchParams.get('token');
    if (token) {
      const file = await mutateState((s) => {
        const share = s.shares.find((x) => x.id === id);
        if (
          !share ||
          share.expires <= Date.now() ||
          !share.tokens[token] ||
          share.tokens[token] < Date.now()
        )
          throw Error('This download token expired or was already used.');
        delete share.tokens[token];
        return { file: share.file, filename: share.filename };
      });
      if (!file.file) throw Error('File unavailable.');
      const bytes = await getBlob(file.file);
      return new NextResponse(new Uint8Array(bytes), {
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${file.filename}"`,
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    }
    const share = (await readState()).shares.find((s) => s.id === id);
    if (!share || share.expires <= Date.now() || share.remaining <= 0)
      return json({ error: 'This share expired, was removed, or has no accesses left.' }, 410);
    return json({
      title: share.title,
      expires: share.expires,
      remaining: share.remaining,
      protected: !!share.password,
      restricted: share.allowed.length > 0,
      filename: share.filename,
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Share unavailable.' }, 400);
  }
}
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return json({ error: 'Request origin is not allowed.' }, 403);
  try {
    const { id } = await context.params;
    const body = await req.json();
    const user = readSession(req)?.registration;
    const result = await mutateState((s) => {
      const share = s.shares.find((x) => x.id === id);
      if (!share || share.expires <= Date.now() || share.remaining <= 0)
        throw Error('This share expired or has no accesses left.');
      if (share.allowed.length && (!user || !share.allowed.includes(user)))
        throw Error('Sign in with a permitted registration number first.');
      if (share.password && !matches(String(body.password ?? ''), share.password))
        throw Error('The share password is incorrect.');
      share.remaining--;
      const token = share.file ? randomBytes(24).toString('base64url') : null;
      if (token) share.tokens[token] = Date.now() + 60000;
      return {
        text: share.text,
        url: token ? `/api/share/${id}?token=${token}` : null,
        filename: share.filename,
      };
    });
    return json(result);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Share access failed.' }, 400);
  }
}
