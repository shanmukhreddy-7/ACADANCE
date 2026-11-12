export function slotMinutes(label: string): [number, number] | null {
  const matches = [...label.matchAll(/(\d{1,2})[:.](\d{2})\s*(AM|PM)?/gi)];
  if (matches.length < 2) return null;
  const parse = (m: RegExpMatchArray) => {
    let h = Number(m[1]);
    const minute = Number(m[2]);
    if (minute > 59 || h > 23) return NaN;
    if (m[3]) h = (h % 12) + (m[3].toUpperCase() === 'PM' ? 12 : 0);
    return h * 60 + minute;
  };
  const start = parse(matches[0]);
  let end = parse(matches[1]);
  // Handle a noon-crossing range such as 11:50–12:40.
  if (end <= start && end < 12 * 60) end += 12 * 60;
  return Number.isFinite(start) && Number.isFinite(end) && end > start ? [start, end] : null;
}
