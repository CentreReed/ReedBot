'use strict';
const { ChannelType, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const config = require('../config');
const progress = require('../progressManager');
const flow = require('../onboardingFlow');
const store = require('./store');
const shifts = require('./shiftActions');
const v = require('./validation');
const silent = { parse: [] };
const staffRoleIds = () => (process.env.AUTOMATION_STAFF_ROLE_IDS || '').split(',').map(x => x.trim()).filter(Boolean).map(x => v.id(x, 'staffRoleId'));
const channelData = c => ({ id: c.id, name: c.name, type: c.type, parentId: c.parentId, url: c.url || `https://discord.com/channels/${c.guildId}/${c.id}`, archived: c.archived ?? null, locked: c.locked ?? null });
const messageData = m => ({ id: m.id, channelId: m.channelId, authorId: m.author.id, content: m.content,
  embeds: m.embeds.map(e => e.toJSON()), createdAt: m.createdTimestamp, url: m.url });
function messageInput(body) {
  v.fields(body, ['content', 'embeds']);
  const out = { allowedMentions: silent };
  if (body.content !== undefined) out.content = v.text(body.content, 'content', 2000);
  let length = 0;
  if (body.embeds !== undefined) {
    if (!Array.isArray(body.embeds) || body.embeds.length > 5) v.fail('INVALID_EMBEDS', 'Maximum cinq embeds.');
    out.embeds = body.embeds.map(e => {
      v.fields(e, ['title', 'description', 'fields', 'color']);
      const b = new EmbedBuilder();
      for (const [key, max] of [['title', 256], ['description', 4000]]) if (e[key] !== undefined) {
        const value = v.text(e[key], key, max); length += value.length;
        if (key === 'title') b.setTitle(value); else b.setDescription(value);
      }
      if (e.color !== undefined) b.setColor(v.integer(e.color, 'color', 0, 0xffffff));
      if (e.fields !== undefined) {
        if (!Array.isArray(e.fields) || e.fields.length > 25) v.fail('INVALID_EMBEDS', 'Maximum 25 champs.');
        b.addFields(e.fields.map(f => {
          v.fields(f, ['name', 'value', 'inline'], ['name', 'value']);
          const name = v.text(f.name, 'name', 256); const value = v.text(f.value, 'value', 1024);
          length += name.length + value.length;
          return { name, value, inline: v.bool(f.inline, 'inline', false) };
        }));
      }
      return b;
    });
  }
  if (length > 6000 || (!out.content && !out.embeds?.length) || (out.embeds?.length && !length)) v.fail('INVALID_MESSAGE', 'Message vide ou embeds dépassant 6000 caractères.');
  return out;
}
class AutomationService {
  constructor(client, hooks = {}) { this.client = client; this.hooks = hooks; }
  async guild(guildId) {
    const allowed = (process.env.AUTOMATION_GUILD_IDS || config.guildId || '').split(',').map(s => s.trim());
    if (!allowed.includes(v.id(guildId, 'guildId'))) v.fail('GUILD_FORBIDDEN', 'Guilde non autorisée.', 403);
    return this.client.guilds.fetch(guildId);
  }
  async channel(guild, channelId, type) {
    const target = await shifts.channel(guild, v.id(channelId, 'channelId'));
    if (type !== undefined && target.type !== type) v.fail('INVALID_CHANNEL_TYPE', 'Type de canal incompatible.', 409);
    return target;
  }
  async privateOverwrites(guild, memberIds = [], roleIds = [], isPrivate = true) {
    const roles = [...new Set([...staffRoleIds(), ...roleIds])];
    const members = [...new Set([this.client.user.id, ...memberIds])];
    const perms = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.SendMessagesInThreads, PermissionFlagsBits.ReadMessageHistory];
    for (const id of members) await guild.members.fetch(id);
    for (const id of roles) {
      if (id === guild.id || !(await guild.roles.fetch(id))) v.fail('INVALID_ROLE', 'Rôle de visibilité invalide.');
    }
    return [{ id: guild.id, ...(isPrivate ? { deny: [PermissionFlagsBits.ViewChannel] } : { allow: [PermissionFlagsBits.ViewChannel] }) },
      ...roles.map(id => ({ id, allow: perms })), ...members.map(id => ({ id, allow: perms }))];
  }
  async listChannels(guild) { return (await guild.channels.fetch()).filter(Boolean).map(channelData); }
  async listMembers(guild, query) {
    const limit = v.integer(query.limit, 'limit', 1, 100, 50);
    const members = await guild.members.list({ limit, ...(query.after ? { after: v.id(query.after, 'after') } : {}) });
    return { items: members.map(m => ({ userId: m.id, displayName: m.displayName, roleIds: [...m.roles.cache.keys()], tutorLevel: shifts.tutorLevel(m) })), nextCursor: members.size === limit ? members.last().id : null };
  }
  async member(guild, userId) {
    const m = await guild.members.fetch(v.id(userId, 'userId'));
    return { userId: m.id, displayName: m.displayName, roleIds: [...m.roles.cache.keys()], tutorLevel: shifts.tutorLevel(m) };
  }
  async listShifts(guild, query) {
    const limit = v.integer(query.limit, 'limit', 1, 100, 20);
    let q = store.guildDoc(guild.id).collection('shifts').orderBy('createdAt', 'desc');
    if (query.cursor) {
      const cursor = await store.shiftDoc(guild.id, v.reference(query.cursor, 'cursor')).get();
      if (!cursor.exists) v.fail('INVALID_CURSOR', 'Curseur de mandat inconnu.');
      q = q.startAfter(cursor);
    }
    if (query.status && !['open', 'assigned', 'closed', 'publishing', 'assigning', 'unassigning', 'updating', 'closing', 'reopening', 'needs_review'].includes(query.status)) v.fail('INVALID_STATUS', 'Filtre status invalide.');
    const snap = await q.limit(limit + 1).get(); const docs = snap.docs.slice(0, limit);
    return { items: docs.map(d => d.data()).filter(s => !query.status || s.status === query.status), nextCursor: snap.size > limit ? docs.at(-1).id : null };
  }
  async applicants(guild, shiftId, query) {
    await store.getShift(guild.id, v.reference(shiftId, 'shiftId'));
    const limit = v.integer(query.limit, 'limit', 1, 100, 50);
    if (query.role && !['N1', 'N1A', 'N2'].includes(query.role)) v.fail('INVALID_ROLE', 'role: N1, N1A ou N2.');
    if (query.includeWithdrawn && !['true', 'false'].includes(query.includeWithdrawn)) v.fail('INVALID_INPUT', 'includeWithdrawn: true ou false.');
    const col = store.shiftDoc(guild.id, shiftId).collection('applications');
    let q = col.orderBy('appliedAt', 'asc');
    if (query.cursor) {
      const cursor = await col.doc(v.id(query.cursor, 'cursor')).get();
      if (!cursor.exists) v.fail('INVALID_CURSOR', 'Curseur candidat inconnu.');
      q = q.startAfter(cursor);
    }
    const snap = await q.limit(limit + 1).get(); const docs = snap.docs.slice(0, limit);
    const items = docs.map(d => d.data()).filter(a => (query.includeWithdrawn === 'true' || !a.withdrawn) && (!query.role || a.roleSnapshot === query.role));
    return { shiftId, items, count: items.length, order: 'appliedAt ASC', nextCursor: snap.size > limit ? docs.at(-1).id : null };
  }
  async application(guild, shiftId, userId, withdraw) {
    v.reference(shiftId, 'shiftId'); v.id(userId, 'userId');
    const member = await guild.members.fetch(userId);
    if (!withdraw && !shifts.tutorLevel(member)) v.fail('TUTOR_NOT_ELIGIBLE', 'Niveau N1, N1A ou N2 requis.', 409);
    const doc = store.shiftDoc(guild.id, shiftId).collection('applications').doc(userId);
    await store.db.runTransaction(async tx => {
      const shift = await tx.get(store.shiftDoc(guild.id, shiftId));
      const previous = await tx.get(doc);
      const assignment = await tx.get(store.guildDoc(guild.id).collection('assignments').doc(shiftId));
      if (!shift.exists) v.fail('SHIFT_NOT_FOUND', 'Mandat introuvable.', 404);
      if (withdraw && !['open', 'assigned', 'closed'].includes(shift.data().status)) v.fail('SHIFT_BUSY', 'Le mandat est en cours de modification.', 409);
      if (!withdraw && shift.data().status !== 'open') v.fail('SHIFT_NOT_OPEN', 'Le mandat n’est plus ouvert.', 409);
      if (withdraw && assignment.exists && assignment.data().active && assignment.data().userId === userId) v.fail('ASSIGNED_TUTOR', 'Le tuteur assigné doit être désassigné avant tout retrait.', 409);
      if (!previous.exists && withdraw) v.fail('APPLICATION_NOT_FOUND', 'Candidature introuvable.', 404);
      tx.set(doc, withdraw ? { withdrawn: true, withdrawnAt: Date.now() } : {
        userId, withdrawn: false, roleSnapshot: { tuteurN1: 'N1', tuteurN1A: 'N1A', tuteurN2: 'N2' }[shifts.tutorLevel(member)],
        appliedAt: previous.exists && !previous.data().withdrawn ? previous.data().appliedAt : Date.now()
      }, { merge: true });
    });
    return { shiftId, userId, withdrawn: withdraw };
  }
  async createForum(guild, body) {
    v.fields(body, ['name', 'topic', 'parentId', 'memberIds', 'roleIds', 'private'], ['name']);
    const name = v.text(body.name, 'name', 100); const topic = v.text(body.topic, 'topic', 4000, true);
    const memberIds = v.list(body.memberIds, 'memberIds', 50, x => v.id(x));
    const roleIds = v.list(body.roleIds, 'roleIds', 20, x => v.id(x));
    if (body.parentId) await this.channel(guild, body.parentId, ChannelType.GuildCategory);
    const forum = await guild.channels.create({ name, type: ChannelType.GuildForum, ...(topic ? { topic } : {}),
      ...(body.parentId ? { parent: body.parentId } : {}),
      permissionOverwrites: await this.privateOverwrites(guild, memberIds, roleIds, v.bool(body.private, 'private', true)),
      reason: 'ReedBot automation: créer un forum' });
    return channelData(forum);
  }
  async updateForum(guild, forumId, body) {
    v.fields(body, ['name', 'topic']);
    if (!Object.keys(body).length) v.fail('EMPTY_PATCH', 'Modification attendue.');
    const forum = await this.channel(guild, forumId, ChannelType.GuildForum);
    await forum.edit({ ...(body.name !== undefined ? { name: v.text(body.name, 'name', 100) } : {}),
      ...(body.topic !== undefined ? { topic: v.text(body.topic, 'topic', 4000) } : {}), reason: 'ReedBot automation' });
    return channelData(forum);
  }
  async permissions(guild, forumId, body) {
    v.fields(body, ['private', 'memberIds', 'roleIds'], ['private']);
    const forum = await this.channel(guild, forumId, ChannelType.GuildForum);
    const managed = await store.guildDoc(guild.id).collection('automationTutors').where('forumId', '==', forumId).limit(1).get();
    if (!managed.empty) v.fail('MANAGED_WORKSPACE', 'Les permissions d’un espace tuteur permanent ne se modifient pas par l’endpoint générique.', 409);
    const rows = await this.privateOverwrites(guild, v.list(body.memberIds, 'memberIds', 50, x => v.id(x)),
      v.list(body.roleIds, 'roleIds', 20, x => v.id(x)), v.bool(body.private, 'private'));
    await forum.permissionOverwrites.set(rows, 'ReedBot automation: permissions explicites');
    return channelData(forum);
  }
  async createPost(guild, forumId, body) {
    v.fields(body, ['name', 'content', 'embeds'], ['name']);
    const forum = await this.channel(guild, forumId, ChannelType.GuildForum);
    const thread = await forum.threads.create({ name: v.text(body.name, 'name', 100),
      message: messageInput(Object.fromEntries(Object.entries(body).filter(([k]) => k !== 'name'))), reason: 'ReedBot automation: post' });
    return { ...channelData(thread), messageId: thread.id };
  }
  async listPosts(guild, forumId, query) {
    const forum = await this.channel(guild, forumId, ChannelType.GuildForum);
    const limit = v.integer(query.limit, 'limit', 1, 100, 50);
    if (query.archived && !['true', 'false'].includes(query.archived)) v.fail('INVALID_INPUT', 'archived: true ou false.');
    if (query.archived === 'true') {
      if (query.before && Number.isNaN(Date.parse(query.before))) v.fail('INVALID_CURSOR', 'before: date ISO attendue.');
      const result = await forum.threads.fetchArchived({ limit, ...(query.before ? { before: new Date(query.before) } : {}) });
      const last = result.threads.last();
      return { items: result.threads.map(channelData), hasMore: result.hasMore,
        nextCursor: result.hasMore && last?.archiveTimestamp ? new Date(last.archiveTimestamp).toISOString() : null };
    }
    const result = await forum.threads.fetchActive();
    const cursor = query.after ? BigInt(v.id(query.after, 'after')) : 0n;
    const rows = [...result.threads.values()].filter(t => t.parentId === forumId && BigInt(t.id) > cursor)
      .sort((a, b) => BigInt(a.id) < BigInt(b.id) ? -1 : 1);
    return { items: rows.slice(0, limit).map(channelData), nextCursor: rows.length > limit ? rows[limit - 1].id : null };
  }
  async workspace(guild, userId, body, ctx) {
    v.id(userId, 'userId'); v.fields(body, ['name', 'parentId']);
    const member = await guild.members.fetch(userId); const doc = store.tutorDoc(guild.id, userId);
    const old = await doc.get();
    if (old.exists && old.data().forumId) {
      await this.assertWorkspace(guild, userId, old.data().forumId);
      return old.data();
    }
    if (old.exists) v.fail('WORKSPACE_UNRESOLVED', 'Création de forum déjà engagée ; vérifier l’opération précédente.', 409);
    const parentId = body.parentId || process.env.AUTOMATION_TUTOR_CATEGORY_ID;
    if (parentId) await this.channel(guild, parentId, ChannelType.GuildCategory);
    await doc.create({ userId, status: 'creating', operationId: ctx.operationId, createdAt: Date.now() });
    const forum = await ctx.step('privateTutorForum', () => this.createForum(guild, {
      name: v.text(body.name || `tuteur-${member.displayName}`, 'name', 100), memberIds: [userId], private: true,
      ...(parentId ? { parentId } : {}) }));
    await doc.update({ forumId: forum.id, status: 'ready' });
    return { userId, forumId: forum.id, status: 'ready', url: forum.url };
  }
  async assertWorkspace(guild, userId, forumId) {
    const forum = await this.channel(guild, forumId, ChannelType.GuildForum);
    const everyone = forum.permissionOverwrites.cache.get(guild.id);
    const allowed = new Set([userId, this.client.user.id, ...staffRoleIds()]);
    if (!everyone?.deny.has(PermissionFlagsBits.ViewChannel) || !forum.permissionOverwrites.cache.get(userId)?.allow.has(PermissionFlagsBits.ViewChannel)
      || forum.permissionOverwrites.cache.some(o => o.allow.has(PermissionFlagsBits.ViewChannel) && !allowed.has(o.id))) {
      v.fail('WORKSPACE_PERMISSIONS', 'Les permissions du forum tuteur doivent être revues avant d’y publier des informations privées.', 409);
    }
    return forum;
  }
  async permanentPost(guild, userId, body, isCard, ctx) {
    v.fields(body, isCard ? ['name', 'content'] : ['studentReference', 'name', 'content'], isCard ? ['content'] : ['studentReference', 'name', 'content']);
    const tutor = await store.tutorDoc(guild.id, v.id(userId, 'userId')).get();
    if (!tutor.exists || tutor.data().status !== 'ready') v.fail('WORKSPACE_REQUIRED', 'Créer d’abord le forum privé du tuteur.', 409);
    const forum = await this.assertWorkspace(guild, userId, tutor.data().forumId);
    const key = isCard ? 'profile' : store.hash(v.reference(body.studentReference, 'studentReference'));
    const doc = store.tutorDoc(guild.id, userId).collection(isCard ? 'cards' : 'students').doc(key);
    const previous = await doc.get();
    const content = v.text(body.content, 'content', 2000);
    const name = v.text(body.name || 'Profil du tuteur', 'name', 100);
    let thread;
    if (previous.exists) {
      if (previous.data().status !== 'ready') v.fail('POST_UNRESOLVED', 'Post en cours de création ou à vérifier.', 409);
      thread = await this.channel(guild, previous.data().threadId);
      if (thread.parentId !== forum.id) v.fail('INVALID_POST', 'Le post n’appartient pas au forum du tuteur.', 409);
      if (thread.archived) await thread.setArchived(false);
      const message = await thread.fetchStarterMessage();
      await ctx.step('updatePermanentPost', async () => { await message.edit({ content, allowedMentions: silent }); await thread.setName(name); return { threadId: thread.id }; });
    } else {
      await doc.create({ status: 'creating', operationId: ctx.operationId, createdAt: Date.now() });
      const created = await ctx.step('createPermanentPost', () => this.createPost(guild, forum.id, { name, content }));
      thread = await this.channel(guild, created.id);
    }
    await ctx.step('pinPermanentPost', async () => { const m = await thread.fetchStarterMessage(); await m.pin('ReedBot: post permanent'); return { messageId: m.id }; });
    const result = { userId, forumId: forum.id, threadId: thread.id, messageId: thread.id, status: 'ready', updatedAt: Date.now(),
      ...(!isCard ? { studentReference: body.studentReference } : {}) };
    await doc.set(result, { merge: true });
    return { ...result, url: thread.url };
  }
  async studentPosts(guild, userId) {
    const rows = await store.tutorDoc(guild.id, v.id(userId, 'userId')).collection('students').limit(100).get();
    return { items: rows.docs.map(d => d.data()), limit: 100, truncated: rows.size === 100 };
  }
  async transferStudent(guild, userId, studentReference, body, ctx) {
    v.fields(body, ['targetTutorId'], ['targetTutorId']);
    v.id(userId, 'userId'); v.id(body.targetTutorId, 'targetTutorId'); v.reference(studentReference, 'studentReference');
    if (userId === body.targetTutorId) v.fail('SAME_TUTOR', 'Le tuteur de destination doit être différent.');
    const source = await store.tutorDoc(guild.id, userId).collection('students').doc(store.hash(studentReference)).get();
    const tutor = await store.tutorDoc(guild.id, userId).get();
    if (!source.exists || source.data().status !== 'ready' || !tutor.exists) v.fail('NOT_FOUND', 'Post source introuvable.', 404);
    await this.assertWorkspace(guild, userId, tutor.data().forumId);
    const oldThread = await this.channel(guild, source.data().threadId);
    if (oldThread.parentId !== tutor.data().forumId) v.fail('INVALID_POST', 'Post source incohérent.', 409);
    const starter = await oldThread.fetchStarterMessage();
    const result = await this.permanentPost(guild, body.targetTutorId, { studentReference, name: oldThread.name, content: starter.content }, false, ctx);
    return { ...result, sourceTutorId: userId, sourceThreadId: oldThread.id, sourceRetained: true, copied: 'starter_message_only' };
  }
  async removeStudent(guild, userId, studentReference, body) {
    v.fields(body, ['replacementTutorId'], ['replacementTutorId']);
    v.id(userId, 'userId'); v.id(body.replacementTutorId, 'replacementTutorId'); v.reference(studentReference, 'studentReference');
    if (userId === body.replacementTutorId) v.fail('SAME_TUTOR', 'Le tuteur de destination doit être différent.');
    const doc = store.tutorDoc(guild.id, userId).collection('students').doc(store.hash(studentReference));
    const source = await doc.get();
    const dest = await store.tutorDoc(guild.id, body.replacementTutorId).collection('students').doc(store.hash(studentReference)).get();
    const tutor = await store.tutorDoc(guild.id, userId).get();
    if (!source.exists || source.data().status !== 'ready' || !dest.exists || dest.data().status !== 'ready' || !tutor.exists) v.fail('TRANSFER_REQUIRED', 'Préparer et vérifier le post de remplacement avant de supprimer la source.', 409);
    const destinationTutor = await store.tutorDoc(guild.id, body.replacementTutorId).get();
    if (!destinationTutor.exists) v.fail('TRANSFER_REQUIRED', 'Espace de remplacement manquant.', 409);
    await this.assertWorkspace(guild, body.replacementTutorId, destinationTutor.data().forumId);
    const destinationThread = await this.channel(guild, dest.data().threadId);
    if (destinationThread.parentId !== destinationTutor.data().forumId) v.fail('TRANSFER_REQUIRED', 'Post de remplacement incohérent.', 409);
    await this.assertWorkspace(guild, userId, tutor.data().forumId);
    const thread = await this.channel(guild, source.data().threadId);
    if (thread.parentId !== tutor.data().forumId || thread.id === destinationThread.id) v.fail('INVALID_POST', 'Post source incohérent.', 409);
    await thread.delete('ReedBot automation: ancien post après transfert vérifié');
    await doc.update({ status: 'deleted', deletedAt: Date.now(), replacementTutorId: body.replacementTutorId });
    return { studentReference, userId, deletedThreadId: thread.id };
  }
  async getOnboarding(guild, userId) {
    const member = await guild.members.fetch({ user: v.id(userId, 'userId'), force: true }); const current = progress.getUserProgress(userId);
    return { userId, currentStep: current.currentStep, currentStepTitle: flow[current.currentStep]?.title || null,
      completedN1: !!current.completedN1, tutorLevel: shifts.tutorLevel(member), n2Ready: shifts.tutorLevel(member) === 'tuteurN2',
      quizAttempts: current.quizAttempts || {}, progressStored: progress.getAllUsers().includes(userId) };
  }
  async resumeOnboarding(guild, userId, body) {
    v.fields(body, ['channelId'], ['channelId']); const member = await guild.members.fetch(v.id(userId, 'userId'));
    const current = progress.getUserProgress(userId); const step = flow[current.currentStep];
    if (!step || (step.level === 2 && !['tuteurN1A', 'tuteurN2'].includes(shifts.tutorLevel(member)))) v.fail('ONBOARDING_PREREQUISITE', 'Prérequis d’onboarding non satisfaits.', 409);
    const target = await this.channel(guild, body.channelId);
    if (!target.isTextBased() || !target.permissionsFor(member)?.has(PermissionFlagsBits.ViewChannel)) v.fail('ONBOARDING_CHANNEL', 'Canal de formation inaccessible au membre.', 409);
    if (!this.hooks.sendStep) v.fail('ONBOARDING_UNAVAILABLE', 'Émetteur d’étape indisponible.', 503);
    await this.hooks.sendStep(target, userId, current.currentStep);
    return { userId, channelId: target.id, currentStep: current.currentStep };
  }
  async resetOnboarding(guild, userId) {
    await guild.members.fetch(v.id(userId, 'userId'));
    progress.resetUserProgress(userId); this.hooks.resetQuiz?.(userId);
    return { userId, reset: true };
  }
  async role(guild, userId, roleKey, remove) {
    if (!['candidat', 'tuteurN1', 'tuteurN1A', 'tuteurN2'].includes(roleKey) || !config.roles[roleKey]) v.fail('ROLE_FORBIDDEN', 'Seuls les rôles métier configurés sont autorisés.', 403);
    const member = await guild.members.fetch(v.id(userId, 'userId'));
    const role = await guild.roles.fetch(config.roles[roleKey]);
    if (!role || role.managed || role.permissions.has(PermissionFlagsBits.Administrator) || role.permissions.has(PermissionFlagsBits.ManageRoles)) v.fail('ROLE_FORBIDDEN', 'Rôle privilégié ou géré interdit.', 403);
    if (!remove && roleKey === 'tuteurN2') v.fail('QUIZ_REQUIRED', 'Le niveau N2 est attribué par le parcours de quiz, pas par cette API.', 409);
    await member.roles[remove ? 'remove' : 'add'](role.id, 'ReedBot automation: rôle métier');
    return { userId, roleKey, removed: remove };
  }
  async resetRoles(guild, userId) {
    const removed = [];
    for (const key of ['tuteurN1', 'tuteurN1A', 'tuteurN2']) if (config.roles[key]) { await this.role(guild, userId, key, true); removed.push(key); }
    return { userId, removed };
  }
  async messages(guild, channelId, query) {
    const target = await this.channel(guild, channelId);
    if (!target.messages) v.fail('INVALID_CHANNEL_TYPE', 'Canal de messages attendu.', 409);
    const rows = await target.messages.fetch({ limit: v.integer(query.limit, 'limit', 1, 100, 50), ...(query.before ? { before: v.id(query.before, 'before') } : {}) });
    return { items: rows.map(messageData), nextCursor: rows.size ? rows.last().id : null };
  }
  async message(guild, channelId, messageId, body, remove) {
    const target = await this.channel(guild, channelId);
    if (!target.messages) v.fail('INVALID_CHANNEL_TYPE', 'Canal de messages attendu.', 409);
    if (!messageId) return messageData(await target.send(messageInput(body)));
    const message = await target.messages.fetch(v.id(messageId, 'messageId'));
    if (remove) { await message.delete(); return { messageId, deleted: true }; }
    if (message.author.id !== this.client.user.id) v.fail('NOT_BOT_MESSAGE', 'Seuls les messages du bot peuvent être modifiés.', 403);
    return messageData(await message.edit(messageInput(body)));
  }
  async thread(guild, channelId, body) {
    v.fields(body, ['name', 'memberIds'], ['name']); const target = await this.channel(guild, channelId, ChannelType.GuildText);
    const ids = v.list(body.memberIds, 'memberIds', 50, x => v.id(x));
    for (const userId of ids) await guild.members.fetch(userId);
    const thread = await target.threads.create({ name: v.text(body.name, 'name', 100), type: ChannelType.PrivateThread, invitable: false, autoArchiveDuration: 1440 });
    for (const userId of ids) await thread.members.add(userId);
    return channelData(thread);
  }
  async editThread(guild, threadId, body) {
    v.fields(body, ['name', 'archived', 'locked']); const thread = await this.channel(guild, threadId);
    if (!thread.isThread()) v.fail('INVALID_CHANNEL_TYPE', 'Fil attendu.', 409);
    if (!Object.keys(body).length) v.fail('EMPTY_PATCH', 'Modification attendue.');
    await thread.edit({ ...(body.name !== undefined ? { name: v.text(body.name, 'name', 100) } : {}),
      ...(body.archived !== undefined ? { archived: v.bool(body.archived, 'archived') } : {}),
      ...(body.locked !== undefined ? { locked: v.bool(body.locked, 'locked') } : {}) });
    return channelData(thread);
  }
  async threadMember(guild, threadId, userId, remove) {
    const thread = await this.channel(guild, threadId); v.id(userId, 'userId');
    if (!thread.isThread()) v.fail('INVALID_CHANNEL_TYPE', 'Fil attendu.', 409);
    if (thread.archived) v.fail('THREAD_ARCHIVED', 'Désarchiver le fil avant de modifier ses membres.', 409);
    await guild.members.fetch(userId);
    await thread.members[remove ? 'remove' : 'add'](userId);
    return { threadId, userId, removed: remove };
  }
}
module.exports = { AutomationService, channelData };
