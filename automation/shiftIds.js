'use strict';
const { db, guildDoc } = require('./store');
const { fail } = require('./validation');

const TIME_ZONE = 'America/Toronto';
const MAX_DAILY_SHIFTS = 99;
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
  // Read the finite set of possible IDs by document reference. No range query,
  // ordering, or Firestore query index is needed to find existing reservations.
  const dayRefs = Array.from({ length: MAX_DAILY_SHIFTS }, (_, index) =>
    collection.doc(day.prefix + String(index + 1).padStart(2, '0')));

  try {
    return await db.runTransaction(async tx => {
      const [counter, ...existing] = await tx.getAll(counterRef, ...dayRefs);
      const savedNumber = counter.exists ? counter.data().lastNumber : 0;
      if (!Number.isInteger(savedNumber) || savedNumber < 0 || savedNumber > MAX_DAILY_SHIFTS) {
        fail('INVALID_SHIFT_COUNTER', 'Le compteur quotidien doit être vérifié.', 409);
      }
      const existingNumber = Math.max(0, ...existing.filter(doc => doc.exists).map(doc => Number(doc.id.slice(-2))));
      const number = Math.max(savedNumber, existingNumber) + 1;
      if (number > MAX_DAILY_SHIFTS) fail('DAILY_SHIFT_LIMIT', 'La limite de 99 contrats pour cette journée est atteinte.', 409);
      const shiftId = day.prefix + String(number).padStart(2, '0');
      const shift = { ...data, shiftId, idFormat: 'AAMMJJNN', idDate: day.date,
        sequenceNumber: number, idTimeZone: TIME_ZONE, createdAt: at.getTime() };
      tx.create(collection.doc(shiftId), shift);
      tx.set(counterRef, { lastNumber: number, date: day.date, prefix: day.prefix,
        timeZone: TIME_ZONE, updatedAt: at.getTime() });
      return shift;
    });
  } catch (error) {
    if (!error.status) {
      console.error(JSON.stringify({ event: 'shift_id_reservation_failed',
        guildId, date: day.date, operationId: data.operationId || null,
        code: String(error.code || 'UNKNOWN'),
        message: String(error.details || error.message || 'Unknown Firestore failure').slice(0, 1600) }));
    }
    throw error;
  }
}
module.exports = { createDailyShift };
