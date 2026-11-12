import * as cheerio from 'cheerio';
export type Upstream = (path: string, body: URLSearchParams) => Promise<Response>;
const report = '/students/report/studentreportresources.jsp';
export async function pastInternals(fetcher: Upstream, semester?: number) {
  const $ = cheerio.load(await (await fetcher(report, new URLSearchParams({ ids: '22' }))).text());
  const semesters: { semester: number; label: string }[] = [];
  $('button').each((_, el) => {
    const match = ($(el).attr('onclick') ?? '').match(/funEarlierInternalMarks\((\d+)\)/);
    if (match) semesters.push({ semester: Number(match[1]), label: $(el).text().trim() });
  });
  if (!semester) return { semesters, rows: [] };
  if (!semesters.some((s) => s.semester === semester)) throw Error('Choose an available semester.');
  const detail = cheerio.load(
    await (
      await fetcher(report, new URLSearchParams({ ids: '23', filter: String(semester) }))
    ).text(),
  );
  const rows: string[][] = [];
  detail('tr').each((_, el) => {
    const cells = detail(el)
      .find('td')
      .map((_, td) => detail(td).text().trim())
      .get();
    if (cells.length === 6) rows.push(cells);
  });
  return { semesters, rows };
}
export async function todayAttendance(fetcher: Upstream) {
  const html = await (
    await fetcher('/students/transaction/studentattendance.jsp', new URLSearchParams({ ids: '33' }))
  ).text();
  const $ = cheerio.load(html);
  const rows: string[][] = [];
  $('div.container-fluid').each((_, el) => {
    if (!$(el).text().includes('Today Attendance')) return;
    $(el)
      .find('div.row')
      .each((_, row) => {
        const cells = $(row)
          .children('div')
          .map((_, col) => $(col).text().trim())
          .get();
        if (cells.length === 5 && !/date/i.test(cells[0])) rows.push(cells);
      });
  });
  return { rows };
}
export async function feedbackSubjects(fetcher: Upstream) {
  const $ = cheerio.load(
    await (
      await fetcher(
        '/students/transaction/subjectwisefeedback.jsp',
        new URLSearchParams({ ids: '9' }),
      )
    ).text(),
  );
  const subjects: { id: string; name: string; faculty: string }[] = [];
  $('td.clsSubject').each((_, el) => {
    const id = $(el).attr('id');
    if (!id) return;
    const copy = $(el).clone();
    const faculty = copy.find('font').text().trim();
    copy.find('font').remove();
    subjects.push({ id, name: copy.text().replace(/\s+/g, ' ').trim(), faculty });
  });
  return {
    subjects,
    type: String($('#feedbacktype').val() ?? ''),
    controller: String($('#mcontroller').val() ?? ''),
  };
}
export async function feedbackForm(fetcher: Upstream, subjectId: string) {
  const list = await feedbackSubjects(fetcher);
  if (!list.subjects.some((s) => s.id === subjectId))
    throw Error('Feedback subject is no longer available.');
  const $ = cheerio.load(
    await (
      await fetcher(
        '/students/transaction/subjectwisefeedbackresources.jsp',
        new URLSearchParams({ ids: '1', filter: subjectId, controller: list.controller }),
      )
    ).text(),
  );
  const questions: {
    id: string;
    text: string;
    options: {
      id: string;
      label: string;
      value: string;
      points: string;
      quesid: string;
      partid: string;
    }[];
    descriptive?: { quesid: string; partid: string };
  }[] = [];
  $('tr.clsquestions').each((_, el) => {
    const row = $(el);
    const options = row
      .find('input.answers')
      .map((_, input) => {
        const i = $(input);
        return {
          id: i.attr('id') ?? '',
          label:
            i.closest('label').text().trim() ||
            (
              {
                '21': 'Strongly disagree',
                '22': 'Somewhat disagree',
                '23': 'Neutral',
                '24': 'Somewhat agree',
                '25': 'Strongly agree',
              } as Record<string, string>
            )[i.attr('answervalue') ?? ''] ||
            i.attr('answervalue') ||
            '',
          value: i.attr('answervalue') ?? '',
          points: i.attr('pointvalue') ?? '',
          quesid: i.attr('quesid') ?? '',
          partid: i.attr('partid') ?? '',
        };
      })
      .get();
    const area = row.find('textarea');
    const id = (area.length ? row.attr('itemid') : row.attr('id'))?.replace(/_\d+$/, '');
    if (!id) return;
    const text = row.children('td').slice(0, 2).text().trim() || `Question ${questions.length + 1}`;
    questions.push({
      id,
      text,
      options,
      descriptive: area.length
        ? { quesid: area.attr('quesid') ?? '', partid: area.attr('partid') ?? '6' }
        : undefined,
    });
  });
  return {
    subjectId,
    controller: String($('#hdnControllerId').val() ?? ''),
    remarks: String($('#txtRemarks').val() ?? ''),
    type: list.type,
    questions,
  };
}
export async function submitFeedback(
  fetcher: Upstream,
  subjectId: string,
  answers: Record<string, string>,
) {
  const form = await feedbackForm(fetcher, subjectId);
  const structured: Record<string, string>[] = [];
  const descriptive: Record<string, string>[] = [];
  if (!form.questions.length) throw Error('The portal did not return feedback questions.');
  for (const q of form.questions) {
    const value = answers[q.id];
    if (q.descriptive) {
      if (typeof value !== 'string' || !value.trim() || value.length > 2000)
        throw Error('Complete every written answer.');
      descriptive.push({
        questionid: q.id,
        answerdesc: value,
        quesid: q.descriptive.quesid,
        partid: q.descriptive.partid,
      });
    } else {
      const option = q.options.find((o) => o.id === value);
      if (!option) throw Error('Choose an answer for every question.');
      structured.push({
        questionid: q.id,
        answerid: option.id,
        answerdesc: option.label,
        quesid: option.quesid,
        partid: option.partid,
        answervalue: option.value,
        pointvalue: option.points,
      });
    }
  }
  const text = await (
    await fetcher(
      '/students/transaction/subjectwisefeedbackresources.jsp',
      new URLSearchParams({
        ids: '2',
        filter: '',
        hdnSubjectId: subjectId,
        hdnControllerId: form.controller,
        txtRemarks: form.remarks,
        remarks: form.remarks,
        feedbacktype: form.type,
        answers: JSON.stringify(structured),
        descriptiveanswer: JSON.stringify(descriptive),
      }),
    )
  ).text();
  let result;
  try {
    result = JSON.parse(text);
  } catch {
    throw Error(
      'The portal did not confirm submission. Check the university portal before retrying.',
    );
  }
  if (result.result !== 'Feedback Completed')
    throw Error(String(result.result ?? 'Feedback was not accepted.'));
  return { success: true, message: 'The university confirmed your feedback submission.' };
}
