// HTML table extraction adapted from StoreVia/Srmap-Api, with owner permission.
import * as cheerio from 'cheerio';
import type { PortalData, Subject } from './types';
const numeric = (s: string) => {
  const cleaned = s.replace(/,/g, '').trim();
  return cleaned !== '' && Number.isFinite(Number(cleaned)) ? Number(cleaned) : null;
};
export function parsePortal(
  pages: Record<string, string>,
): Omit<PortalData, 'syncedAt' | 'warnings'> {
  const $a = cheerio.load(pages.attendance ?? '');
  const $p = cheerio.load(pages.profile ?? '');
  const $t = cheerio.load(pages.timetable ?? '');
  const $s = cheerio.load(pages.subjects ?? '');
  const $m = cheerio.load(pages.internals ?? '');
  const $l = cheerio.load(pages.ledger ?? '');
  const attendance: PortalData['attendance'] = [];
  $a('#tblSubjectWiseAttendance tr').each((_, row) => {
    const td = $a(row).find('td');
    if (td.length !== 9) return;
    const cells = td.map((_, el) => $a(el).text().trim()).get();
    const p = numeric(cells[3]),
      total = numeric(cells[2]),
      absent = numeric(cells[4]),
      percent = numeric(cells[8]);
    if (p === null || total === null || absent === null || percent === null) return;
    attendance.push({
      code: cells[0],
      name: cells[1],
      total,
      present: p,
      absent,
      od: numeric(cells[5]) ?? 0,
      percentage: percent,
      approvedOdPercentage: numeric(cells[7]) ?? 0,
    });
  });
  const profile: PortalData['profile'] = {
    name: 'Student',
    registration: '',
    semester: '',
    program: '',
  };
  $p('tr').each((_, row) => {
    const td = $p(row).find('td');
    const key = td.first().text().trim().toLowerCase();
    const value = td.last().text().trim();
    if (key === 'student name') profile.name = value;
    if (key.startsWith('register no')) profile.registration = value;
    if (key === 'semester') profile.semester = value;
    if (key.startsWith('program')) {
      const parts = value.split(/\s*\/\s*/);
      profile.program = parts[0];
      if (parts[1]) profile.section = parts.slice(1).join(' / ').replace(/['"]/g, '');
    }
    if (key === 'institution') profile.institution = value;
    if (key === 'section') profile.section = value;
    if (key.startsWith('specialization')) profile.specialization = value;
    if (/d\.?o\.?b\.?|date of birth/i.test(key)) {
      const parts = value.split(/\s+\/\s+|\s*\/\s*(?=male|female|other)/i);
      if (/^\d{1,2}[.\/-]\d{1,2}[.\/-]\d{4}$/.test(parts[0])) profile.dateOfBirth = parts[0];
      if (parts[1]) profile.gender = parts[1];
    }
    if (key === 'gender') profile.gender = value;
  });
  const timetable: PortalData['timetable'] = [];
  let timeHeaders: string[] = [];
  const days = /^(mon|tue|wed|thu|fri|sat|sun)/i;
  $t('tr').each((_, row) => {
    const cells = $t(row)
      .children('td,th')
      .map((_, el) => $t(el).text().replace(/\s+/g, ' ').trim())
      .get();
    if (days.test(cells[0] ?? '') && cells.length > 1)
      timetable.push({ day: cells[0], slots: cells.slice(1) });
    if (
      cells.some((c) => /\d[:.]\d{2}/.test(c)) &&
      cells.length > 2 &&
      !days.test(cells[0] ?? '')
    ) {
      const times = cells.filter((c) => /\d[:.]\d{2}/.test(c));
      if (times.length > timeHeaders.length) timeHeaders = times;
    }
  });
  const subjects: Subject[] = [];
  $s('tr').each((_, row) => {
    const cells = $s(row)
      .find('td')
      .map((_, el) => $s(el).text().trim())
      .get();
    if (cells.length < 4 || !cells[1] || !cells[2] || numeric(cells[3]) === null) return;
    subjects.push({ code: cells[1], name: cells[2], credits: Number(cells[3]) });
  });
  // Timetable's lower table holds faculty and room details by course code.
  $t('tr').each((_, row) => {
    const cells = $t(row)
      .find('td')
      .map((_, el) => $t(el).text().replace(/\s+/g, ' ').trim())
      .get();
    const subject = subjects.find(
      (s) => s.code.replace(/\s/g, '') === cells[0]?.replace(/\s/g, ''),
    );
    if (subject && cells.length >= 5) {
      subject.faculty = cells[3];
      subject.room = cells[4];
    }
  });
  const internals: PortalData['internals'] = [];
  $m('tr').each((_, row) => {
    // Direct cells avoid counting the cells of a nested detail table twice.
    const td = $m(row).children('td');
    if (td.length !== 4 || td.find('table').length) return;
    const cells = td.map((_, el) => $m(el).text().trim()).get();
    if (!cells[0] || !cells[1]) return;
    const exams: NonNullable<PortalData['internals'][number]['exams']> = [];
    const detailRow = $m(row).next('tr');
    detailRow.find('table tr').each((_, detail) => {
      const dtd = $m(detail).children('td');
      if (dtd.length !== 3 || dtd.first().hasClass('ui-state-active') || dtd.find('table').length)
        return;
      const name = dtd.eq(0).text().replace(/\s+/g, ' ').trim();
      if (!name || /^(assessment|exam|component|name|exam name)$/i.test(name)) return;
      const conductedText = dtd.eq(1).text().replace(/\s+/g, ' ').trim(),
        convertedText = dtd.eq(2).text().replace(/\s+/g, ' ').trim();
      const conducted = conductedText.split('/'),
        converted = convertedText.split('/');
      exams.push({
        name,
        conductedScore: numeric(conducted[0] ?? ''),
        conductedMax: numeric(conducted[1] ?? ''),
        convertedScore: numeric(converted[0] ?? ''),
        convertedMax: numeric(converted[1] ?? ''),
        conductedText,
        convertedText,
      });
    });
    const score = numeric(cells[2]),
      max = numeric(cells[3]);
    if ((score !== null && max !== null && max > 0) || exams.length)
      internals.push({ code: cells[0], name: cells[1], score, max, exams });
  });
  const ledger: PortalData['ledger'] = [];
  $l('div.subTable table tr').each((_, row) => {
    const cells = $l(row)
      .find('td')
      .map((_, el) => $l(el).text().trim())
      .get();
    if (cells.length < 9) return;
    const credits = numeric(cells[4]),
      points = numeric(cells[6]);
    if (credits === null || points === null) return;
    ledger.push({
      semester: cells[0],
      code: cells[2],
      name: cells[3],
      credits,
      grade: cells[5],
      points,
      result: cells[7],
      attempt: cells[8],
    });
  });
  const cgpaMatch = $l('body')
    .text()
    .match(/CGPA\s*:\s*([0-9.]+)/i);
  const cgpa = cgpaMatch ? numeric(cgpaMatch[1]) : null;
  const period =
    $a('body')
      .text()
      .replace(/\s+/g, ' ')
      .match(/During the Period\s*:\s*(.*?)(?:Subject Code|Subject Description)/i)?.[1]
      ?.trim() ?? '';
  return {
    profile,
    attendance,
    subjects: subjects.length
      ? subjects
      : attendance.map((a) => ({ code: a.code, name: a.name, credits: 0 })),
    timetable,
    timeHeaders,
    internals,
    ledger,
    cgpa,
    period,
  };
}
