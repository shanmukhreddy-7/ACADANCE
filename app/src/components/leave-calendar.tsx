'use client';
import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { today } from '@/lib/core';
import type { Core, PortalData } from '@/lib/types';
import { attendanceProjection, missedSlots } from '@/lib/leave-plan';
import styles from './student-academic.module.css';

export default function LeaveCalendar({
  data,
  core,
  target,
  selected,
  setSelected,
}: {
  data: PortalData;
  core: Core;
  target: number;
  selected: string[];
  setSelected: React.Dispatch<React.SetStateAction<string[]>>;
}) {
  const minimum = today();
  const horizon = new Date(Date.parse(minimum + 'T12:00:00Z') + 180 * 86400000)
    .toISOString()
    .slice(0, 10);
  const [month, setMonth] = useState(minimum.slice(0, 7));
  const first = new Date(month + '-01T12:00:00Z');
  const year = first.getUTCFullYear(),
    monthIndex = first.getUTCMonth();
  const offset = (first.getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const label = first.toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const missed = missedSlots(data, selected);
  function moveMonth(delta: number) {
    setMonth(new Date(Date.UTC(year, monthIndex + delta, 1, 12)).toISOString().slice(0, 7));
  }
  return (
    <div className={styles.leavePlan}>
      <p className={styles.hint}>Choose future leave dates. Click again to remove.</p>
      <div className={styles.calendar}>
        <div className={styles.monthHeader}>
          <button
            aria-label="Previous month"
            disabled={month <= minimum.slice(0, 7)}
            onClick={() => moveMonth(-1)}
          >
            <ChevronLeft size={19} />
          </button>
          <h3>{label}</h3>
          <button
            aria-label="Next month"
            disabled={month >= horizon.slice(0, 7)}
            onClick={() => moveMonth(1)}
          >
            <ChevronRight size={19} />
          </button>
        </div>
        <div className={styles.calendarGrid}>
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
            <span className={styles.weekday} key={day}>
              {day}
            </span>
          ))}
          {Array.from({ length: offset }, (_, i) => (
            <span key={'empty' + i} />
          ))}
          {Array.from({ length: days }, (_, i) => {
            const date = `${month}-${String(i + 1).padStart(2, '0')}`;
            return (
              <button
                key={date}
                aria-label={date}
                aria-pressed={selected.includes(date)}
                disabled={date <= minimum || date > horizon}
                className={selected.includes(date) ? styles.selectedDay : ''}
                onClick={() =>
                  setSelected((prev) =>
                    prev.includes(date) ? prev.filter((d) => d !== date) : [...prev, date].sort(),
                  )
                }
              >
                {i + 1}
              </button>
            );
          })}
        </div>
      </div>
      <div className={styles.selectionHeader}>
        <strong>
          {selected.length} {selected.length === 1 ? 'day' : 'days'} selected
        </strong>
        <button className="text-link" disabled={!selected.length} onClick={() => setSelected([])}>
          Clear dates
        </button>
      </div>
      {selected.length > 0 && (
        <div className={styles.dateChips}>
          {selected.map((date) => (
            <button
              key={date}
              aria-label={'Remove ' + date}
              onClick={() => setSelected((prev) => prev.filter((d) => d !== date))}
            >
              {new Date(date + 'T12:00:00Z').toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                timeZone: 'UTC',
              })}{' '}
              ×
            </button>
          ))}
        </div>
      )}
      <h3>Attendance after leave</h3>
      {!data.timetable.length && (
        <p role="status" className={styles.danger}>
          No timetable available. Missed classes cannot be estimated.
        </p>
      )}
      <div className="table-wrap">
        <table className={styles.forecastTable}>
          <thead>
            <tr>
              <th>Subject</th>
              <th>Missed</th>
              <th>Current → projected</th>
              <th>To reach {target}%</th>
            </tr>
          </thead>
          <tbody>
            {data.attendance.map((row) => {
              const next = attendanceProjection(core, row, 0, missed[row.code], target);
              const current = core.attendance(row.present, row.total);
              return (
                <tr key={row.code}>
                  <td>
                    <strong>{row.name}</strong>
                    <small>{row.code}</small>
                  </td>
                  <td>{data.timetable.length ? missed[row.code] : '—'}</td>
                  <td
                    className={
                      next.percentage >= 0 && (next.need > 0 || next.need === -2)
                        ? styles.danger
                        : ''
                    }
                  >
                    {current < 0 ? '—' : current.toFixed(2) + '%'} →{' '}
                    <strong>
                      {!data.timetable.length
                        ? '—'
                        : next.percentage < 0
                          ? '—'
                          : next.percentage.toFixed(2) + '%'}
                    </strong>
                  </td>
                  <td
                    className={
                      next.percentage >= 0 && (next.need > 0 || next.need === -2)
                        ? styles.danger
                        : ''
                    }
                  >
                    {!data.timetable.length
                      ? 'Unknown'
                      : next.percentage < 0
                        ? 'No records'
                        : next.need === -2
                          ? 'Not recoverable'
                          : next.need < 0
                            ? 'Unavailable'
                            : next.need > 0
                              ? `Attend ${next.need}`
                              : 'On track'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className={styles.hint}>
        Estimate only. Each selected timetable slot counts as missed; other future classes are not
        assumed attended. Holidays, cancellations and extra classes are not known. University
        records stay unchanged.
      </p>
    </div>
  );
}
