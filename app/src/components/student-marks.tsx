'use client';
import { useState } from 'react';
import { Download } from 'lucide-react';
import { Badge, Button, Empty, Modal } from './ui';
import type { Core, PortalData, UniversityProfile, InternalMark } from '@/lib/types';
import { csvDownload } from '@/lib/core';
import styles from './student-results.module.css';

const marks = (score: number | null, maximum: number | null, raw: string) => {
  if (score !== null) return `${score}${maximum === null ? '' : ` / ${maximum}`}`;
  const label = raw.split('/')[0].trim() || 'Pending';
  return maximum === null ? raw || 'Pending' : `${label} / ${maximum}`;
};

export function InternalBreakdown({ data, core }: { data: PortalData; core: Core }) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<InternalMark | null>(null);
  const [target, setTarget] = useState(75);
  const rows = data.internals.filter((row) =>
    (row.name + ' ' + row.code).toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      {data.internals.length > 5 && (
        <input
          className={styles.search}
          aria-label="Search subjects"
          placeholder="Search subjects"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      )}
      <div className={styles.markList}>
        {rows.map((row) => (
          <div className={styles.markRow} key={row.code}>
            <div className={styles.subject}>
              <strong>{row.name}</strong>
              <span>{row.code}</span>
            </div>
            <span className={styles.total}>
              {row.score ?? '—'}
              <small> / {row.max ?? '—'}</small>
            </span>
            <Button kind="secondary" onClick={() => setSelected(row)}>
              Breakdown<span className={styles.srOnly}> for {row.name}</span>
            </Button>
          </div>
        ))}
      </div>
      {!rows.length && (
        <Empty
          title={data.internals.length ? 'No matching subjects' : 'No internal marks yet'}
          description=""
        />
      )}
      {selected && (
        <Modal title={selected.name} wide onClose={() => setSelected(null)}>
          <div className={styles.detailHeader}>
            <span>{selected.code}</span>
            <strong>
              {selected.score ?? '—'} / {selected.max ?? '—'}
            </strong>
          </div>
          {selected.exams?.length ? (
            <div className="table-wrap">
              <table className={styles.breakdownTable}>
                <thead>
                  <tr>
                    <th>Assessment</th>
                    <th>Exam marks</th>
                    <th>Converted</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.exams.map((exam, i) => (
                    <tr key={i}>
                      <td>
                        <strong>{exam.name}</strong>
                      </td>
                      <td>{marks(exam.conductedScore, exam.conductedMax, exam.conductedText)}</td>
                      <td>{marks(exam.convertedScore, exam.convertedMax, exam.convertedText)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className={styles.note}>
              {selected.exams === undefined
                ? 'Sync to load the breakdown.'
                : 'No breakdown published.'}
            </p>
          )}
          <div className={styles.detailFooter}>
            {selected.score !== null &&
              selected.max !== null &&
              selected.max > 0 &&
              selected.score >= 0 &&
              selected.score <= selected.max && (
                <label className={styles.target}>
                  Target
                  <select
                    aria-label="Internal marks target"
                    value={target}
                    onChange={(event) => setTarget(Number(event.target.value))}
                  >
                    {[60, 70, 75, 80, 90].map((value) => (
                      <option key={value} value={value}>
                        {value}%
                      </option>
                    ))}
                  </select>
                  <span>
                    {core.marks_needed(selected.score, selected.max, target) > 0
                      ? `${core.marks_needed(selected.score, selected.max, target).toFixed(2)} marks short`
                      : 'Target reached'}
                  </span>
                </label>
              )}
            <Button
              kind="secondary"
              onClick={() =>
                csvDownload(
                  'acadence-' + selected.code.replace(/[^a-z0-9]/gi, '-') + '-breakdown.csv',
                  [
                    [
                      'Subject code',
                      'Subject',
                      'Assessment',
                      'Conducted score',
                      'Conducted maximum',
                      'Converted score',
                      'Converted maximum',
                    ],
                    ...(selected.exams ?? []).map((exam) => [
                      selected.code,
                      selected.name,
                      exam.name,
                      exam.conductedScore ?? '',
                      exam.conductedMax ?? '',
                      exam.convertedScore ?? '',
                      exam.convertedMax ?? '',
                    ]),
                  ],
                )
              }
            >
              <Download size={15} /> Export
            </Button>
          </div>
          <p className={styles.note}>
            University figures. Pending marks are not zero; totals may use best-of rules.
          </p>
        </Modal>
      )}
    </>
  );
}
export function ProfileSummary({
  profile,
  syncedAt,
  demo = false,
}: {
  profile: UniversityProfile;
  syncedAt: string;
  demo?: boolean;
}) {
  const fields = [
    ['Registration number', profile.registration],
    ['Institution', profile.institution],
    ['Programme', profile.program],
    ['Specialization', profile.specialization],
    ['Semester', profile.semester],
    ['Section', profile.section],
    ['Date of birth', profile.dateOfBirth],
    ['Gender', profile.gender],
  ].filter(([, value]) => !!value);
  return (
    <section className="panel profile-summary">
      <div className="profile-summary-head">
        <span className="avatar">
          {profile.name
            .split(' ')
            .filter(Boolean)
            .slice(0, 2)
            .map((s) => s[0])
            .join('')}
        </span>
        <div>
          <span className="eyebrow">{demo ? 'SAMPLE PROFILE' : 'UNIVERSITY PROFILE'}</span>
          <h2>{profile.name}</h2>
          <p className="muted">
            {demo
              ? 'Fictional student profile'
              : `Fetched ${new Date(syncedAt).toLocaleString('en-IN')}`}
          </p>
        </div>
        <Badge>{demo ? 'Demo' : 'SRM AP'}</Badge>
      </div>
      <dl className="profile-details">
        {fields.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
