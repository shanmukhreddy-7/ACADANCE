import { NextRequest, NextResponse } from 'next/server';
import { readSession } from '@/server/session';
import { readState, getBlob } from '@/server/store';
export const runtime = 'nodejs';
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!readSession(req)?.authenticated)
    return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  const { id } = await context.params;
  try {
    const resource = (await readState()).resources.find((r) => r.id === id);
    if (!resource?.file) return NextResponse.json({ error: 'File not found.' }, { status: 404 });
    return new NextResponse(new Uint8Array(await getBlob(resource.file)), {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${resource.filename?.replace(/[\r\n"/\\]/g, '_')}"`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Could not load resource.' }, { status: 503 });
  }
}
