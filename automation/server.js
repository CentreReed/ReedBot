'use strict';
const http = require('node:http');
const { createHash, timingSafeEqual, randomUUID } = require('node:crypto');
const { ApiError, fail, text, id, reference, fields, shiftInput } = require('./validation');

// No Firebase access, socket or Discord action until explicitly enabled.
function startAutomationApi({ client, hooks = {} }) {
  if (process.env.AUTOMATION_API_ENABLED !== 'true') return null;
  const secret = process.env.AUTOMATION_API_TOKEN || '';
  if (secret.length < 32 || secret.length > 512) throw new Error('AUTOMATION_API_TOKEN must contain 32–512 characters.');
  const scopes = new Set((process.env.AUTOMATION_API_SCOPES || 'read,mandates:write').split(',').map(x => x.trim()));
  if (!(process.env.AUTOMATION_GUILD_IDS || require('../config').guildId)) throw new Error('GUILD_ID or AUTOMATION_GUILD_IDS is required.');
  const port = Number(process.env.PORT || 10000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT.');
  const expected = createHash('sha256').update(secret).digest();
  const { AutomationService, channelData } = require('./service');
  const { firebaseInitialized } = require('../firebase');
  if (!firebaseInitialized) throw new Error('The automation API requires configured Firestore credentials.');
  const store = require('./store');
  const shifts = require('./shiftActions');
  const service = new AutomationService(client, hooks);
  const routes = [];
  function route(method, path, scope, handler, validate = () => {}) {
    const keys = [];
    const regex = new RegExp('^' + path.replace(/:([A-Za-z]+)/g, (_, key) => { keys.push(key); return '([^/]+)'; }) + '$');
    routes.push({ method, path, scope, handler, validate, keys, regex });
  }
  const base = '/v1/guilds/:guildId';
  const empty = b => fields(b, []);
  route('GET', '/v1/status', 'read', async () => ({ ready: client.isReady(), firestoreConfigured: firebaseInitialized }));
  route('GET', base + '/operations/:operationId', 'read', c => store.getOperation(c.params.operationId, c.guild.id));
  route('GET', base + '/channels', 'read', c => service.listChannels(c.guild));
  route('GET', base + '/roles', 'read', async c => (await c.guild.roles.fetch()).map(r => ({ id: r.id, name: r.name, managed: r.managed })));
  route('GET', base + '/members', 'read', c => service.listMembers(c.guild, c.query));
  route('GET', base + '/members/:userId', 'read', c => service.member(c.guild, c.params.userId));
  route('GET', base + '/shifts', 'read', c => service.listShifts(c.guild, c.query));
  route('POST', base + '/shifts', 'mandates:write', c => shifts.postShift(c.guild, 'automation:n8n', c.body, c), b => shiftInput(b));
  route('GET', base + '/shifts/:shiftId', 'read', c => store.getShift(c.guild.id, reference(c.params.shiftId, 'shiftId')));
  route('PATCH', base + '/shifts/:shiftId', 'mandates:write', c => shifts.editShift(c.guild, c.params.shiftId, c.body, c), b => shiftInput(b, true));
  route('GET', base + '/shifts/:shiftId/applicants', 'read', c => service.applicants(c.guild, c.params.shiftId, c.query));
  route('GET', base + '/shifts/:shiftId/assignment', 'read', async c => {
    await store.getShift(c.guild.id, reference(c.params.shiftId, 'shiftId'));
    const snap = await store.guildDoc(c.guild.id).collection('assignments').doc(c.params.shiftId).get();
    return snap.exists ? snap.data() : null;
  });
  route('POST', base + '/shifts/:shiftId/assign', 'mandates:write', c => shifts.assignShift(c.guild, 'automation:n8n', c.params.shiftId, c.body.tutorUserId, c.body, c), b => {
    fields(b, ['tutorUserId', 'selectionReason'], ['tutorUserId']); id(b.tutorUserId, 'tutorUserId'); if (b.selectionReason !== undefined) text(b.selectionReason, 'selectionReason', 1000);
  });
  route('POST', base + '/shifts/:shiftId/unassign', 'mandates:write', c => shifts.unassignShift(c.guild, c.params.shiftId, c), empty);
  route('POST', base + '/shifts/:shiftId/close', 'mandates:write', c => shifts.closeShift(c.guild, c.params.shiftId, c, c.body.expectedStatus), b => {
    fields(b, ['expectedStatus']);
    if (b.expectedStatus !== undefined && b.expectedStatus !== 'open') fail('INVALID_INPUT', 'expectedStatus doit être open si fourni.');
  });
  route('POST', base + '/shifts/:shiftId/reopen', 'mandates:write', c => shifts.reopenShift(c.guild, c.params.shiftId, c), empty);
  route('PUT', base + '/shifts/:shiftId/applicants/:userId', 'applications:write', c => service.application(c.guild, c.params.shiftId, c.params.userId, false), empty);
  route('DELETE', base + '/shifts/:shiftId/applicants/:userId', 'applications:write', c => service.application(c.guild, c.params.shiftId, c.params.userId, true), empty);
  route('POST', base + '/forums', 'forums:write', c => service.createForum(c.guild, c.body));
  route('GET', base + '/forums/:forumId', 'read', async c => channelData(await service.channel(c.guild, c.params.forumId, 15)));
  route('PATCH', base + '/forums/:forumId', 'forums:write', c => service.updateForum(c.guild, c.params.forumId, c.body));
  route('PUT', base + '/forums/:forumId/permissions', 'permissions:write', c => service.permissions(c.guild, c.params.forumId, c.body));
  route('GET', base + '/forums/:forumId/posts', 'read', c => service.listPosts(c.guild, c.params.forumId, c.query));
  route('POST', base + '/forums/:forumId/posts', 'forums:write', c => service.createPost(c.guild, c.params.forumId, c.body));
  route('PUT', base + '/tutors/:userId/workspace', 'tutors:write', c => service.workspace(c.guild, c.params.userId, c.body, c));
  route('GET', base + '/tutors/:userId/workspace', 'read', async c => {
    const snap = await store.tutorDoc(c.guild.id, id(c.params.userId, 'userId')).get();
    if (!snap.exists) fail('NOT_FOUND', 'Espace tuteur introuvable.', 404); return snap.data();
  });
  route('PUT', base + '/tutors/:userId/card', 'tutors:write', c => service.permanentPost(c.guild, c.params.userId, c.body, true, c));
  route('GET', base + '/tutors/:userId/card', 'read', async c => {
    const snap = await store.tutorDoc(c.guild.id, id(c.params.userId, 'userId')).collection('cards').doc('profile').get();
    if (!snap.exists) fail('NOT_FOUND', 'Carte tuteur introuvable.', 404); return snap.data();
  });
  route('PUT', base + '/tutors/:userId/students/:studentReference', 'tutors:write', c => {
    fields(c.body, ['name', 'content'], ['name', 'content']);
    return service.permanentPost(c.guild, c.params.userId, { ...c.body, studentReference: reference(c.params.studentReference, 'studentReference') }, false, c);
  });
  route('GET', base + '/tutors/:userId/students', 'read', c => service.studentPosts(c.guild, c.params.userId));
  route('POST', base + '/tutors/:userId/students/:studentReference/transfer', 'tutors:write', c => service.transferStudent(c.guild, c.params.userId, c.params.studentReference, c.body, c));
  route('DELETE', base + '/tutors/:userId/students/:studentReference', 'resources:delete', c => service.removeStudent(c.guild, c.params.userId, c.params.studentReference, c.body));
  route('GET', base + '/tutors/:userId/students/:studentReference', 'read', async c => {
    const snap = await store.tutorDoc(c.guild.id, id(c.params.userId, 'userId')).collection('students').doc(store.hash(reference(c.params.studentReference, 'studentReference'))).get();
    if (!snap.exists) fail('NOT_FOUND', 'Post élève introuvable.', 404); return snap.data();
  });
  route('GET', base + '/members/:userId/onboarding', 'read', c => service.getOnboarding(c.guild, c.params.userId));
  route('POST', base + '/members/:userId/onboarding/resume', 'onboarding:write', c => service.resumeOnboarding(c.guild, c.params.userId, c.body));
  route('POST', base + '/members/:userId/onboarding/reset', 'onboarding:reset', c => service.resetOnboarding(c.guild, c.params.userId), empty);
  route('POST', base + '/members/:userId/onboarding/reset-roles', 'onboarding:reset', c => service.resetRoles(c.guild, c.params.userId), empty);
  route('PUT', base + '/members/:userId/roles/:roleKey', 'roles:write', c => service.role(c.guild, c.params.userId, c.params.roleKey, false), empty);
  route('DELETE', base + '/members/:userId/roles/:roleKey', 'roles:write', c => service.role(c.guild, c.params.userId, c.params.roleKey, true), empty);
  route('GET', base + '/channels/:channelId/messages', 'read', c => service.messages(c.guild, c.params.channelId, c.query));
  route('POST', base + '/channels/:channelId/messages', 'messages:write', c => service.message(c.guild, c.params.channelId, null, c.body, false));
  route('PATCH', base + '/channels/:channelId/messages/:messageId', 'messages:write', c => service.message(c.guild, c.params.channelId, c.params.messageId, c.body, false));
  route('DELETE', base + '/channels/:channelId/messages/:messageId', 'resources:delete', c => service.message(c.guild, c.params.channelId, c.params.messageId, {}, true), empty);
  route('POST', base + '/channels/:channelId/threads', 'threads:write', c => service.thread(c.guild, c.params.channelId, c.body));
  route('GET', base + '/threads/:threadId', 'read', async c => {
    const thread = await service.channel(c.guild, c.params.threadId); if (!thread.isThread()) fail('INVALID_CHANNEL_TYPE', 'Fil attendu.', 409); return channelData(thread);
  });
  route('PATCH', base + '/threads/:threadId', 'threads:write', c => service.editThread(c.guild, c.params.threadId, c.body));
  route('PUT', base + '/threads/:threadId/members/:userId', 'threads:write', c => service.threadMember(c.guild, c.params.threadId, c.params.userId, false), empty);
  route('DELETE', base + '/threads/:threadId/members/:userId', 'threads:write', c => service.threadMember(c.guild, c.params.threadId, c.params.userId, true), empty);
  route('GET', base + '/threads/:threadId/members', 'read', async c => {
    const thread = await service.channel(c.guild, c.params.threadId); if (!thread.isThread()) fail('INVALID_CHANNEL_TYPE', 'Fil attendu.', 409);
    return (await thread.members.fetch()).map(m => ({ userId: m.id }));
  });
  route('GET', '/v1/capabilities', 'read', async () => routes.map(r => ({ method: r.method, path: r.path, scope: r.scope })));

  let windowStart = Date.now(); let requestCount = 0; let mutations = 0;
  const send = (res, status, data) => { if (!res.destroyed) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(data)); } };
  const server = http.createServer(async (req, res) => {
    const requestId = randomUUID(); let routeName = 'unmatched'; let mutation = false;
    try {
      const url = new URL(req.url, 'http://localhost');
      if (req.method === 'GET' && url.pathname === '/healthz') return send(res, 200, { status: 'alive' });
      if (req.method === 'GET' && url.pathname === '/readyz') return send(res, client.isReady() ? 200 : 503, { ready: client.isReady() });
      const header = req.headers.authorization || '';
      const candidate = header.startsWith('Bearer ') ? header.slice(7) : '';
      if (!timingSafeEqual(expected, createHash('sha256').update(candidate).digest())) fail('UNAUTHORIZED', 'Authentification requise.', 401);
      if (Date.now() - windowStart >= 60000) { windowStart = Date.now(); requestCount = 0; }
      if (++requestCount > 120) { res.setHeader('Retry-After', '60'); fail('RATE_LIMIT', 'Trop de requêtes.', 429); }
      const matched = routes.find(r => r.method === req.method && r.regex.test(url.pathname));
      if (!matched) fail('NOT_FOUND', 'Endpoint introuvable.', 404);
      routeName = matched.path;
      if (!scopes.has(matched.scope)) fail('SCOPE_REQUIRED', `Scope requis : ${matched.scope}.`, 403);
      if (!client.isReady()) fail('BOT_NOT_READY', 'Le bot Discord n’est pas prêt.', 503);
      const values = matched.regex.exec(url.pathname).slice(1).map(decodeURIComponent);
      if (values.some(x => /[\/\u0000-\u001f]/.test(x))) fail('INVALID_PATH', 'Paramètre de chemin invalide.');
      const params = Object.fromEntries(matched.keys.map((k, i) => [k, values[i]]));
      const guild = params.guildId ? await service.guild(params.guildId) : null;
      const query = Object.fromEntries(url.searchParams);
      let body = {};
      const changing = !['GET', 'HEAD'].includes(req.method);
      let key;
      if (changing) {
        key = text(req.headers['idempotency-key'], 'Idempotency-Key', 160);
        if (!/^[A-Za-z0-9_.:-]+$/.test(key)) fail('INVALID_KEY', 'Idempotency-Key invalide.');
        if (mutations >= 5) { res.setHeader('Retry-After', '5'); fail('BUSY', 'Trop d’opérations en cours.', 429); }
        mutations++; mutation = true;
        if (req.headers['content-type']?.split(';')[0] !== 'application/json') fail('CONTENT_TYPE', 'Content-Type application/json requis.', 415);
        const chunks = []; let size = 0;
        for await (const part of req) { size += part.length; if (size > 65536) fail('BODY_TOO_LARGE', 'Corps JSON limité à 64 Kio.', 413); chunks.push(part); }
        try { body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}; }
        catch { fail('INVALID_JSON', 'JSON invalide.'); }
        fields(body, Object.keys(body && typeof body === 'object' ? body : {}));
        matched.validate(body);
      }
      const correlationId = req.headers['x-correlation-id'] ? text(req.headers['x-correlation-id'], 'X-Correlation-ID', 120) : requestId;
      const ctx = { guild, params, query, body, correlationId };
      const result = changing ? await store.operation({ key, path: url.pathname, method: req.method, body, correlationId }, op => matched.handler({ ...ctx, ...op })) : { data: await matched.handler(ctx) };
      send(res, 200, { ...result, requestId });
      console.log(JSON.stringify({ event: 'automation_request', requestId, route: routeName, status: 200, operationId: result.operationId }));
    } catch (error) {
      const status = error instanceof ApiError ? error.status : error instanceof URIError ? 400 : 502;
      send(res, status, { error: { code: error instanceof ApiError ? error.code : 'ACTION_FAILED',
        message: error instanceof ApiError ? error.message : 'Action interrompue ; consulter les effets de l’opération avant une reprise.',
        ...(error.operationId ? { operationId: error.operationId } : {}) }, requestId });
      console.error(JSON.stringify({ event: 'automation_request', requestId, route: routeName, status, operationId: error.operationId, code: String(error.code || 'ACTION_FAILED') }));
    } finally { if (mutation) mutations--; }
  });
  server.requestTimeout = 30000; server.headersTimeout = 10000; server.timeout = 120000;
  server.on('error', error => { console.error('Automation HTTP server error:', error.code); process.exitCode = 1; });
  server.listen(port, '0.0.0.0', () => console.log(`Automation API listening on port ${port}`));
  return server;
}
module.exports = { startAutomationApi };
