'use client';
import { useEffect, useState } from 'react';
import { Badge } from './ui';
import type { PortalData } from '@/lib/types';
import { slotMinutes } from '@/lib/schedule';
export function CurrentClass({ data }: { data: PortalData }) {
  const [clock, setClock] = useState<Date | null>(null);
  useEffect(() => {
    setClock(new Date());
    const timer = setInterval(() => setClock(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);
  if (!clock) return null;
  const dayName = clock.toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata', weekday: 'long' });
  const [hour, minute] = clock
    .toLocaleTimeString('en-GB', {
      timeZone: 'Asia/Kolkata',
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
    })
    .split(':')
    .map(Number);
  const now = hour * 60 + minute;
  const day = data.timetable.find((d) =>
    d.day.toLowerCase().startsWith(dayName.toLowerCase().slice(0, 3)),
  );
  const slots =
    day?.slots.flatMap((slot, i) => {
      const range = slotMinutes(data.timeHeaders[i] ?? '');
      return slot && !/^(free|lunch|break|-|—)$/i.test(slot.trim()) && range
        ? [{ slot, range, label: data.timeHeaders[i] }]
        : [];
    }) ?? [];
  const current = slots.find((s) => now >= s.range[0] && now < s.range[1]);
  const next = slots.filter((s) => s.range[0] > now).sort((a, b) => a.range[0] - b.range[0])[0];
  return (
    <div className="panel padded current-class">
      <Badge tone={current ? 'amber' : 'green'}>
        {current ? 'Current class' : next ? 'Up next' : 'Today'}
      </Badge>
      <strong>{current?.slot ?? next?.slot ?? 'No upcoming class in the loaded timetable'}</strong>
      <span className="muted">
        {current?.label ?? next?.label ?? 'Check changes announced by your faculty.'} · India time
      </span>
    </div>
  );
}
