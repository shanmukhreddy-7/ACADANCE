'use client';
import { useEffect, useState } from 'react';
import { Button, Notice } from './ui';
import type { ProfessorData, Session } from '@/lib/types';
import { periods, saveRegister, type RegisterSelection } from '@/lib/register';
import { today } from '@/lib/core';
import styles from './professor-workspace.module.css';
export default function ProfessorAttendance({
  data,
  subject,
  subjectSelect,
  update,
  notify,
  selection,
}: {
  data: ProfessorData;
  subject: string;
  subjectSelect: React.ReactNode;
  update: (data: ProfessorData, note?: string) => void;
  notify: (text: string) => void;
  selection?: RegisterSelection;
}) {
  const [date, setDate] = useState(selection?.date ?? today());
  const [period, setPeriod] = useState(selection?.label ?? 'Period 1');
  const [details, setDetails] = useState(selection?.details ?? false);
  const [records, setRecords] = useState<Session['records']>({});
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const current = data.sessions.find(
    (row) => row.subject === subject && row.date === date && row.label === period,
  );
  useEffect(() => {
    setRecords(current?.records ?? {});
    setError('');
  }, [subject, date, period, current]);
  const labels = [
    ...new Set([
      ...periods,
      ...data.sessions
        .filter((row) => row.subject === subject && row.date === date)
        .map((row) => row.label),
    ]),
  ];
  const present = data.students.filter((row) => records[row.id] === 'present');
  const absent = data.students.filter(
    (row) => records[row.id] === 'absent' || records[row.id] === 'leave',
  );
  const missing = data.students.length - present.length - absent.length;
  function save() {
    try {
      const next = saveRegister(data, subject, date, period, records, today(), crypto.randomUUID());
      update(
        next,
        `${current ? 'Updated' : 'Recorded'} attendance · ${subject} · ${date} · ${period}`,
      );
      notify('Attendance saved.');
      setError('');
      setDetails(true);
    } catch (error) {
      setError((error as Error).message);
    }
  }
  const savedPresent = data.students.filter((row) => current?.records[row.id] === 'present');
  const savedAbsent = data.students.filter(
    (row) => current?.records[row.id] === 'absent' || current?.records[row.id] === 'leave',
  );
  return (
    <>
      <div className={styles.heading}>
        <h1>Attendance</h1>
        <div className={styles.actions}>
          <Button kind={details ? 'secondary' : 'primary'} onClick={() => setDetails(false)}>
            Take attendance
          </Button>
          <Button
            kind={details ? 'primary' : 'secondary'}
            onClick={() => {
              setDetails(true);
              setError('');
            }}
          >
            Fetch details
          </Button>
        </div>
      </div>
      <div className={styles.sessionFields}>
        <label>Subject{subjectSelect}</label>
        <label>
          Date
          <input
            aria-label="Attendance date"
            type="date"
            max={today()}
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </label>
        <label>
          Period
          <select
            aria-label="Attendance period"
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
          >
            {labels.map((label) => (
              <option key={label}>{label}</option>
            ))}
          </select>
        </label>
      </div>
      {error && <Notice error>{error}</Notice>}
      {details ? (
        !current ? (
          <p className={styles.empty}>No saved attendance for this date and period.</p>
        ) : current.cancelled ? (
          <Notice>This session was cancelled.</Notice>
        ) : (
          <>
            <div className={styles.heading}>
              <p className={styles.hint}>
                {date} · {period}
              </p>
              <Button kind="secondary" onClick={() => setDetails(false)}>
                Edit register
              </Button>
            </div>
            <div className={styles.detailColumns}>
              {[
                ['Present', savedPresent],
                ['Absent', savedAbsent],
              ].map(([title, students]) => (
                <section className={styles.panel} key={title as string}>
                  <h2>
                    {title as string} · {(students as typeof data.students).length}
                  </h2>
                  {(students as typeof data.students).map((student) => (
                    <div className={styles.person} key={student.id}>
                      <strong>{student.name}</strong>
                      <span>
                        {student.id}
                        {current.records[student.id] === 'leave' ? ' · Leave' : ''}
                      </span>
                    </div>
                  ))}
                  {!(students as typeof data.students).length && (
                    <p className={styles.hint}>None</p>
                  )}
                </section>
              ))}
            </div>
          </>
        )
      ) : (
        <>
          <div className={styles.rosterToolbar}>
            <span>
              {present.length} present · {absent.length} absent
              {missing > 0 ? ` · ${missing} unmarked` : ''}
            </span>
            <div className={styles.actions}>
              <Button
                kind="secondary"
                onClick={() =>
                  setRecords(
                    Object.fromEntries(data.students.map((student) => [student.id, 'present'])),
                  )
                }
              >
                All present
              </Button>
              <Button
                kind="secondary"
                onClick={() =>
                  setRecords(
                    Object.fromEntries(data.students.map((student) => [student.id, 'absent'])),
                  )
                }
              >
                All absent
              </Button>
            </div>
          </div>
          {data.students.length > 30 && (
            <input
              aria-label="Find student"
              placeholder="Find student"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          )}
          <div className={styles.roster}>
            {data.students
              .filter((student) =>
                (student.name + ' ' + student.id).toLowerCase().includes(query.toLowerCase()),
              )
              .map((student) => (
                <div className={styles.rosterRow} key={student.id}>
                  <div>
                    <strong>{student.name}</strong>
                    <small>
                      {student.id}
                      {records[student.id] === 'leave' ? ' · Leave' : ''}
                    </small>
                  </div>
                  <div className={styles.markButtons}>
                    <button
                      aria-label={'Present ' + student.name}
                      aria-pressed={records[student.id] === 'present'}
                      onClick={() => setRecords({ ...records, [student.id]: 'present' })}
                    >
                      Present
                    </button>
                    <button
                      aria-label={'Absent ' + student.name}
                      aria-pressed={records[student.id] === 'absent'}
                      onClick={() => setRecords({ ...records, [student.id]: 'absent' })}
                    >
                      Absent
                    </button>
                  </div>
                </div>
              ))}
          </div>
          {!data.students.length && (
            <p className={styles.empty}>Add students in Students &amp; subjects.</p>
          )}
          <div className={styles.saveBar}>
            <span>
              {present.length} present · {absent.length} absent
            </span>
            <Button disabled={!data.students.length} onClick={save}>
              Save attendance
            </Button>
          </div>
        </>
      )}
    </>
  );
}
