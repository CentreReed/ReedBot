'use strict';
const { createHash } = require('node:crypto');
const jobKey = (guildId, shiftId, userId, assignedAt) => createHash('sha256').update([guildId, shiftId, userId, assignedAt].join(':')).digest('hex');
function localSlot(date, time, now = Date.now()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) throw new Error('Date AAAA-MM-JJ et heure HH:MM requises.');
  const wall = Date.parse(`${date}T${time}:00Z`);
  if (!Number.isFinite(wall) || new Date(wall).toISOString().slice(0, 16) !== `${date}T${time}`) throw new Error('Date ou heure invalide.');
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const candidates = [];
  for (let offset = -720; offset <= 840; offset += 15) {
    const utc = wall - offset * 60000;
    const p = Object.fromEntries(fmt.formatToParts(utc).map(x => [x.type, x.value]));
    if (`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}` === `${date}T${time}`) candidates.push(utc);
  }
  if (candidates.length !== 1) throw new Error('Cette heure est inexistante ou ambiguë lors du changement d’heure. Choisir une autre heure.');
  if (candidates[0] <= now) throw new Error('Le créneau doit être dans le futur.');
  return { start: new Date(candidates[0]).toISOString(), end: new Date(candidates[0] + 90 * 60000).toISOString(), localDate: date, localTime: time, timezone: 'America/Toronto', durationMinutes: 90 };
}
function tutorEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error('Saisir le courriel utilisé dans TutorBird.');
  return email;
}
function activeAssignment(job, assignment, shift) {
  return !!assignment?.active && assignment.userId === job.userId && assignment.assignedAt === job.assignedAt && shift?.status === 'assigned';
}
module.exports = { jobKey, localSlot, tutorEmail, activeAssignment };
