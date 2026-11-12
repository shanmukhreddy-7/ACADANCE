import type { PortalData } from './types.ts';

type AccountRequest = (action: string, payload?: Record<string, unknown>) => Promise<unknown>;

export async function activateStudentAccount(
  registration: string,
  request: AccountRequest,
): Promise<PortalData> {
  const expected = registration.trim().toUpperCase();
  if (!/^AP\d{8,15}$/.test(expected)) throw Error('Invalid saved account.');
  await request('activate', { registration: expected });
  // The cookie now belongs to the selected account; never send the previous identity.
  const data = (await request('sync', { expectedRegistration: expected })) as PortalData;
  if (data?.profile?.registration?.toUpperCase() !== expected)
    throw Error('The university returned a different account. Please sign in again.');
  return data;
}
