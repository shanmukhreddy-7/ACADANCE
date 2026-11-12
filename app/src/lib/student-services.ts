export async function campus(action: string, payload: Record<string, unknown> = {}) {
  if (!localStorage.getItem('acadence.activeRegistration'))
    throw Error('Sign in to use shared campus tools.');
  const response = await fetch('/api/community', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action,
      expectedRegistration: localStorage.getItem('acadence.activeRegistration') ?? '',
      ...payload,
    }),
  });
  const data = await response.json();
  if (!response.ok) throw Error(data.error ?? 'Campus tool request failed.');
  return data;
}
export async function portalTool(action: string, payload: Record<string, unknown> = {}) {
  const response = await fetch('/api/portal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action,
      expectedRegistration: localStorage.getItem('acadence.activeRegistration') ?? '',
      ...payload,
    }),
  });
  const data = await response.json();
  if (!response.ok) throw Error(data.error ?? 'Portal request failed.');
  return data;
}
export async function fileBase64(file: File) {
  if (file.size > 2 * 1024 * 1024) throw Error('Choose a file up to 2 MB.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192)
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
}
export function savedAccounts() {
  try {
    return JSON.parse(
      localStorage.getItem('acadence.accounts.v2') ?? '[]',
    ) as import('./types').PortalData[];
  } catch {
    return [];
  }
}
export function cacheStudent(data: import('./types').PortalData) {
  if (data.demo) return;
  localStorage.setItem('acadence.student.cache', JSON.stringify(data));
  const accounts = savedAccounts().filter(
    (a) => a.profile.registration !== data.profile.registration,
  );
  localStorage.setItem('acadence.accounts.v2', JSON.stringify([data, ...accounts].slice(0, 5)));
  const key = 'acadence.history.' + data.profile.registration;
  let rows: import('./types').PortalData[] = [];
  try {
    rows = JSON.parse(localStorage.getItem(key) ?? '[]');
  } catch {}
  const date = data.syncedAt.slice(0, 10);
  localStorage.setItem(
    key,
    JSON.stringify([data, ...rows.filter((r) => r.syncedAt.slice(0, 10) !== date)].slice(0, 30)),
  );
}
