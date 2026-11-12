import type { ProfessorData, Session } from './types';
// Return the last fully completed Monday–Friday teaching week in India time.
export function demoWeekDates(reference: string) {
  const date = new Date(reference + 'T12:00:00Z');
  const day = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - day - (day < 5 ? 7 : 0));
  return Array.from({ length: 5 }, (_, i) =>
    new Date(+date + i * 86400000).toISOString().slice(0, 10),
  );
}
export function addDemoWeek(data: ProfessorData, reference: string) {
  const sessions: Session[] = [];
  for (const [si, subject] of data.subjects.entries())
    for (const [day, date] of demoWeekDates(reference).entries()) {
      if (data.sessions.some((s) => s.subject === subject.code && s.date === date)) continue;
      sessions.push({
        id: `demo-week-${subject.code}-${date}`,
        date,
        subject: subject.code,
        label: 'Lecture',
        cancelled: false,
        records: Object.fromEntries(
          data.students.map((student, i) => [
            student.id,
            (i + day + si) % 19 === 0
              ? 'leave'
              : (i * 3 + day + si) % 11 < 2
                ? 'absent'
                : 'present',
          ]),
        ),
      });
    }
  return { ...data, sessions: [...data.sessions, ...sessions] };
}

export function parseRollNumbers(value: string, count: number) {
  const rolls = new Set<number>();
  if (!value.trim()) return [];
  for (const token of value.split(/[\s,]+/).filter(Boolean)) {
    const match = token.match(/^(\d+)(?:[-–](\d+))?$/);
    if (!match) throw Error('Use roll numbers such as 2, 5-7.');
    const first = Number(match[1]),
      last = Number(match[2] ?? match[1]);
    if (first < 1 || last > count || last < first)
      throw Error(`Choose roster positions from 1 to ${count}.`);
    for (let i = first; i <= last; i++) rolls.add(i);
  }
  return [...rolls].sort((a, b) => a - b);
}
