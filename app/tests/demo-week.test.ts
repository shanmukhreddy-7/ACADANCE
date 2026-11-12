import test from 'node:test';
import assert from 'node:assert/strict';
import { demoWeekDates, addDemoWeek, parseRollNumbers } from '../src/lib/demo-week.ts';
import { createProfessorDemo, emptyProfessor } from '../src/lib/demo.ts';
test('demo contains a complete teaching week and never overwrites saved attendance', () => {
  const demo = createProfessorDemo();
  assert.equal(demo.students.length, 24);
  assert.equal(demo.sessions.length, 15);
  for (const session of demo.sessions) {
    assert.equal(Object.keys(session.records).length, 24);
    assert.ok(![0, 6].includes(new Date(session.date + 'T12:00:00Z').getUTCDay()));
  }
  assert.equal(addDemoWeek(demo, demo.sessions[4].date.slice(0, 10)).students.length, 24);
  assert.deepEqual(demoWeekDates('2026-11-07'), [
    '2026-11-02',
    '2026-11-03',
    '2026-11-04',
    '2026-11-05',
    '2026-11-06',
  ]);
  assert.equal(demoWeekDates('2026-11-04')[0], '2026-10-26');
  const first = addDemoWeek({ ...emptyProfessor(), students: demo.students }, '2026-11-07');
  first.sessions[0].records[demo.students[0].id] = 'leave';
  const again = addDemoWeek(first, '2026-11-07');
  assert.equal(again.sessions.length, 15);
  assert.equal(again.sessions[0].records[demo.students[0].id], 'leave');
});
test('absentee lists support ranges and reject unknown roll numbers', () => {
  assert.deepEqual(parseRollNumbers('2, 5-7, 5', 24), [2, 5, 6, 7]);
  assert.deepEqual(parseRollNumbers('', 24), []);
  for (const text of ['0', '25', '7-3', 'abc', '2-999999'])
    assert.throws(() => parseRollNumbers(text, 24));
});
