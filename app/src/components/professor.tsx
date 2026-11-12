'use client';
import { useEffect, useState, useRef } from 'react';
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  ClipboardList,
  ChartNoAxesCombined,
  Shuffle,
  Settings2,
  ArrowUpRight,
  Plus,
  Download,
  Upload,
  Search,
  Check,
  Trash2,
  BookOpen,
  ArrowRight,
  RotateCcw,
  Camera,
} from 'lucide-react';
import Shell from './shell';
import dynamic from 'next/dynamic';
const PhotoAttendance = dynamic(() => import('./photo-attendance'));
import { Button, PageHeading, Stat, Empty, Modal, Notice, Badge, Progress } from './ui';
import type { Core, ProfessorData, Component, Student } from '@/lib/types';
import { createProfessorDemo, emptyProfessor, defaultComponents } from '@/lib/demo';
import { attendanceFor, studentSummary } from '@/lib/professor';
import ProfessorAttendance from './professor-attendance';
import type { RegisterSelection } from '@/lib/register';
import workspaceStyles from './professor-workspace.module.css';
import { isSeatPlan } from '@/lib/photo-attendance';
import { csvDownload, download, today, prettyDate, sum } from '@/lib/core';
const STORAGE = 'acadence.professor.v1';
const nav = [
  { id: 'overview', label: 'Overview', icon: <LayoutDashboard size={18} /> },
  { id: 'attendance', label: 'Attendance', icon: <CalendarCheck size={18} /> },
  { id: 'photo', label: 'Photo attendance', icon: <Camera size={18} /> },
  { id: 'marks', label: 'Assessments', icon: <ClipboardList size={18} /> },
  { id: 'analysis', label: 'Class insights', icon: <ChartNoAxesCombined size={18} /> },
  { id: 'teams', label: 'Project teams', icon: <Shuffle size={18} /> },
  { id: 'students', label: 'Students & subjects', icon: <Users size={18} /> },
  { id: 'settings', label: 'Settings & backup', icon: <Settings2 size={18} /> },
];
export default function Professor({ core, onExit }: { core: Core; onExit: () => void }) {
  const [data, setData] = useState<ProfessorData | null>(null);
  const [ready, setReady] = useState(false);
  const [page, setPage] = useState('overview');
  const [attendanceSelection, setAttendanceSelection] = useState<RegisterSelection>();
  const [subject, setSubject] = useState('CSE 202');
  const [message, setMessage] = useState('');
  const [detail, setDetail] = useState<Student | null>(null);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (validBackup(parsed)) {
          setData(parsed);
          setSubject(parsed.subjects[0]?.code ?? 'CSE 202');
        }
      }
    } catch {}
    setReady(true);
  }, []);
  useEffect(() => {
    if (data && ready) {
      try {
        localStorage.setItem(STORAGE, JSON.stringify(data));
      } catch {
        setMessage('Browser storage is full. Export a backup before closing.');
      }
    }
  }, [data, ready]);
  function update(next: ProfessorData, note?: string) {
    if (note)
      next = {
        ...next,
        history: [{ at: new Date().toISOString(), message: note }, ...next.history].slice(0, 200),
      };
    setData(next);
  }
  function exportReport() {
    if (!data) return;
    csvDownload('acadence-class-report.csv', [
      [
        'Register number',
        'Name',
        'Subject',
        'Present',
        'Recorded sessions',
        'Attendance %',
        'Marks earned',
        'Assessed out of',
        'Pending components',
      ],
      ...data.students.map((st) => {
        const s = studentSummary(core, data, st.id, subject);
        return [
          st.id,
          st.name,
          subject,
          s.present,
          s.total,
          s.percent < 0 ? 'Not recorded' : s.percent.toFixed(2),
          s.earned.toFixed(2),
          s.available,
          s.pending,
        ];
      }),
    ]);
  }
  if (!ready) return <div className="loading-screen">Opening your desk…</div>;
  if (!data)
    return (
      <div className="setup-screen">
        <button className="text-link" onClick={onExit}>
          ← Back to welcome
        </button>
        <h1>Professor workspace</h1>
        <div className="setup-choices">
          <button onClick={() => setData(createProfessorDemo())}>
            <h3>Load demo class</h3>
            <p>24 students · 3 subjects</p>
          </button>
          <button
            onClick={() => {
              setData(emptyProfessor());
              setPage('students');
            }}
          >
            <h3>Create a class</h3>
            <p>Add your students</p>
          </button>
        </div>
        <small>Demo workspace · saved in this browser · no university connection</small>
      </div>
    );
  const summaries = data.students.map((st) => ({
    student: st,
    ...studentSummary(core, data, st.id, subject),
  }));
  const recorded = summaries.filter((s) => s.percent >= 0);
  const average = recorded.length
    ? core.attendance(
        sum(
          core,
          recorded.map((s) => s.present),
        ),
        sum(
          core,
          recorded.map((s) => s.total),
        ),
      )
    : null;
  const shortage = summaries.filter((s) => s.percent >= 0 && s.percent < data.threshold);
  const selected = data.subjects.find((s) => s.code === subject);
  const subjectSelect = (
    <select
      aria-label="Select subject"
      value={subject}
      onChange={(e) => setSubject(e.target.value)}
    >
      {data.subjects.map((s) => (
        <option key={s.code} value={s.code}>
          {s.code} · {s.name}
        </option>
      ))}
    </select>
  );
  return (
    <Shell
      mode="Professor"
      name={data.name}
      nav={nav}
      active={page}
      onNavigate={setPage}
      onExit={onExit}
    >
      {message && (
        <div className="dismiss-notice">
          <Notice>{message}</Notice>
          <button onClick={() => setMessage('')} aria-label="Dismiss notification">
            ×
          </button>
        </div>
      )}
      {page === 'overview' && (
        <>
          <div className={workspaceStyles.heading}>
            <h1>Overview</h1>
            <div className={workspaceStyles.actions}>
              <Button kind="secondary" onClick={exportReport}>
                Export report
              </Button>
              <Button
                onClick={() => {
                  setAttendanceSelection(undefined);
                  setPage('attendance');
                }}
              >
                Take attendance
              </Button>
            </div>
          </div>
          <div className="section-toolbar">{subjectSelect}</div>
          <div className="stats-grid">
            <Stat label="Students" value={data.students.length} detail="Enrolled" />
            <Stat
              label="Attendance"
              value={average === null ? '—' : average.toFixed(1) + '%'}
              detail="Selected subject"
            />
            <Stat
              label="Below target"
              value={shortage.length}
              detail={`${data.threshold}% required`}
            />
            <Stat
              label="Assessments"
              value={data.components[subject]?.length ?? 0}
              detail="Configured"
            />
          </div>
          <section className={workspaceStyles.panel}>
            <h2>Subjects</h2>
            {data.subjects.map((row) => (
              <button
                className={workspaceStyles.subjectButton}
                key={row.code}
                onClick={() => {
                  setSubject(row.code);
                  setAttendanceSelection(undefined);
                  setPage('attendance');
                }}
              >
                <span>
                  <strong>{row.name}</strong>
                  <small>{row.code}</small>
                </span>
                <ArrowRight size={16} />
              </button>
            ))}
          </section>
        </>
      )}
      {page === 'attendance' && (
        <ProfessorAttendance
          data={data}
          subject={subject}
          subjectSelect={subjectSelect}
          update={update}
          notify={setMessage}
          selection={attendanceSelection}
        />
      )}
      {page === 'photo' && (
        <PhotoAttendance
          core={core}
          data={data}
          subject={subject}
          subjectSelect={subjectSelect}
          update={update}
          notify={setMessage}
          onSaved={(selection) => {
            setAttendanceSelection(selection);
            setPage('attendance');
          }}
        />
      )}
      {page === 'marks' && (
        <MarksPage
          core={core}
          data={data}
          subject={subject}
          subjectSelect={subjectSelect}
          update={update}
          notify={setMessage}
        />
      )}
      {page === 'analysis' && (
        <>
          <PageHeading
            eyebrow="CLASS INSIGHTS"
            title="See the whole picture."
            description="Attendance and assessment progress, with space for context."
            action={
              <Button kind="secondary" onClick={exportReport}>
                <Download size={16} /> Export analysis
              </Button>
            }
          />
          <div className="section-toolbar">
            {subjectSelect}
            <Badge>Based on recorded assessments</Badge>
          </div>
          <div className="stats-grid">
            <Stat
              label="Strong progress"
              value={summaries.filter((s) => s.band === 2).length}
              detail="75% or more of assessed marks"
              accent
            />
            <Stat
              label="Developing"
              value={summaries.filter((s) => s.band === 1).length}
              detail="50–74.99% of assessed marks"
            />
            <Stat
              label="Needs support"
              value={summaries.filter((s) => s.band === 0).length}
              detail="Below 50% of assessed marks"
            />
            <Stat
              label="Attendance shortage"
              value={shortage.length}
              detail={`Below ${data.threshold}% recorded attendance`}
            />
          </div>
          <Notice>
            Marks reflect completed components only. Pending marks stay ungraded. These bands are
            descriptive, not a final academic decision.
          </Notice>
          <div className="panel table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Attendance</th>
                  <th>Marks so far</th>
                  <th>Pending</th>
                  <th>Progress</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {summaries.map((s) => (
                  <tr key={s.student.id}>
                    <td>
                      <strong>{s.student.name}</strong>
                      <small>{s.student.id}</small>
                    </td>
                    <td>
                      <span className={s.percent < data.threshold ? 'text-amber' : ''}>
                        {s.percent < 0 ? '—' : s.percent.toFixed(1) + '%'}
                      </span>
                      <Progress
                        value={s.percent}
                        tone={s.percent < data.threshold ? 'amber' : 'green'}
                      />
                    </td>
                    <td>
                      {s.available ? s.earned.toFixed(1) + ' / ' + s.available : 'Not graded'}
                    </td>
                    <td>{s.pending}</td>
                    <td>
                      <Badge tone={s.band === 2 ? 'green' : s.band === 0 ? 'amber' : 'neutral'}>
                        {['Needs support', 'Developing', 'Strong progress'][s.band] ??
                          'Awaiting marks'}
                      </Badge>
                    </td>
                    <td>
                      <button
                        className="icon-btn"
                        onClick={() => setDetail(s.student)}
                        aria-label={'View ' + s.student.name}
                      >
                        <ArrowUpRight size={17} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!summaries.length && (
              <Empty
                title="Your class insights will appear here"
                description="Add students and record attendance or marks to get started."
              />
            )}
          </div>
        </>
      )}
      {page === 'teams' && (
        <TeamsPage
          core={core}
          data={data}
          subject={subject}
          subjectSelect={subjectSelect}
          notify={setMessage}
        />
      )}
      {page === 'students' && (
        <RosterPage data={data} update={update} notify={setMessage} onSubject={setSubject} />
      )}
      {page === 'settings' && (
        <SettingsPage
          data={data}
          update={update}
          notify={setMessage}
          onRestore={(d) => {
            setData(d);
            setSubject(d.subjects[0].code);
          }}
        />
      )}
      {detail && (
        <Modal title={detail.name} wide onClose={() => setDetail(null)}>
          <p className="muted">
            {detail.id} · {selected?.name}
          </p>
          {(() => {
            const s = studentSummary(core, data, detail.id, subject);
            return (
              <>
                <div className="stats-grid compact-stats">
                  <Stat
                    label="Attendance"
                    value={s.percent < 0 ? '—' : s.percent.toFixed(1) + '%'}
                    detail={`${s.present} / ${s.total} recorded sessions`}
                  />
                  <Stat
                    label="Marks earned"
                    value={s.earned.toFixed(1)}
                    detail={`Out of ${s.available} assessed marks`}
                  />
                </div>
                <h3>Assessment breakdown</h3>
                {s.results.map((r) => (
                  <div className="detail-row" key={r.component.id}>
                    <span>{r.component.name}</span>
                    <strong>
                      {r.value === null
                        ? 'Pending'
                        : r.value.toFixed(2) + ' / ' + r.component.weight}
                    </strong>
                  </div>
                ))}
                <h3>Absence dates</h3>
                <div className="chip-list">
                  {data.sessions
                    .filter(
                      (x) =>
                        x.subject === subject &&
                        !x.cancelled &&
                        ['absent', 'leave'].includes(x.records[detail.id]),
                    )
                    .map((x) => (
                      <Badge key={x.id}>
                        {prettyDate(x.date)} · {x.label}
                      </Badge>
                    ))}
                </div>
                {!data.sessions.some(
                  (x) =>
                    x.subject === subject && ['absent', 'leave'].includes(x.records[detail.id]),
                ) && <p className="muted">No absences recorded.</p>}
              </>
            );
          })()}
        </Modal>
      )}
    </Shell>
  );
}
function MarksPage({
  core,
  data,
  subject,
  subjectSelect,
  update,
  notify,
}: {
  core: Core;
  data: ProfessorData;
  subject: string;
  subjectSelect: React.ReactNode;
  update: (d: ProfessorData, n?: string) => void;
  notify: (s: string) => void;
}) {
  const [configure, setConfigure] = useState(false);
  const [components, setComponents] = useState<Component[]>([]);
  const [internalTotal, setInternalTotal] = useState(data.internalTotal);
  const [draft, setDraft] = useState(data.marks);
  const [reason, setReason] = useState('');
  useEffect(() => setDraft(data.marks), [data.marks, subject]);
  const comps = data.components[subject] ?? [];
  function saveMarks() {
    if (!reason.trim()) return notify('Add a brief note for this marks update.');
    update({ ...data, marks: draft }, `Updated marks · ${subject} · ${reason}`);
    setReason('');
    notify('Marks saved. Converted totals have been recalculated.');
  }
  function saveConfig() {
    if (
      !components.length ||
      components.some(
        (c) =>
          !c.name.trim() ||
          !Number.isFinite(c.max) ||
          !Number.isFinite(c.weight) ||
          c.max <= 0 ||
          c.weight < 0,
      ) ||
      internalTotal <= 0
    )
      return notify('Use valid component names, positive maximum marks and non-negative weights.');
    if (
      Math.abs(
        sum(
          core,
          components.map((c) => c.weight),
        ) - internalTotal,
      ) > 0.00001
    )
      return notify('Converted component weights must add up to the internal total.');
    const invalid = data.students.some((s) =>
      components.some((c) => (data.marks[s.id]?.[c.id] ?? 0) > c.max),
    );
    if (invalid)
      return notify('Some recorded marks exceed the new maximum. Correct those marks first.');
    update(
      { ...data, internalTotal, components: { ...data.components, [subject]: components } },
      `Changed assessment pattern · ${subject}`,
    );
    setConfigure(false);
    notify('Assessment pattern saved.');
  }
  return (
    <>
      <PageHeading
        eyebrow="INTERNAL ASSESSMENTS"
        title="Marks, without the maths."
        description="Enter original scores. Conversions and totals are handled for you."
        action={
          <>
            <Button
              kind="secondary"
              onClick={() => {
                setComponents(comps.map((c) => ({ ...c })));
                setInternalTotal(
                  sum(
                    core,
                    comps.map((c) => c.weight),
                  ),
                );
                setConfigure(true);
              }}
            >
              <Settings2 size={16} /> Assessment setup
            </Button>
            <Button onClick={saveMarks}>
              <Check size={16} /> Save marks
            </Button>
          </>
        }
      />
      <div className="section-toolbar">
        {subjectSelect}
        <Badge>
          {sum(
            core,
            comps.map((c) => c.weight),
          )}{' '}
          converted marks
        </Badge>
      </div>
      <Notice>
        Blank means pending. Enter 0 for a scored zero. Attendance marks use the configured
        attendance bands shown in Settings. Paste spreadsheet columns directly into the marks grid.
      </Notice>
      <div className="panel table-wrap marks-table">
        <table>
          <thead>
            <tr>
              <th className="sticky-col">Student</th>
              {comps.map((c) => (
                <th key={c.id}>
                  {c.name}
                  <small>
                    {c.type === 'attendance' ? 'Automatic' : `Out of ${c.max}`} → {c.weight}
                  </small>
                </th>
              ))}
              <th>Earned so far</th>
            </tr>
          </thead>
          <tbody>
            {data.students.map((st, row) => (
              <tr key={st.id}>
                <td className="sticky-col">
                  <strong>{st.name}</strong>
                  <small>{st.id}</small>
                </td>
                {comps.map((c) => (
                  <td key={c.id}>
                    {c.type === 'attendance' ? (
                      <span className="automatic-mark">
                        {(() => {
                          const a = attendanceFor(data, st.id, subject);
                          const p = core.attendance(a.present, a.total);
                          return p < 0 ? '—' : core.attendance_marks(p, c.weight).toFixed(1);
                        })()}
                      </span>
                    ) : (
                      <input
                        type="number"
                        min={0}
                        max={c.max}
                        step="any"
                        aria-label={`${st.name} ${c.name}`}
                        value={draft[st.id]?.[c.id] ?? ''}
                        onChange={(e) => {
                          const value = e.target.value === '' ? null : Number(e.target.value);
                          if (
                            value !== null &&
                            (!Number.isFinite(value) || value < 0 || value > c.max)
                          )
                            return;
                          setDraft({ ...draft, [st.id]: { ...draft[st.id], [c.id]: value } });
                        }}
                        onPaste={(e) => {
                          const cells = e.clipboardData.getData('text').trim().split(/\r?\n/);
                          if (cells.length < 2) return;
                          e.preventDefault();
                          const next = structuredClone(draft);
                          let valid = true;
                          cells.forEach((line, i) => {
                            const student = data.students[row + i];
                            if (!student) return;
                            const value = line.trim() === '' ? null : Number(line.split('\t')[0]);
                            if (
                              value !== null &&
                              (!Number.isFinite(value) || value < 0 || value > c.max)
                            ) {
                              valid = false;
                              return;
                            }
                            next[student.id] ??= {};
                            next[student.id][c.id] = value;
                          });
                          if (valid) setDraft(next);
                          else
                            notify(
                              'Paste contains scores outside the assessment maximum. No values were changed.',
                            );
                        }}
                      />
                    )}
                  </td>
                ))}
                <td>
                  <strong>
                    {studentSummary(core, { ...data, marks: draft }, st.id, subject).earned.toFixed(
                      2,
                    )}
                  </strong>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="panel save-bar">
        <label className="field">
          Update note
          <input
            placeholder="e.g. Mid exam scores entered"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
        <Button onClick={saveMarks}>
          Save marks <ArrowRight size={16} />
        </Button>
      </div>
      {configure && (
        <Modal title="Build your assessment pattern" wide onClose={() => setConfigure(false)}>
          <p className="muted">Choose the components and the weight each contributes.</p>
          <label className="field">
            Total internal marks
            <input
              type="number"
              min={1}
              max={1000}
              value={internalTotal}
              onChange={(e) => setInternalTotal(Number(e.target.value))}
            />
          </label>
          <div className="component-list">
            <div className="component-labels">
              <span>Component</span>
              <span>Conducted /</span>
              <span>Converted /</span>
              <span>Type</span>
              <span />
            </div>
            {components.map((c, i) => (
              <div className="component-row" key={c.id}>
                <input
                  aria-label="Component name"
                  value={c.name}
                  onChange={(e) =>
                    setComponents(
                      components.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)),
                    )
                  }
                />
                <input
                  aria-label={`${c.name} maximum marks`}
                  type="number"
                  min={1}
                  value={c.max}
                  onChange={(e) =>
                    setComponents(
                      components.map((x, j) =>
                        j === i ? { ...x, max: Number(e.target.value) } : x,
                      ),
                    )
                  }
                />
                <input
                  aria-label={`${c.name} converted marks`}
                  type="number"
                  min={0}
                  value={c.weight}
                  onChange={(e) =>
                    setComponents(
                      components.map((x, j) =>
                        j === i ? { ...x, weight: Number(e.target.value) } : x,
                      ),
                    )
                  }
                />
                <select
                  aria-label={`${c.name} type`}
                  value={c.type}
                  onChange={(e) =>
                    setComponents(
                      components.map((x, j) =>
                        j === i ? { ...x, type: e.target.value as Component['type'] } : x,
                      ),
                    )
                  }
                >
                  <option value="exam">Marks</option>
                  <option value="attendance">Attendance</option>
                </select>
                <button
                  className="icon-btn"
                  onClick={() => setComponents(components.filter((_, j) => i !== j))}
                  aria-label={'Remove ' + c.name}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
          <div className="section-toolbar">
            <Button
              kind="secondary"
              onClick={() =>
                setComponents([
                  ...components,
                  {
                    id: crypto.randomUUID(),
                    name: 'New assessment',
                    max: 20,
                    weight: 0,
                    type: 'exam',
                  },
                ])
              }
            >
              <Plus size={15} /> Add component
            </Button>
            <Badge
              tone={
                sum(
                  core,
                  components.map((c) => c.weight),
                ) === internalTotal
                  ? 'green'
                  : 'amber'
              }
            >
              {sum(
                core,
                components.map((c) => c.weight),
              )}{' '}
              / {internalTotal} allocated
            </Badge>
          </div>
          <div className="modal-actions">
            <Button onClick={saveConfig}>Save assessment pattern</Button>
          </div>
        </Modal>
      )}
    </>
  );
}
function TeamsPage({
  core,
  data,
  subject,
  subjectSelect,
  notify,
}: {
  core: Core;
  data: ProfessorData;
  subject: string;
  subjectSelect: React.ReactNode;
  notify: (s: string) => void;
}) {
  const [size, setSize] = useState(4);
  const [teams, setTeams] = useState<Student[][]>([]);
  const [seed, setSeed] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    try {
      const saved = localStorage.getItem('acadence.teams.' + subject);
      setTeams(saved ? JSON.parse(saved) : []);
    } catch {
      setTeams([]);
    }
    setLoaded(true);
    setSelected([]);
  }, [subject]);
  useEffect(() => {
    if (loaded) localStorage.setItem('acadence.teams.' + subject, JSON.stringify(teams));
  }, [teams, loaded, subject]);
  const comps = (data.components[subject] ?? []).filter((c) => c.type === 'exam');
  function score(st: Student) {
    const results = comps
      .filter((c) => !selected.length || selected.includes(c.id))
      .flatMap((c) => {
        const v = data.marks[st.id]?.[c.id];
        return v === null || v === undefined
          ? []
          : [{ value: core.convert_marks(v, c.max, c.weight), weight: c.weight }];
      });
    const w = sum(
      core,
      results.map((r) => r.weight),
    );
    return w
      ? core.attendance(
          sum(
            core,
            results.map((r) => r.value),
          ),
          w,
        )
      : -1;
  }
  function generate() {
    if (data.students.length < 2) return notify('Add at least two students to generate teams.');
    if (data.students.some((st) => score(st) < 0))
      return notify(
        'Each student needs at least one scored assessment from the selected components.',
      );
    data.students.forEach((st, i) => core.set_input(i, score(st), 1));
    const n = core.generate_teams(data.students.length, size, seed);
    if (n < 1) return;
    const groups: Student[][] = Array.from({ length: n }, () => []);
    data.students.forEach((st, i) => groups[core.team_for(i)].push(st));
    setTeams(groups);
    setSeed(seed + 1);
    notify('Teams generated and saved in this browser. You can adjust assignments below.');
  }
  function move(id: string, target: number) {
    const found = teams.flat().find((s) => s.id === id);
    if (!found) return;
    setTeams(
      teams.map((t, i) =>
        i === target ? [...t.filter((s) => s.id !== id), found] : t.filter((s) => s.id !== id),
      ),
    );
  }
  return (
    <>
      <PageHeading
        eyebrow="BETTER TOGETHER"
        title="A little balance. Better teams."
        description="Mix academic strengths and give every project a thoughtful starting point."
        action={
          <Button onClick={generate}>
            <Shuffle size={16} />
            {teams.length ? 'Regenerate teams' : 'Generate teams'}
          </Button>
        }
      />
      <div className="panel team-controls">
        <div>{subjectSelect}</div>
        <label>
          Preferred team size
          <select value={size} onChange={(e) => setSize(Number(e.target.value))}>
            {[3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n} students
              </option>
            ))}
          </select>
        </label>
        <div>
          <span className="field-label">Assessments used · all when none selected</span>
          <div className="chip-list">
            {comps.map((c) => (
              <button
                className={'filter-chip ' + (selected.includes(c.id) ? 'selected' : '')}
                key={c.id}
                onClick={() =>
                  setSelected(
                    selected.includes(c.id)
                      ? selected.filter((x) => x !== c.id)
                      : [...selected, c.id],
                  )
                }
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
      </div>
      <Notice>
        The C++ engine distributes students from highest to lowest normalized assessment score,
        balancing team sizes and totals. Equal mixes are a best effort. Labels stay within the
        professor workspace.
      </Notice>
      {teams.length ? (
        <>
          <div className="section-toolbar">
            <h2>{teams.length} teams, ready to meet</h2>
            <Button
              kind="secondary"
              onClick={() =>
                csvDownload('acadence-project-teams.csv', [
                  ['Team', 'Registration number', 'Name'],
                  ...teams.flatMap((team, i) => team.map((st) => [i + 1, st.id, st.name])),
                ])
              }
            >
              <Download size={16} /> Export team list
            </Button>
          </div>
          <div className="teams-grid">
            {teams.map((team, i) => (
              <section className="panel team-card" key={i}>
                <div className="panel-head">
                  <div>
                    <span className="eyebrow">PROJECT GROUP</span>
                    <h2>Team {String(i + 1).padStart(2, '0')}</h2>
                  </div>
                  <Badge>{team.length} people</Badge>
                </div>
                <p className="team-average">
                  Average assessed score{' '}
                  <strong>
                    {team.length ? (sum(core, team.map(score)) / team.length).toFixed(1) : '—'}%
                  </strong>
                </p>
                {team.map((st) => (
                  <div className="team-member" key={st.id}>
                    <span className="avatar small">
                      {st.name
                        .split(' ')
                        .map((x) => x[0])
                        .join('')}
                    </span>
                    <div>
                      <strong>{st.name}</strong>
                      <small>{score(st).toFixed(0)}% assessed score</small>
                    </div>
                    <select
                      aria-label={'Move ' + st.name + ' to team'}
                      value={i}
                      onChange={(e) => move(st.id, Number(e.target.value))}
                    >
                      {teams.map((_, j) => (
                        <option key={j} value={j}>
                          Team {j + 1}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </section>
            ))}
          </div>
        </>
      ) : (
        <Empty
          title="Good projects start with good teams."
          description="Choose a size and generate a balanced first draft. You can move students between teams before exporting."
          action={
            <Button onClick={generate}>
              Create the first mix <Shuffle size={16} />
            </Button>
          }
        />
      )}
    </>
  );
}
function RosterPage({
  data,
  update,
  notify,
  onSubject,
}: {
  data: ProfessorData;
  update: (d: ProfessorData, n?: string) => void;
  notify: (s: string) => void;
  onSubject: (s: string) => void;
}) {
  const [name, setName] = useState('');
  const [id, setId] = useState('');
  const [search, setSearch] = useState('');
  const [addSubject, setAddSubject] = useState(false);
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [credits, setCredits] = useState(3);
  const [remove, setRemove] = useState<Student | null>(null);
  const file = useRef<HTMLInputElement>(null);
  function add() {
    if (!name.trim() || !id.trim()) return notify('Enter a student name and registration number.');
    if (data.students.some((s) => s.id === id.trim()))
      return notify('That registration number is already in the roster.');
    if (data.students.length >= 1000) return notify('A class can contain up to 1,000 students.');
    update(
      { ...data, students: [...data.students, { id: id.trim(), name: name.trim() }] },
      'Added student ' + id,
    );
    setName('');
    setId('');
  }
  async function importCsv(f: File) {
    const text = await f.text();
    const lines = text.trim().split(/\r?\n/);
    const incoming = lines
      .map((l) => {
        const cells = l.match(/("(?:[^"]|"")*"|[^,]+)(?=,|$)/g) ?? [];
        return cells.map((c) => c.replace(/^"|"$/g, '').replaceAll('""', '"').trim());
      })
      .filter((c) => c.length >= 2);
    if (incoming[0]?.[0].toLowerCase().includes('reg')) incoming.shift();
    const seen = new Set(data.students.map((s) => s.id));
    const additions: Student[] = [];
    for (const [reg, name] of incoming) {
      if (reg && name && !seen.has(reg)) {
        additions.push({ id: reg, name });
        seen.add(reg);
      }
    }
    if (data.students.length + additions.length > 1000)
      return notify('Import would exceed 1,000 students.');
    update(
      { ...data, students: [...data.students, ...additions] },
      `Imported ${additions.length} students`,
    );
    notify(`${additions.length} students imported. Duplicate registration numbers were skipped.`);
  }
  function saveSubject() {
    if (!code.trim() || !title.trim() || !Number.isFinite(credits) || credits < 0)
      return notify('Enter a subject code, name and valid credits.');
    if (data.subjects.some((s) => s.code === code.trim()))
      return notify('That subject code already exists.');
    const s = { code: code.trim(), name: title.trim(), credits };
    update(
      {
        ...data,
        subjects: [...data.subjects, s],
        components: { ...data.components, [s.code]: defaultComponents(s.code) },
      },
      'Added subject ' + s.code,
    );
    onSubject(s.code);
    setAddSubject(false);
    setCode('');
    setTitle('');
  }
  return (
    <>
      <PageHeading
        eyebrow="YOUR CLASSROOM"
        title="Put names to the numbers."
        description="A simple roster. A considered start to every class."
        action={
          <>
            <Button kind="secondary" onClick={() => file.current?.click()}>
              <Upload size={16} /> Import CSV
            </Button>
            <Button
              kind="secondary"
              onClick={() =>
                csvDownload('student-roster-template.csv', [
                  ['Registration number', 'Name'],
                  ['AP260001', 'Sample Student'],
                ])
              }
            >
              <Download size={16} /> CSV template
            </Button>
          </>
        }
      />
      <input
        ref={file}
        type="file"
        accept=".csv"
        hidden
        onChange={(e) => {
          if (e.target.files?.[0])
            void importCsv(e.target.files[0]).catch(() => notify('Could not read that CSV file.'));
          e.target.value = '';
        }}
      />
      <div className="section-toolbar">
        <h2>Subjects</h2>
        <Button kind="ghost" onClick={() => setAddSubject(true)}>
          <Plus size={16} /> Add subject
        </Button>
      </div>
      <div className="subject-chips">
        {data.subjects.map((s) => (
          <div className="subject-chip" key={s.code}>
            <BookOpen size={18} />
            <div>
              <strong>{s.name}</strong>
              <small>
                {s.code} · {s.credits} credits
              </small>
            </div>
          </div>
        ))}
      </div>
      <div className="section-toolbar">
        <h2>
          Student roster <span className="muted">/ {data.students.length}</span>
        </h2>
        <div className="search-box">
          <Search size={16} />
          <input
            placeholder="Search roster…"
            aria-label="Search roster"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      <form
        className="panel add-student"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <label className="field">
          Student name
          <input
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>
        <label className="field">
          Registration number
          <input
            placeholder="e.g. AP25110080001"
            value={id}
            onChange={(e) => setId(e.target.value)}
            required
          />
        </label>
        <Button type="submit">
          <Plus size={16} /> Add student
        </Button>
      </form>
      <div className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>Student name</th>
              <th>Registration number</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data.students
              .filter((s) => (s.name + s.id).toLowerCase().includes(search.toLowerCase()))
              .map((s) => (
                <tr key={s.id}>
                  <td>
                    <strong>{s.name}</strong>
                  </td>
                  <td className="mono">{s.id}</td>
                  <td>
                    <button
                      className="icon-btn"
                      onClick={() => setRemove(s)}
                      aria-label={'Remove ' + s.name}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
        {!data.students.length && (
          <Empty
            title="Your next class starts here"
            description="Add a student above or import your class roster from a CSV file."
          />
        )}
      </div>
      {addSubject && (
        <Modal title="Add a subject" onClose={() => setAddSubject(false)}>
          <div className="form-stack">
            <label className="field">
              Subject code
              <input value={code} onChange={(e) => setCode(e.target.value)} />
            </label>
            <label className="field">
              Subject name
              <input value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label className="field">
              Credits
              <input
                type="number"
                min={0}
                max={30}
                value={credits}
                onChange={(e) => setCredits(Number(e.target.value))}
              />
            </label>
            <Button onClick={saveSubject}>Add subject</Button>
          </div>
        </Modal>
      )}
      {remove && (
        <Modal title="Remove student?" onClose={() => setRemove(null)}>
          <p>
            Remove {remove.name} from this roster? Existing historical records remain in your
            backup.
          </p>
          <div className="modal-actions">
            <Button kind="secondary" onClick={() => setRemove(null)}>
              Keep student
            </Button>
            <Button
              kind="danger"
              onClick={() => {
                update(
                  { ...data, students: data.students.filter((s) => s.id !== remove.id) },
                  'Removed student ' + remove.id,
                );
                setRemove(null);
              }}
            >
              Remove student
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
function validBackup(d: unknown): d is ProfessorData {
  if (!d || typeof d !== 'object') return false;
  const p = d as ProfessorData;
  return (
    (p.photoPlan === undefined || isSeatPlan(p.photoPlan)) &&
    Array.isArray(p.students) &&
    p.students.length <= 1000 &&
    p.students.every((s) => typeof s.id === 'string' && typeof s.name === 'string') &&
    new Set(p.students.map((s) => s.id)).size === p.students.length &&
    Array.isArray(p.subjects) &&
    p.subjects.length > 0 &&
    p.subjects.every(
      (s) => typeof s.code === 'string' && typeof s.name === 'string' && Number.isFinite(s.credits),
    ) &&
    Array.isArray(p.sessions) &&
    p.sessions.every(
      (s) =>
        typeof s.id === 'string' &&
        typeof s.date === 'string' &&
        typeof s.subject === 'string' &&
        typeof s.label === 'string' &&
        typeof s.records === 'object' &&
        s.records !== null &&
        Object.values(s.records).every((v) => ['present', 'absent', 'leave'].includes(v)),
    ) &&
    Array.isArray(p.history) &&
    p.history.every((h) => typeof h.at === 'string' && typeof h.message === 'string') &&
    typeof p.marks === 'object' &&
    p.marks !== null &&
    Object.values(p.marks).every(
      (m) =>
        m &&
        typeof m === 'object' &&
        Object.values(m).every((v) => v === null || (Number.isFinite(v) && v >= 0)),
    ) &&
    typeof p.components === 'object' &&
    p.components !== null &&
    p.subjects.every(
      (s) =>
        Array.isArray(p.components[s.code]) &&
        p.components[s.code].every(
          (c) =>
            typeof c.id === 'string' &&
            typeof c.name === 'string' &&
            c.max > 0 &&
            Number.isFinite(c.max) &&
            c.weight >= 0 &&
            Number.isFinite(c.weight) &&
            ['exam', 'attendance'].includes(c.type),
        ),
    ) &&
    p.threshold > 0 &&
    p.threshold <= 100 &&
    p.internalTotal > 0 &&
    typeof p.name === 'string'
  );
}
function SettingsPage({
  data,
  update,
  notify,
  onRestore,
}: {
  data: ProfessorData;
  update: (d: ProfessorData, n?: string) => void;
  notify: (s: string) => void;
  onRestore: (d: ProfessorData) => void;
}) {
  const [name, setName] = useState(data.name);
  const [threshold, setThreshold] = useState(data.threshold);
  const [reset, setReset] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  return (
    <>
      <PageHeading
        eyebrow="MAKE YOURSELF AT HOME"
        title="Your desk. Your rules."
        description="Set your preferences and keep a copy of your work."
      />
      <div className="two-column">
        <section className="panel padded">
          <h2>Workspace preferences</h2>
          <div className="form-stack">
            <label className="field">
              Professor name
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="field">
              Attendance requirement (%)
              <input
                type="number"
                min={1}
                max={100}
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
              />
            </label>
            <Button
              onClick={() => {
                if (
                  !name.trim() ||
                  !Number.isFinite(threshold) ||
                  threshold <= 0 ||
                  threshold > 100
                )
                  return notify('Enter a name and a threshold between 1 and 100.');
                update({ ...data, name: name.trim(), threshold }, 'Changed workspace preferences');
                notify('Preferences saved.');
              }}
            >
              Save preferences
            </Button>
          </div>
        </section>
        <section className="panel padded">
          <h2>A copy, just in case.</h2>
          <p className="muted">
            Professor records live in this browser. Export a backup to move your workspace or
            protect it before clearing browser data.
          </p>
          <div className="form-stack">
            <Button
              kind="secondary"
              onClick={() =>
                download(
                  'acadence-backup-' + today() + '.json',
                  'application/json',
                  JSON.stringify(data, null, 2),
                )
              }
            >
              <Download size={16} /> Download workspace backup
            </Button>
            <Button kind="secondary" onClick={() => file.current?.click()}>
              <Upload size={16} /> Restore a backup
            </Button>
            <input
              hidden
              type="file"
              ref={file}
              accept="application/json,.json"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  const d = JSON.parse(await f.text());
                  if (!validBackup(d)) throw Error();
                  onRestore(d);
                  notify('Workspace restored from your backup.');
                } catch {
                  notify('That file is not a valid Acadence professor backup.');
                }
                e.target.value = '';
              }}
            />
            <Button kind="ghost" onClick={() => setReset(true)}>
              <RotateCcw size={16} /> Replace with demo class
            </Button>
          </div>
        </section>
      </div>
      <section className="panel padded">
        <h2>How attendance marks work</h2>
        <p className="muted">
          The demo uses this visible rule. Each band awards a share of the attendance component’s
          converted weight.
        </p>
        <div className="rule-bands">
          {[
            ['95–100%', '100%'],
            ['90–94.99%', '80%'],
            ['85–89.99%', '60%'],
            ['80–84.99%', '40%'],
            ['75–79.99%', '20%'],
            ['Below 75%', '0%'],
          ].map(([a, b]) => (
            <div key={a}>
              <strong>{a}</strong>
              <small>{b} of component marks</small>
            </div>
          ))}
        </div>
      </section>
      <section className="panel padded">
        <h2>Correction history</h2>
        {data.history.length ? (
          data.history.slice(0, 30).map((h, i) => (
            <div className="history-row" key={h.at + i}>
              <span className="live-dot" />
              <span>{h.message}</span>
              <small>{new Date(h.at).toLocaleString('en-IN')}</small>
            </div>
          ))
        ) : (
          <p className="muted">Updates to attendance, marks, and your roster will appear here.</p>
        )}
      </section>
      {reset && (
        <Modal title="Replace the current class?" onClose={() => setReset(false)}>
          <p>
            Download a backup first if you want to keep your current records. This will load a fresh
            sample class.
          </p>
          <div className="modal-actions">
            <Button kind="secondary" onClick={() => setReset(false)}>
              Keep my class
            </Button>
            <Button
              onClick={() => {
                onRestore(createProfessorDemo());
                setReset(false);
                notify('Fresh demo class loaded.');
              }}
            >
              Load demo class
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
