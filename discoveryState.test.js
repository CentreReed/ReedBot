'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const domain = require('./automation/discoveryDomain');
const id = 'a'.repeat(64);
function setup(overrides = {}) {
  const job = { jobId: id, userId: 'u', assignedAt: 1, shiftId: 's', stage: 'ready', effects: {}, slot: {}, ...overrides };
  const shift = { status: 'assigned' }, assignment = { active: true, userId: 'u', assignedAt: 1 };
  const doc = { get: async () => ({ exists: true, data: () => structuredClone(job), ref: doc }), update: async patch => {
    for (const [key, value] of Object.entries(patch)) {
      const parts = key.split('.'); if (parts.length === 1) job[key] = value; else job[parts[0]][parts[1]] = value;
    }
  } };
  const store = { guildDoc: () => ({ collection: name => ({ doc: () => name === 'discoveryJobs' ? doc : { get: async () => ({ exists: true, data: () => assignment }) } }) }),
    getShift: async () => shift, db: { runTransaction: async fn => fn({ get: ref => ref.get(), update: (ref, patch) => ref.update(patch) }) } };
  const validation = { text: x => x, fields: () => {}, fail: (code, message, status) => { const error = new Error(message); Object.assign(error, { code, status }); throw error; } };
  const module = { exports: {} }, process = { env: { AUTOMATION_DISCOVERY_ENABLED: 'true' } };
  const requireMock = name => name === './store' ? store : name === './validation' ? validation : name === './discoveryDomain' ? domain : name === 'discord.js' ? { MessageFlags: { Ephemeral: 64 } } : (() => { throw new Error('Unexpected module: ' + name); })();
  vm.runInNewContext('(function(require,module,process){' + fs.readFileSync(__dirname + '/automation/discovery.js', 'utf8') + '\n})', { Date, console })(requireMock, module, process);
  return { api: module.exports, job, assignment, shift, process, guild: { id: 'g' } };
}
test('one run reserves a job; another run cannot reserve it', async () => {
  const s = setup();
  assert.equal((await s.api.claim(s.guild, id, { runId: 'first', stage: 'ready' })).proceed, true);
  assert.equal((await s.api.claim(s.guild, id, { runId: 'second', stage: 'ready' })).proceed, false);
  assert.equal(s.job.lock.runId, 'first');
});
test('an interrupted uncertain external write requires review', async () => {
  const s = setup({ lock: { runId: 'old', until: 0 }, effects: { tutorbird: { status: 'pending' } } });
  assert.equal((await s.api.claim(s.guild, id, { runId: 'next', stage: 'ready' })).proceed, false);
  assert.equal(s.job.stage, 'needs_review');
});
test('confirmed earlier steps can resume without repeating writes', async () => {
  const s = setup({ lock: { runId: 'old', until: 0 }, effects: { google: { status: 'done', result: { eventId: 'already-created' } } } });
  assert.equal((await s.api.claim(s.guild, id, { runId: 'next', stage: 'ready' })).proceed, true);
  const result = await s.api.effect(s.guild, id, 'google', { runId: 'next', phase: 'begin' });
  assert.equal(result.proceed, false);
  assert.equal(result.result.eventId, 'already-created');
});
test('a second begin cannot replay a pending TutorBird creation', async () => {
  const s = setup();
  await s.api.claim(s.guild, id, { runId: 'run', stage: 'ready' });
  assert.equal((await s.api.effect(s.guild, id, 'tutorbird', { runId: 'run', phase: 'begin' })).proceed, true);
  await assert.rejects(s.api.effect(s.guild, id, 'tutorbird', { runId: 'run', phase: 'begin' }), e => e.code === 'EFFECT_UNRESOLVED');
});
test('reassignment cancels the previous discovery job', async () => {
  const s = setup();s.assignment.userId = 'replacement';
  await assert.rejects(s.api.getJob(s.guild, id), e => e.code === 'ASSIGNMENT_CHANGED');
  assert.equal(s.job.stage, 'cancelled');
});
test('another Discord member cannot submit the assigned tutor’s slot', async () => {
  const s = setup({ stage: 'awaiting_slot', threadId: 'thread' }); let reply;
  await s.api.handleInteraction({ customId: 'discovery:submit:' + id, guild: s.guild, user: { id: 'other' }, channelId: 'thread', isModalSubmit: () => true, reply: async value => { reply = value; } });
  assert.match(reply.content, /Seul le tuteur assigné/);
  assert.equal(s.job.stage, 'awaiting_slot');
});
test('new jobs require the feature flag and a TutorBird student reference', () => {
  const s = setup(), shift = { shiftId: 's', studentReference: 'tb:sdt_test' };
  assert.equal(s.api.initialJob('g', shift, 'u', 1).stage, 'prepare');
  s.process.env.AUTOMATION_DISCOVERY_ENABLED = 'false';
  assert.equal(s.api.initialJob('g', shift, 'u', 1), null);
  s.process.env.AUTOMATION_DISCOVERY_ENABLED = 'true';
  assert.equal(s.api.initialJob('g', { shiftId: 's' }, 'u', 1), null);
});
