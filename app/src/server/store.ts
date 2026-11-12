import { readFile, writeFile, mkdir, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { MongoClient } from 'mongodb';
import { encrypt, decrypt } from './session.ts';
export type Resource = {
  id: string;
  title: string;
  year: string;
  course: string;
  subject: string;
  kind: string;
  url?: string;
  file?: string;
  filename?: string;
  owner: string;
  createdAt: string;
};
export type Share = {
  id: string;
  owner: string;
  title: string;
  text?: string;
  file?: string;
  filename?: string;
  mime?: string;
  password?: string;
  allowed: string[];
  expires: number;
  remaining: number;
  createdAt: string;
  tokens: Record<string, number>;
};
export type GameRoom = {
  id: string;
  white: string;
  black?: string;
  fen: string;
  moves: string[];
  updated: number;
};
export type ChatRoom = {
  random?: boolean;
  id: string;
  participants: string[];
  messages: { sender: string; text: string; at: number }[];
  updated: number;
};
export type SharedState = {
  faculty?: Record<string, { faculty: string; location: string; hidden?: boolean }>;
  captcha?: { enabled: boolean; requests: number; suggestions: number };
  resources: Resource[];
  shares: Share[];
  timetables: Record<
    string,
    {
      savedAt: string;
      timetable: { day: string; slots: string[] }[];
      timeHeaders: string[];
      subjects: { code: string; name: string; faculty?: string; room?: string }[];
    }
  >;
  ratings: Record<string, Record<string, number>>;
  games: GameRoom[];
  chats: ChatRoom[];
  reports: { id: string; by: string; text: string; at: string }[];
};
const empty = (): SharedState => ({
  resources: [],
  shares: [],
  timetables: {},
  ratings: {},
  games: [],
  chats: [],
  reports: [],
});
const file = path.join(process.cwd(), 'data', 'community.enc');
let client: MongoClient | undefined;
let queue = Promise.resolve();
async function collection() {
  if (!process.env.MONGO_URI)
    throw Error(
      'Hosted shared tools need MONGO_URI. Local mode stores encrypted data in app/data.',
    );
  client ??= new MongoClient(process.env.MONGO_URI);
  await client.connect();
  return client.db('acadence').collection<{ _id: string; version: number; value: string }>('state');
}
export async function readState(): Promise<SharedState> {
  if (process.env.MONGO_URI) {
    const doc = await (await collection()).findOne({ _id: 'community' });
    return doc ? decrypt(doc.value) : empty();
  }
  if (process.env.VERCEL) throw Error('Set MONGO_URI before using shared tools on Vercel.');
  try {
    return decrypt(await readFile(file, 'utf8'));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return empty();
    throw e;
  }
}
export async function mutateState<T>(fn: (state: SharedState) => T): Promise<T> {
  if (process.env.MONGO_URI) {
    const col = await collection();
    for (let retry = 0; retry < 8; retry++) {
      const doc = await col.findOne({ _id: 'community' });
      const state: SharedState = doc ? decrypt(doc.value) : empty();
      const result = fn(state);
      try {
        if (!doc) {
          await col.insertOne({ _id: 'community', version: 1, value: encrypt(state) });
          return result;
        }
        const update = await col.updateOne(
          { _id: 'community', version: doc.version },
          { $set: { value: encrypt(state) }, $inc: { version: 1 } },
        );
        if (update.modifiedCount) return result;
      } catch (e) {
        if ((e as { code?: number }).code !== 11000) throw e;
      }
    }
    throw Error('Shared data changed. Please retry.');
  }
  if (process.env.VERCEL) throw Error('Set MONGO_URI before using shared tools on Vercel.');
  let release!: () => void;
  const before = queue;
  queue = new Promise<void>((r) => (release = r));
  await before;
  try {
    const state = await readState();
    const result = fn(state);
    await mkdir(path.dirname(file), { recursive: true });
    const temp = file + '.tmp';
    await writeFile(temp, encrypt(state), { mode: 0o600 });
    await rename(temp, file);
    return result;
  } finally {
    release();
  }
}
function blobPath(id: string) {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id)) throw Error('Invalid file identifier.');
  return path.join(process.cwd(), 'data', 'files', id + '.enc');
}
async function s3() {
  if (
    !process.env.B2_BUCKET ||
    !process.env.B2_ENDPOINT ||
    !process.env.B2_KEY_ID ||
    !process.env.B2_APP_KEY
  )
    throw Error(
      'Configure B2_BUCKET, B2_ENDPOINT, B2_REGION, B2_KEY_ID and B2_APP_KEY for hosted files.',
    );
  const { S3Client } = await import('@aws-sdk/client-s3');
  return new S3Client({
    endpoint: process.env.B2_ENDPOINT,
    region: process.env.B2_REGION ?? 'us-west-004',
    credentials: { accessKeyId: process.env.B2_KEY_ID, secretAccessKey: process.env.B2_APP_KEY },
  });
}
export async function saveBlob(id: string, bytes: Buffer) {
  const value = encrypt({ bytes: bytes.toString('base64') });
  if (process.env.B2_BUCKET) {
    const { PutObjectCommand } = await import('@aws-sdk/client-s3');
    await (
      await s3()
    ).send(
      new PutObjectCommand({
        Bucket: process.env.B2_BUCKET,
        Key: 'acadence/' + id,
        Body: value,
        ContentType: 'application/octet-stream',
      }),
    );
  } else {
    if (process.env.VERCEL) throw Error('Configure B2 object storage for file uploads on Vercel.');
    const file = blobPath(id);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, value, { mode: 0o600 });
  }
}
export async function getBlob(id: string) {
  let value: string;
  if (process.env.B2_BUCKET) {
    const { GetObjectCommand } = await import('@aws-sdk/client-s3');
    const result = await (
      await s3()
    ).send(new GetObjectCommand({ Bucket: process.env.B2_BUCKET, Key: 'acadence/' + id }));
    value = await result.Body!.transformToString();
  } else value = await readFile(blobPath(id), 'utf8');
  return Buffer.from(decrypt<{ bytes: string }>(value).bytes, 'base64');
}
export async function removeBlob(id: string) {
  if (process.env.B2_BUCKET) {
    const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
    await (
      await s3()
    ).send(new DeleteObjectCommand({ Bucket: process.env.B2_BUCKET, Key: 'acadence/' + id }));
  } else await unlink(blobPath(id)).catch(() => {});
}
export async function purgeExpired() {
  const files = await mutateState((state) => {
    const expired = state.shares.filter((s) => s.expires <= Date.now());
    state.shares = state.shares.filter((s) => s.expires > Date.now());
    state.games = state.games.filter((g) => g.updated > Date.now() - 86400000);
    state.chats = state.chats.filter((g) => g.updated > Date.now() - 3600000);
    return expired.flatMap((s) => (s.file ? [s.file] : []));
  });
  await Promise.allSettled(files.map(removeBlob));
}
