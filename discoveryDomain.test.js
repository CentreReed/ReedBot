'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { localSlot, tutorEmail, jobKey, activeAssignment } = require('./automation/discoveryDomain');
test('Toronto winter and summer dates produce correct UTC instants and 90-minute sessions', () => {
  const winter = localSlot('2027-01-12', '17:00', 0);
  assert.equal(winter.start, '2027-01-12T22:00:00.000Z');
  assert.equal(winter.end, '2027-01-12T23:30:00.000Z');
  assert.equal(localSlot('2027-07-12', '17:00', 0).start, '2027-07-12T21:00:00.000Z');
});
test('reject nonexistent and repeated Toronto clock-change hours', () => {
  assert.throws(() => localSlot('2027-03-14', '02:30', 0), /inexistante/);
  assert.throws(() => localSlot('2027-11-07', '01:30', 0), /ambiguë/);
});
test('reject impossible dates, invalid hours and past sessions', () => {
  for (const [date, time] of [['2027-02-30', '17:00'], ['2027-01-12', '24:00'], ['2027-01-12', '17:99'], ['12/01/2027', '17:00']]) assert.throws(() => localSlot(date, time, 0));
  assert.throws(() => localSlot('2027-01-12', '17:00', Date.parse('2028-01-01')), /futur/);
});
test('normalize a tutor email and reject invalid values', () => {
  assert.equal(tutorEmail(' Tutor@Example.com '), 'tutor@example.com');
  for (const value of ['', 'tutor', 'tutor@example', 'a\nb@example.com']) assert.throws(() => tutorEmail(value));
});
test('reassignments use a new job identity and invalidate the previous tutor', () => {
  assert.equal(jobKey('g', 's', 'u', 1), jobKey('g', 's', 'u', 1));
  assert.notEqual(jobKey('g', 's', 'u', 1), jobKey('g', 's', 'u', 2));
  assert.notEqual(jobKey('g', 's', 'u', 1), jobKey('g', 's', 'v', 1));
  const job = { userId: 'u', assignedAt: 1 }, assignment = { active: true, userId: 'u', assignedAt: 1 }, shift = { status: 'assigned' };
  assert.equal(activeAssignment(job, assignment, shift), true);
  assert.equal(activeAssignment(job, { ...assignment, userId: 'v' }, shift), false);
  assert.equal(activeAssignment(job, { ...assignment, assignedAt: 2 }, shift), false);
  assert.equal(activeAssignment(job, { ...assignment, active: false }, shift), false);
  assert.equal(activeAssignment(job, assignment, { status: 'open' }), false);
});
