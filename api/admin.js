import { sql } from '../lib/db.js';
import { clearSessionCookie, createToken, currentHash, hashPassword, isAdmin, setSessionCookie, verifyPassword } from '../lib/auth.js';
import { clientIp, handle, query, rateLimited, readJson, sameOrigin, send } from '../lib/http.js';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const bad = (msg) => Object.assign(new Error(msg), { status: 400 });
const int = (v, min, max, label) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw bad(`${label} must be a whole number between ${min} and ${max}`);
  return n;
};

// One function, routed by ?action= (keeps us well under the serverless function limit).
export default handle(async (req, res) => {
  const action = query(req).get('action');
  const db = sql();

  if (req.method !== 'GET') {
    if (!sameOrigin(req)) return send(res, 403, { error: 'forbidden' });
  }

  if (action === 'login' && req.method === 'POST') {
    if (await rateLimited(db, `login:${clientIp(req)}`, 6, 900)) return send(res, 429, { error: 'Too many attempts. Try again in 15 minutes.' });
    const { password } = await readJson(req);
    const hash = await currentHash(db);
    if (!hash || !verifyPassword(password ?? '', hash)) return send(res, 401, { error: 'Incorrect password.' });
    setSessionCookie(res, createToken(hash));
    return send(res, 200, { ok: true });
  }

  if (action === 'logout' && req.method === 'POST') {
    clearSessionCookie(res);
    return send(res, 200, { ok: true });
  }

  if (action === 'me' && req.method === 'GET') {
    return send(res, 200, { authenticated: await isAdmin(req, db) });
  }

  if (!(await isAdmin(req, db))) return send(res, 401, { error: 'unauthorized' });

  switch (`${req.method} ${action}`) {
    case 'GET settings': {
      const [s] = await db`SELECT timezone, slot_minutes, buffer_minutes, min_notice_hours, horizon_days, meeting_provider, meeting_url FROM settings WHERE id = 1`;
      return send(res, 200, s);
    }

    case 'PUT settings': {
      const b = await readJson(req);
      const slot = int(b.slot_minutes, 10, 240, 'Meeting length (minutes)');
      const buffer = int(b.buffer_minutes, 0, 120, 'Buffer (minutes)');
      const notice = int(b.min_notice_hours, 0, 720, 'Minimum notice (hours)');
      const horizon = int(b.horizon_days, 1, 180, 'Booking window (days)');
      const provider = String(b.meeting_provider ?? '').trim().slice(0, 40);
      const url = String(b.meeting_url ?? '').trim();
      if (url) {
        let u;
        try { u = new URL(url); } catch { throw bad('Meeting link must be a valid URL'); }
        if (u.protocol !== 'https:' || url.length > 500) throw bad('Meeting link must start with https://');
      }
      await db`UPDATE settings SET slot_minutes = ${slot}, buffer_minutes = ${buffer}, min_notice_hours = ${notice},
               horizon_days = ${horizon}, meeting_provider = ${provider}, meeting_url = ${url} WHERE id = 1`;
      return send(res, 200, { ok: true });
    }

    case 'GET availability': {
      const rules = await db`SELECT weekday::int AS weekday, to_char(start_time,'HH24:MI') AS start, to_char(end_time,'HH24:MI') AS "end" FROM availability_rules ORDER BY weekday, start_time`;
      const exceptions = await db`SELECT to_char(date,'YYYY-MM-DD') AS date, to_char(start_time,'HH24:MI') AS start, to_char(end_time,'HH24:MI') AS "end" FROM availability_exceptions ORDER BY date, start_time`;
      return send(res, 200, { rules, exceptions });
    }

    case 'PUT availability': {
      const b = await readJson(req, 128 * 1024);
      const rules = Array.isArray(b.rules) ? b.rules : [];
      const exceptions = Array.isArray(b.exceptions) ? b.exceptions : [];
      if (rules.length > 70 || exceptions.length > 200) throw bad('Too many entries');
      for (const r of rules) {
        if (!Number.isInteger(r.weekday) || r.weekday < 1 || r.weekday > 7) throw bad('Invalid weekday');
        if (!TIME.test(r.start) || !TIME.test(r.end) || r.end <= r.start) throw bad('Each window needs a valid start before its end');
      }
      for (let d = 1; d <= 7; d++) {
        const w = rules.filter((r) => r.weekday === d).sort((a, c) => (a.start < c.start ? -1 : 1));
        for (let i = 1; i < w.length; i++) if (w[i].start < w[i - 1].end) throw bad('Time windows on the same day cannot overlap');
      }
      for (const e of exceptions) {
        if (!DATE.test(e.date)) throw bad('Invalid exception date');
        const hasTimes = e.start || e.end;
        if (hasTimes && (!TIME.test(e.start) || !TIME.test(e.end) || e.end <= e.start)) throw bad('Exception hours need a valid start before the end');
      }
      await db.transaction([
        db`DELETE FROM availability_rules`,
        db`DELETE FROM availability_exceptions`,
        ...rules.map((r) => db`INSERT INTO availability_rules (weekday, start_time, end_time) VALUES (${r.weekday}, ${r.start}::time, ${r.end}::time)`),
        ...exceptions.map((e) => db`INSERT INTO availability_exceptions (date, start_time, end_time) VALUES (${e.date}::date, ${e.start || null}::time, ${e.end || null}::time)`),
      ]);
      return send(res, 200, { ok: true });
    }

    case 'GET bookings': {
      const rows = await db`
        SELECT id, start_utc, end_utc, name, email, company, notes, visitor_tz, status, created_at
        FROM bookings WHERE end_utc > now() - interval '30 days' ORDER BY start_utc`;
      return send(res, 200, {
        bookings: rows.map((r) => ({
          id: r.id, name: r.name, email: r.email, company: r.company, notes: r.notes, visitorTz: r.visitor_tz, status: r.status,
          start: new Date(r.start_utc).toISOString(), end: new Date(r.end_utc).toISOString(), createdAt: new Date(r.created_at).toISOString(),
        })),
      });
    }

    case 'POST cancel': {
      const { id } = await readJson(req);
      if (!UUID.test(String(id))) throw bad('Invalid booking id');
      await db`UPDATE bookings SET status = 'cancelled' WHERE id = ${id}::uuid`;
      return send(res, 200, { ok: true });
    }

    case 'POST password': {
      const { current, next } = await readJson(req);
      if (!verifyPassword(current ?? '', await currentHash(db))) return send(res, 401, { error: 'Current password is incorrect.' });
      if (typeof next !== 'string' || next.length < 12) throw bad('New password must be at least 12 characters');
      const hash = hashPassword(next);
      await db`INSERT INTO admin_auth (id, password_hash) VALUES (1, ${hash}) ON CONFLICT (id) DO UPDATE SET password_hash = ${hash}, updated_at = now()`;
      setSessionCookie(res, createToken(hash)); // keep this browser signed in; every other session is invalidated
      return send(res, 200, { ok: true });
    }

    default:
      return send(res, 404, { error: 'not_found' });
  }
});
