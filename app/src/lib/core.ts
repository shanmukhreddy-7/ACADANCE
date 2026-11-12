import type { Core } from './types';
let pending: Promise<Core> | undefined;
export function loadCore() {
  return (pending ??= fetch('/academic_core.wasm').then(async (r) => {
    if (!r.ok) throw Error('Academic engine could not load. Reload to try again.');
    const { instance } = await WebAssembly.instantiate(await r.arrayBuffer(), {});
    return instance.exports as unknown as Core;
  }));
}
export function sum(core: Core, values: number[]) {
  values.forEach((v, i) => core.set_input(i, v, 1));
  return core.sum_scores(values.length);
}
export function gpa(core: Core, items: { points: number; credits: number }[]) {
  if (!items.length) return null;
  items.forEach((x, i) => core.set_input(i, x.points, x.credits));
  const result = core.weighted_gpa(items.length);
  return result < 0 ? null : result;
}
export function csvDownload(name: string, rows: (string | number)[][]) {
  const csv = rows
    .map((row) =>
      row
        .map((v) => {
          let s = String(v);
          if (/^[=+@\-\t\r]/.test(s)) s = "'" + s;
          return '"' + s.replaceAll('"', '""') + '"';
        })
        .join(','),
    )
    .join('\r\n');
  download(name, 'text/csv;charset=utf-8', csv);
}
export function download(name: string, type: string, body: string) {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function today() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}
export function prettyDate(value: string) {
  if (!value) return 'Select a date';
  return new Date(value + 'T12:00:00').toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
