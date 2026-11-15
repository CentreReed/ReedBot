'use strict';
const { admin } = require('../firebase');
const { db, guildDoc } = require('./store');
const { fail } = require('./validation');

const TIME_ZONE = 'America/Toronto';
function calendarDay(at) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(at).filter(p => p.type !== 'literal').map(p => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`,
    prefix: `${parts.year.slice(-2)}${parts.month}${parts.day}` };
}

// The counter and the reserved shift document commit together. No Discord call
// belongs in this callback: Firestore may run it again during a conflict.
async function createDailyShift(guildId, data) {
  const at = new Date();
  const day = calendarDay(at);
  const guild = guildDoc(guildId);
  const counterRef = guild.collection('automationCounters').doc(`shifts-${day.date}`);
  const collection = guild.collection('shifts');
  const lastForDay = collection
    .where(admin.firestore.FieldPath.documentId(), '>=', `${day.prefix}01`)
    .where(admin.firestore.FieldPath.documentId(), '<=', `${day.prefix}99`)
    .orderBy(admin.firestore.FieldPath.documentId(), 'desc').select('shiftId').limit(200);

  return db.runTransaction(async tx => {
    const counter = await tx.get(counterRef);
    const existing = await tx.get(lastForDay);
    const savedNumber = counter.exists ? counter.data().lastNumber : 0;
    if (!Number.isInteger(savedNumber) || savedNumber < 0 || savedNumber > 99) {
      fail('INVALID_SHIFT_COUNTER', 'Le compteur quotidien doit être vérifié.', 409);
    }
    if (existing.size === 200) fail('SHIFT_COUNTER_REVIEW', 'Trop d’anciens identifiants dans cette plage ; vérifier le compteur.', 409);
    const existingNumber = Math.max(0, ...existing.docs.filter(doc => /^\d{8}$/.test(doc.id)).map(doc => Number(doc.id.slice(-2))));
    const number = Math.max(savedNumber, existingNumber) + 1;
    if (number > 99) fail('DAILY_SHIFT_LIMIT', 'La limite de 99 contrats pour cette journée est atteinte.', 409);
    const shiftId = day.prefix + String(number).padStart(2, '0');
    const shift = { ...data, shiftId, idFormat: 'AAMMJJNN', idDate: day.date,
      sequenceNumber: number, idTimeZone: TIME_ZONE, createdAt: at.getTime() };
    tx.create(collection.doc(shiftId), shift);
    tx.set(counterRef, { lastNumber: number, date: day.date, prefix: day.prefix,
      timeZone: TIME_ZONE, updatedAt: at.getTime() });
    return shift;
  });
}
module.exports = { createDailyShift };
