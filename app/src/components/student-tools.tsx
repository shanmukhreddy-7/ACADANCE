'use client';
import { useEffect, useState } from 'react';
import {
  Download,
  Plus,
  Trash2,
  Search,
  RefreshCw,
  ArrowUpRight,
  CalendarDays,
  BookOpen,
  MapPin,
} from 'lucide-react';
import { Button, PageHeading, Notice, Empty, Badge, Modal, Stat } from './ui';
import type { Core, PortalData } from '@/lib/types';
import { campus, portalTool, fileBase64, savedAccounts } from '@/lib/student-services';
import { csvDownload, download } from '@/lib/core';
import calendar from '@/data/academic-calendar.json';
import { ProfileSummary } from './student-marks';
type AnyRow = Record<string, any>;
export default function StudentTools({
  page,
  data,
  core,
  onAddAccount,
  onAccount,
  onSwitchAccount,
}: {
  page: string;
  data: PortalData;
  core: Core;
  onAddAccount: () => void;
  onAccount: (d: PortalData, cachedOnly?: boolean) => void;
  onSwitchAccount: (registration: string) => void;
}) {
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  async function run<T>(fn: () => Promise<T>) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      return await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const props = { data, core, run, busy, notify: setNotice };
  return (
    <>
      {error && <Notice error>{error}</Notice>}
      {notice && <Notice>{notice}</Notice>}
      {page === 'profile' && <Profile {...props} />} {page === 'history' && <History {...props} />}{' '}
      {page === 'past' && <PastInternals {...props} />}{' '}
      {page === 'feedback' && <Feedback {...props} />}{' '}
      {page === 'checkin' && <CheckIn {...props} />} {page === 'calendar' && <Calendar />}{' '}
      {page === 'faculty' && (
        <ComingSoon
          title="Faculty directory"
          description="Faculty search, cabin details and schedules are being prepared."
        />
      )}{' '}
      {page === 'vacant' && (
        <ComingSoon
          title="Empty classrooms"
          description="Classroom availability is under development."
        />
      )}{' '}
      {page === 'resources' && <Resources {...props} />}{' '}
      {page === 'settings' && (
        <StudentSettings
          {...props}
          onAddAccount={onAddAccount}
          onAccount={onAccount}
          onSwitchAccount={onSwitchAccount}
        />
      )}{' '}
      {page === 'admin' && <Admin {...props} />}
    </>
  );
}
type ToolProps = {
  data: PortalData;
  core: Core;
  run: <T>(fn: () => Promise<T>) => Promise<T | undefined>;
  busy: boolean;
  notify: (s: string) => void;
};
function Profile({ data }: ToolProps) {
  return (
    <>
      <PageHeading
        eyebrow="YOUR UNIVERSITY RECORD"
        title="Your campus identity."
        description="Profile and registered courses from the latest successful sync."
      />
      <ProfileSummary profile={data.profile} syncedAt={data.syncedAt} demo={data.demo} />
      <div className="section-toolbar">
        <h2>Registered subjects</h2>
        <Badge>{data.subjects.length} courses</Badge>
      </div>
      <div className="subject-chips">
        {data.subjects.map((s) => (
          <section className="subject-chip" key={s.code}>
            <BookOpen size={20} />
            <div>
              <strong>{s.name}</strong>
              <small>
                {s.code} · {s.credits} credits
              </small>
              <small>{s.faculty || 'Faculty not provided'}</small>
              <small>{s.room || 'Room not provided'}</small>
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
function History({ data, run, busy }: ToolProps) {
  const [rows, setRows] = useState<string[][] | null>(null);
  const [snapshots, setSnapshots] = useState<PortalData[]>([]);
  useEffect(() => {
    try {
      setSnapshots(
        JSON.parse(localStorage.getItem('acadence.history.' + data.profile.registration) ?? '[]'),
      );
    } catch {}
  }, [data.profile.registration]);
  return (
    <>
      <PageHeading
        eyebrow="THE ATTENDANCE RECORD"
        title="A closer look at each day."
        description="Today’s portal entries and the snapshots saved on this device."
        action={
          <Button
            disabled={busy || !!data.demo}
            onClick={() =>
              void run(async () => setRows((await portalTool('today-attendance')).rows))
            }
          >
            <RefreshCw size={16} /> Load today’s records
          </Button>
        }
      />
      {data.demo && <Notice>Today’s live attendance requires a university sign-in.</Notice>}
      {rows && <Table columns={['Date', 'Day', 'Hour', 'Subject', 'Status']} rows={rows} />}
      <div className="section-toolbar">
        <h2>Saved daily snapshots</h2>
        <Button
          kind="secondary"
          onClick={() =>
            csvDownload('attendance-history.csv', [
              ['Captured at', 'Subject', 'Present', 'Absent', 'Total', 'Published %'],
              ...snapshots.flatMap((s) =>
                s.attendance.map((a) => [
                  s.syncedAt,
                  a.name,
                  a.present,
                  a.absent,
                  a.total,
                  a.percentage,
                ]),
              ),
            ])
          }
        >
          <Download size={16} /> Export history
        </Button>
      </div>
      {snapshots.length ? (
        snapshots.map((s) => (
          <section className="panel padded" key={s.syncedAt}>
            <h3>{new Date(s.syncedAt).toLocaleString('en-IN')}</h3>
            <Table
              columns={['Subject', 'Present', 'Absent', 'Recorded', 'Published %']}
              rows={s.attendance.map((a) => [
                a.name,
                String(a.present),
                String(a.absent),
                String(a.total),
                a.percentage.toFixed(2),
              ])}
            />
          </section>
        ))
      ) : (
        <Empty
          title="Your history starts with a sync"
          description="Up to 30 daily snapshots are saved on this device. Earlier attendance is not invented or reconstructed."
        />
      )}
    </>
  );
}
function PastInternals({ data, run, busy }: ToolProps) {
  const [semesters, setSemesters] = useState<{ semester: number; label: string }[]>([]);
  const [semester, setSemester] = useState('');
  const [rows, setRows] = useState<string[][]>([]);
  useEffect(() => {
    if (!data.demo)
      void run(async () => {
        const d = await portalTool('past-internals');
        setSemesters(d.semesters);
      });
  }, []);
  return (
    <>
      <PageHeading
        eyebrow="EARLIER ASSESSMENTS"
        title="The semesters behind you."
        description="Earlier internal marks published by the university."
      />
      <div className="section-toolbar">
        <select
          aria-label="Earlier semester"
          value={semester}
          onChange={(e) => setSemester(e.target.value)}
        >
          <option value="">Choose semester</option>
          {semesters.map((s) => (
            <option key={s.semester} value={s.semester}>
              {s.label}
            </option>
          ))}
        </select>
        <Button
          disabled={busy || !semester || !!data.demo}
          onClick={() =>
            void run(async () =>
              setRows((await portalTool('past-internals', { semester: Number(semester) })).rows),
            )
          }
        >
          Load marks
        </Button>
      </div>
      {rows.length ? (
        <Table columns={['Semester', 'Code', 'Subject', 'Type', 'Marks', 'Maximum']} rows={rows} />
      ) : (
        <Empty
          title={data.demo ? 'University sign-in required' : 'Choose an available semester'}
          description="Only marks returned by the portal will appear here."
        />
      )}
    </>
  );
}
function Calendar() {
  const [term, setTerm] = useState('oddSemesterData');
  const [search, setSearch] = useState('');
  const lists = calendar as unknown as Record<string, AnyRow[]>;
  const rows = (lists[term] ?? []).filter((e) =>
    String(e.details ?? e.occasion)
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <>
      <PageHeading
        eyebrow="THE ACADEMIC CALENDAR"
        title="A little room to plan."
        description="Semester dates and holidays from the reference project’s 2026–27 calendar."
      />
      <Notice>
        This is a bundled calendar, not a live university feed. Confirm changed examination dates
        with the university.
      </Notice>
      <div className="section-toolbar">
        <select value={term} onChange={(e) => setTerm(e.target.value)}>
          {[
            ['oddSemesterData', 'Odd semester'],
            ['evenSemesterData', 'Even semester'],
            ['summerTermData', 'Summer term'],
            ['oddSemesterHolidays', 'Odd semester holidays'],
            ['evenSemesterHolidays', 'Even semester holidays'],
          ].map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <div className="search-box">
          <Search size={16} />
          <input
            aria-label="Search academic calendar"
            placeholder="Find an event…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button
          kind="secondary"
          onClick={() =>
            csvDownload('academic-calendar.csv', [
              ['Event', 'Date', 'Day'],
              ...rows.map((e) => [e.details ?? e.occasion, e.date, e.day]),
            ])
          }
        >
          <Download size={16} /> Export
        </Button>
      </div>
      <div className="panel calendar-list">
        {rows.map((e, i) => (
          <div className="calendar-event" key={i}>
            <span className="role-icon">
              <CalendarDays size={21} />
            </span>
            <div>
              <strong>{e.details ?? e.occasion}</strong>
              <small>{e.day}</small>
            </div>
            <Badge tone="amber">{e.date}</Badge>
          </div>
        ))}
      </div>
    </>
  );
}
function Resources({ data, run, busy, notify }: ToolProps) {
  const [rows, setRows] = useState<AnyRow[]>([]);
  const [query, setQuery] = useState('');
  const [admin, setAdmin] = useState(false);
  const [form, setForm] = useState(false);
  const [editing, setEditing] = useState('');
  const [preview, setPreview] = useState<{ url: string; title: string; kind: string } | null>(null);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview.url);
    },
    [preview],
  );
  const [draft, setDraft] = useState({
    title: '',
    year: '2',
    course: 'CSE',
    subject: '',
    kind: 'Notes',
    url: '',
  });
  const [file, setFile] = useState<File | null>(null);
  async function load() {
    const [d, status] = await Promise.all([campus('resources'), campus('status')]);
    setRows(d.resources);
    setAdmin(status.admin);
  }
  useEffect(() => {
    if (!data.demo) void run(load);
  }, []);
  return (
    <>
      <PageHeading
        eyebrow="THE RESOURCE SHELF"
        title="Keep useful things close."
        description="Notes, past papers and course material shared by your campus administrator."
        action={
          admin ? (
            <Button
              onClick={() => {
                setEditing('');
                setDraft({
                  title: '',
                  year: '2',
                  course: 'CSE',
                  subject: '',
                  kind: 'Notes',
                  url: '',
                });
                setFile(null);
                setForm(true);
              }}
            >
              <Plus size={16} /> Publish resource
            </Button>
          ) : undefined
        }
      />
      <div className="section-toolbar">
        <div className="search-box">
          <Search size={16} />
          <input
            aria-label="Search resources"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Subject, year, title or course…"
          />
        </div>
        <Button kind="secondary" disabled={busy || !!data.demo} onClick={() => void run(load)}>
          <RefreshCw size={16} /> Refresh
        </Button>
      </div>
      <div className="directory-grid">
        {rows
          .filter((r) =>
            [r.title, r.subject, r.year, r.course, r.kind]
              .join(' ')
              .toLowerCase()
              .includes(query.toLowerCase()),
          )
          .map((r) => (
            <section className="panel padded" key={r.id}>
              <Badge>
                {r.kind} · Year {r.year}
              </Badge>
              <h3>{r.title}</h3>
              <p className="muted">
                {r.course} · {r.subject}
              </p>
              <div className="section-toolbar">
                <a
                  className="btn secondary"
                  href={r.file ? '/api/resource/' + r.id : r.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {r.file ? 'Download file' : 'Open resource'} <ArrowUpRight size={15} />
                </a>
                {r.file && /\.(pdf|png|jpe?g|gif|webp|txt)$/i.test(r.filename ?? '') && (
                  <Button
                    kind="ghost"
                    onClick={() =>
                      void run(async () => {
                        const response = await fetch('/api/resource/' + r.id);
                        if (!response.ok) throw Error('Could not preview resource.');
                        const extension = String(r.filename).split('.').pop()?.toLowerCase();
                        const kind =
                          extension === 'pdf'
                            ? 'application/pdf'
                            : extension === 'txt'
                              ? 'text/plain'
                              : 'image/' + (extension === 'jpg' ? 'jpeg' : extension);
                        const url = URL.createObjectURL(
                          new Blob([await response.arrayBuffer()], { type: kind }),
                        );
                        setPreview({ url, title: r.title, kind });
                      })
                    }
                  >
                    Preview
                  </Button>
                )}
                {admin && (
                  <Button
                    kind="ghost"
                    onClick={() => {
                      setEditing(r.id);
                      setDraft({
                        title: r.title,
                        year: r.year,
                        course: r.course,
                        subject: r.subject,
                        kind: r.kind,
                        url: r.url ?? '',
                      });
                      setFile(null);
                      setForm(true);
                    }}
                  >
                    Edit
                  </Button>
                )}
                {admin && (
                  <button
                    className="icon-btn"
                    aria-label={'Delete ' + r.title}
                    onClick={() =>
                      void run(async () => {
                        await campus('resource-delete', { id: r.id });
                        await load();
                      })
                    }
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </section>
          ))}
      </div>
      {!rows.length && (
        <Empty
          title={data.demo ? 'Sign in to browse campus resources' : 'Your shared shelf is ready'}
          description="The reference project’s resource database is not in its Git repository. Publish your own materials here; its private collection is not silently copied."
        />
      )}
      {form && (
        <Modal
          title={editing ? 'Edit resource' : 'Publish a resource'}
          onClose={() => setForm(false)}
        >
          <div className="form-stack">
            {Object.entries(draft).map(([key, value]) => (
              <label className="field" key={key}>
                {key}
                <input
                  value={value}
                  onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                />
              </label>
            ))}
            <label className="field">
              Upload a file for a new resource · up to 2 MB
              <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
            <Button
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await campus(editing ? 'resource-update' : 'resource-create', {
                    id: editing,
                    ...draft,
                    file: file ? await fileBase64(file) : undefined,
                    filename: file?.name,
                  });
                  setForm(false);
                  await load();
                  notify('Resource published to this Acadence installation.');
                })
              }
            >
              Publish resource
            </Button>
          </div>
        </Modal>
      )}
      {preview && (
        <Modal wide title={preview.title} onClose={() => setPreview(null)}>
          {preview.kind.startsWith('image/') ? (
            <img className="resource-preview-image" src={preview.url} alt={preview.title} />
          ) : (
            <iframe
              className="resource-preview-frame"
              sandbox=""
              src={preview.url}
              title={preview.title}
            />
          )}
        </Modal>
      )}
    </>
  );
}
function Feedback({ data, run, busy, notify }: ToolProps) {
  const [subjects, setSubjects] = useState<AnyRow[]>([]);
  const [form, setForm] = useState<AnyRow | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    if (!data.demo)
      void run(async () => setSubjects((await portalTool('feedback-subjects')).subjects));
  }, []);
  return (
    <>
      <PageHeading
        eyebrow="COURSE FEEDBACK"
        title="Your words. Your experience."
        description="Review the university’s questions and submit the answers you choose."
      />
      <Notice>
        Feedback is submitted to the university only after you review every answer and explicitly
        confirm. No comments or ratings are filled in on your behalf.
      </Notice>
      <div className="subject-chips">
        {subjects.map((s) => (
          <button
            className="subject-chip"
            key={s.id}
            onClick={() =>
              void run(async () => {
                setForm(await portalTool('feedback-form', { subject: s.id }));
                setAnswers({});
                setConfirm(false);
              })
            }
          >
            <div>
              <strong>{s.name}</strong>
              <small>{s.faculty}</small>
            </div>
          </button>
        ))}
      </div>
      {!subjects.length && (
        <Empty
          title={data.demo ? 'Sign in to see feedback forms' : 'No pending feedback returned'}
          description="The portal may not have opened feedback yet, or you may already have completed it."
        />
      )}
      {form && (
        <section className="panel padded form-stack">
          {form.questions.map((q: AnyRow) => (
            <label className="field" key={q.id}>
              {q.text}
              {q.descriptive ? (
                <textarea
                  rows={3}
                  value={answers[q.id] ?? ''}
                  onChange={(e) => {
                    setAnswers({ ...answers, [q.id]: e.target.value });
                    setConfirm(false);
                  }}
                />
              ) : (
                <select
                  value={answers[q.id] ?? ''}
                  onChange={(e) => {
                    setAnswers({ ...answers, [q.id]: e.target.value });
                    setConfirm(false);
                  }}
                >
                  <option value="">Choose your answer</option>
                  {q.options.map((o: AnyRow) => (
                    <option key={o.id} value={o.id}>
                      {o.label || o.value}
                    </option>
                  ))}
                </select>
              )}
            </label>
          ))}
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={confirm}
              onChange={(e) => setConfirm(e.target.checked)}
            />{' '}
            I reviewed these answers and want to submit them to the university.
          </label>
          <Button
            disabled={!confirm || busy}
            onClick={() =>
              void run(async () => {
                const d = await portalTool('feedback-submit', {
                  subject: form.subjectId,
                  answers,
                  confirmed: true,
                });
                notify(d.message);
                setForm(null);
                setSubjects((await portalTool('feedback-subjects')).subjects);
              })
            }
          >
            Submit reviewed feedback
          </Button>
        </section>
      )}
    </>
  );
}
function CheckIn({ data, run, busy, notify }: ToolProps) {
  const [code, setCode] = useState('');
  const [position, setPosition] = useState<{ latitude: number; longitude: number } | null>(null);
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      <PageHeading
        eyebrow="CLASS CHECK-IN"
        title="Present, with a confirmation."
        description="Submit your professor’s attendance code using your actual location."
      />
      <div className="panel padded form-stack">
        <Notice>
          Use this only while attending the class. Your location is requested by your browser and
          sent to the university with the code; it is not replaced with fabricated coordinates.
        </Notice>
        <label className="field">
          Attendance code
          <input
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              setConfirm(false);
            }}
          />
        </label>
        <Button
          kind="secondary"
          onClick={() =>
            void run(
              () =>
                new Promise<void>((resolve, reject) => {
                  if (!navigator.geolocation)
                    return reject(Error('Location is not supported in this browser.'));
                  navigator.geolocation.getCurrentPosition(
                    (p) => {
                      setPosition({ latitude: p.coords.latitude, longitude: p.coords.longitude });
                      resolve();
                    },
                    (e) => reject(Error(e.message)),
                    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
                  );
                }),
            )
          }
        >
          <MapPin size={16} />{' '}
          {position ? 'Location obtained · refresh' : 'Use my current location'}
        </Button>
        <label className="checkbox-label">
          <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} />{' '}
          I am attending this class and want to submit this code and location.
        </label>
        <Button
          disabled={busy || !!data.demo || !position || !confirm || !code}
          onClick={() =>
            void run(async () => {
              const d = await portalTool('attendance-code', { code, ...position, confirmed: true });
              notify(d.message);
              setConfirm(false);
            })
          }
        >
          Submit attendance code
        </Button>
      </div>
    </>
  );
}
function StudentSettings({
  data,
  run,
  busy,
  notify,
  onAddAccount,
  onAccount,
  onSwitchAccount,
}: ToolProps & {
  onAddAccount: () => void;
  onAccount: (d: PortalData, cachedOnly?: boolean) => void;
  onSwitchAccount: (registration: string) => void;
}) {
  const [accounts, setAccounts] = useState(savedAccounts());
  const [refresh, setRefresh] = useState(true);
  const [consent, setConsent] = useState(false);
  const [report, setReport] = useState('');
  useEffect(() => setRefresh(localStorage.getItem('acadence.autoRefresh') !== 'false'), []);
  return (
    <>
      <PageHeading
        eyebrow="YOUR WORKSPACE"
        title="Make it work for you."
        description="Manage accounts, saved records, refresh preferences and campus sharing."
      />
      <div className="two-column">
        <section className="panel padded">
          <h2>Saved student accounts</h2>
          {accounts.map((a) => (
            <div className="share-item" key={a.profile.registration}>
              <strong>{a.profile.name}</strong>
              <p className="muted">{a.profile.registration}</p>
              <div className="inline-gap">
                <Button
                  kind="secondary"
                  disabled={busy}
                  onClick={() => onSwitchAccount(a.profile.registration)}
                >
                  Switch account
                </Button>
                <Button
                  kind="ghost"
                  onClick={() => {
                    onAccount(a, true);
                    notify(
                      'Opened cached records. Sync to check whether the session is still active.',
                    );
                  }}
                >
                  View cached
                </Button>
                <button
                  className="icon-btn"
                  aria-label={'Forget cached ' + a.profile.registration}
                  onClick={() => {
                    const next = accounts.filter(
                      (x) => x.profile.registration !== a.profile.registration,
                    );
                    localStorage.setItem('acadence.accounts.v2', JSON.stringify(next));
                    setAccounts(next);
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
          <Button disabled={accounts.length >= 5} onClick={onAddAccount}>
            <Plus size={16} /> Add student account
          </Button>
          <p className="muted">
            Up to five accounts. Sign-in sessions stay in encrypted HttpOnly cookies.
          </p>
        </section>
        <section className="panel padded form-stack">
          <h2>Install Acadence</h2>
          <p className="muted">
            On a deployed HTTPS site, use your browser’s Install app option. On iPhone or iPad, open
            Safari’s Share menu and choose Add to Home Screen. The installed app uses the same
            website and saved accounts.
          </p>
          <p className="muted">
            Offline viewing becomes available after opening the production app online. Live
            university and shared campus tools need a connection.
          </p>
          <h2>Refresh and saved data</h2>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={refresh}
              onChange={(e) => {
                setRefresh(e.target.checked);
                localStorage.setItem('acadence.autoRefresh', String(e.target.checked));
              }}
            />{' '}
            Refresh after 1 AM when this workspace is open.
          </label>
          <Button
            kind="secondary"
            onClick={() =>
              download(
                'acadence-student-records.json',
                'application/json',
                JSON.stringify(data, null, 2),
              )
            }
          >
            <Download size={16} /> Export my academic records
          </Button>
          <Button
            kind="secondary"
            onClick={() => {
              for (const key of Object.keys(localStorage))
                if (
                  key.startsWith('acadence.history.') ||
                  key === 'acadence.accounts.v2' ||
                  key === 'acadence.student.cache'
                )
                  localStorage.removeItem(key);
              setAccounts([]);
              notify('Cached student records removed from this browser.');
            }}
          >
            Clear saved academic records
          </Button>
        </section>
      </div>
      <section className="panel padded form-stack">
        <h2>Contribute your timetable</h2>
        <p className="muted">
          This shares course times, room details and faculty names with this Acadence installation
          for campus room and faculty schedule tools. Your marks and attendance are excluded.
        </p>
        <label className="checkbox-label">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />{' '}
          I agree to share my timetable for these campus tools.
        </label>
        <div className="inline-gap">
          <Button
            disabled={!consent || busy || !!data.demo}
            onClick={() =>
              void run(async () => {
                await campus('timetable-share', {
                  consent: true,
                  data: {
                    timetable: data.timetable,
                    timeHeaders: data.timeHeaders,
                    subjects: data.subjects,
                  },
                });
                notify('Timetable contributed.');
              })
            }
          >
            Share timetable
          </Button>
          <Button
            kind="secondary"
            disabled={busy || !!data.demo}
            onClick={() =>
              void run(async () => {
                await campus('timetable-withdraw');
                notify('Your contributed timetable was removed.');
              })
            }
          >
            Withdraw timetable
          </Button>
        </div>
      </section>
      <section className="panel padded form-stack">
        <h2>Report an issue to this installation</h2>
        <textarea
          rows={4}
          placeholder="Describe the issue…"
          value={report}
          onChange={(e) => setReport(e.target.value)}
        />
        <Button
          disabled={busy || !!data.demo}
          onClick={() =>
            void run(async () => {
              await campus('report', { text: report });
              setReport('');
              notify('Report saved for the administrator.');
            })
          }
        >
          Send issue report
        </Button>
      </section>
    </>
  );
}
function Admin({ data, run, busy }: ToolProps) {
  const [facultyDraft, setFacultyDraft] = useState({
    index: '',
    name: '',
    location: '',
    hidden: false,
  });
  const [info, setInfo] = useState<AnyRow | null>(null);
  useEffect(() => {
    if (!data.demo) void run(async () => setInfo(await campus('admin')));
  }, []);
  return (
    <>
      <PageHeading
        eyebrow="INSTALLATION ADMINISTRATION"
        title="Keep the shared space in order."
        description="Resource publishing, issue reports, shares and collected-data status."
      />
      {data.demo && <Notice>Sign in with an administrator account to manage campus tools.</Notice>}
      {info && (
        <>
          <div className="stats-grid">
            <Stat
              label="Published resources"
              value={info.resources.length}
              detail="Manage in Resources"
            />
            <Stat
              label="Shared items"
              value={info.shares.length}
              detail="Expiry enforced on every access"
            />
            <Stat
              label="Opt-in timetables"
              value={info.timetables}
              detail="100 needed for vacancy reports"
            />
            <Stat
              label="Issue reports"
              value={info.reports.length}
              detail="Submitted to this installation"
            />
          </div>
          <section className="panel padded form-stack">
            <h2>Automatic sign-in verification</h2>
            <p className="muted">
              {info.captcha.requests} requests · {info.captcha.suggestions} model suggestions. Model
              suggestions are not a guarantee of successful university sign-in.
            </p>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={info.captcha.enabled}
                disabled={busy}
                onChange={(e) =>
                  void run(async () => {
                    await campus('captcha-settings', { enabled: e.target.checked });
                    setInfo(await campus('admin'));
                  })
                }
              />
              Enable automatic sign-in verification
            </label>
          </section>
          <section className="panel padded form-stack">
            <h2>Faculty directory editor</h2>
            <label className="field">
              Choose an existing entry, or add new
              <select
                value={facultyDraft.index}
                onChange={(e) => {
                  const f = info.faculty.find((f: AnyRow) => String(f.index) === e.target.value);
                  setFacultyDraft(
                    f
                      ? {
                          index: String(f.index),
                          name: f.faculty,
                          location: f.location,
                          hidden: !!f.hidden,
                        }
                      : { index: '', name: '', location: '', hidden: false },
                  );
                }}
              >
                <option value="">Add new faculty</option>
                {info.faculty.map((f: AnyRow) => (
                  <option key={f.index} value={f.index}>
                    {f.faculty}
                    {f.hidden ? ' · hidden' : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Faculty name
              <input
                value={facultyDraft.name}
                onChange={(e) => setFacultyDraft({ ...facultyDraft, name: e.target.value })}
              />
            </label>
            <label className="field">
              Cabin / location
              <input
                value={facultyDraft.location}
                onChange={(e) => setFacultyDraft({ ...facultyDraft, location: e.target.value })}
              />
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={facultyDraft.hidden}
                onChange={(e) => setFacultyDraft({ ...facultyDraft, hidden: e.target.checked })}
              />
              Hide this entry from the directory
            </label>
            <Button
              disabled={busy || !facultyDraft.name.trim()}
              onClick={() =>
                void run(async () => {
                  await campus('faculty-update', facultyDraft);
                  setInfo(await campus('admin'));
                  setFacultyDraft({ index: '', name: '', location: '', hidden: false });
                })
              }
            >
              Save faculty entry
            </Button>
          </section>
          <Button
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await campus('purge');
                setInfo(await campus('admin'));
              })
            }
          >
            Purge expired shares and inactive rooms
          </Button>
          <div className="section-toolbar">
            <h2>Issue reports</h2>
          </div>
          <Table
            columns={['Date', 'Submitted by', 'Report']}
            rows={info.reports.map((r: AnyRow) => [r.at, r.by, r.text])}
          />
          <div className="section-toolbar">
            <h2>Shared-item moderation</h2>
          </div>
          {info.shares.map((s: AnyRow) => (
            <div className="panel padded" key={s.id}>
              <strong>{s.title}</strong>
              <p className="muted">
                {s.owner} · expires {new Date(s.expires).toLocaleString()}
              </p>
              <Button
                kind="danger"
                onClick={() =>
                  void run(async () => {
                    await campus('share-delete', { id: s.id });
                    setInfo(await campus('admin'));
                  })
                }
              >
                Remove share
              </Button>
            </div>
          ))}
        </>
      )}
    </>
  );
}
function Table({ columns, rows }: { columns: string[]; rows: string[][] }) {
  return (
    <div className="panel table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && (
        <Empty
          title="No records returned"
          description="Nothing is available for this selection yet."
        />
      )}
    </div>
  );
}

function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <>
      <PageHeading eyebrow="ON THE WAY" title={title} description={description} />
      <section className="panel coming-soon">
        <Badge>Coming soon</Badge>
        <CalendarDays size={46} />
        <h2>We’re getting this ready.</h2>
        <p>{description}</p>
      </section>
    </>
  );
}
