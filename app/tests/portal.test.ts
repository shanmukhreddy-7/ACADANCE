import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePortal } from '../src/lib/portal-parser.ts';
test('portal parser extracts academic tables without importing unrelated profile fields', () => {
  const data = parsePortal({
    attendance:
      '<table id="tblSubjectWiseAttendance"><tr><td>CSE 202</td><td>C++</td><td>48</td><td>46</td><td>2</td><td>0</td><td>95.83</td><td>0.00</td><td>95.83</td></tr></table>',
    profile:
      '<table><tr><td>Student Name</td><td>:</td><td>Example Student</td></tr><tr><td>Register No.</td><td>:</td><td>AP26000000001</td></tr><tr><td>D.O.B.</td><td>:</td><td>Private field</td></tr></table>',
    timetable:
      '<table><tr><th>Day / Time</th><th>9:00-9:50</th><th>10:00-10:50</th></tr><tr><td>Monday</td><td>CSE 202</td><td>Free</td></tr><tr><td>Saturday</td><td>CSE 203</td><td>Free</td></tr></table>',
    subjects: '<table><tr><td>III</td><td>CSE 202</td><td>C++</td><td>4</td></tr></table>',
    internals: '<table><tr><td>CSE 202</td><td>C++</td><td>24.40</td><td>50</td></tr></table>',
    ledger:
      '<div>CGPA : 9.21</div><div class="subTable"><table><tr><td>I</td><td>May 2026</td><td>CSE 101</td><td>Programming</td><td>4</td><td>A+</td><td>9</td><td>PASS</td><td>1</td></tr></table></div>',
  });
  assert.equal(data.attendance[0].present, 46);
  assert.equal(data.internals[0].score, 24.4);
  assert.equal(data.cgpa, 9.21);
  assert.equal(data.timetable.length, 2);
  assert.equal(data.timeHeaders.length, 2);
  assert.equal(data.subjects[0].credits, 4);
  assert.equal(data.profile.registration, 'AP26000000001');
  assert.equal(data.ledger[0].points, 9);
  assert.ok(!JSON.stringify(data.profile).includes('Private field'));
});
test('missing academic records remain unavailable rather than appearing as zero', () => {
  const data = parsePortal({
    ledger: '<p>CGPA: Not available</p>',
    internals: '<table><tr><td>CSE</td><td>Test</td><td></td><td>50</td></tr></table>',
  });
  assert.equal(data.cgpa, null);
  assert.equal(data.internals.length, 0);
  assert.equal(data.attendance.length, 0);
});
test('internal marks retain nested CLA and mid-exam conducted/converted marks', () => {
  const data = parsePortal({
    internals: `<table class="table table-striped table-bordered"><tbody>
 <tr><td>CSE101</td><td>Programming</td><td>12</td><td>50</td></tr>
 <tr><td colspan="4"><table><tr><td class="ui-state-active">Assessment</td><td>Conducted</td><td>Converted</td></tr><tr><td>CLA 1</td><td>16 / 20</td><td>4 / 5</td></tr><tr><td>Mid exam</td><td>0 / 50</td><td>0 / 15</td></tr><tr><td>CLA 2</td><td>Not published</td><td> / 5</td></tr></table></td></tr>
 <tr><td>CSE102</td><td>Algorithms</td><td></td><td>50</td></tr><tr><td colspan="4"><table><tr><td>Project</td><td>Pending</td><td> / 10</td></tr></table></td></tr></tbody></table>`,
  });
  assert.equal(data.internals.length, 2);
  const [cla, mid, pending] = data.internals[0].exams!;
  assert.equal(cla.conductedScore, 16);
  assert.equal(cla.conductedMax, 20);
  assert.equal(cla.convertedScore, 4);
  assert.equal(cla.convertedMax, 5);
  assert.equal(mid.convertedScore, 0);
  assert.equal(pending.convertedScore, null);
  assert.equal(pending.convertedMax, 5);
  assert.equal(data.internals[1].score, null);
});
test('university profile includes institution, section, specialization and provided birth/gender fields', () => {
  const data = parsePortal({
    profile:
      '<table><tr><td>Student Name</td><td>Example</td></tr><tr><td>Institution</td><td>SRM University AP</td></tr><tr><td>Program / Section</td><td>B.Tech CSE / A</td></tr><tr><td>Specialization</td><td>Computer Science</td></tr><tr><td>D.O.B. / Gender</td><td>03.04.2007 / Female</td></tr></table>',
  });
  assert.equal(data.profile.institution, 'SRM University AP');
  assert.equal(data.profile.section, 'A');
  assert.equal(data.profile.program, 'B.Tech CSE');
  assert.equal(data.profile.dateOfBirth, '03.04.2007');
  assert.equal(data.profile.gender, 'Female');
});
