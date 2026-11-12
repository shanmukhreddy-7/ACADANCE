import type { ProfessorData, Session } from './types.ts';
import { isCalendarDate } from './leave-plan.ts';
export const periods = Array.from({ length: 8 }, (_, i) => `Period ${i + 1}`);
export type RegisterSelection = { date: string; label: string; details?: boolean };
export function saveRegister(
  data: ProfessorData,
  subject: string,
  date: string,
  label: string,
  records: Session['records'],
  now: string,
  id: string,
) {
  if (!data.subjects.some((row) => row.code === subject)) throw Error('Select a subject.');
  if (!isCalendarDate(date) || date > now) throw Error('Choose today or a past date.');
  if (!label.trim()) throw Error('Choose a period.');
  if (!data.students.length) throw Error('Add students first.');
  if (
    data.students.some((student) => !['present', 'absent', 'leave'].includes(records[student.id]))
  )
    throw Error('Mark every student before saving.');
  const current = data.sessions.find(
    (row) => row.subject === subject && row.date === date && row.label === label.trim(),
  );
  const session: Session = {
    id: current?.id ?? id,
    subject,
    date,
    label: label.trim(),
    cancelled: false,
    records: Object.fromEntries(data.students.map((student) => [student.id, records[student.id]])),
  };
  return {
    ...data,
    sessions: current
      ? data.sessions.map((row) => (row.id === current.id ? session : row))
      : [...data.sessions, session],
  };
}
