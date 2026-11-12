'use client';
import { use, useEffect, useState } from 'react';
import { Brand, Button, Notice } from '@/components/ui';
export default function SharedPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [info, setInfo] = useState<{
    title: string;
    expires: number;
    remaining: number;
    protected: boolean;
    restricted: boolean;
    filename?: string;
  } | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ text?: string; url?: string; filename?: string } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    fetch('/api/share/' + id)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error);
        setInfo(d);
      })
      .catch((e) => setError(e.message));
  }, [id]);
  async function access() {
    setBusy(true);
    setError('');
    try {
      const r = await fetch('/api/share/' + id, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setResult(d);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="share-page">
      <a href="/">
        <Brand />
      </a>
      <section className="panel padded">
        <h1>{info?.title ?? 'Shared with you'}</h1>
        {error && <Notice error>{error}</Notice>}
        {info && !result && (
          <div className="form-stack">
            <p>
              Expires {new Date(info.expires).toLocaleString('en-IN')} · {info.remaining} accesses
              remain
            </p>
            {info.restricted && (
              <Notice>
                Sign in on this same origin with an allowed university account before opening this
                share.
              </Notice>
            )}
            {info.protected && (
              <label className="field">
                Share password
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
            )}
            <Button onClick={() => void access()} disabled={busy}>
              {busy ? 'Opening…' : 'Open share · uses one access'}
            </Button>
          </div>
        )}
        {result && (
          <div className="form-stack">
            {result.text && <pre className="shared-text">{result.text}</pre>}
            {result.url && (
              <a className="btn primary" href={result.url}>
                Download {result.filename} · link valid for 60 seconds
              </a>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
