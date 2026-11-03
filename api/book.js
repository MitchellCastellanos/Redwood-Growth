import { DateTime } from 'luxon';
import { sql } from '../lib/db.js';
import { clientIp, handle, rateLimited, readJson, sameOrigin, send } from '../lib/http.js';
import { generateSlots, loadSchedule } from '../lib/slots.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const clean = (v, max) => String(v ?? '').trim().slice(0, max);

// POST /api/book  { start, name, email, company?, notes?, visitorTz?, website (honeypot) }
export default handle(async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'method_not_allowed' });
  if (!sameOrigin(req)) return send(res, 403, { error: 'forbidden' });
  const body = await readJson(req);

  if (body.website) return send(res, 200, { ok: true }); // honeypot: pretend success to bots

  const name = clean(body.name, 120);
  const email = clean(body.email, 200).toLowerCase();
  const company = clean(body.company, 160);
  const notes = clean(body.notes, 1000);
  const visitorTz = clean(body.visitorTz, 64);
  if (!name) return send(res, 400, { error: 'name_required' });
  if (!EMAIL.test(email)) return send(res, 400, { error: 'email_invalid' });
  const startDt = DateTime.fromISO(String(body.start || ''), { setZone: true });
  if (!startDt.isValid) return send(res, 400, { error: 'start_invalid' });

  const db = sql();
  if (await rateLimited(db, `book:${clientIp(req)}`, 8, 3600)) return send(res, 429, { error: 'too_many_requests' });

  // Re-derive the free slots server-side: the client can only book a slot we would have offered.
  const { settings } = await loadSchedule(db);
  if (!settings.meeting_url) return send(res, 409, { error: 'not_configured' });
  const zone = settings.timezone;
  const day = startDt.setZone(zone).toISODate();
  const schedule = await loadSchedule(db, { fromDate: day, toDate: day });
  const wanted = startDt.toUTC().toISO();
  const slot = generateSlots({ ...schedule, fromDate: day, toDate: day }).find((s) => s.start === wanted);
  if (!slot) return send(res, 409, { error: 'slot_unavailable' });

  try {
    const rows = await db`
      INSERT INTO bookings (start_utc, end_utc, name, email, company, notes, visitor_tz)
      VALUES (${slot.start}::timestamptz, ${slot.end}::timestamptz, ${name}, ${email}, ${company}, ${notes}, ${visitorTz})
      RETURNING id`;
    send(res, 200, {
      ok: true,
      booking: {
        id: rows[0].id,
        start: slot.start,
        end: slot.end,
        meetingUrl: settings.meeting_url,
        meetingProvider: settings.meeting_provider,
        timezone: zone,
      },
    });
  } catch (err) {
    if (err.code === '23P01' || err.code === '23505') return send(res, 409, { error: 'slot_unavailable' }); // lost a race
    throw err;
  }
});
