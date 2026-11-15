'use strict';

class ApiError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
const fail = (code, message, status = 400) => { throw new ApiError(status, code, message); };
function text(value, name, max = 200, optional = false) {
  if (optional && (value === undefined || value === null)) return undefined;
  if (typeof value !== 'string' || !value.trim() || value.length > max || /\u0000/.test(value)) {
    fail('INVALID_INPUT', `${name}: chaîne non vide, maximum ${max} caractères.`);
  }
  return value.trim();
}
function id(value, name = 'id') {
  if (typeof value !== 'string' || !/^\d{17,20}$/.test(value)) fail('INVALID_ID', `${name}: identifiant Discord attendu sous forme de chaîne.`);
  return value;
}
function reference(value, name = 'reference') {
  const result = text(value, name, 120);
  if (!/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(result)) fail('INVALID_REFERENCE', `${name}: caractères autorisés A-Z, a-z, 0-9, _, -, ., :.`);
  return result;
}
function integer(value, name, min = 1, max = 100, fallback) {
  if (value === undefined && fallback !== undefined) return fallback;
  const n = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  if (!Number.isInteger(n) || n < min || n > max) fail('INVALID_INPUT', `${name}: entier entre ${min} et ${max}.`);
  return n;
}
function bool(value, name, fallback) {
  if (value === undefined) return fallback;
  if (typeof value !== 'boolean') fail('INVALID_INPUT', `${name}: booléen attendu.`);
  return value;
}
function list(value, name, max = 20, parser = (v) => text(v, name, 100)) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > max) fail('INVALID_INPUT', `${name}: liste de ${max} éléments maximum.`);
  return [...new Set(value.map(parser))];
}
function fields(body, allowed, required = []) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail('INVALID_BODY', 'Objet JSON attendu.');
  for (const key of Object.keys(body)) if (!allowed.includes(key)) fail('UNKNOWN_FIELD', `Champ non pris en charge : ${key}.`);
  for (const key of required) if (body[key] === undefined) fail('MISSING_FIELD', `Champ requis : ${key}.`);
  return body;
}
function shiftInput(body, patch = false) {
  const names = ['shiftId', 'title', 'startDate', 'durationHours', 'availabilities', 'description', 'subjects', 'studentReference', 'externalReference'];
  fields(body, patch ? names.filter(n => !['shiftId', 'studentReference'].includes(n)) : names,
    patch ? [] : ['title', 'startDate', 'durationHours', 'availabilities', 'description']);
  const out = {};
  for (const [key, max] of [['title', 200], ['availabilities', 1000], ['description', 2000]]) {
    if (body[key] !== undefined) out[key] = text(body[key], key, max);
  }
  if (body.startDate !== undefined) {
    const date = text(body.startDate, 'startDate', 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date + 'T00:00:00Z')) || new Date(date + 'T00:00:00Z').toISOString().slice(0, 10) !== date) fail('INVALID_DATE', 'startDate: date YYYY-MM-DD valide attendue.');
    out.startDate = date;
  }
  if (body.durationHours !== undefined) {
    if (typeof body.durationHours !== 'number' || !Number.isFinite(body.durationHours) || body.durationHours <= 0 || body.durationHours > 168) fail('INVALID_DURATION', 'durationHours: nombre supérieur à 0 et inférieur ou égal à 168.');
    out.durationHours = body.durationHours;
  }
  if (body.subjects !== undefined) out.subjects = list(body.subjects, 'subjects', 10, v => text(v, 'subject', 60));
  else if (!patch) out.subjects = [];
  for (const key of ['shiftId', 'studentReference', 'externalReference']) if (body[key] !== undefined) out[key] = reference(body[key], key);
  if (patch && !Object.keys(out).length) fail('EMPTY_PATCH', 'Aucune modification fournie.');
  return out;
}
module.exports = { ApiError, fail, text, id, reference, integer, bool, list, fields, shiftInput };
