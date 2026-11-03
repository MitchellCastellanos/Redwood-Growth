import { DateTime } from 'luxon';

const toHM = (t) => {
  const [h, m] = String(t).split(':').map(Number);
  return { hour: h, minute: m };
};

/**
 * Pure slot generator. All schedule times are wall-clock in `settings.timezone`; output is UTC instants.
 * - rules:       [{ weekday 1-7, start 'HH:MM', end 'HH:MM' }]
 * - exceptions:  [{ date 'YYYY-MM-DD', start|null, end|null }]  (no times = day blocked; times = only these windows)
 * - bookings:    [{ start: ISO, end: ISO }]  confirmed only
 */
export function generateSlots({ settings, rules, exceptions, bookings, now = DateTime.utc(), fromDate, toDate }) {
  const zone = settings.timezone;
  const today = now.setZone(zone).startOf('day');
  const horizonEnd = today.plus({ days: settings.horizon_days });
  let first = fromDate ? DateTime.fromISO(fromDate, { zone }).startOf('day') : today;
  let last = toDate ? DateTime.fromISO(toDate, { zone }).startOf('day') : horizonEnd;
  if (first < today) first = today;
  if (last > horizonEnd) last = horizonEnd;

  const earliest = now.plus({ hours: settings.min_notice_hours });
  const buffer = settings.buffer_minutes;
  const busy = bookings.map((b) => ({
    start: DateTime.fromISO(b.start).minus({ minutes: buffer }),
    end: DateTime.fromISO(b.end).plus({ minutes: buffer }),
  }));

  const out = [];
  for (let day = first; day <= last; day = day.plus({ days: 1 })) {
    const iso = day.toISODate();
    const dayEx = exceptions.filter((e) => e.date === iso);
    let windows;
    if (dayEx.some((e) => !e.start)) windows = [];
    else if (dayEx.length) windows = dayEx.map((e) => ({ start: e.start, end: e.end }));
    else windows = rules.filter((r) => r.weekday === day.weekday).map((r) => ({ start: r.start, end: r.end }));

    for (const w of windows) {
      const winEnd = day.set({ ...toHM(w.end), second: 0, millisecond: 0 });
      for (let s = day.set({ ...toHM(w.start), second: 0, millisecond: 0 }); ; s = s.plus({ minutes: settings.slot_minutes })) {
        const e = s.plus({ minutes: settings.slot_minutes });
        if (e > winEnd) break;
        if (s < earliest) continue;
        if (busy.some((b) => s < b.end && e > b.start)) continue;
        out.push({ start: s.toUTC().toISO(), end: e.toUTC().toISO() });
      }
    }
  }
  const seen = new Set();
  return out
    .filter((s) => !seen.has(s.start) && seen.add(s.start))
    .sort((a, b) => (a.start < b.start ? -1 : 1));
}

// Loads settings, rules, exceptions and confirmed bookings from Postgres, in the shapes generateSlots expects.
export async function loadSchedule(sql, { fromDate, toDate } = {}) {
  const [settings] = await sql`SELECT * FROM settings WHERE id = 1`;
  const rules = await sql`
    SELECT weekday::int AS weekday, to_char(start_time, 'HH24:MI') AS start, to_char(end_time, 'HH24:MI') AS "end"
    FROM availability_rules ORDER BY weekday, start_time`;
  const exceptions = await sql`
    SELECT to_char(date, 'YYYY-MM-DD') AS date, to_char(start_time, 'HH24:MI') AS start, to_char(end_time, 'HH24:MI') AS "end"
    FROM availability_exceptions ORDER BY date, start_time`;
  const lo = fromDate ? DateTime.fromISO(fromDate, { zone: settings.timezone }).minus({ days: 1 }).toUTC().toISO() : DateTime.utc().minus({ days: 1 }).toISO();
  const hi = toDate ? DateTime.fromISO(toDate, { zone: settings.timezone }).plus({ days: 2 }).toUTC().toISO() : DateTime.utc().plus({ days: settings.horizon_days + 2 }).toISO();
  const rows = await sql`
    SELECT start_utc, end_utc FROM bookings
    WHERE status = 'confirmed' AND end_utc > ${lo}::timestamptz AND start_utc < ${hi}::timestamptz`;
  const bookings = rows.map((r) => ({ start: new Date(r.start_utc).toISOString(), end: new Date(r.end_utc).toISOString() }));
  return { settings, rules, exceptions, bookings };
}
