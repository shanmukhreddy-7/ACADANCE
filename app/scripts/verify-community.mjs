// Local integration checks use synthetic accounts and never call the university.
import { readFile } from 'node:fs/promises';
import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
const origin = process.env.TEST_ORIGIN ?? 'http://127.0.0.1:3001';
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin))
  throw Error('Use a local verification server.');
const env = await readFile('.env.local', 'utf8');
const secret = env.match(/^SESSION_SECRET=["']?([^\n"']+)/m)?.[1];
if (!secret) throw Error('Local session secret is missing.');
const key = createHash('sha256').update(secret).digest();
function cookie(registration) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const bytes = Buffer.concat([
    cipher.update(
      JSON.stringify({
        id: 'synthetic-no-university-session',
        registration,
        authenticated: true,
        expires: Date.now() + 600000,
      }),
    ),
    cipher.final(),
  ]);
  return (
    'acadence_session_v2=' + Buffer.concat([iv, cipher.getAuthTag(), bytes]).toString('base64url')
  );
}
const a = cookie('AP00000000001'),
  b = cookie('AP00000000002'),
  outsider = cookie('AP00000000003');
async function call(action, payload = {}, who = a) {
  const res = await fetch(origin + '/api/community', {
    method: 'POST',
    headers: { origin, cookie: who, 'content-type': 'application/json' },
    body: JSON.stringify({ action, ...payload }),
  });
  const body = await res.json();
  if (!res.ok) throw Error(body.error);
  return body;
}
async function unlock(id, password, who = a) {
  return fetch(origin + '/api/share/' + id, {
    method: 'POST',
    headers: { origin, cookie: who, 'content-type': 'application/json' },
    body: JSON.stringify({ password }),
  });
}
const resource = await call('resource-create', {
  title: 'Synthetic verification resource',
  url: 'https://example.com',
  year: '2',
  subject: 'TEST',
});
let share, game, chat;
try {
  assert((await call('resources')).resources.some((r) => r.id === resource.resource.id));
  share = await call('share-create', {
    title: 'Synthetic verification share',
    text: 'test content',
    file: Buffer.from('synthetic-file').toString('base64'),
    filename: 'fixture.txt',
    password: 'test-password',
    allowed: ['AP00000000001'],
    hours: 1,
    downloads: 1,
  });
  assert.equal((await unlock(share.id, 'wrong')).status, 400);
  assert.equal((await unlock(share.id, 'test-password', outsider)).status, 400);
  const opened = await unlock(share.id, 'test-password');
  assert(opened.ok);
  const data = await opened.json();
  assert.equal(data.text, 'test content');
  assert.equal((await unlock(share.id, 'test-password')).status, 400);
  const file = await fetch(origin + data.url);
  assert(file.ok);
  assert.equal(await file.text(), 'synthetic-file');
  assert.equal((await fetch(origin + data.url)).status, 400);
  game = await call('game-create');
  await call('game-join', { id: game.id }, b);
  await assert.rejects(call('game-move', { id: game.id, from: 'e7', to: 'e5' }, b));
  await call('game-move', { id: game.id, from: 'e2', to: 'e4' });
  await assert.rejects(call('game-state', { id: game.id }, outsider));
  await call('game-move', { id: game.id, from: 'e7', to: 'e5' }, b);
  assert.equal((await call('game-state', { id: game.id })).moves.join(' '), 'e4 e5');
  chat = await call('chat-join');
  await call('chat-join', { id: chat.id }, b);
  await call('chat-send', { id: chat.id, text: 'Synthetic hello' });
  assert.equal((await call('chat-state', { id: chat.id }, b)).messages[0].self, false);
  await assert.rejects(call('chat-state', { id: chat.id }, outsider));
  const cross = await fetch(origin + '/api/community', {
    method: 'POST',
    headers: { origin: 'https://example.com', cookie: a, 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'resources' }),
  });
  assert.equal(cross.status, 403);
  await assert.rejects(
    call('report', { expectedRegistration: 'AP00000000002', text: 'synthetic report' }),
  );
  console.log(
    'Passed: resource publishing, encrypted shares, password/ACL/access limits, single-use downloads, chess turns, chat membership, origin and account guards.',
  );
} finally {
  if (game) await call('game-leave', { id: game.id });
  if (chat) await call('chat-leave', { id: chat.id });
  await call('resource-delete', { id: resource.resource.id });
  if (share) await call('share-delete', { id: share.id });
}
