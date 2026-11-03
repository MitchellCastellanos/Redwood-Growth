import test from 'node:test';
import assert from 'node:assert/strict';
import { DateTime } from 'luxon';
import { generateSlots } from '../lib/slots.js';

const settings = { timezone: 'America/Mexico_City', slot_minutes: 30, buffer_minutes: 0, min_notice_hours: 0, horizon_days: 30 };
// Monday 2026-11-09 09:00 Mexico City (UTC-6) == 15:00 UTC
const now = DateTime.fromISO('2026-11-09T00:00:00Z');
const base = { settings, rules: [{ weekday: 1, start: '09:00', end: '11:00' }], exceptions: [], bookings: [], now };

test('slots are wall-clock in Mexico City and returned as UTC', () => {
  const s = generateSlots({ ...base, fromDate: '2026-11-09', toDate: '2026-11-09' });
  assert.deepEqual(s.map((x) => x.start), ['2026-11-09T15:00:00.000Z', '2026-11-09T15:30:00.000Z', '2026-11-09T16:00:00.000Z', '2026-11-09T16:30:00.000Z']);
});

test('slot length is configurable', () => {
  const s = generateSlots({ ...base, settings: { ...settings, slot_minutes: 60 }, fromDate: '2026-11-09', toDate: '2026-11-09' });
  assert.equal(s.length, 2);
});

test('a slot that would run past the window is not offered', () => {
  const s = generateSlots({ ...base, settings: { ...settings, slot_minutes: 45 }, fromDate: '2026-11-09', toDate: '2026-11-09' });
  assert.equal(s.length, 2); // 09:00, 09:45 (10:30 would end 11:15)
});

test('booked slots and buffer are removed', () => {
  const bookings = [{ start: '2026-11-09T15:30:00.000Z', end: '2026-11-09T16:00:00.000Z' }];
  const none = generateSlots({ ...base, bookings, fromDate: '2026-11-09', toDate: '2026-11-09' }).map((x) => x.start);
  assert.ok(!none.includes('2026-11-09T15:30:00.000Z') && none.includes('2026-11-09T15:00:00.000Z'));
  const buf = generateSlots({ ...base, settings: { ...settings, buffer_minutes: 30 }, bookings, fromDate: '2026-11-09', toDate: '2026-11-09' }).map((x) => x.start);
  assert.deepEqual(buf, ['2026-11-09T16:30:00.000Z']);
});

test('minimum notice and horizon are enforced', () => {
  const n = DateTime.fromISO('2026-11-09T15:10:00Z');
  const s = generateSlots({ ...base, settings: { ...settings, min_notice_hours: 1 }, now: n, fromDate: '2026-11-09', toDate: '2026-11-09' });
  assert.deepEqual(s.map((x) => x.start), ['2026-11-09T16:30:00.000Z']); // 16:10Z is the earliest allowed
  const far = generateSlots({ ...base, settings: { ...settings, horizon_days: 3 }, fromDate: '2026-11-09', toDate: '2026-12-31' });
  assert.ok(far.every((x) => x.start < '2026-11-13'));
});

test('exceptions: blocked day and custom hours override weekly rules', () => {
  const blocked = generateSlots({ ...base, exceptions: [{ date: '2026-11-09', start: null, end: null }], fromDate: '2026-11-09', toDate: '2026-11-09' });
  assert.equal(blocked.length, 0);
  const custom = generateSlots({ ...base, exceptions: [{ date: '2026-11-09', start: '14:00', end: '15:00' }], fromDate: '2026-11-09', toDate: '2026-11-09' });
  assert.deepEqual(custom.map((x) => x.start), ['2026-11-09T20:00:00.000Z', '2026-11-09T20:30:00.000Z']);
});

test('past days are never returned', () => {
  const later = DateTime.fromISO('2026-11-16T12:00:00Z');
  const s = generateSlots({ ...base, now: later, fromDate: '2026-11-09', toDate: '2026-11-09' });
  assert.equal(s.length, 0);
});
