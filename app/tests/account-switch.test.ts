import test from 'node:test';
import assert from 'node:assert/strict';
import { activateStudentAccount } from '../src/lib/account-switch.ts';
import { createStudentDemo } from '../src/lib/demo.ts';

test('switching activates the selected account before syncing with its identity', async () => {
  const registration = 'AP26110080002';
  const data = createStudentDemo();
  data.profile.registration = registration;
  const calls: { action: string; payload?: Record<string, unknown> }[] = [];
  const result = await activateStudentAccount('ap26110080002', async (action, payload) => {
    calls.push({ action, payload });
    return action === 'activate' ? { success: true } : data;
  });
  assert.equal(result, data);
  assert.deepEqual(calls, [
    { action: 'activate', payload: { registration } },
    { action: 'sync', payload: { expectedRegistration: registration } },
  ]);
});

test('expired sessions stop switching before sync; mismatched records are never returned', async () => {
  let requests = 0;
  await assert.rejects(
    activateStudentAccount('AP26110080002', async () => {
      requests++;
      throw Error('Expired');
    }),
    /Expired/,
  );
  assert.equal(requests, 1);
  const wrong = createStudentDemo();
  wrong.profile.registration = 'AP26110080003';
  await assert.rejects(
    activateStudentAccount('AP26110080002', async (action) => (action === 'activate' ? {} : wrong)),
    /different account/,
  );
  await assert.rejects(
    activateStudentAccount('invalid', async () => {
      throw Error('Should not run');
    }),
    /Invalid saved account/,
  );
});
