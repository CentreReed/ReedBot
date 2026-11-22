'use strict';
const { ChannelType, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags } = require('discord.js');
const store = require('./store');
const v = require('./validation');
const domain = require('./discoveryDomain');
const TEMPLATE = '1537684730366132324';
const CATEGORY = '1478819072266342472';
const TEMPLATE_POSTS = ['1537687207777665034', '1537687370286243870', '1537687600880685107'];
const jobs = guildId => store.guildDoc(guildId).collection('discoveryJobs');
const jobDoc = (guildId, id) => jobs(guildId).doc(v.text(id, 'jobId', 64));
function enabled() { return process.env.AUTOMATION_DISCOVERY_ENABLED === 'true'; }
function initialJob(guildId, shift, userId, assignedAt) {
  if (!enabled() || !/^tb:sdt_[A-Za-z0-9]+$/.test(shift.studentReference || '')) return null;
  const jobId = domain.jobKey(guildId, shift.shiftId, userId, assignedAt);
  return { jobId, guildId, shiftId: shift.shiftId, userId, assignedAt, studentId: shift.studentReference.slice(3), studentReference: shift.studentReference,
    stage: 'prepare', createdAt: assignedAt, updatedAt: assignedAt, effects: {}, slot: null, reminderAt: assignedAt + 12 * 3600000 };
}
async function getJob(guild, id, checkActive = true) {
  if (!/^[a-f0-9]{64}$/.test(id)) v.fail('INVALID_JOB', 'Identifiant découverte invalide.');
  const snap = await jobDoc(guild.id, id).get();
  if (!snap.exists) v.fail('NOT_FOUND', 'Dossier découverte introuvable.', 404);
  const job = snap.data();
  if (checkActive) {
    const [assignment, shift] = await Promise.all([store.guildDoc(guild.id).collection('assignments').doc(job.shiftId).get(), store.getShift(guild.id, job.shiftId)]);
    if (!domain.activeAssignment(job, assignment.exists ? assignment.data() : null, shift)) {
      await snap.ref.update({ stage: 'cancelled', updatedAt: Date.now() });
      v.fail('ASSIGNMENT_CHANGED', 'Le tuteur n’est plus assigné à ce mandat.', 409);
    }
  }
  return job;
}
async function list(guild, query) {
  const limit = v.integer(query.limit, 'limit', 1, 100, 50);
  let q = jobs(guild.id).orderBy('createdAt', 'asc');
  if (query.cursor) {
    const cursor = await jobDoc(guild.id, query.cursor).get();
    if (!cursor.exists) v.fail('INVALID_CURSOR', 'Curseur inconnu.');
    q = q.startAfter(cursor);
  }
  const snap = await q.limit(limit + 1).get();
  const docs = snap.docs.slice(0, limit);
  const items = docs.map(x => x.data()).filter(x => query.stage === 'remind' ? x.stage === 'awaiting_slot' && x.reminderAt <= Date.now() : x.stage === query.stage);
  return { items, nextCursor: snap.size > limit ? docs.at(-1).id : null };
}
async function claim(guild, id, body) {
  v.fields(body, ['runId', 'stage'], ['runId', 'stage']);
  const runId = v.text(body.runId, 'runId', 120);
  await getJob(guild, id);
  return store.db.runTransaction(async tx => {
    const doc = jobDoc(guild.id, id), snap = await tx.get(doc), job = snap.data();
    const expected = body.stage === 'remind' ? 'awaiting_slot' : body.stage;
    if (!['prepare', 'ready', 'remind'].includes(body.stage) || job.stage !== expected) return { proceed: false };
    if (job.lock) {
      if (job.lock.until >= Date.now()) return { proceed: false };
      // Only resume a calendar run when no external write is uncertain.
      if (body.stage !== 'ready' || Object.values(job.effects).some(e => e.status !== 'done')) {
        tx.update(doc, { stage: 'needs_review', errorCode: 'INTERRUPTED_RUN', updatedAt: Date.now() });
        return { proceed: false };
      }
    }
    if (body.stage === 'remind' && job.reminderAt > Date.now()) return { proceed: false };
    const lock = { runId, until: Date.now() + 20 * 60000 };
    tx.update(doc, { lock, updatedAt: Date.now() });
    return { proceed: true, ...job, lock };
  });
}
async function owned(guild, id, runId) {
  const job = await getJob(guild, id);
  if (!job.lock || job.lock.runId !== runId || job.lock.until < Date.now()) v.fail('JOB_LOCK', 'Dossier non réservé par cette exécution.', 409);
  return job;
}
function copyMessage(m) {
  const embeds = m.embeds.map(x => { const e = x.toJSON(); delete e.type; delete e.provider; delete e.video; return e; });
  const files = [...m.attachments.values()].map(x => ({ attachment: x.url, name: x.name }));
  if (m.components?.length || m.poll || m.stickers?.size) v.fail('TEMPLATE_UNSUPPORTED', 'Le gabarit contient un composant à vérifier avant copie.', 409);
  return { ...(m.content ? { content: m.content } : {}), ...(embeds.length ? { embeds } : {}), ...(files.length ? { files } : {}), allowedMentions: { parse: [] } };
}
async function templatePosts(guild) {
  const rows = [];
  for (const id of TEMPLATE_POSTS) {
    const thread = await guild.channels.fetch(id);
    if (!thread || thread.parentId !== TEMPLATE) v.fail('TEMPLATE_CHANGED', 'Un post du gabarit est manquant.', 409);
    const messages = await thread.messages.fetch({ limit: 100 });
    if (messages.size === 100) v.fail('TEMPLATE_TOO_LARGE', 'Le gabarit dépasse la limite de copie vérifiée.', 409);
    const ordered = [...messages.values()].filter(m => m.type === 0 || m.type === 19).sort((a, b) => BigInt(a.id) < BigInt(b.id) ? -1 : 1);
    if (!ordered.length || ordered[0].id !== thread.id) v.fail('TEMPLATE_STARTER', 'Premier message du gabarit introuvable.', 409);
    // Validate every payload before creating any destination.
    rows.push({ thread, messages: ordered, payloads: ordered.map(copyMessage) });
  }
  return rows;
}
async function prepareWorkspace(service, guild, userId, ctx) {
  const source = await guild.channels.fetch(TEMPLATE);
  if (!source || source.type !== ChannelType.GuildForum || source.parentId !== CATEGORY) v.fail('TEMPLATE_CHANGED', 'Forum gabarit déplacé ou introuvable.', 409);
  const rows = await templatePosts(guild);
  const existing = await store.tutorDoc(guild.id, userId).get();
  if (!existing.exists) {
    const channels = await guild.channels.fetch();
    const candidates = [...channels.values()].filter(c => c?.type === ChannelType.GuildForum && c.parentId === CATEGORY && c.id !== TEMPLATE && c.permissionOverwrites.cache.get(userId)?.allow.has(PermissionFlagsBits.ViewChannel));
    if (candidates.length > 1) v.fail('DUPLICATE_WORKSPACE', 'Plusieurs forums existent pour ce tuteur : vérifier leur correspondance.', 409);
    if (candidates.length === 1) {
      await service.assertWorkspace(guild, userId, candidates[0].id);
      v.fail('LEGACY_WORKSPACE', 'Un forum privé existe déjà : enregistrer sa correspondance avant la préparation automatique.', 409);
    }
  }
  const result = await service.workspace(guild, userId, { parentId: CATEGORY }, ctx);
  const forum = await service.assertWorkspace(guild, userId, result.forumId);
  const tutor = store.tutorDoc(guild.id, userId);
  const current = (await tutor.get()).data();
  if (current.discoveryTemplateReady) return { ...result, templateReady: true };
  // Existing managed workspaces get their missing template posts once; unknown
  // legacy forums are never adopted based only on a matching display name.
  await ctx.step('forumTemplateSettings', async () => {
    await forum.edit({ topic: source.topic, availableTags: source.availableTags.map(({ id, ...tag }) => tag), defaultAutoArchiveDuration: source.defaultAutoArchiveDuration,
      defaultThreadRateLimitPerUser: source.defaultThreadRateLimitPerUser, rateLimitPerUser: source.rateLimitPerUser, defaultSortOrder: source.defaultSortOrder,
      defaultForumLayout: source.defaultForumLayout, defaultReactionEmoji: source.defaultReactionEmoji, nsfw: source.nsfw });
    return { forumId: forum.id };
  });
  for (const row of rows) {
    const ref = tutor.collection('templatePosts').doc(row.thread.id);
    const old = await ref.get();
    if (old.exists) {
      if (old.data().status !== 'ready') v.fail('TEMPLATE_UNRESOLVED', 'Copie du gabarit interrompue ; vérifier avant reprise.', 409);
      continue;
    }
    await ref.create({ status: 'creating', operationId: ctx.operationId, createdAt: Date.now() });
    const tagNames = new Set(row.thread.appliedTags.map(id => source.availableTags.find(t => t.id === id)?.name));
    const copied = await ctx.step('template_' + row.thread.id, async () => {
      const target = await forum.threads.create({ name: row.thread.name, message: row.payloads[0], autoArchiveDuration: row.thread.autoArchiveDuration,
        rateLimitPerUser: row.thread.rateLimitPerUser, appliedTags: forum.availableTags.filter(t => tagNames.has(t.name)).map(t => t.id), reason: 'ReedBot: copie exacte tuteur-gabarit' });
      await ref.update({ threadId: target.id });
      if (row.messages[0].pinned) await (await target.fetchStarterMessage()).pin();
      for (let i = 1; i < row.payloads.length; i++) {
        const sent = await target.send(row.payloads[i]);
        if (row.messages[i].pinned) await sent.pin();
      }
      return { threadId: target.id };
    });
    await ref.update({ ...copied, status: 'ready', finishedAt: Date.now() });
  }
  await tutor.update({ discoveryTemplateReady: true, discoveryTemplateId: TEMPLATE });
  return { ...result, templateReady: true };
}
async function prepareAssignment(guild, shift, userId, ctx) {
  if (!enabled() || !shift.studentReference?.startsWith('tb:')) return;
  const { AutomationService } = require('./service');
  const service = new AutomationService(guild.client);
  await prepareWorkspace(service, guild, userId, ctx);
  const ref = store.tutorDoc(guild.id, userId).collection('students').doc(store.hash(shift.studentReference));
  if (!(await ref.get()).exists) {
    const template = await guild.channels.fetch(TEMPLATE_POSTS[2]);
    const starter = await template.fetchStarterMessage();
    await service.permanentPost(guild, userId, { studentReference: shift.studentReference, name: `Élève — Mandat ${shift.shiftId}`,
      content: starter.content + '\n\nPréparation du dossier élève en cours.' }, false, ctx);
  }
}
async function workspace(service, guild, id, body, ctx) {
  v.fields(body, ['runId'], ['runId']); const job = await owned(guild, id, body.runId);
  const result = await prepareWorkspace(service, guild, job.userId, ctx);
  await jobDoc(guild.id, id).update({ forumId: result.forumId });
  return { ...job, forumId: result.forumId };
}
async function student(service, guild, id, body, ctx) {
  v.fields(body, ['runId', 'studentName'], ['runId', 'studentName']);
  const job = await owned(guild, id, body.runId);
  const studentName = v.text(body.studentName, 'studentName', 100);
  const shift = await store.getShift(guild.id, job.shiftId);
  const source = await guild.channels.fetch(TEMPLATE_POSTS[2]); const starter = await source.fetchStarterMessage();
  const content = `${starter.content}\n\n**Élève : ${studentName}**\n**Mandat : ${job.shiftId}**\n\n**Disponibilités de l’élève**\n${shift.availabilities}\n\nChoisis une plage parmi ces disponibilités pour la séance découverte de **90 minutes**. Utilise le bouton ci-dessous. Les heures sont celles de Toronto.`;
  const post = await service.permanentPost(guild, job.userId, { studentReference: job.studentReference, name: studentName, content }, false, ctx);
  const doc = jobDoc(guild.id, id); await doc.update({ studentName, threadId: post.threadId });
  if (!job.requestMessageId) {
    await doc.update({ requestSending: true });
    const sent = await ctx.step('requestSlot', async () => {
      const thread = await guild.channels.fetch(post.threadId);
      return thread.send({ content: `<@${job.userId}>, indique le créneau choisi pour ${studentName}.`,
        components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('discovery:slot:' + id).setLabel('Choisir la séance découverte').setStyle(ButtonStyle.Primary))],
        allowedMentions: { users: [job.userId], parse: [] } }).then(m => ({ messageId: m.id }));
    });
    await doc.update({ requestMessageId: sent.messageId, requestSending: false });
  }
  await doc.update({ stage: 'awaiting_slot', lock: null, updatedAt: Date.now() });
  return { jobId: id, stage: 'awaiting_slot', threadId: post.threadId };
}
async function remind(guild, id, body, ctx) {
  v.fields(body, ['runId'], ['runId']); const job = await owned(guild, id, body.runId);
  if (job.stage !== 'awaiting_slot' || job.slot || job.reminderAt > Date.now()) v.fail('REMINDER_NOT_DUE', 'Relance non requise.', 409);
  await ctx.step('reminder', async () => {
    const thread = await guild.channels.fetch(job.threadId);
    if (thread.archived) await thread.setArchived(false);
    const sent = await thread.send({ content: `<@${job.userId}>, il reste à choisir la date et l’heure de la séance découverte pour **${job.studentName}**. Utilise le bouton de ce post.`, allowedMentions: { users: [job.userId], parse: [] } });
    return { messageId: sent.id };
  });
  await jobDoc(guild.id, id).update({ reminderAt: Date.now() + 12 * 3600000, lock: null, updatedAt: Date.now() });
  return { jobId: id, stage: 'awaiting_slot' };
}
async function effect(guild, id, name, body) {
  v.fields(body, ['runId', 'phase', 'result'], ['runId', 'phase']);
  if (!['google', 'trial', 'tutorbird'].includes(name)) v.fail('INVALID_EFFECT', 'Étape inconnue.');
  await owned(guild, id, body.runId);
  return store.db.runTransaction(async tx => {
    const doc = jobDoc(guild.id, id), job = (await tx.get(doc)).data(), old = job.effects[name];
    if (old?.status === 'done') return { proceed: false, result: old.result };
    if (body.phase === 'begin') {
      if (old) v.fail('EFFECT_UNRESOLVED', 'Étape externe engagée : vérifier avant reprise.', 409);
      tx.update(doc, { [`effects.${name}`]: { status: 'pending', startedAt: Date.now() } });
      return { proceed: true };
    }
    if (body.phase !== 'done' || old?.status !== 'pending') v.fail('INVALID_EFFECT_STATE', 'Étape externe non réservée.', 409);
    const r = body.result;
    if (!r || typeof r !== 'object' || Array.isArray(r)) v.fail('INVALID_RESULT', 'Accusé externe requis.');
    if (name === 'google' && (!/^[a-v0-9]{5,1024}$/.test(r.eventId || '') || !/^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/.test(r.meetUrl || ''))) v.fail('INVALID_RESULT', 'Événement Google et lien Meet requis.');
    if (name === 'trial' && r.status !== 'Trial') v.fail('INVALID_RESULT', 'Statut Trial non confirmé.');
    if (name === 'tutorbird' && (typeof r.eventId !== 'string' || !r.eventId || r.eventId.length > 100)) v.fail('INVALID_RESULT', 'Événement TutorBird requis.');
    tx.update(doc, { [`effects.${name}`]: { status: 'done', result: r, finishedAt: Date.now() } });
    return { proceed: false, result: r };
  });
}
async function complete(guild, id, body, ctx) {
  v.fields(body, ['runId'], ['runId']); const job = await owned(guild, id, body.runId);
  if (!['google', 'trial', 'tutorbird'].every(k => job.effects[k]?.status === 'done')) v.fail('INCOMPLETE', 'Toutes les étapes doivent être confirmées.', 409);
  await ctx.step('confirmation', async () => {
    const thread = await guild.channels.fetch(job.threadId);
    if (thread.archived) await thread.setArchived(false);
    const sent = await thread.send({ content: `✅ **Séance découverte**\n📅 <t:${Math.floor(Date.parse(job.slot.start) / 1000)}:F> — 90 minutes\n🔗 ${job.effects.google.result.meetUrl}\nLa séance est inscrite dans Google Calendar et dans les calendriers TutorBird du tuteur et de l’élève. L’élève est maintenant **À l’essai**.`, allowedMentions: { parse: [] } });
    return { messageId: sent.id };
  });
  await jobDoc(guild.id, id).update({ stage: 'completed', lock: null, completedAt: Date.now() });
  return { jobId: id, stage: 'completed' };
}
async function handleInteraction(interaction) {
  if (!interaction.customId?.startsWith('discovery:')) return false;
  const modal = interaction.isModalSubmit();
  const id = interaction.customId.split(':')[2];
  try {
    const job = await getJob(interaction.guild, id);
    if (interaction.user.id !== job.userId || interaction.channelId !== job.threadId) v.fail('SLOT_FORBIDDEN', 'Seul le tuteur assigné peut choisir le créneau dans le post élève.', 403);
    if (job.stage !== 'awaiting_slot' || job.lock) v.fail('SLOT_LOCKED', 'Le créneau a déjà été transmis ou le dossier est en traitement.', 409);
    if (!modal) {
      const input = (id, label, placeholder) => new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId(id).setLabel(label).setPlaceholder(placeholder).setStyle(TextInputStyle.Short).setRequired(true));
      await interaction.showModal(new ModalBuilder().setCustomId('discovery:submit:' + id).setTitle('Séance découverte — Toronto').addComponents(
        input('date', 'Date choisie (AAAA-MM-JJ)', '2026-12-01'), input('time', 'Heure de début à Toronto (HH:MM)', '17:00'), input('email', 'Ton courriel dans TutorBird', 'prenom@exemple.com')));
    } else {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const slot = { ...domain.localSlot(interaction.fields.getTextInputValue('date').trim(), interaction.fields.getTextInputValue('time').trim()), tutorEmail: domain.tutorEmail(interaction.fields.getTextInputValue('email')) };
      await store.db.runTransaction(async tx => {
        const doc = jobDoc(interaction.guild.id, id), fresh = (await tx.get(doc)).data();
        const assignment = await tx.get(store.guildDoc(interaction.guild.id).collection('assignments').doc(job.shiftId));
        const shift = await tx.get(store.shiftDoc(interaction.guild.id, job.shiftId));
        if (!domain.activeAssignment(fresh, assignment.data(), shift.data()) || fresh.stage !== 'awaiting_slot' || fresh.lock) v.fail('SLOT_LOCKED', 'Le dossier a changé ; le créneau n’a pas été enregistré.', 409);
        tx.update(doc, { slot, stage: 'ready', updatedAt: Date.now() });
      });
      await interaction.editReply('Créneau enregistré. Le Centre Reed va préparer les invitations et le lien Meet.');
    }
  } catch (error) {
    const content = error.status ? error.message : error instanceof Error && /date|heure|créneau|courriel/i.test(error.message) ? error.message : 'Le créneau n’a pas pu être enregistré. Contacter le Centre Reed.';
    if (interaction.deferred || interaction.replied) await interaction.editReply(content);
    else await interaction.reply({ content, flags: MessageFlags.Ephemeral });
  }
  return true;
}
module.exports = { initialJob, prepareAssignment, list, getJob, claim, workspace, student, remind, effect, complete, handleInteraction };
