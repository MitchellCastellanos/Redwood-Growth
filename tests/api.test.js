import test from 'node:test';
import assert from 'node:assert/strict';
import { DateTime } from 'luxon';

process.env.SESSION_SECRET = 'test-secret-test-secret-test-secret-123456';
const PW = 'correct-horse-battery';
const { hashPassword } = await import('../lib/auth.js');
process.env.ADMIN_PASSWORD_HASH = hashPassword(PW);
process.env.NODE_ENV = 'development';

const { setSql } = await import('../lib/db.js');
const { createPgliteSql } = await import('../scripts/pglite-sql.mjs');
const { createDevServer } = await import('../scripts/dev.mjs');
setSql(await createPgliteSql());

const server = createDevServer();
await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}`;
test.after(() => server.close());

let cookie = '';
const call = async (path, method = 'GET', body, headers = {}) => {
  const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
  const sc = r.headers.get('set-cookie');
  if (sc) cookie = sc.split(';')[0].endsWith('=') ? '' : sc.split(';')[0];
  return { status: r.status, data: await r.json().catch(() => ({})) };
};
const admin = (a, m, b) => call(`/api/admin?action=${a}`, m, b);
const settings = { slot_minutes: 45, buffer_minutes: 15, min_notice_hours: 0, horizon_days: 21, meeting_provider: 'Zoom', meeting_url: 'https://zoom.us/j/123456789' };
const weekdays = [1, 2, 3, 4, 5].map((weekday) => ({ weekday, start: '09:00', end: '17:00' }));

test('booking page stays closed until a meeting link exists', async () => {
  const r = await call('/api/slots');
  assert.equal(r.status, 200);
  assert.equal(r.data.configured, false);
  assert.deepEqual(r.data.slots, []);
});

test('admin API requires login; wrong password rejected', async () => {
  assert.equal((await admin('settings')).status, 401);
  assert.equal((await admin('login', 'POST', { password: 'nope' })).status, 401);
  assert.equal((await admin('login', 'POST', { password: PW })).status, 200);
  assert.equal((await admin('me')).data.authenticated, true);
});

test('settings and availability validation', async () => {
  assert.equal((await admin('settings', 'PUT', { ...settings, meeting_url: 'http://insecure.example' })).status, 400);
  assert.equal((await admin('settings', 'PUT', { ...settings, slot_minutes: 3 })).status, 400);
  assert.equal((await admin('settings', 'PUT', settings)).status, 200);
  const overlap = [{ weekday: 1, start: '09:00', end: '12:00' }, { weekday: 1, start: '11:00', end: '13:00' }];
  assert.equal((await admin('availability', 'PUT', { rules: overlap, exceptions: [] })).status, 400);
  assert.equal((await admin('availability', 'PUT', { rules: weekdays, exceptions: [] })).status, 200);
  const got = await admin('availability');
  assert.equal(got.data.rules.length, 5);
});

test('full booking flow: slots -> book -> conflict -> cancel -> reopen', async () => {
  const slots = (await call('/api/slots')).data;
  assert.equal(slots.configured, true);
  assert.equal(slots.slotMinutes, 45);
  assert.ok(slots.slots.length > 20);
  assert.ok(!JSON.stringify(slots).includes('zoom'), 'public slots must not leak the meeting link');
  for (const s of slots.slots) {
    const d = DateTime.fromISO(s).setZone('America/Mexico_City');
    assert.ok(d.weekday <= 5 && d.hour >= 9 && d.hour < 17, `unexpected slot ${s}`);
  }
  const target = slots.slots[3];
  const visitor = { start: target, name: 'Test Visitor', email: 'visitor@example.com', company: 'Acme', notes: '2 roles', visitorTz: 'America/New_York' };

  assert.equal((await call('/api/book', 'POST', { ...visitor, start: '2030-01-01T00:00:00Z' })).status, 409);
  assert.equal((await call('/api/book', 'POST', { ...visitor, name: '' })).status, 400);
  assert.equal((await call('/api/book', 'POST', { ...visitor, email: 'nope' })).status, 400);
  const bot = await call('/api/book', 'POST', { ...visitor, website: 'spam' });
  assert.equal(bot.status, 200);
  assert.equal(bot.data.booking, undefined);
  assert.equal((await call('/api/book', 'POST', visitor, { Origin: 'https://evil.example' })).status, 403);

  const ok = await call('/api/book', 'POST', visitor);
  assert.equal(ok.status, 200);
  assert.equal(ok.data.booking.meetingUrl, settings.meeting_url);
  assert.equal((await call('/api/book', 'POST', { ...visitor, email: 'other@example.com' })).status, 409);

  const after = (await call('/api/slots')).data.slots;
  assert.ok(!after.includes(target));
  // 45-minute slots + 15-minute buffer: nothing starting less than 15 min after the booking ends is offered
  const end = DateTime.fromISO(target).plus({ minutes: 45 });
  for (const s of after) {
    const st = DateTime.fromISO(s);
    assert.ok(st >= end.plus({ minutes: 15 }) || st.plus({ minutes: 45 }) <= DateTime.fromISO(target).minus({ minutes: 15 }), `slot ${s} violates buffer`);
  }

  const list = await admin('bookings');
  assert.ok(list.data.bookings.some((b) => b.id === ok.data.booking.id && b.email === 'visitor@example.com'));
  assert.equal((await admin('cancel', 'POST', { id: ok.data.booking.id })).status, 200);
  assert.ok((await call('/api/slots')).data.slots.includes(target));
});

test('concurrent bookings of one slot: exactly one wins', async () => {
  const target = (await call('/api/slots')).data.slots[10];
  const mk = (i) => call('/api/book', 'POST', { start: target, name: `P${i}`, email: `p${i}@example.com` });
  const res = await Promise.all([mk(1), mk(2), mk(3), mk(4)]);
  assert.equal(res.filter((r) => r.status === 200).length, 1);
  assert.equal(res.filter((r) => r.status === 409).length, 3);
});

test('password change signs out other sessions; forged cookies fail', async () => {
  const oldCookie = cookie;
  assert.equal((await admin('password', 'POST', { current: 'wrong', next: 'a-very-long-password-1' })).status, 401);
  assert.equal((await admin('password', 'POST', { current: PW, next: 'short' })).status, 400);
  assert.equal((await admin('password', 'POST', { current: PW, next: 'a-very-long-password-1' })).status, 200);
  assert.equal((await admin('settings')).status, 200); // this browser stays signed in
  const fresh = cookie;
  cookie = oldCookie;
  assert.equal((await admin('settings')).status, 401); // old session invalidated
  cookie = fresh.slice(0, -3) + 'xxx';
  assert.equal((await admin('settings')).status, 401); // forged
  cookie = '';
  assert.equal((await admin('login', 'POST', { password: PW })).status, 401); // old password dead
  assert.equal((await admin('login', 'POST', { password: 'a-very-long-password-1' })).status, 200);
});
