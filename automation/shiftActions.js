'use strict';
const { randomUUID } = require('node:crypto');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder } = require('discord.js');
const config = require('../config');
const store = require('./store');
const { createDailyShift } = require('./shiftIds');
const { fail, reference, shiftInput, text } = require('./validation');
const { listApplicants } = require('../shiftStore');
const tutorLevel = member => ['tuteurN2', 'tuteurN1A', 'tuteurN1'].find(key => config.roles[key] && member.roles.cache.has(config.roles[key])) || null;
const context = ctx => ({ operationId: ctx?.operationId || randomUUID(), step: ctx?.step || (async (_name, fn) => fn()) });
async function channel(guild, id) {
  const value = await guild.channels.fetch(id);
  if (!value || value.guildId !== guild.id) fail('CHANNEL_NOT_FOUND', 'Canal introuvable dans cette guilde.', 404);
  return value;
}
function embed(shift, status) {
  return new EmbedBuilder().setColor(status === 'open' ? '#2ECC71' : '#E74C3C')
    .setTitle(`📣 ${shift.title}`).setDescription(shift.description)
    .addFields({ name: '📅 Date de début', value: shift.startDate, inline: true },
      { name: '⏱️ Durée', value: /^Séance découverte\s*:/iu.test(shift.description || '')
        ? `${shift.durationHours} h (séance découverte)` : `${shift.durationHours}h/semaine`, inline: true },
      { name: '📚 Matières', value: (shift.subjects || []).join(', ') || '—', inline: true },
      { name: '🗓️ Disponibilités élève', value: shift.availabilities })
    .setFooter({ text: `ID: ${shift.shiftId} • Statut: ${status === 'open' ? 'Ouvert' : status === 'assigned' ? 'Assigné' : 'Fermé'}` }).setTimestamp();
}
function buttons(shiftId, disabled) {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`shift_apply_${shiftId}`).setStyle(ButtonStyle.Primary).setLabel('✅ Postuler').setDisabled(disabled),
    new ButtonBuilder().setCustomId(`shift_withdraw_${shiftId}`).setStyle(ButtonStyle.Secondary).setLabel('↩️ Retirer').setDisabled(disabled))];
}
async function offerMessage(guild, shift) {
  const target = await channel(guild, shift.channelId);
  if (!target.messages) fail('INVALID_CHANNEL', 'Le canal du mandat ne supporte pas les messages.', 409);
  return target.messages.fetch(shift.messageId);
}
async function postShift(guild, actorId, body, ctx) {
  const input = shiftInput(body); const c = context(ctx);
  const target = await channel(guild, config.channels.contrats);
  if (target.type !== ChannelType.GuildText) fail('OFFERS_CHANNEL_TYPE', 'CHANNEL_OFFRES doit être un canal texte de guilde.', 409);
  const shift = await createDailyShift(guild.id, { ...input, guildId: guild.id, channelId: target.id, messageId: null,
    createdBy: actorId, status: 'publishing', operationId: c.operationId });
  const shiftId = shift.shiftId;
  try {
    const sent = await c.step('publishOffer', async () => {
      const message = await target.send({ embeds: [embed(shift, 'open')], components: buttons(shiftId, false), allowedMentions: { parse: [] } });
      return { messageId: message.id, url: message.url };
    });
    await store.shiftDoc(guild.id, shiftId).update({ messageId: sent.messageId, status: 'open', updatedAt: Date.now() });
    return { ...shift, status: 'open', ...sent };
  } catch (error) { await store.reviewShift(guild.id, shiftId, c.operationId); throw error; }
}
async function editShift(guild, shiftId, body, ctx) {
  reference(shiftId, 'shiftId'); const input = shiftInput(body, true); const c = context(ctx);
  const old = await store.claimShift(guild.id, shiftId, ['open', 'assigned', 'closed'], 'updating', c.operationId);
  try {
    const next = { ...old, ...input };
    const msg = await offerMessage(guild, old);
    await c.step('editOffer', async () => { await msg.edit({ embeds: [embed(next, old.status)], components: buttons(shiftId, old.status !== 'open'), allowedMentions: { parse: [] } }); return { messageId: msg.id }; });
    await store.shiftDoc(guild.id, shiftId).update({ ...input, status: old.status, updatedAt: Date.now() });
    return store.getShift(guild.id, shiftId);
  } catch (error) { await store.reviewShift(guild.id, shiftId, c.operationId); throw error; }
}
async function assignShift(guild, actorId, shiftId, userId, options = {}, ctx) {
  reference(shiftId, 'shiftId'); const c = context(ctx);
  const member = await guild.members.fetch({ user: userId, force: true });
  if (!tutorLevel(member)) fail('TUTOR_NOT_ELIGIBLE', 'Le membre doit avoir le niveau N1, N1A ou N2.', 409);
  const candidates = await listApplicants(guild.id, shiftId);
  if ((!candidates.length || candidates[0].userId !== userId) && !options.selectionReason) fail('SELECTION_REASON_REQUIRED', 'Indiquer selectionReason pour retenir un autre tuteur que le premier candidat.', 409);
  if (options.selectionReason) text(options.selectionReason, 'selectionReason', 1000);
  const current = await store.getShift(guild.id, shiftId);
  if (current.studentReference) {
    const permanent = await store.tutorDoc(guild.id, userId).collection('students').doc(store.hash(current.studentReference)).get();
    if (!permanent.exists || !permanent.data().threadId || permanent.data().status !== 'ready') fail('STUDENT_POST_REQUIRED', 'Préparer le post permanent de cet élève dans le forum du tuteur avant l’affectation.', 409);
    const space = await store.tutorDoc(guild.id, userId).get();
    const studentThread = await channel(guild, permanent.data().threadId);
    if (!space.exists || studentThread.parentId !== space.data().forumId || !studentThread.permissionsFor(member)?.has('ViewChannel')) fail('STUDENT_POST_REQUIRED', 'Le post permanent doit être accessible au tuteur dans son forum privé.', 409);
  }
  const old = await store.claimShift(guild.id, shiftId, ['open'], 'assigning', c.operationId);
  try {
    const msg = await offerMessage(guild, old);
    const target = await channel(guild, old.channelId);
    const threadInfo = await c.step('assignmentThread', async () => {
      const thread = old.threadId ? await channel(guild, old.threadId) : await target.threads.create({
        name: `✅ Assigné • ${member.displayName}`.slice(0, 100), autoArchiveDuration: 1440, type: ChannelType.PrivateThread,
        invitable: false, reason: `Affectation ${shiftId}` });
      if (thread.type !== ChannelType.PrivateThread || thread.parentId !== target.id) fail('INVALID_ASSIGNMENT_THREAD', 'Fil privé d’affectation incohérent.', 409);
      if (thread.archived) await thread.setArchived(false);
      await thread.setName(`✅ Assigné • ${member.displayName}`.slice(0, 100));
      await thread.members.add(userId);
      await store.shiftDoc(guild.id, shiftId).update({ threadId: thread.id });
      return { threadId: thread.id };
    });
    await c.step('tutorRole', async () => {
      if (tutorLevel(member) === 'tuteurN1' && config.roles.tuteurN1A) await member.roles.add(config.roles.tuteurN1A, `Affectation ${shiftId}`);
      return { userId, level: tutorLevel(member) };
    });
    await c.step('offerAssigned', async () => { await msg.edit({ embeds: [embed(old, 'assigned')], components: buttons(shiftId, true), allowedMentions: { parse: [] } }); return { messageId: msg.id }; });
    await c.step('assignmentNotification', async () => {
      const thread = await channel(guild, threadInfo.threadId);
      const sent = await thread.send({ content: `🎉 **Contrat assigné à <@${userId}>**\n📋 **${old.title}**\n📅 ${old.startDate}\n⏱️ ${old.durationHours}h/semaine\n🗓️ ${old.availabilities}\n\nInscrire le créneau dans le post permanent de l’élève. Le niveau N2 est requis avant la première séance.`, allowedMentions: { users: [userId], parse: [] } });
      return { messageId: sent.id };
    });
    const batch = store.db.batch();
    batch.set(store.guildDoc(guild.id).collection('assignments').doc(shiftId), {
      shiftId, userId, assignedBy: actorId, assignedAt: Date.now(), active: true, selectionReason: options.selectionReason || '', operationId: c.operationId });
    batch.update(store.shiftDoc(guild.id, shiftId), { status: 'assigned', threadId: threadInfo.threadId, updatedAt: Date.now() });
    await batch.commit();
    return { shiftId, userId, status: 'assigned', ...threadInfo, n2BeforeFirstSession: tutorLevel(member) === 'tuteurN2' };
  } catch (error) { await store.reviewShift(guild.id, shiftId, c.operationId); throw error; }
}
async function unassignShift(guild, shiftId, ctx) {
  const c = context(ctx);
  const before = await store.guildDoc(guild.id).collection('assignments').doc(shiftId).get();
  if (!before.exists || !before.data().active) fail('NO_ACTIVE_ASSIGNMENT', 'Aucune affectation active à retirer.', 409);
  const old = await store.claimShift(guild.id, shiftId, ['assigned', 'closed'], 'unassigning', c.operationId);
  try {
    const assignment = await store.guildDoc(guild.id).collection('assignments').doc(shiftId).get();
    if (old.threadId && assignment.exists && assignment.data().active) {
      await c.step('removePreviousTutor', async () => {
        const thread = await channel(guild, old.threadId);
        if (thread.archived) await thread.setArchived(false);
        await thread.members.remove(assignment.data().userId);
        return { threadId: thread.id, userId: assignment.data().userId };
      });
    }
    const msg = await offerMessage(guild, old);
    await c.step('reopenOffer', async () => { await msg.edit({ embeds: [embed(old, 'open')], components: buttons(shiftId, false), allowedMentions: { parse: [] } }); return { messageId: msg.id }; });
    const batch = store.db.batch();
    batch.set(store.guildDoc(guild.id).collection('assignments').doc(shiftId), { active: false, unassignedAt: Date.now() }, { merge: true });
    batch.update(store.shiftDoc(guild.id, shiftId), { status: 'open', updatedAt: Date.now() });
    await batch.commit();
    return { shiftId, status: 'open' };
  } catch (error) { await store.reviewShift(guild.id, shiftId, c.operationId); throw error; }
}
async function closeShift(guild, shiftId, ctx) {
  const c = context(ctx); const old = await store.claimShift(guild.id, shiftId, ['open', 'assigned'], 'closing', c.operationId);
  try {
    const msg = await offerMessage(guild, old);
    await c.step('closeOffer', async () => { await msg.edit({ embeds: [embed(old, 'closed')], components: buttons(shiftId, true), allowedMentions: { parse: [] } }); return { messageId: msg.id }; });
    await store.shiftDoc(guild.id, shiftId).update({ status: 'closed', updatedAt: Date.now() });
    return { shiftId, status: 'closed' };
  } catch (error) { await store.reviewShift(guild.id, shiftId, c.operationId); throw error; }
}
async function reopenShift(guild, shiftId, ctx) {
  const assignment = await store.guildDoc(guild.id).collection('assignments').doc(shiftId).get();
  if (assignment.exists && assignment.data().active) fail('ACTIVE_ASSIGNMENT', 'Désassigner explicitement le tuteur avant de rouvrir aux candidatures.', 409);
  const c = context(ctx); const old = await store.claimShift(guild.id, shiftId, ['closed'], 'reopening', c.operationId);
  try {
    const msg = await offerMessage(guild, old);
    await c.step('reopenClosedOffer', async () => { await msg.edit({ embeds: [embed(old, 'open')], components: buttons(shiftId, false), allowedMentions: { parse: [] } }); return { messageId: msg.id }; });
    await store.shiftDoc(guild.id, shiftId).update({ status: 'open', updatedAt: Date.now() });
    return { shiftId, status: 'open' };
  } catch (error) { await store.reviewShift(guild.id, shiftId, c.operationId); throw error; }
}
module.exports = { postShift, editShift, assignShift, unassignShift, closeShift, reopenShift, channel, tutorLevel };

