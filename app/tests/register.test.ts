import test from 'node:test';
import assert from 'node:assert/strict';
import { createProfessorDemo } from '../src/lib/demo.ts';
import { saveRegister } from '../src/lib/register.ts';

test('manual and photo registers share date/period keys and corrections do not create duplicate sessions', () => {
  const data = createProfessorDemo();
  const date = '2026-11-08';
  const records = Object.fromEntries(
    data.students.map((student, i) => [
      student.id,
      i === 0 ? ('absent' as const) : ('present' as const),
    ]),
  );
  const first = saveRegister(
    data,
    data.subjects[0].code,
    date,
    'Period 2',
    records,
    date,
    'new-id',
  );
  const added = first.sessions.find((row) => row.id === 'new-id')!;
  assert.equal(added.date, date);
  assert.equal(added.label, 'Period 2');
  assert.equal(Object.values(added.records).filter((value) => value === 'present').length, 23);
  const revised = saveRegister(
    first,
    data.subjects[0].code,
    date,
    'Period 2',
    { ...records, [data.students[0].id]: 'present' },
    date,
    'different-id',
  );
  assert.equal(revised.sessions.length, first.sessions.length);
  assert.equal(
    revised.sessions.find((row) => row.id === 'new-id')?.records[data.students[0].id],
    'present',
  );
  const other = saveRegister(
    revised,
    data.subjects[0].code,
    date,
    'Period 3',
    records,
    date,
    'period-3',
  );
  assert.equal(other.sessions.length, revised.sessions.length + 1);
  assert.equal(
    data.sessions.some((row) => row.id === 'new-id'),
    false,
  );
});

test('register saves reject incomplete marks, invalid dates, unknown subjects and empty periods', () => {
  const data = createProfessorDemo();
  const records = Object.fromEntries(
    data.students.map((student) => [student.id, 'present' as const]),
  );
  for (const [subject, date, label, marks] of [
    [data.subjects[0].code, '2026-11-08', 'Period 1', {}],
    [data.subjects[0].code, '2026-02-30', 'Period 1', records],
    [data.subjects[0].code, '2026-11-09', 'Period 1', records],
    ['unknown', '2026-11-08', 'Period 1', records],
    [data.subjects[0].code, '2026-11-08', '', records],
  ] as const) {
    assert.throws(() => saveRegister(data, subject, date, label, marks, '2026-11-08', 'id'));
  }
});
