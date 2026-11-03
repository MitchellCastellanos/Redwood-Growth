import { DateTime } from 'luxon';
import { sql } from '../lib/db.js';
import { handle, query, send } from '../lib/http.js';
import { generateSlots, loadSchedule } from '../lib/slots.js';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

// GET /api/slots?from=YYYY-MM-DD&to=YYYY-MM-DD  -> free slots as UTC instants. Public; exposes no personal data or meeting link.
export default handle(async (req, res) => {
  if (req.method !== 'GET') return send(res, 405, { error: 'method_not_allowed' });
  const q = query(req);
  const from = q.get('from');
  const to = q.get('to');
  if ((from && !DATE.test(from)) || (to && !DATE.test(to))) return send(res, 400, { error: 'invalid_date' });

  const db = sql();
  const schedule = await loadSchedule(db, { fromDate: from, toDate: to });
  const { settings } = schedule;
  const configured = settings.meeting_url !== '';
  let slots = [];
  if (configured) {
    if (from && to && DateTime.fromISO(to).diff(DateTime.fromISO(from), 'days').days > 62) return send(res, 400, { error: 'range_too_large' });
    slots = generateSlots({ ...schedule, fromDate: from, toDate: to }).map((s) => s.start);
  }
  send(res, 200, {
    configured,
    timezone: settings.timezone,
    slotMinutes: settings.slot_minutes,
    horizonDays: settings.horizon_days,
    slots,
  });
});
