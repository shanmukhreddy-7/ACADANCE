import test from 'node:test';
import assert from 'node:assert/strict';
import { encrypt, decrypt } from '../src/server/session.ts';
import {
  pastInternals,
  todayAttendance,
  feedbackForm,
  submitFeedback,
  type Upstream,
} from '../src/server/portal-tools.ts';
import { predictCharacters } from '../src/server/captcha.ts';
process.env.SESSION_SECRET = 'synthetic-test-secret-used-only-for-unit-testing';
test('encrypted records round-trip and reject tampering and wrong keys', () => {
  const input = { id: 'synthetic', password: 'test-only', expires: 123 };
  const token = encrypt(input);
  assert.deepEqual(decrypt(token), input);
  assert(!token.includes('test-only'));
  const bytes = Buffer.from(token, 'base64url');
  bytes[30] ^= 1;
  assert.throws(() => decrypt(bytes.toString('base64url')));
  const secret = process.env.SESSION_SECRET;
  process.env.SESSION_SECRET = 'another-synthetic-test-secret-at-least-32';
  assert.throws(() => decrypt(token));
  process.env.SESSION_SECRET = secret;
});
test('past internals accept only semesters exposed by the portal', async () => {
  const fetcher: Upstream = async (_path, body) =>
    new Response(
      body.get('ids') === '22'
        ? '<button onclick="funEarlierInternalMarks(2)">Semester II</button>'
        : '<table><tr><td>1</td><td>CS</td><td>Programming</td><td>40</td><td>50</td><td>Pass</td></tr></table>',
    );
  const result = await pastInternals(fetcher, 2);
  assert.equal(result.rows.length, 1);
  assert.equal(result.semesters[0].semester, 2);
  await assert.rejects(pastInternals(fetcher, 99));
});
test('today attendance extracts daily rows without the header', async () => {
  const fetcher: Upstream = async () =>
    new Response(
      '<div class="container-fluid"><h2>Today Attendance</h2><div class="row"><div>Date</div><div>Day</div><div>Hour</div><div>Subject</div><div>Status</div></div><div class="row"><div>2026-11-06</div><div>Friday</div><div>2</div><div>CS</div><div>Present</div></div></div>',
    );
  assert.equal((await todayAttendance(fetcher)).rows[0][4], 'Present');
});
test('feedback validates real questions and forwards only selected answers', async () => {
  let submitted: URLSearchParams | undefined;
  const fetcher: Upstream = async (path, body) => {
    if (path.endsWith('subjectwisefeedback.jsp'))
      return new Response(
        '<input id="feedbacktype" value="1"><input id="mcontroller" value="c"><table><td class="clsSubject" id="s1">Programming<font>Teacher</font></td></table>',
      );
    if (body.get('ids') === '2') {
      submitted = body;
      return new Response('{"result":"Feedback Completed"}');
    }
    return new Response(
      '<input id="hdnControllerId" value="controller"><table><tr class="clsquestions" id="q1"><td>1</td><td>Clarity</td><td><label>Good<input class="answers" id="a1" quesid="101" partid="1" answervalue="Good" pointvalue="4"></label></td></tr><tr class="clsquestions" itemid="q2"><td>2</td><td>Comment</td><td><textarea quesid="102" partid="6"></textarea></td></tr></table>',
    );
  };
  assert.equal((await feedbackForm(fetcher, 's1')).questions.length, 2);
  await assert.rejects(submitFeedback(fetcher, 's1', { q1: 'invented', q2: 'My experience' }));
  assert.equal(submitted, undefined);
  assert.equal(
    (await submitFeedback(fetcher, 's1', { q1: 'a1', q2: 'My own comment' })).success,
    true,
  );
  assert.match(submitted!.get('descriptiveanswer')!, /My own comment/);
  assert.match(submitted!.get('answers')!, /a1/);
});
test('portable reference model runs its full graph on synthetic pixels', async () => {
  const result = await predictCharacters(new Float32Array(25 * 120).fill(1));
  assert.match(result, /^[A-Z0-9]{0,5}$/);
});
