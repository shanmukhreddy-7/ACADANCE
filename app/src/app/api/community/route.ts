import { NextRequest, NextResponse } from 'next/server';
import { randomBytes, scryptSync } from 'node:crypto';
import { Chess } from 'chess.js';
import { readSession, sameOrigin, isAdmin } from '@/server/session';
import { readState, mutateState, saveBlob, removeBlob, purgeExpired } from '@/server/store';
import faculty from '@/data/faculty.json';
import { slotMinutes } from '@/lib/schedule';
export const runtime = 'nodejs';
const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
function hashPassword(value: string) {
  const salt = randomBytes(16).toString('hex');
  return salt + ':' + scryptSync(value, salt, 32).toString('hex');
}
const id = () => randomBytes(16).toString('base64url');
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return json({ error: 'Request origin is not allowed.' }, 403);
  const session = readSession(req);
  if (!session?.authenticated || !session.registration)
    return json({ error: 'Sign in to use shared campus tools.' }, 401);
  const owner = session.registration;
  try {
    const b = await req.json();
    if (b.expectedRegistration && b.expectedRegistration !== owner)
      return json({ error: 'Activate this university account before using campus tools.' }, 409);
    const admin = isAdmin(owner, req);
    const state = await readState();
    if (b.action === 'faculty-directory')
      return json({
        faculty: [
          ...faculty.map((f, index) => ({ ...f, index, ...state.faculty?.[index] })),
          ...Object.entries(state.faculty ?? {})
            .filter(([index]) => Number(index) >= faculty.length)
            .map(([index, f]) => ({ ...f, index: Number(index) })),
        ].filter((f) => !f.hidden),
      });
    if (b.action === 'faculty-update') {
      if (!admin) return json({ error: 'Administrator access required.' }, 403);
      const index = b.index === '' || b.index === undefined ? Date.now() : Number(b.index);
      if (
        !Number.isSafeInteger(index) ||
        index < 0 ||
        !String(b.name ?? '').trim() ||
        String(b.name).length > 200 ||
        String(b.location ?? '').length > 500
      )
        throw Error('Enter a valid faculty name and cabin.');
      await mutateState((s) => {
        s.faculty ??= {};
        s.faculty[index] = {
          faculty: String(b.name).trim(),
          location: String(b.location ?? '').trim(),
          hidden: b.hidden === true,
        };
      });
      return json({ success: true });
    }
    if (b.action === 'captcha-settings') {
      if (!admin) return json({ error: 'Administrator access required.' }, 403);
      await mutateState((s) => {
        s.captcha ??= { enabled: true, requests: 0, suggestions: 0 };
        if (typeof b.enabled === 'boolean') s.captcha.enabled = b.enabled;
      });
      return json({ success: true });
    }
    if (b.action === 'status')
      return json({
        admin,
        resources: state.resources.length,
        shares: state.shares.filter((s) => s.owner === owner && s.expires > Date.now()).length,
        timetables: Object.keys(state.timetables).length,
        storage: process.env.MONGO_URI ? 'MongoDB' : 'Encrypted local storage',
      });
    if (b.action === 'resources') return json({ resources: state.resources });
    if (b.action === 'resource-create') {
      if (!admin)
        return json(
          { error: 'Only the campus resource administrator can publish resources.' },
          403,
        );
      if (typeof b.title !== 'string' || !b.title.trim() || b.title.length > 200)
        throw Error('Enter a resource title.');
      let file: string | undefined;
      if (b.file) {
        const bytes = Buffer.from(String(b.file), 'base64');
        if (bytes.length > 2 * 1024 * 1024) throw Error('Upload files up to 2 MB.');
        file = id();
        await saveBlob(file, bytes);
      }
      if (!file && (!b.url || !/^https:\/\//.test(b.url)))
        throw Error('Use an HTTPS resource URL or upload a file.');
      const resource = {
        id: id(),
        title: b.title.trim(),
        year: String(b.year ?? ''),
        course: String(b.course ?? ''),
        subject: String(b.subject ?? ''),
        kind: String(b.kind ?? 'Notes'),
        url: file ? undefined : String(b.url),
        file,
        filename: String(b.filename ?? 'resource'),
        owner,
        createdAt: new Date().toISOString(),
      };
      try {
        await mutateState((s) => s.resources.push(resource));
      } catch (e) {
        if (file) await removeBlob(file);
        throw e;
      }
      return json({ resource });
    }
    if (b.action === 'resource-update') {
      if (!admin) return json({ error: 'Administrator access required.' }, 403);
      if (typeof b.title !== 'string' || !b.title.trim() || b.title.length > 200)
        throw Error('Enter a resource title.');
      await mutateState((s) => {
        const r = s.resources.find((r) => r.id === b.id);
        if (!r) throw Error('Resource not found.');
        r.title = b.title.trim();
        for (const field of ['year', 'course', 'subject', 'kind'] as const)
          r[field] = String(b[field] ?? r[field]).slice(0, 200);
        if (!r.file && b.url) {
          if (!/^https:\/\//.test(String(b.url))) throw Error('Use an HTTPS resource URL.');
          r.url = String(b.url);
        }
      });
      return json({ success: true });
    }
    if (b.action === 'resource-delete') {
      if (!admin) return json({ error: 'Administrator access required.' }, 403);
      const file = await mutateState((s) => {
        const resource = s.resources.find((r) => r.id === b.id);
        s.resources = s.resources.filter((r) => r.id !== b.id);
        return resource?.file;
      });
      if (file) await removeBlob(file);
      return json({ success: true });
    }
    if (b.action === 'share-create') {
      const text = String(b.text ?? '');
      if (text.length > 100000) throw Error('Keep shared text under 100,000 characters.');
      if (!text && !b.file) throw Error('Add text or a file.');
      const hours = Number(b.hours ?? 24),
        downloads = Number(b.downloads ?? 1);
      if (
        !Number.isFinite(hours) ||
        hours < 1 ||
        hours > 168 ||
        !Number.isInteger(downloads) ||
        downloads < 1 ||
        downloads > 100
      )
        throw Error('Choose 1–168 hours and 1–100 accesses.');
      let file: string | undefined;
      if (b.file) {
        const bytes = Buffer.from(String(b.file), 'base64');
        if (bytes.length > 2 * 1024 * 1024) throw Error('Upload files up to 2 MB.');
        file = id();
        await saveBlob(file, bytes);
      }
      const share = {
        id: id(),
        owner,
        title: String(b.title ?? 'Shared file').slice(0, 150),
        text,
        file,
        filename: String(b.filename ?? 'download').replace(/[\r\n"/\\]/g, '_'),
        mime: 'application/octet-stream',
        password: b.password ? hashPassword(String(b.password)) : undefined,
        allowed: Array.isArray(b.allowed)
          ? b.allowed
              .map((v: unknown) => String(v).trim().toUpperCase())
              .filter(Boolean)
              .slice(0, 100)
          : [],
        expires: Date.now() + hours * 3600000,
        remaining: downloads,
        createdAt: new Date().toISOString(),
        tokens: {},
      };
      try {
        await mutateState((s) => s.shares.push(share));
      } catch (e) {
        if (file) await removeBlob(file);
        throw e;
      }
      return json({ id: share.id, url: new URL('/share/' + share.id, req.url).toString() });
    }
    if (b.action === 'shares')
      return json({
        shares: state.shares
          .filter((s) => s.owner === owner)
          .map(({ password, text, file, tokens, ...s }) => ({
            ...s,
            protected: !!password,
            hasFile: !!file,
            hasText: !!text,
          })),
      });
    if (b.action === 'share-delete') {
      const file = await mutateState((s) => {
        const share = s.shares.find((r) => r.id === b.id);
        if (!share || (share.owner !== owner && !admin))
          throw Error('You cannot remove this share.');
        s.shares = s.shares.filter((r) => r.id !== b.id);
        return share.file;
      });
      if (file) await removeBlob(file);
      return json({ success: true });
    }
    if (b.action === 'faculty-rating') {
      const index = Number(b.index),
        rating = Number(b.rating);
      if (
        (!faculty[index] && !state.faculty?.[index]) ||
        !Number.isInteger(rating) ||
        rating < 1 ||
        rating > 5
      )
        throw Error('Choose a valid faculty member and rating.');
      await mutateState((s) => {
        s.ratings[index] ??= {};
        s.ratings[index][owner] = rating;
      });
      return json({ success: true });
    }
    if (b.action === 'faculty-ratings')
      return json({
        ratings: Object.fromEntries(
          Object.entries(state.ratings).map(([key, values]) => [
            key,
            {
              count: Object.keys(values).length,
              total: Object.values(values).reduce((a, b) => a + b, 0),
              own: values[owner] ?? null,
            },
          ]),
        ),
      });
    if (b.action === 'timetable-share') {
      if (b.consent !== true) throw Error('Timetable sharing requires consent.');
      const d = b.data;
      if (
        !d ||
        !Array.isArray(d.timetable) ||
        !Array.isArray(d.subjects) ||
        !Array.isArray(d.timeHeaders) ||
        JSON.stringify(d).length > 150000
      )
        throw Error('Invalid timetable.');
      await mutateState((s) => {
        s.timetables[owner] = {
          timetable: d.timetable,
          timeHeaders: d.timeHeaders,
          subjects: d.subjects,
          savedAt: new Date().toISOString(),
        };
      });
      return json({ success: true });
    }
    if (b.action === 'timetable-withdraw') {
      await mutateState((s) => delete s.timetables[owner]);
      return json({ success: true });
    }
    if (b.action === 'vacancies' || b.action === 'faculty-schedule') {
      const schedules = Object.values(state.timetables);
      const rows: { day: string; slot: string; room: string; subject: string; faculty: string }[] =
        [];
      for (const d of schedules)
        for (const day of d.timetable)
          day.slots.forEach((slot, i) => {
            const subject = d.subjects.find((s) =>
              slot.replace(/\s/g, '').includes(s.code.replace(/\s/g, '')),
            );
            const room = slot.match(/\(([^)]+)\)/)?.[1] ?? subject?.room ?? '';
            if (room && subject)
              rows.push({
                day: day.day,
                slot: d.timeHeaders[i] ?? `Slot ${i + 1}`,
                room,
                subject: subject.name,
                faculty: subject.faculty ?? '',
              });
          });
      if (b.action === 'faculty-schedule')
        return json({
          rows: rows.filter((r) =>
            r.faculty.toLowerCase().includes(String(b.name ?? '').toLowerCase()),
          ),
          count: schedules.length,
        });
      if (schedules.length < 100)
        return json({
          rooms: [],
          count: schedules.length,
          minimum: 100,
          warning:
            'At least 100 opt-in timetables are required before reporting campus room availability.',
        });
      const rooms = [...new Set(rows.map((r) => r.room))];
      const occupied = new Set(
        rows
          .filter((r) => {
            if (r.day.toLowerCase().slice(0, 3) !== String(b.day).toLowerCase().slice(0, 3))
              return false;
            const a = slotMinutes(r.slot),
              selection = slotMinutes(String(b.slot));
            return a && selection ? a[0] < selection[1] && selection[0] < a[1] : r.slot === b.slot;
          })
          .map((r) => r.room),
      );
      return json({
        rooms: rooms.filter((r) => !occupied.has(r)),
        count: schedules.length,
        warning: 'Based on collected timetables only; extra classes and bookings may differ.',
      });
    }
    if (b.action === 'game-create') {
      const game = {
        id: id(),
        white: owner,
        fen: new Chess().fen(),
        moves: [],
        updated: Date.now(),
      };
      await mutateState((s) => s.games.push(game));
      return json({ id: game.id });
    }
    if (b.action === 'game-join') {
      await mutateState((s) => {
        const game = s.games.find((g) => g.id === b.id);
        if (!game || game.updated < Date.now() - 86400000)
          throw Error('Room not found or expired.');
        if (game.white !== owner && game.black && game.black !== owner)
          throw Error('This game already has two players.');
        if (game.white !== owner) game.black = owner;
        game.updated = Date.now();
      });
      return json({ success: true });
    }
    if (b.action === 'game-state') {
      const game = state.games.find((g) => g.id === b.id);
      if (
        !game ||
        game.updated < Date.now() - 86400000 ||
        (game.white !== owner && game.black !== owner)
      )
        throw Error('Join the game first.');
      return json({
        fen: game.fen,
        moves: game.moves,
        joined: !!game.black,
        side: game.white === owner ? 'w' : 'b',
        updated: game.updated,
      });
    }
    if (b.action === 'game-move') {
      const result = await mutateState((s) => {
        const game = s.games.find((g) => g.id === b.id);
        if (!game || game.updated < Date.now() - 86400000 || !game.black)
          throw Error('Wait for both players.');
        const board = new Chess(game.fen);
        if ((board.turn() === 'w' ? game.white : game.black) !== owner)
          throw Error('It is not your turn.');
        const move = board.move({
          from: String(b.from),
          to: String(b.to),
          promotion: ['q', 'r', 'b', 'n'].includes(b.promotion) ? b.promotion : 'q',
        });
        if (!move) throw Error('Illegal move.');
        game.fen = board.fen();
        game.moves.push(move.san);
        game.updated = Date.now();
        return { fen: game.fen };
      });
      return json(result);
    }
    if (b.action === 'game-leave') {
      await mutateState((s) => {
        s.games = s.games.filter((g) => g.id !== b.id || (g.white !== owner && g.black !== owner));
      });
      return json({ success: true });
    }
    if (b.action === 'chat-leave') {
      await mutateState((s) => {
        s.chats = s.chats.filter((c) => c.id !== b.id || !c.participants.includes(owner));
      });
      return json({ success: true });
    }
    if (b.action === 'chat-match') {
      const matched = await mutateState((s) => {
        const existing = s.chats.find(
          (c) => c.random && c.participants.includes(owner) && c.updated > Date.now() - 120000,
        );
        if (existing) return { id: existing.id };
        let room = s.chats.find(
          (c) =>
            c.random &&
            c.participants.length === 1 &&
            c.updated > Date.now() - 15000 &&
            !c.participants.includes(owner),
        );
        if (room) room.participants.push(owner);
        else {
          room = {
            id: id(),
            random: true,
            participants: [owner],
            messages: [],
            updated: Date.now(),
          };
          s.chats.push(room);
        }
        return { id: room.id };
      });
      return json(matched);
    }
    if (b.action === 'chat-join') {
      const roomId = String(b.id ?? '').trim() || id();
      if (!/^[a-zA-Z0-9_-]{1,100}$/.test(roomId))
        throw Error('Use a room code with letters, numbers, underscores or hyphens.');
      const joined = await mutateState((s) => {
        let room = s.chats.find((c) => c.id === roomId);
        if (!room) {
          room = { id: roomId, participants: [], messages: [], updated: Date.now() };
          s.chats.push(room);
        }
        if (!room.participants.includes(owner) && room.participants.length >= 2)
          throw Error('Room is full.');
        if (!room.participants.includes(owner)) room.participants.push(owner);
        return { id: room.id };
      });
      return json(joined);
    }
    if (b.action === 'chat-state' || b.action === 'chat-send') {
      const result = await mutateState((s) => {
        const room = s.chats.find((c) => c.id === b.id);
        if (!room || room.updated < Date.now() - 3600000 || !room.participants.includes(owner))
          throw Error('Join this chat first.');
        if (b.action === 'chat-send') {
          const text = String(b.text ?? '').trim();
          if (!text || text.length > 1000) throw Error('Use 1–1,000 characters.');
          room.messages.push({ sender: owner, text, at: Date.now() });
          room.messages = room.messages.slice(-100);
        }
        room.updated = Date.now();
        return {
          id: room.id,
          joined: room.participants.length,
          messages: room.messages.map((m) => ({
            text: m.text,
            at: m.at,
            self: m.sender === owner,
          })),
        };
      });
      return json(result);
    }
    if (b.action === 'report') {
      const text = String(b.text ?? '').trim();
      if (text.length < 10 || text.length > 2000)
        throw Error('Write a report between 10 and 2,000 characters.');
      await mutateState((s) =>
        s.reports.push({ id: id(), by: owner, text, at: new Date().toISOString() }),
      );
      return json({ success: true });
    }
    if (b.action === 'admin') {
      if (!admin) return json({ error: 'Administrator access required.' }, 403);
      return json({
        faculty: [
          ...faculty.map((f, index) => ({ ...f, index, ...state.faculty?.[index] })),
          ...Object.entries(state.faculty ?? {})
            .filter(([index]) => Number(index) >= faculty.length)
            .map(([index, f]) => ({ ...f, index: Number(index) })),
        ],
        captcha: state.captcha ?? { enabled: true, requests: 0, suggestions: 0 },
        resources: state.resources,
        reports: state.reports,
        shares: state.shares.map((s) => ({
          id: s.id,
          title: s.title,
          owner: s.owner,
          expires: s.expires,
        })),
        timetables: Object.keys(state.timetables).length,
      });
    }
    if (b.action === 'purge') {
      if (!admin) return json({ error: 'Administrator access required.' }, 403);
      await purgeExpired();
      return json({ success: true });
    }
    return json({ error: 'Unknown campus tool action.' }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Campus tool request failed.' }, 400);
  }
}
