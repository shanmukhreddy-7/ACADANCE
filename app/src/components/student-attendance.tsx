'use client';
import { useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { Button, Empty, Modal } from './ui';
import type { Attendance, Core, PortalData } from '@/lib/types';
import { attendanceProjection } from '@/lib/leave-plan';
import LeaveCalendar from './leave-calendar';
import styles from './student-academic.module.css';

function SubjectAttendance({ row, core, target }: { row: Attendance; core: Core; target: number }) {
  const [attend, setAttend] = useState(0);
  const [miss, setMiss] = useState(0);
  const [od, setOd] = useState(false);
  const current = core.attendance(row.present, row.total);
  const need = core.need_attend(row.present, row.total, target);
  const skip = core.can_skip(row.present, row.total, target);
  const shortage = row.total > 0 && (need > 0 || need === -2);
  const approved = od ? Math.min(row.od, Math.max(0, row.total - row.present)) : 0;
  const next = attendanceProjection(core, row, attend, miss, target, approved);
  const change = (value: string) => Math.min(1000, Math.max(0, Math.floor(Number(value) || 0)));
  return (
    <article className={styles.subjectCard}>
      <div className={styles.subjectTop}>
        <span>{row.code}</span>
        {shortage && <span className={styles.shortageBadge}>Below {target}%</span>}
      </div>
      <h2>{row.name}</h2>
      <div className={styles.percentageRow}>
        <strong className={shortage ? styles.danger : ''}>
          {current < 0 ? '—' : current.toFixed(2) + '%'}
        </strong>
        <span>
          {row.present} / {row.total} attended
        </span>
      </div>
      <div className={styles.track}>
        <span
          style={{
            width: Math.max(0, Math.min(100, current)) + '%',
            background: shortage ? '#ff7885' : '#78a9ff',
          }}
        />
      </div>
      <p className={shortage ? styles.danger : styles.skipAdvice}>
        {!row.total
          ? 'No recorded classes'
          : need === -2
            ? '100% cannot be recovered'
            : need > 0
              ? `Attend ${need} classes to reach ${target}%`
              : `You can skip ${Math.max(0, skip)} classes`}
      </p>
      {current >= 0 && Math.abs(current - row.percentage) > 0.05 && (
        <small className={styles.hint}>Portal: {row.percentage.toFixed(2)}%</small>
      )}
      <details className={styles.bunkDetails}>
        <summary>Plan bunks</summary>
        <div className={styles.bunkInputs}>
          <label>
            Attend first
            <input
              aria-label={'Attend first ' + row.code}
              type="number"
              min={0}
              max={1000}
              value={attend}
              onChange={(e) => setAttend(change(e.target.value))}
            />
          </label>
          <label>
            Skip classes
            <input
              aria-label={'Skip classes ' + row.code}
              type="number"
              min={0}
              max={1000}
              value={miss}
              onChange={(e) => setMiss(change(e.target.value))}
            />
          </label>
        </div>
        {row.od > 0 && (
          <label className={styles.odOption}>
            <input type="checkbox" checked={od} onChange={(e) => setOd(e.target.checked)} /> Include
            existing OD/ML as attended
          </label>
        )}
        <div className={styles.bunkResult} aria-live="polite">
          <span>After plan</span>
          <strong className={next.need > 0 || next.need === -2 ? styles.danger : ''}>
            {next.percentage < 0 ? '—' : next.percentage.toFixed(2) + '%'}
          </strong>
        </div>
        <p className={next.need > 0 || next.need === -2 ? styles.danger : styles.hint}>
          {next.need === -2
            ? '100% cannot be recovered'
            : next.need < 0 || next.percentage < 0
              ? 'No records'
              : next.need > 0
                ? `Then attend ${next.need} classes to reach ${target}%`
                : `${Math.max(0, next.skip)} further classes can be skipped`}
        </p>
        {(attend > 0 || miss > 0 || od) && (
          <button
            className={styles.reset}
            onClick={() => {
              setAttend(0);
              setMiss(0);
              setOd(false);
            }}
          >
            Reset plan
          </button>
        )}
      </details>
    </article>
  );
}

export default function StudentAttendance({ core, data }: { core: Core; data: PortalData }) {
  const [target, setTarget] = useState(75);
  const [calendar, setCalendar] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const shortages = data.attendance
    .map((row) => ({ row, need: core.need_attend(row.present, row.total, target) }))
    .filter(({ row, need }) => row.total > 0 && (need > 0 || need === -2));
  return (
    <>
      <div className={styles.pageHeader}>
        <div>
          <h1>Attendance</h1>
          {data.period && <p>{data.period}</p>}
        </div>
        <div className={styles.headerActions}>
          <label>
            Target
            <select
              aria-label="Attendance target"
              value={target}
              onChange={(e) => setTarget(Number(e.target.value))}
            >
              {[75, 80, 85, 90, 95, 100].map((n) => (
                <option key={n} value={n}>
                  {n}%
                </option>
              ))}
            </select>
          </label>
          <Button onClick={() => setCalendar(true)}>
            <CalendarDays size={17} /> Absence planner
          </Button>
        </div>
      </div>
      {shortages.length > 0 && (
        <section className={styles.recovery} aria-label="Attendance recovery">
          <strong>
            {shortages.length} {shortages.length === 1 ? 'subject' : 'subjects'} below {target}%
          </strong>
          <div>
            {shortages.map(({ row, need }) => (
              <span key={row.code}>
                <b>{row.code}</b> ·{' '}
                {need === -2 ? '100% not recoverable' : `Attend ${need} classes`}
              </span>
            ))}
          </div>
        </section>
      )}
      {data.attendance.length ? (
        <div className={styles.subjectGrid}>
          {data.attendance.map((row) => (
            <SubjectAttendance key={row.code} row={row} core={core} target={target} />
          ))}
        </div>
      ) : (
        <Empty title="No attendance records" description="Sync after attendance is recorded." />
      )}
      <p className={styles.pageNote}>
        Plans use recorded counts and do not change university attendance. Approved portal
        adjustments may differ.
      </p>
      {calendar && (
        <Modal title="Absence planner" wide onClose={() => setCalendar(false)}>
          <LeaveCalendar
            data={data}
            core={core}
            target={target}
            selected={selected}
            setSelected={setSelected}
          />
        </Modal>
      )}
    </>
  );
}
