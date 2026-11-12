'use client';
import { useState } from 'react';
import { Download } from 'lucide-react';
import { Button, Empty } from './ui';
import { InternalBreakdown } from './student-marks';
import { csvDownload, gpa } from '@/lib/core';
import type { Core, PortalData } from '@/lib/types';
import styles from './student-results.module.css';

export default function StudentResults({
  data,
  core,
  cgpa,
}: {
  data: PortalData;
  core: Core;
  cgpa: number | null;
}) {
  const [view, setView] = useState<'internals' | 'results'>('internals');
  const semesters = [...new Set(data.ledger.map((row) => row.semester))];
  const [semester, setSemester] = useState(semesters.at(-1) ?? '');
  const rows = data.ledger.filter((row) => row.semester === semester);
  const sgpa = gpa(core, rows);
  return (
    <>
      <div className={styles.header}>
        <h1>Marks &amp; results</h1>
        <Button
          kind="secondary"
          onClick={() =>
            view === 'internals'
              ? csvDownload('acadence-internal-marks.csv', [
                  ['Subject code', 'Subject', 'Score', 'Maximum'],
                  ...data.internals.map((row) => [
                    row.code,
                    row.name,
                    row.score ?? '',
                    row.max ?? '',
                  ]),
                ])
              : csvDownload('acadence-semester-results.csv', [
                  [
                    'Semester',
                    'Subject code',
                    'Subject',
                    'Credits',
                    'Grade',
                    'Points',
                    'Result',
                    'Attempt',
                  ],
                  ...rows.map((row) => [
                    row.semester,
                    row.code,
                    row.name,
                    row.credits,
                    row.grade,
                    row.points,
                    row.result,
                    row.attempt,
                  ]),
                ])
          }
        >
          <Download size={15} /> Export
        </Button>
      </div>
      <div className={styles.tabs} role="tablist" aria-label="Marks view">
        <button
          role="tab"
          id="internals-tab"
          aria-selected={view === 'internals'}
          aria-controls="internals-panel"
          onClick={() => setView('internals')}
          onKeyDown={(event) => {
            if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
              event.preventDefault();
              setView('results');
              document.getElementById('results-tab')?.focus();
            }
          }}
          tabIndex={view === 'internals' ? 0 : -1}
        >
          Internals
        </button>
        <button
          role="tab"
          id="results-tab"
          aria-selected={view === 'results'}
          aria-controls="results-panel"
          onClick={() => setView('results')}
          onKeyDown={(event) => {
            if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
              event.preventDefault();
              setView('internals');
              document.getElementById('internals-tab')?.focus();
            }
          }}
          tabIndex={view === 'results' ? 0 : -1}
        >
          Semester results
        </button>
      </div>
      {view === 'internals' ? (
        <section id="internals-panel" role="tabpanel" aria-labelledby="internals-tab">
          <InternalBreakdown data={data} core={core} />
        </section>
      ) : (
        <section id="results-panel" role="tabpanel" aria-labelledby="results-tab">
          {semesters.length ? (
            <>
              <div className={styles.resultToolbar}>
                <label>
                  Semester
                  <select
                    aria-label="Result semester"
                    value={semester}
                    onChange={(event) => setSemester(event.target.value)}
                  >
                    {semesters.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>
                <div className={styles.gpa}>
                  <span>
                    SGPA <strong>{sgpa?.toFixed(2) ?? '—'}</strong>
                  </span>
                  <span>
                    CGPA <strong>{cgpa?.toFixed(2) ?? '—'}</strong>
                  </span>
                </div>
              </div>
              <div className={styles.resultsList}>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Subject</th>
                        <th>Grade</th>
                        <th>Credits</th>
                        <th>Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, i) => (
                        <tr key={i}>
                          <td>
                            <strong>{row.name}</strong>
                            <small>
                              {row.code}
                              {row.attempt && row.attempt !== '1'
                                ? ` · Attempt ${row.attempt}`
                                : ''}
                            </small>
                          </td>
                          <td>{row.grade || '—'}</td>
                          <td>{row.credits}</td>
                          <td>{row.result || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <p className={styles.note}>
                SGPA calculated from credits. CGPA{' '}
                {data.cgpa !== null
                  ? 'published by the university'
                  : 'calculated from available results'}
                .
              </p>
            </>
          ) : (
            <Empty title="No semester results yet" description="" />
          )}
        </section>
      )}
    </>
  );
}
