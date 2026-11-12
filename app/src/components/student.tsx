'use client';
import { useEffect, useState, useRef } from 'react';
import {
  LayoutDashboard,
  CalendarDays,
  CalendarCheck,
  GraduationCap,
  ClipboardList,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  RefreshCw,
  LogOut,
  BookOpen,
  Eye,
  EyeOff,
  Users,
  WifiOff,
  Settings2,
  History,
  MapPin,
  UserRound,
  ListChecks,
  Shield,
  Library,
  CalendarRange,
} from 'lucide-react';
import Shell from './shell';
import CursorFollow from './cursor-follow';
import SavedAccounts from './saved-accounts';
import { activateStudentAccount } from '@/lib/account-switch';
import loginStyles from './student-login.module.css';
import { Brand, Button, PageHeading, Stat, Badge, Empty, Notice } from './ui';
import type { Core, PortalData } from '@/lib/types';
import StudentTools from './student-tools';
import StudentAttendance from './student-attendance';
import StudentResults from './student-results';
import { CurrentClass } from './student-planner';
import academicStyles from './student-academic.module.css';
import { cacheStudent, savedAccounts } from '@/lib/student-services';
import { createStudentDemo } from '@/lib/demo';
import { gpa, sum } from '@/lib/core';
const nav = [
  { id: 'overview', label: 'My semester', icon: <LayoutDashboard size={18} /> },
  { id: 'attendance', label: 'Attendance', icon: <CalendarCheck size={18} /> },
  { id: 'timetable', label: 'Timetable', icon: <CalendarDays size={18} /> },
  { id: 'results', label: 'Marks & results', icon: <ClipboardList size={18} /> },
  { id: 'gpa', label: 'Grade planner', icon: <GraduationCap size={18} /> },
  { id: 'past', label: 'Earlier internals', icon: <History size={18} /> },
  { id: 'history', label: 'Attendance history', icon: <ListChecks size={18} /> },
  { id: 'profile', label: 'Profile & subjects', icon: <UserRound size={18} /> },
  { id: 'calendar', label: 'Academic calendar', icon: <CalendarRange size={18} /> },
  { id: 'faculty', label: 'Faculty · coming soon', icon: <Users size={18} /> },
  { id: 'vacant', label: 'Classrooms · coming soon', icon: <MapPin size={18} /> },
  { id: 'resources', label: 'Study resources', icon: <Library size={18} /> },
  { id: 'feedback', label: 'Course feedback', icon: <ClipboardList size={18} /> },
  { id: 'checkin', label: 'Attendance code', icon: <CalendarCheck size={18} /> },
  { id: 'settings', label: 'Accounts & settings', icon: <Settings2 size={18} /> },
  { id: 'admin', label: 'Campus admin', icon: <Shield size={18} /> },
];
async function portal(action: string, payload: Record<string, unknown> = {}) {
  const response = await fetch('/api/portal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload }),
    signal: AbortSignal.timeout(55000),
  });
  const data = await response.json().catch(() => {
    throw Error('The university connection did not finish. Please try again.');
  });
  if (!response.ok) throw Error(data.error ?? 'Could not connect to the portal.');
  return data;
}
export default function StudentApp({ core, onExit }: { core: Core; onExit: () => void }) {
  const [data, setData] = useState<PortalData | null>(null);
  const [cached, setCached] = useState<PortalData | null>(null);
  const [page, setPage] = useState('overview');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [offline, setOffline] = useState(false);
  const [registration, setRegistration] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [accounts, setAccounts] = useState<PortalData[]>([]);
  const [accountsOpen, setAccountsOpen] = useState(false);
  const [switching, setSwitching] = useState('');
  const refreshDay = useRef('');
  useEffect(() => {
    setAccounts(savedAccounts());
  }, []);
  useEffect(() => {
    if (data)
      localStorage.setItem(
        'acadence.activeRegistration',
        data.demo ? '' : data.profile.registration,
      );
  }, [data]);
  useEffect(() => {
    if (!data || data.demo || offline) return;
    const timer = setInterval(() => {
      const now = new Date();
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
      const synced = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(
        new Date(data.syncedAt),
      );
      const hour = Number(
        new Intl.DateTimeFormat('en-GB', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          hourCycle: 'h23',
        }).format(now),
      );
      if (
        localStorage.getItem('acadence.autoRefresh') !== 'false' &&
        !busy &&
        hour >= 1 &&
        today !== synced &&
        refreshDay.current !== today
      ) {
        refreshDay.current = today;
        void sync();
      }
    }, 60000);
    return () => clearInterval(timer);
  }, [data, offline, busy]);
  useEffect(() => {
    try {
      const cache = localStorage.getItem('acadence.student.cache');
      if (cache) {
        const parsed = JSON.parse(cache);
        if (parsed.profile && Array.isArray(parsed.attendance) && Array.isArray(parsed.ledger))
          setCached(parsed);
      }
    } catch {}
  }, []);
  async function sync() {
    setBusy(true);
    setError('');
    try {
      const d: PortalData = await portal('sync');
      setData(d);
      setOffline(false);
      cacheStudent(d);
      setAccounts(savedAccounts());
      setCached(d);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await portal('login-auto', { registration, password });
      setPassword('');
      const d: PortalData = await portal('sync');
      setData(d);
      cacheStudent(d);
      setAccounts(savedAccounts());
      setCached(d);
      setOffline(false);
    } catch (e) {
      setError(
        e instanceof Error && e.name === 'TimeoutError'
          ? 'The university connection timed out. Please try again.'
          : (e as Error).message,
      );
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    try {
      await portal('logout');
    } catch {}
    setData(null);
    setPassword('');
    setError('');
    setOffline(false);
  }
  function addAccount() {
    setAccountsOpen(false);
    setData(null);
    setPassword('');
    setRegistration('');
    setError('');
    setOffline(false);
    setPage('overview');
  }
  async function switchAccount(registration: string) {
    setAccountsOpen(false);
    setSwitching(registration);
    setBusy(true);
    setError('');
    try {
      const next = await activateStudentAccount(registration, portal);
      cacheStudent(next);
      setAccounts(savedAccounts());
      setCached(next);
      setData(next);
      setOffline(false);
      setPage('overview');
      setPassword('');
    } catch {
      // Do not leave the previous student's UI mounted after the active cookie changes.
      setData(null);
      setRegistration(registration);
      setPassword('');
      setCached(
        savedAccounts().find((account) => account.profile.registration === registration) ?? null,
      );
      setOffline(false);
      setPage('overview');
      setError('Sign in to this account to continue. Its saved session may have expired.');
    } finally {
      setBusy(false);
      setSwitching('');
    }
  }
  if (switching)
    return (
      <main className={loginStyles.page}>
        <header className={loginStyles.header}>
          <Brand />
        </header>
        <div className={loginStyles.center}>
          <section className={loginStyles.card}>
            <h1>Switching account</h1>
            <p role="status">{switching}</p>
          </section>
        </div>
      </main>
    );
  if (!data)
    return (
      <main className={loginStyles.page}>
        <CursorFollow />
        <header className={loginStyles.header}>
          <button className="brand-home" onClick={onExit} aria-label="Return to welcome">
            <Brand />
          </button>
          <button className={loginStyles.back} onClick={onExit}>
            <ArrowLeft size={16} /> Back
          </button>
        </header>
        <div className={loginStyles.center}>
          <section className={loginStyles.card} aria-labelledby="student-sign-in">
            <h1 id="student-sign-in">Student sign-in</h1>
            {error && <Notice error>{error}</Notice>}
            <form onSubmit={login} className={loginStyles.form}>
              <label className="field">
                Registration number
                <input
                  value={registration}
                  onChange={(e) => setRegistration(e.target.value.toUpperCase())}
                  placeholder="AP…"
                  autoComplete="username"
                  required
                  maxLength={20}
                />
              </label>
              <label className="field">
                Password
                <div className="password-field">
                  <input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </label>
              <Button type="submit" disabled={busy}>
                {busy ? 'Signing in…' : 'Sign in'} <ArrowRight size={17} />
              </Button>
            </form>
            <div className={loginStyles.links}>
              <button
                onClick={() => {
                  setData(createStudentDemo());
                  setError('');
                }}
              >
                Try demo <ArrowUpRight size={14} />
              </button>
              <a
                href="https://student.srmap.edu.in/srmapstudentcorner/StudentLoginPage"
                target="_blank"
                rel="noreferrer"
              >
                Forgot password?
              </a>
            </div>
            <p className={loginStyles.privacy}>Your password is not saved.</p>
            {(cached || accounts.length > 0) && (
              <details className={loginStyles.saved}>
                <summary>Saved accounts &amp; offline</summary>
                <div className={loginStyles.savedOptions}>
                  {cached && (
                    <>
                      <Button
                        kind="ghost"
                        onClick={() => {
                          setData(cached);
                          setOffline(true);
                          setError('');
                        }}
                      >
                        <WifiOff size={16} /> Open saved records
                      </Button>
                      <Button
                        kind="ghost"
                        onClick={() => {
                          localStorage.removeItem('acadence.student.cache');
                          setCached(null);
                        }}
                      >
                        Remove saved records
                      </Button>
                    </>
                  )}
                  {accounts.map((account) => (
                    <Button
                      kind="secondary"
                      key={account.profile.registration}
                      disabled={busy}
                      onClick={() => void switchAccount(account.profile.registration)}
                    >
                      Resume {account.profile.name}
                    </Button>
                  ))}
                </div>
              </details>
            )}
          </section>
        </div>
        <footer className={loginStyles.footer}>Independent of SRM University AP.</footer>
      </main>
    );
  const cgpa = data.cgpa ?? gpa(core, data.ledger);
  const below = data.attendance.filter((a) => a.percentage < 75);
  const totalPresent = sum(
    core,
    data.attendance.map((a) => a.present),
  );
  const totalRecorded = sum(
    core,
    data.attendance.map((a) => a.total),
  );
  const overall = core.attendance(totalPresent, totalRecorded);
  const weekday = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    timeZone: 'Asia/Kolkata',
  }).format(new Date());
  const day = data.timetable.find((d) =>
    d.day.toLowerCase().startsWith(weekday.slice(0, 3).toLowerCase()),
  );
  return (
    <Shell
      mode="Student"
      name={data.profile.name}
      nav={nav}
      active={page}
      onNavigate={setPage}
      onExit={onExit}
      footer={
        <span>
          {data.demo
            ? 'Sample records'
            : offline
              ? 'Offline · cached records'
              : 'Last synced ' + new Date(data.syncedAt).toLocaleString('en-IN')}
        </span>
      }
    >
      <div className="student-sync-bar">
        <span>
          <span className={'live-dot ' + (offline ? 'offline' : '')} />
          {data.demo
            ? 'Sample semester · fictional data'
            : offline
              ? 'Offline copy · may be out of date'
              : data.profile.registration + ' · ' + data.profile.semester}
        </span>
        <div>
          <Button
            kind="secondary"
            disabled={busy}
            onClick={() => {
              setAccounts(savedAccounts());
              setAccountsOpen(true);
            }}
          >
            <Users size={15} /> Saved accounts
          </Button>
          {!data.demo && (
            <Button kind="ghost" disabled={busy} onClick={() => void sync()}>
              <RefreshCw size={14} className={busy ? 'spin' : ''} />
              {busy ? 'Refreshing…' : 'Sync now'}
            </Button>
          )}
          <Button kind="ghost" onClick={() => void logout()}>
            <LogOut size={14} />
            {data.demo ? 'Leave preview' : 'Sign out'}
          </Button>
        </div>
      </div>
      {accountsOpen && (
        <SavedAccounts
          accounts={accounts}
          current={data.demo || offline ? '' : data.profile.registration}
          onClose={() => setAccountsOpen(false)}
          onSwitch={(registration) => void switchAccount(registration)}
          onAdd={addAccount}
        />
      )}
      {error && (
        <Notice error>
          {error} Your last loaded records are still available. Sign out and sign in again if the
          session has expired.
        </Notice>
      )}
      {data.warnings.map((w, i) => (
        <Notice key={i}>{w}</Notice>
      ))}
      {page === 'overview' && (
        <>
          <div className={academicStyles.pageHeader}>
            <div>
              <h1>Overview</h1>
              <p>
                {data.profile.name} · {data.profile.semester}
              </p>
            </div>
            <Button onClick={() => setPage('attendance')}>
              <CalendarCheck size={16} /> Attendance
            </Button>
          </div>
          <div className="stats-grid">
            <Stat
              label="Attendance"
              value={overall < 0 ? '—' : overall.toFixed(1) + '%'}
              detail="Recorded classes"
            />
            <Stat
              label="CGPA"
              value={cgpa === null ? '—' : cgpa.toFixed(2)}
              detail={data.cgpa !== null ? 'University record' : 'Calculated'}
            />
            <Stat label="Below 75%" value={below.length} detail="Subjects" />
            <Stat
              label="Courses"
              value={data.subjects.length}
              detail={data.profile.semester || 'Current semester'}
            />
          </div>
          <div className={academicStyles.overviewGrid}>
            <section className={academicStyles.compactPanel}>
              <div className={academicStyles.panelTitle}>
                <h2>Today</h2>
                <button className="text-link" onClick={() => setPage('timetable')}>
                  Timetable <ArrowUpRight size={15} />
                </button>
              </div>
              {day?.slots.some((slot) => slot && !/^(free|lunch|break|-|—)$/i.test(slot.trim())) ? (
                day.slots
                  .map((slot, i) => ({ slot, i }))
                  .filter(({ slot }) => slot && !/^(free|lunch|break|-|—)$/i.test(slot.trim()))
                  .map(({ slot, i }) => (
                    <div className={academicStyles.summaryRow} key={i}>
                      <span className={academicStyles.scheduleTime}>
                        {data.timeHeaders[i] ?? `Slot ${i + 1}`}
                      </span>
                      <span>
                        <strong>
                          {data.subjects.find((s) =>
                            slot.replace(/\s/g, '').includes(s.code.replace(/\s/g, '')),
                          )?.name ?? slot}
                        </strong>
                      </span>
                    </div>
                  ))
              ) : (
                <p className={academicStyles.hint}>No classes in today’s timetable.</p>
              )}
            </section>
            <section className={academicStyles.compactPanel}>
              <div className={academicStyles.panelTitle}>
                <h2>Attendance</h2>
                <button className="text-link" onClick={() => setPage('attendance')}>
                  View all <ArrowUpRight size={15} />
                </button>
              </div>
              {data.attendance.length ? (
                data.attendance.map((row) => (
                  <div className={academicStyles.summaryRow} key={row.code}>
                    <span>
                      <strong>{row.name}</strong>
                      <small>
                        {row.present} / {row.total} attended
                      </small>
                    </span>
                    <b className={row.percentage < 75 ? academicStyles.danger : ''}>
                      {row.percentage.toFixed(1)}%
                    </b>
                  </div>
                ))
              ) : (
                <p className={academicStyles.hint}>No attendance records.</p>
              )}
            </section>
          </div>
        </>
      )}
      {page === 'attendance' && <StudentAttendance core={core} data={data} />}
      {page === 'timetable' && (
        <>
          <PageHeading
            eyebrow="YOUR ACADEMIC WEEK"
            title="Know what’s next."
            description="A little structure for your day, and space between classes."
            action={<Badge tone="green">{weekday}</Badge>}
          />
          {data.timetable.length ? (
            <div className="panel table-wrap timetable">
              <table>
                <thead>
                  <tr>
                    <th>Day / time</th>
                    {Array.from(
                      { length: Math.max(...data.timetable.map((d) => d.slots.length)) },
                      (_, i) => (
                        <th key={i}>{data.timeHeaders[i] ?? `Slot ${i + 1}`}</th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {data.timetable.map((day) => (
                    <tr
                      key={day.day}
                      className={
                        day.day.toLowerCase().startsWith(weekday.slice(0, 3).toLowerCase())
                          ? 'today-row'
                          : ''
                      }
                    >
                      <th>{day.day}</th>
                      {day.slots.map((slot, i) => {
                        const subject = data.subjects.find((s) =>
                          slot.replace(/\s/g, '').includes(s.code.replace(/\s/g, '')),
                        );
                        return (
                          <td key={i}>
                            {!slot || /^(free|lunch|break|-|—)$/i.test(slot) ? (
                              <span className="free-slot">{slot || 'Free'}</span>
                            ) : (
                              <div className="timetable-subject">
                                <strong>{subject?.code ?? slot}</strong>
                                <span>{subject?.name ?? ''}</span>
                                <small>{subject?.room ?? ''}</small>
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty
              title="No timetable available yet"
              description="Refresh your portal records when the university publishes your schedule."
            />
          )}
          <div className="section-toolbar">
            <h2>Subjects & classrooms</h2>
          </div>
          <div className="subject-chips">
            {data.subjects.map((s) => (
              <div className="subject-chip" key={s.code}>
                <BookOpen size={19} />
                <div>
                  <strong>{s.name}</strong>
                  <small>
                    {s.code} · {s.credits} credits{s.room ? ' · ' + s.room : ''}
                  </small>
                  {s.faculty && <small>{s.faculty}</small>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      {page === 'results' && <StudentResults data={data} core={core} cgpa={cgpa} />}
      {page === 'timetable' && <CurrentClass data={data} />}
      {page === 'gpa' && <GradePlanner core={core} data={data} currentCgpa={cgpa} />}
      {!['overview', 'attendance', 'timetable', 'results', 'gpa'].includes(page) && (
        <StudentTools
          page={page}
          data={data}
          core={core}
          onAddAccount={addAccount}
          onSwitchAccount={(registration) => void switchAccount(registration)}
          onAccount={(d, cachedOnly) => {
            setData(d);
            cacheStudent(d);
            setOffline(!!cachedOnly);
            setPage('overview');
          }}
        />
      )}
    </Shell>
  );
}
function GradePlanner({
  core,
  data,
  currentCgpa,
}: {
  core: Core;
  data: PortalData;
  currentCgpa: number | null;
}) {
  const [grades, setGrades] = useState<Record<string, string>>({});
  const [previousCredits, setPreviousCredits] = useState('');
  const points: Record<string, number> = { O: 10, 'A+': 9, A: 8, 'B+': 7, B: 6, C: 5, P: 4, F: 0 };
  const entries = data.subjects
    .filter((s) => grades[s.code])
    .map((s) => ({ points: points[grades[s.code]], credits: s.credits }));
  const sgpa = gpa(core, entries);
  const previous = Number(previousCredits);
  const gradedCredits = sum(
    core,
    entries.map((e) => e.credits),
  );
  const projected =
    currentCgpa !== null && previous > 0 && sgpa !== null
      ? gpa(core, [
          { points: currentCgpa, credits: previous },
          { points: sgpa, credits: gradedCredits },
        ])
      : null;
  return (
    <>
      <PageHeading
        eyebrow="ROOM FOR POSSIBILITY"
        title="Picture your next milestone."
        description="Try expected grades and see a credit-weighted projection."
      />
      <Notice>
        This is a forecast, separate from your published results. Grade points use O=10, A+=9, A=8,
        B+=7, B=6, C=5, P=4, F=0. Confirm your programme’s grading rules before relying on a
        prediction.
      </Notice>
      <div className="two-column planner-columns">
        <section className="panel">
          <div className="panel-head">
            <h2>This semester’s subjects</h2>
            <Button kind="ghost" onClick={() => setGrades({})}>
              Reset
            </Button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Credits</th>
                  <th>Expected grade</th>
                </tr>
              </thead>
              <tbody>
                {data.subjects.map((s) => (
                  <tr key={s.code}>
                    <td>
                      <strong>{s.name}</strong>
                      <small>{s.code}</small>
                    </td>
                    <td>{s.credits}</td>
                    <td>
                      <select
                        aria-label={s.name + ' expected grade'}
                        value={grades[s.code] ?? ''}
                        onChange={(e) => setGrades({ ...grades, [s.code]: e.target.value })}
                      >
                        <option value="">Select</option>
                        {Object.keys(points).map((g) => (
                          <option key={g}>{g}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="panel padded grade-projection">
          <span className="eyebrow">YOUR POSSIBLE NEXT CHAPTER</span>
          <div className="prediction">
            <span>PROJECTED SGPA</span>
            <strong>{sgpa?.toFixed(2) ?? '—'}</strong>
            <p>
              {entries.length} / {data.subjects.length} subjects selected · {gradedCredits} graded
              credits
            </p>
          </div>
          <label className="field">
            Previously completed GPA credits
            <input
              type="number"
              min={0}
              max={400}
              value={previousCredits}
              onChange={(e) => setPreviousCredits(e.target.value)}
              placeholder="Enter your completed credits"
            />
          </label>
          <p className="muted">
            Use the total credits underlying your published CGPA. Semesters can have different
            credit totals.
          </p>
          <div className="detail-row">
            <span>Current CGPA</span>
            <strong>{currentCgpa?.toFixed(2) ?? 'Unavailable'}</strong>
          </div>
          <div className="detail-row">
            <span>Projected cumulative GPA</span>
            <strong>{projected?.toFixed(2) ?? '—'}</strong>
          </div>
          <small className="muted">
            Only selected subject grades are included in this projection.
          </small>
        </section>
      </div>
    </>
  );
}
