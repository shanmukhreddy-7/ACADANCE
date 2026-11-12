import type { Attendance, Core, PortalData } from './types.ts';

export function isCalendarDate(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value + 'T12:00:00Z')) &&
    new Date(value + 'T12:00:00Z').toISOString().slice(0, 10) === value
  );
}

export function missedSlots(data: Pick<PortalData, 'attendance' | 'timetable'>, dates: string[]) {
  const counts: Record<string, number> = Object.fromEntries(
    data.attendance.map((a) => [a.code, 0]),
  );
  for (const date of new Set(dates)) {
    if (!isCalendarDate(date)) continue;
    const weekday = new Date(date + 'T12:00:00Z').getUTCDay();
    const name = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][weekday];
    const day = data.timetable.find((d) => d.day.toLowerCase().startsWith(name));
    for (const slot of day?.slots ?? []) {
      const words = slot
        .toUpperCase()
        .replace(/[\s-]+/g, '')
        .split(/[^A-Z0-9]+/);
      for (const subject of data.attendance) {
        const code = subject.code.toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (code && words.includes(code)) counts[subject.code]++;
      }
    }
  }
  return counts;
}

export function attendanceProjection(
  core: Core,
  row: Attendance,
  attend: number,
  miss: number,
  target: number,
  approved = 0,
) {
  return {
    percentage: core.attendance_scenario(row.present, row.total, attend, miss, approved),
    need: core.scenario_need_attend(row.present, row.total, attend, miss, approved, target),
    skip: core.scenario_can_skip(row.present, row.total, attend, miss, approved, target),
  };
}
