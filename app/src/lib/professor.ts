import type { Core, ProfessorData } from './types';
import { sum } from './core.ts';
export function attendanceFor(data: ProfessorData, id: string, subject: string) {
  const sessions = data.sessions.filter(
    (s) => s.subject === subject && !s.cancelled && s.records[id],
  );
  return {
    present: sessions.filter((s) => s.records[id] === 'present').length,
    total: sessions.length,
    leave: sessions.filter((s) => s.records[id] === 'leave').length,
  };
}
export function studentSummary(core: Core, data: ProfessorData, id: string, subject: string) {
  const a = attendanceFor(data, id, subject);
  const percent = core.attendance(a.present, a.total);
  const comps = data.components[subject] ?? [];
  let graded = 0;
  const results = comps.map((c) => {
    if (c.type === 'attendance') {
      const value = percent < 0 ? null : core.attendance_marks(percent, c.weight);
      return { component: c, value };
    }
    const raw = data.marks[id]?.[c.id];
    if (raw === null || raw === undefined) return { component: c, value: null };
    graded++;
    return { component: c, value: core.convert_marks(raw, c.max, c.weight) };
  });
  const earned = sum(
    core,
    results.filter((r) => r.value !== null).map((r) => r.value!),
  );
  const available = sum(
    core,
    results.filter((r) => r.value !== null).map((r) => r.component.weight),
  );
  // Attendance contributes to earned internal marks, but academic performance
  // bands require at least one assessed exam, lab, or project component.
  const academicResults = results.filter((r) => r.component.type === 'exam' && r.value !== null);
  const academicWeight = sum(
    core,
    academicResults.map((r) => r.component.weight),
  );
  const academicEarned = sum(
    core,
    academicResults.map((r) => r.value!),
  );
  const score = academicWeight > 0 ? core.attendance(academicEarned, academicWeight) : -1;
  return {
    ...a,
    percent,
    earned,
    available,
    score,
    graded,
    pending: results.filter((r) => r.value === null).length,
    results,
    band: core.performance_band(score),
  };
}
