import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { isCalendarDate, missedSlots, attendanceProjection } from '../src/lib/leave-plan.ts';
import { createStudentDemo } from '../src/lib/demo.ts';
import type { Core } from '../src/lib/types.ts';
const { instance } = await WebAssembly.instantiate(
  await readFile(new URL('../public/academic_core.wasm', import.meta.url)),
  {},
);
const core = instance.exports as unknown as Core;

test('leave selection counts only selected days, deduplicates dates and matches whole course codes', () => {
  const data = createStudentDemo();
  assert.deepEqual(missedSlots(data, ['2026-11-09', '2026-11-11', '2026-11-09']), {
    'CSE 202': 4,
    'CSE 204': 2,
    'CSE 203': 2,
  });
  assert.deepEqual(missedSlots(data, ['2026-11-08', '2026-11-14']), {
    'CSE 202': 0,
    'CSE 204': 0,
    'CSE 203': 0,
  });
  const custom = {
    ...data,
    timetable: [{ day: 'Monday', slots: ['CSE2021', 'CSE-202 / CSE204', 'Free', 'CSE 202 (LAB)'] }],
  };
  assert.deepEqual(missedSlots(custom, ['2026-11-09']), {
    'CSE 202': 2,
    'CSE 204': 1,
    'CSE 203': 0,
  });
  assert.deepEqual(missedSlots(data, ['invalid', '2026-02-30']), {
    'CSE 202': 0,
    'CSE 204': 0,
    'CSE 203': 0,
  });
  assert.equal(isCalendarDate('2026-02-29'), false);
  assert.equal(isCalendarDate('2028-02-29'), true);
});

test('leave and bunk forecasts use C++ exact counts and do not mutate university records', () => {
  const data = createStudentDemo();
  const before = JSON.stringify(data);
  const row = data.attendance.find((a) => a.code === 'CSE 204')!;
  const counts = missedSlots(data, ['2026-11-09']);
  const projection = attendanceProjection(core, row, 0, counts[row.code], 75);
  assert.equal(projection.percentage, (25 / 37) * 100);
  assert.equal(projection.need, 11);
  const recovered = attendanceProjection(core, row, 8, 0, 75);
  assert.equal(recovered.percentage, 75);
  assert.equal(recovered.need, 0);
  assert.equal(recovered.skip, 0);
  const safe = attendanceProjection(core, { ...row, present: 42, total: 48 }, 0, 8, 75);
  assert.equal(safe.percentage, 75);
  assert.equal(safe.skip, 0);
  assert.equal(JSON.stringify(data), before);
});
