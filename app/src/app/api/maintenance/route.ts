import { timingSafeEqual } from 'node:crypto';
import { purgeExpired } from '@/server/store';
export const runtime = 'nodejs';
export async function GET(req: Request) {
  const actual = Buffer.from(req.headers.get('authorization') ?? '');
  const expected = Buffer.from('Bearer ' + (process.env.CRON_SECRET ?? ''));
  if (
    !process.env.CRON_SECRET ||
    actual.length !== expected.length ||
    !timingSafeEqual(actual, expected)
  )
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    await purgeExpired();
    return Response.json({ success: true });
  } catch {
    return Response.json(
      { error: 'Maintenance failed. Check storage configuration.' },
      { status: 503 },
    );
  }
}
