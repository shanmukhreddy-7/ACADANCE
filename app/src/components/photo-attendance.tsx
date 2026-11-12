'use client';
import { useEffect, useRef, useState } from 'react';
import { Button, Notice, Modal } from './ui';
import type { Core, ProfessorData, SeatPlan, Session } from '@/lib/types';
import {
  defaultSeatPlan,
  validateSeatPlan,
  analyzeSeatPhotos,
  seatRegion,
} from '@/lib/photo-attendance';
import { periods, saveRegister, type RegisterSelection } from '@/lib/register';
import { today } from '@/lib/core';
import styles from './professor-workspace.module.css';
type Analysis = Awaited<ReturnType<typeof analyzeSeatPhotos>>;
export default function PhotoAttendance({
  core,
  data,
  subject,
  subjectSelect,
  update,
  notify,
  onSaved,
}: {
  core: Core;
  data: ProfessorData;
  subject: string;
  subjectSelect: React.ReactNode;
  update: (data: ProfessorData, note?: string) => void;
  notify: (text: string) => void;
  onSaved: (selection: RegisterSelection) => void;
}) {
  const [plan, setPlan] = useState<SeatPlan>(
    () => data.photoPlan ?? defaultSeatPlan(data.students),
  );
  const [reference, setReference] = useState('');
  const [photo, setPhoto] = useState('');
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [records, setRecords] = useState<Session['records']>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [date, setDate] = useState(today());
  const [period, setPeriod] = useState('Period 1');
  const [confirm, setConfirm] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [delta, setDelta] = useState(36);
  const [occupied, setOccupied] = useState(0.22);
  const urls = useRef<string[]>([]);
  const version = useRef(0);
  useEffect(
    () => () => {
      version.current++;
      urls.current.forEach((url) => URL.revokeObjectURL(url));
    },
    [],
  );
  const present = data.students.filter((student) => records[student.id] === 'present').length;
  const absent = data.students.filter(
    (student) => records[student.id] === 'absent' || records[student.id] === 'leave',
  ).length;
  const missing = data.students.length - present - absent;
  const existing = data.sessions.find(
    (row) => row.subject === subject && row.date === date && row.label === period,
  );
  const labels = [
    ...new Set([
      ...periods,
      ...data.sessions
        .filter((row) => row.subject === subject && row.date === date)
        .map((row) => row.label),
    ]),
  ];
  function reset() {
    version.current++;
    setAnalysis(null);
    setRecords({});
    setReviewed(false);
    setError('');
  }
  function changePlan(next: SeatPlan) {
    setPlan(next);
    reset();
  }
  function upload(file: File | undefined, kind: 'reference' | 'photo') {
    if (!file) return;
    if (
      !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
      file.size > 12 * 1024 * 1024
    ) {
      setError('Use a JPEG, PNG or WebP up to 12 MB.');
      return;
    }
    const url = URL.createObjectURL(file);
    urls.current.push(url);
    reset();
    if (kind === 'reference') setReference(url);
    else setPhoto(url);
  }
  async function analyze() {
    setError('');
    try {
      validateSeatPlan(plan, data.students);
      if (!reference || !photo) throw Error('Add an empty reference and a class photo.');
    } catch (error) {
      setError((error as Error).message);
      return;
    }
    const request = ++version.current;
    setBusy(true);
    setReviewed(false);
    try {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const result = await analyzeSeatPhotos(core, reference, photo, plan, delta, occupied);
      if (request !== version.current) return;
      setAnalysis(result);
      setRecords(
        Object.fromEntries(
          result.results
            .filter((row) => row.student && row.status !== 'review')
            .map((row) => [row.student, row.status as 'present' | 'absent']),
        ),
      );
    } catch (error) {
      if (request === version.current) setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function save() {
    try {
      if (!analysis) throw Error('Analyse the photo first.');
      validateSeatPlan(plan, data.students);
      if (!reviewed) throw Error('Confirm that you checked every attendance mark.');
      const next = saveRegister(
        { ...data, photoPlan: plan },
        subject,
        date,
        period,
        records,
        today(),
        crypto.randomUUID(),
      );
      update(
        next,
        `${existing ? 'Updated' : 'Recorded'} photo attendance · ${subject} · ${date} · ${period} · reviewed`,
      );
      notify('Photo attendance saved.');
      setConfirm(false);
      setError('');
      onSaved({ date, label: period, details: true });
    } catch (error) {
      setError((error as Error).message);
    }
  }
  function assign(index: number, id: string) {
    const assignments = [...plan.assignments];
    const other = assignments.indexOf(id);
    if (id && other !== -1 && other !== index) assignments[other] = assignments[index];
    assignments[index] = id;
    changePlan({ ...plan, assignments });
  }
  return (
    <>
      <div className={styles.heading}>
        <h1>Photo attendance</h1>
        <Button
          kind="secondary"
          disabled={busy || data.students.length > 24 || !data.students.length}
          onClick={() => {
            reset();
            setPlan({
              ...defaultSeatPlan(data.students),
              rows: 4,
              columns: 6,
              assignments: Array.from({ length: 24 }, (_, i) => data.students[i]?.id ?? ''),
            });
            setReference('/photo-demo/empty-classroom.png');
            setPhoto('/photo-demo/occupied-classroom.png');
          }}
        >
          Load demo photos
        </Button>
      </div>
      <p className={styles.hint}>
        Experimental seat comparison. Use a fixed camera and empty reference. Review every mark.
      </p>
      <div className={styles.sessionFields}>
        <label>Subject{subjectSelect}</label>
        <label>
          Date
          <input
            aria-label="Photo attendance date"
            type="date"
            max={today()}
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </label>
        <label>
          Period
          <select
            aria-label="Photo attendance period"
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
          >
            {labels.map((label) => (
              <option key={label}>{label}</option>
            ))}
          </select>
        </label>
      </div>
      {error && !confirm && <Notice error>{error}</Notice>}
      <div className={styles.photoUploads}>
        <label>
          Empty reference
          <input
            aria-label="Empty reference"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={busy}
            onChange={(event) => upload(event.target.files?.[0], 'reference')}
          />
          {reference && <img src={reference} alt="Empty classroom reference" />}
        </label>
        <label>
          Class photo
          <input
            aria-label="Class photo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            disabled={busy}
            onChange={(event) => upload(event.target.files?.[0], 'photo')}
          />
          {photo && <img src={photo} alt="Class attendance photo" />}
        </label>
      </div>
      <details className={styles.advanced}>
        <summary>
          Seating &amp; alignment · {plan.rows} × {plan.columns}
        </summary>
        {(photo || reference) && (
          <div className={styles.alignmentPreview}>
            <img src={photo || reference} alt="Seat alignment preview" />
            {plan.assignments.map((id, index) => {
              const region = seatRegion(plan, index);
              return (
                <span
                  key={index}
                  style={{
                    left: region.x * 100 + '%',
                    top: region.y * 100 + '%',
                    width: region.width * 100 + '%',
                    height: region.height * 100 + '%',
                  }}
                >
                  {id ? index + 1 : 'Empty'}
                </span>
              );
            })}
          </div>
        )}
        <p className={styles.hint}>
          Rows run top to bottom; columns left to right. Assign each student once.
        </p>
        <div className={styles.gridControls}>
          {(['rows', 'columns'] as const).map((key) => (
            <label key={key}>
              {key === 'rows' ? 'Rows' : 'Seats per row'}
              <input
                type="number"
                min={1}
                max={10}
                disabled={busy}
                value={plan[key]}
                onChange={(event) => {
                  const value = Math.max(
                    1,
                    Math.min(10, Math.floor(Number(event.target.value) || 1)),
                  );
                  const rows = key === 'rows' ? value : plan.rows,
                    columns = key === 'columns' ? value : plan.columns;
                  changePlan({
                    ...plan,
                    rows,
                    columns,
                    assignments: Array.from(
                      { length: rows * columns },
                      (_, i) => plan.assignments[i] ?? '',
                    ),
                  });
                }}
              />
            </label>
          ))}
        </div>
        <Button
          kind="secondary"
          disabled={busy}
          onClick={() =>
            changePlan({
              ...plan,
              assignments: Array.from(
                { length: plan.rows * plan.columns },
                (_, i) => data.students[i]?.id ?? '',
              ),
            })
          }
        >
          Use roster order
        </Button>
        <div className={styles.seats}>
          {plan.assignments.map((id, i) => (
            <label key={i}>
              R{Math.floor(i / plan.columns) + 1} C{(i % plan.columns) + 1}
              <select
                disabled={busy}
                aria-label={`Student at seat ${i + 1}`}
                value={id}
                onChange={(event) => assign(i, event.target.value)}
              >
                <option value="">Empty seat</option>
                {data.students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.name}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <div className={styles.gridControls}>
          {(
            ['left', 'top', 'width', 'height', 'sampleWidth', 'sampleHeight', 'offsetY'] as const
          ).map((key) => (
            <label key={key}>
              {
                {
                  left: 'Grid left',
                  top: 'Grid top',
                  width: 'Grid width',
                  height: 'Grid height',
                  sampleWidth: 'Seat width',
                  sampleHeight: 'Seat height',
                  offsetY: 'Vertical offset',
                }[key]
              }
              <input
                aria-label={key}
                type="number"
                step="0.01"
                min={key === 'offsetY' ? -0.4 : 0}
                max={1}
                disabled={busy}
                value={plan[key]}
                onChange={(event) => changePlan({ ...plan, [key]: Number(event.target.value) })}
              />
            </label>
          ))}
          <label>
            Pixel threshold
            <input
              type="number"
              min={1}
              max={255}
              value={delta}
              disabled={busy}
              onChange={(event) => {
                setDelta(Math.max(1, Math.min(255, Number(event.target.value) || 36)));
                reset();
              }}
            />
          </label>
          <label>
            Occupied threshold
            <input
              type="number"
              min={0.08}
              max={1}
              step=".01"
              value={occupied}
              disabled={busy}
              onChange={(event) => {
                setOccupied(Math.max(0.08, Math.min(1, Number(event.target.value) || 0.22)));
                reset();
              }}
            />
          </label>
        </div>
        <a className="text-link" href="/photo-demo/classroom-demo-kit.zip" download>
          Download demo kit
        </a>
      </details>
      <Button disabled={busy || !data.students.length} onClick={() => void analyze()}>
        {busy ? 'Analysing…' : 'Analyse photo'}
      </Button>
      {analysis && (
        <>
          <div className={styles.heading}>
            <p>
              {present} present · {absent} absent{missing ? ` · ${missing} to review` : ''}
            </p>
            <Button
              onClick={() => {
                if (missing) {
                  setError(`Review ${missing} unmarked students before saving.`);
                  return;
                }
                setReviewed(false);
                setError('');
                setConfirm(true);
              }}
            >
              Save attendance
            </Button>
          </div>
          <div className={styles.photoReview}>
            <div>
              <img src={photo} alt="Photo being reviewed" />
              <p className={styles.hint}>Seat occupancy does not verify student identity.</p>
            </div>
            <div className={styles.photoRows}>
              {data.students.map((student) => (
                <label key={student.id}>
                  {student.name}
                  <select
                    aria-label={'Review ' + student.name}
                    value={records[student.id] ?? 'review'}
                    onChange={(event) => {
                      const next = { ...records };
                      if (event.target.value === 'review') delete next[student.id];
                      else next[student.id] = event.target.value as 'present' | 'absent';
                      setRecords(next);
                      setReviewed(false);
                    }}
                  >
                    <option value="review">Review</option>
                    <option value="present">Present</option>
                    <option value="absent">Absent</option>
                    <option value="leave">Leave</option>
                  </select>
                </label>
              ))}
            </div>
          </div>
        </>
      )}
      {confirm && (
        <Modal title="Save attendance" onClose={() => setConfirm(false)}>
          <p>
            {subject} · {date} · {period}
          </p>
          <p>
            {present} present · {absent} absent
          </p>
          {existing && (
            <p className={styles.hint}>This replaces the saved register for this period.</p>
          )}
          <label className={styles.reviewCheck}>
            <input
              type="checkbox"
              checked={reviewed}
              onChange={(event) => setReviewed(event.target.checked)}
            />{' '}
            I checked the seating order and every attendance mark.
          </label>
          {error && <Notice error>{error}</Notice>}
          <Button onClick={save}>Confirm &amp; save</Button>
        </Modal>
      )}
    </>
  );
}
