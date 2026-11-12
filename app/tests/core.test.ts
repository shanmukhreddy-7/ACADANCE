import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import type { Core, ProfessorData } from '../src/lib/types.ts';
import { studentSummary } from '../src/lib/professor.ts';
const { instance } = await WebAssembly.instantiate(
  await readFile(new URL('../public/academic_core.wasm', import.meta.url)),
  {},
);
const core = instance.exports as unknown as Core;
test('attendance boundaries use exact ratios, including the 75 percent edge', () => {
  assert.equal(core.can_skip(46, 48, 75), 13);
  assert.equal(core.need_attend(2, 4, 75), 4);
  assert.equal(core.can_skip(3, 4, 75), 0);
  assert.equal(core.need_attend(0, 0, 75), 1);
  assert.equal(core.need_attend(3, 4, 100), -2);
  assert.equal(core.attendance(0, 0), -1);
  for (let total = 1; total < 100; total++)
    for (let present = 0; present <= total; present++) {
      const skip = core.can_skip(present, total, 75);
      if (present * 100 >= total * 75) {
        assert.ok(present * 100 >= (total + skip) * 75);
        assert.ok(present * 100 < (total + skip + 1) * 75);
      }
      const need = core.need_attend(present, total, 75);
      assert.ok((present + need) * 100 >= (total + need) * 75);
      if (need > 0) assert.ok((present + need - 1) * 100 < (total + need - 1) * 75);
    }
});
test('assessment conversion validates maxima and keeps fractional marks', () => {
  assert.ok(Math.abs(core.convert_marks(36, 50, 15) - 10.8) < 1e-9);
  assert.equal(core.convert_marks(51, 50, 15), -1);
  assert.equal(core.convert_marks(1, 0, 10), -1);
  assert.equal(core.attendance_marks(90, 5), 4);
  assert.equal(core.attendance_marks(74.999, 5), 0);
  [2, 8, 5].forEach((s, i) => core.set_input(i, s, 1));
  assert.equal(core.best_scores(3, 2), 13);
});
test('GPA is credit weighted and excludes zero-credit courses', () => {
  core.set_input(0, 10, 4);
  core.set_input(1, 8, 2);
  core.set_input(2, 0, 0);
  assert.ok(Math.abs(core.weighted_gpa(3) - 56 / 6) < 1e-9);
  core.set_input(0, 10, 0);
  assert.equal(core.weighted_gpa(1), -1);
});
test('teams include every student once, respect capacities and balance scores', () => {
  for (const count of [2, 7, 23, 24, 31, 100])
    for (const size of [3, 4, 5]) {
      for (let i = 0; i < count; i++) core.set_input(i, 100 - (i % 20) * 4, 1);
      const teams = core.generate_teams(count, size, 0);
      const sizes = Array(teams).fill(0);
      for (let i = 0; i < count; i++) {
        const assigned = core.team_for(i);
        assert.ok(assigned >= 0 && assigned < teams);
        sizes[assigned]++;
      }
      assert.equal(
        sizes.reduce((a, b) => a + b, 0),
        count,
      );
      assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1);
      assert.ok(Math.max(...sizes) <= size);
    }
});

test('each team gets all three score bands when the class has enough students', () => {
  const scores = Array.from({ length: 24 }, (_, i) => 100 - (i % 20) * 4);
  scores.forEach((score, i) => core.set_input(i, score, 1));
  const count = core.generate_teams(scores.length, 4, 0);
  const teams: number[][] = Array.from({ length: count }, () => []);
  scores.forEach((score, i) => teams[core.team_for(i)].push(score));
  for (const team of teams) {
    assert.ok(team.some((score) => score >= 75));
    assert.ok(team.some((score) => score >= 50 && score < 75));
    assert.ok(team.some((score) => score < 50));
  }
  const means = teams.map((team) => team.reduce((a, b) => a + b, 0) / team.length);
  assert.ok(Math.max(...means) - Math.min(...means) <= 5);
});

test('pending academic marks are not classified from attendance alone', () => {
  const data: ProfessorData = {
    name: 'Professor',
    students: [{ id: 'S1', name: 'Example' }],
    subjects: [{ code: 'CSE', name: 'Computing', credits: 4 }],
    components: {
      CSE: [
        { id: 'exam', name: 'Mid exam', max: 50, weight: 45, type: 'exam' },
        { id: 'attendance', name: 'Attendance', max: 100, weight: 5, type: 'attendance' },
      ],
    },
    marks: {},
    sessions: [
      {
        id: 'session',
        date: '2026-11-05',
        subject: 'CSE',
        label: 'Lecture',
        cancelled: false,
        records: { S1: 'present' },
      },
    ],
    history: [],
    internalTotal: 50,
    threshold: 75,
  };
  const pending = studentSummary(core, data, 'S1', 'CSE');
  assert.equal(pending.earned, 5);
  assert.equal(pending.band, -1);
  assert.equal(pending.pending, 1);
  data.marks.S1 = { exam: 0 };
  const scoredZero = studentSummary(core, data, 'S1', 'CSE');
  assert.equal(scoredZero.band, 0);
  assert.equal(scoredZero.pending, 0);
});
test('C++ scenarios calculate planned bunks, recovery, OD limits and marks shortage', () => {
  assert.equal(core.attendance_scenario(25, 36, 8, 0, 0), 75);
  assert.equal(core.scenario_need_attend(25, 36, 0, 1, 0, 75), 11);
  assert.equal(core.scenario_can_skip(35, 40, 0, 0, 0, 75), 6);
  assert.equal(core.attendance_scenario(35, 40, 0, 0, 6), -1);
  assert.equal(core.scenario_need_attend(3, 4, 0, 0, 0, 100), -2);
  assert.equal(core.attendance_scenario(0, 0, 0, 0, 0), -1);
  assert.equal(core.attendance_scenario(25, 36, -1, 0, 0), -1);
  assert.equal(core.attendance_scenario(25, 36, 0, 1000001, 0), -1);
  assert.equal(core.marks_needed(35, 50, 75), 2.5);
  assert.equal(core.marks_needed(40, 50, 75), 0);
  assert.equal(core.marks_needed(51, 50, 75), -1);
});
