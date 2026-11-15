'use strict';
const { createHash } = require('node:crypto');
const { db } = require('../firebase');
const { fail } = require('./validation');
const hash = v => createHash('sha256').update(v).digest('hex');
const guildDoc = g => db.collection('guilds').doc(g);
const shiftDoc = (g, s) => guildDoc(g).collection('shifts').doc(s);
const tutorDoc = (g, u) => guildDoc(g).collection('automationTutors').doc(u);
const operationDoc = key => db.collection('automationOperations').doc(key);
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])])) : value;

async function operation({ key, path, method, body, correlationId }, action) {
  const operationId = hash(key + '\n' + method + '\n' + path);
  const doc = operationDoc(operationId);
  const requestHash = hash(JSON.stringify(canonical(body)));
  const cached = await db.runTransaction(async tx => {
    const old = await tx.get(doc);
    if (old.exists) {
      const data = old.data();
      if (data.requestHash !== requestHash) fail('IDEMPOTENCY_CONFLICT', 'Clé déjà utilisée avec un autre contenu.', 409);
      if (data.status === 'succeeded') return data.result;
      fail('OPERATION_UNRESOLVED', `Opération ${operationId} déjà engagée ; consulter son état avant toute reprise.`, 409);
    }
    tx.create(doc, { operationId, requestHash, path, method, correlationId, status: 'running', startedAt: Date.now(), effects: {} });
    return null;
  });
  if (cached) return { ...cached, operationId, replayed: true };
  const step = async (name, fn) => {
    await doc.update({ currentStep: name, updatedAt: Date.now() });
    const result = await fn();
    await doc.update({ [`effects.${name}`]: result ?? null, updatedAt: Date.now() });
    return result;
  };
  try {
    const data = await action({ operationId, step });
    const result = { data };
    await doc.update({ status: 'succeeded', result, finishedAt: Date.now() });
    return { ...result, operationId, replayed: false };
  } catch (error) {
    // Never automatically replay a mutation whose Discord side effects are uncertain.
    await doc.update({ status: 'needs_review', finishedAt: Date.now(),
      error: { code: String(error.code || 'ACTION_FAILED'), message: error.status ? error.message : 'Action interrompue ; vérifier les effets enregistrés.' } }).catch(() => {});
    error.operationId = operationId;
    throw error;
  }
}
async function getOperation(operationId, guildId) {
  if (!/^[a-f0-9]{64}$/.test(operationId)) fail('INVALID_ID', 'Identifiant d’opération invalide.');
  const doc = await operationDoc(operationId).get();
  if (!doc.exists || !doc.data().path.startsWith(`/v1/guilds/${guildId}/`)) fail('NOT_FOUND', 'Opération introuvable.', 404);
  const data = doc.data();
  if (data.status === 'running' && Date.now() - data.startedAt > 180000) return { ...data, status: 'needs_review' };
  return data;
}
async function claimShift(guildId, shiftId, states, nextState, operationId) {
  return db.runTransaction(async tx => {
    const doc = shiftDoc(guildId, shiftId);
    const snap = await tx.get(doc);
    if (!snap.exists) fail('SHIFT_NOT_FOUND', 'Mandat introuvable.', 404);
    const current = snap.data();
    if (!states.includes(current.status)) fail('INVALID_SHIFT_STATE', `Statut actuel : ${current.status}.`, 409);
    tx.update(doc, { status: nextState, operationId, updatedAt: Date.now() });
    return current;
  });
}
async function getShift(g, s) {
  const snap = await shiftDoc(g, s).get();
  if (!snap.exists) fail('SHIFT_NOT_FOUND', 'Mandat introuvable.', 404);
  return snap.data();
}
async function reviewShift(g, s, operationId) {
  await db.runTransaction(async tx => {
    const doc = shiftDoc(g, s); const snap = await tx.get(doc);
    if (snap.exists && snap.data().operationId === operationId) tx.update(doc, { status: 'needs_review', updatedAt: Date.now() });
  }).catch(() => {});
}
module.exports = { db, hash, guildDoc, shiftDoc, tutorDoc, operation, getOperation, claimShift, getShift, reviewShift };
