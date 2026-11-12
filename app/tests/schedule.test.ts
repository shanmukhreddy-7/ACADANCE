import test from 'node:test';
import assert from 'node:assert/strict';
import { slotMinutes } from '../src/lib/schedule.ts';
test('timetable time ranges support portal dot/colon formats and AM/PM', () => {
  assert.deepEqual(slotMinutes('08.50 AM - 09.40 AM'), [530, 580]);
  assert.deepEqual(slotMinutes('12:00 PM–12:50 PM'), [720, 770]);
  assert.deepEqual(slotMinutes('14:00–14:50'), [840, 890]);
  assert.equal(slotMinutes('Slot 1'), null);
  assert.equal(slotMinutes('9:99–10:50'), null);
});
