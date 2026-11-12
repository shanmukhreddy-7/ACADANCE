import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import type { Core } from '../src/lib/types.ts';
import {
  defaultSeatPlan,
  validateSeatPlan,
  seatRegion,
  comparePhotoPixels,
} from '../src/lib/photo-attendance.ts';
import { automaticLogin } from '../src/server/automatic-login.ts';
const { instance } = await WebAssembly.instantiate(
  await readFile(new URL('../public/academic_core.wasm', import.meta.url)),
  {},
);
const core = instance.exports as unknown as Core;
test('automatic sign-in keeps verification server-side and submits credentials only after a suggestion', async () => {
  let calls = 0,
    submissions = 0;
  const result = await automaticLogin('AP00000000001', 'synthetic-password', {
    challenge: async () => ({ id: 'session-' + ++calls, suggestion: calls === 1 ? null : 'ABCDE' }),
    submit: async (id, registration, password, code) => {
      submissions++;
      assert.equal(id, 'session-2');
      assert.equal(code, 'ABCDE');
      assert.equal(password, 'synthetic-password');
      return 'authenticated-session';
    },
  });
  assert.equal(result, 'authenticated-session');
  assert.equal(calls, 2);
  assert.equal(submissions, 1);
  await assert.rejects(
    automaticLogin('AP00000000001', 'test', {
      challenge: async () => ({ id: 's', suggestion: null }),
      submit: async () => {
        throw Error('must not submit');
      },
    }),
    /try again shortly/i,
  );
  await assert.rejects(
    automaticLogin('AP00000000001', 'test', {
      challenge: async () => ({ id: 's', suggestion: 'ABCDE' }),
      submit: async () => {
        throw Error('private upstream response');
      },
    }),
    /registration number and password/,
  );
});
test('C++ photo comparison handles unchanged pixels, exposure changes, occupancy and review boundaries', () => {
  const empty = new Uint8Array(32 * 32 * 4).fill(100),
    same = new Uint8Array(empty);
  assert.equal(comparePhotoPixels(core, empty, same, 30, 0).fraction, 0);
  const brighter = new Uint8Array(empty).fill(120);
  assert.equal(comparePhotoPixels(core, empty, brighter, 10, 20).fraction, 0);
  const occupied = new Uint8Array(empty);
  for (let i = 0; i < 400; i++) occupied.fill(0, i * 4, i * 4 + 3);
  const difference = comparePhotoPixels(core, empty, occupied, 30, 0);
  assert.equal(difference.fraction, 400 / 1024);
  assert.equal(core.photo_seat_state(difference.fraction, 0.07, 0.22), 1);
  assert.equal(core.photo_seat_state(0.04, 0.07, 0.22), 0);
  assert.equal(core.photo_seat_state(0.15, 0.07, 0.22), 2);
  assert.equal(core.photo_seat_state(0.15, 0.3, 0.2), -1);
  assert.equal(core.photo_changed_fraction(1025, 30, 0), -1);
});
test('seating plan rejects duplicates, missing students and out-of-frame regions', () => {
  const students = Array.from({ length: 24 }, (_, i) => ({
    id: 'demo-' + i,
    name: 'Student ' + i,
  }));
  const plan = defaultSeatPlan(students);
  validateSeatPlan(plan, students);
  assert.throws(
    () =>
      validateSeatPlan(
        { ...plan, assignments: plan.assignments.map(() => students[0].id) },
        students,
      ),
    /only one seat/,
  );
  assert.throws(
    () =>
      validateSeatPlan(
        { ...plan, assignments: plan.assignments.map((id, i) => (i === 0 ? '' : id)) },
        students,
      ),
    /every student/,
  );
  assert.throws(() => validateSeatPlan({ ...plan, left: 0.9 }, students), /inside/);
  assert.throws(() => validateSeatPlan({ ...plan, offsetY: 0.4 }, students), /outside/);
});
test('generated demo photographs produce 20 occupied and the four visibly empty seats from actual pixels', async () => {
  const students = Array.from({ length: 24 }, (_, i) => ({ id: String(i), name: String(i) }));
  const plan = defaultSeatPlan(students);
  async function sample(file: string, region: ReturnType<typeof seatRegion>) {
    const input = new URL('../public/photo-demo/' + file, import.meta.url);
    const { width, height } = await sharp(await readFile(input)).metadata();
    return sharp(await readFile(input))
      .extract({
        left: Math.round(region.x * width!),
        top: Math.round(region.y * height!),
        width: Math.round(region.width * width!),
        height: Math.round(region.height * height!),
      })
      .resize(32, 32)
      .ensureAlpha()
      .raw()
      .toBuffer();
  }
  const full = { x: 0, y: 0, width: 1, height: 1 };
  const shift = comparePhotoPixels(
    core,
    await sample('empty-classroom.png', full),
    await sample('occupied-classroom.png', full),
    36,
    0,
  ).shift;
  const absent: number[] = [];
  let present = 0;
  for (let i = 0; i < 24; i++) {
    const region = seatRegion(plan, i);
    const value = comparePhotoPixels(
      core,
      await sample('empty-classroom.png', region),
      await sample('occupied-classroom.png', region),
      36,
      shift,
    ).fraction;
    const state = core.photo_seat_state(value, 0.07, 0.22);
    if (state === 0) absent.push(i + 1);
    if (state === 1) present++;
  }
  assert.equal(present, 20);
  assert.deepEqual(absent, [2, 11, 13, 22]);
});
test('automatic sign-in hides upstream verification errors from the credential-only form', async () => {
  await assert.rejects(
    automaticLogin('AP00000000001', 'test', {
      challenge: async () => {
        throw Error('private verification failure');
      },
      submit: async () => '',
    }),
    /sign-in service is unavailable/,
  );
});
