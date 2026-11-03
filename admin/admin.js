/* Admin panel. All schedule times are Mexico City time. User-supplied text is only ever inserted with textContent. */
const API = '/api/admin';
const BIZ_TZ = 'America/Mexico_City';
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const $ = (id) => document.getElementById(id);
const h = (tag, props = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) n.setAttribute(k, v === true ? '' : v);
  }
  kids.flat().forEach((c) => c != null && n.append(c));
  return n;
};

async function api(action, method = 'GET', body) {
  const r = await fetch(`${API}?action=${action}`, {
    method, credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (r.status === 401 && action !== 'login' && action !== 'password') { showLogin(); throw new Error('unauthorized'); }
  if (!r.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}

let toastTimer;
function toast(msg, ok = true) {
  const t = $('toast');
  t.textContent = msg; t.hidden = false; t.style.borderLeftColor = ok ? '#0e7c4f' : '#b3261e';
  clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), 5000);
}
const guard = (fn) => async (...a) => { try { await fn(...a); } catch (e) { if (e.message !== 'unauthorized') toast(e.message, false); } };

function showLogin() { $('appView').hidden = true; $('loginView').hidden = false; $('logoutBtn').hidden = true; }
function showApp() { $('loginView').hidden = true; $('appView').hidden = false; $('logoutBtn').hidden = false; loadAll(); }

/* ---------- Tabs ---------- */
document.querySelectorAll('#tabs [data-tab]').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('#tabs [data-tab]').forEach((x) => { const on = x === b; x.classList.toggle('active', on); x.setAttribute('aria-selected', on); });
  document.querySelectorAll('[data-panel]').forEach((p) => (p.hidden = p.dataset.panel !== b.dataset.tab));
  if (b.dataset.tab === 'bookings') guard(loadBookings)();
}));

/* ---------- Login / logout ---------- */
$('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = $('loginErr'); err.hidden = true;
  try { await api('login', 'POST', { password: $('loginPw').value }); $('loginPw').value = ''; showApp(); }
  catch (ex) { err.textContent = ex.message; err.hidden = false; }
});
$('logoutBtn').addEventListener('click', async () => { await fetch(`${API}?action=logout`, { method: 'POST', credentials: 'same-origin' }); showLogin(); });

/* ---------- Bookings ---------- */
const fmt = (iso, tz, extra = {}) => new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', ...extra }).format(new Date(iso));

function bookingCard(b) {
  const meta = [b.email, b.company].filter(Boolean).join(' · ');
  const cancel = b.status === 'confirmed' && new Date(b.end) > new Date()
    ? h('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: 'Cancel', onclick: guard(async () => {
        if (!confirm(`Cancel the booking with ${b.name}? They are not notified automatically.`)) return;
        await api('cancel', 'POST', { id: b.id }); toast('Booking cancelled'); await loadBookings();
      }) })
    : null;
  return h('div', { class: `b-card${b.status === 'cancelled' ? ' cancelled' : ''}` },
    h('div', {},
      h('div', { class: 'b-when', text: `${fmt(b.start, BIZ_TZ, { timeZoneName: 'short' })}${b.status === 'cancelled' ? ' — cancelled' : ''}` }),
      b.visitorTz ? h('div', { class: 'b-meta', text: `Visitor’s time: ${fmt(b.start, b.visitorTz, { timeZoneName: 'short' })} (${b.visitorTz})` }) : null,
      h('div', { class: 'mt-1 fw-semibold', text: b.name }),
      h('div', { class: 'b-meta' }, h('a', { href: `mailto:${b.email}`, text: b.email }), b.company ? ` · ${b.company}` : ''),
      b.notes ? h('div', { class: 'b-notes', text: b.notes }) : null),
    cancel);
}

async function loadBookings() {
  const { bookings } = await api('bookings');
  const now = new Date();
  const up = bookings.filter((b) => b.status === 'confirmed' && new Date(b.end) > now);
  const past = bookings.filter((b) => !up.includes(b)).reverse();
  $('upcoming').replaceChildren(...(up.length ? up.map(bookingCard) : [h('p', { class: 'text-secondary', text: 'No upcoming bookings yet.' })]));
  $('past').replaceChildren(...(past.length ? past.map(bookingCard) : [h('p', { class: 'text-secondary', text: 'Nothing here.' })]));
}

/* ---------- Availability ---------- */
let rules = []; // {weekday, start, end}
let exceptions = []; // {date, start, end} ; start/end '' = closed all day

function renderWeek() {
  const card = h('div', { class: 'week-card' });
  DAYS.forEach((name, i) => {
    const wd = i + 1;
    const wins = rules.map((r, idx) => ({ r, idx })).filter((x) => x.r.weekday === wd);
    card.append(h('div', { class: 'day-row' },
      h('div', { class: 'day-name', text: name }),
      h('div', {},
        ...(wins.length ? wins.map(({ r, idx }) => h('div', { class: 'win' },
          h('input', { type: 'time', class: 'form-control form-control-sm', value: r.start, 'aria-label': `${name} start`, onchange: (e) => (r.start = e.target.value) }),
          h('span', { text: 'to' }),
          h('input', { type: 'time', class: 'form-control form-control-sm', value: r.end, 'aria-label': `${name} end`, onchange: (e) => (r.end = e.target.value) }),
          h('button', { type: 'button', class: 'btn btn-sm btn-ghost', 'aria-label': `Remove ${name} window`, text: '✕', onclick: () => { rules.splice(idx, 1); renderWeek(); } })))
          : [h('div', { class: 'text-secondary small mb-1', text: 'Unavailable' })]),
        h('button', { type: 'button', class: 'btn btn-sm btn-ghost', text: '+ Add hours', onclick: () => { rules.push({ weekday: wd, start: '09:00', end: '17:00' }); renderWeek(); } }))));
  });
  $('weekEditor').replaceChildren(card);
}

function renderEx() {
  $('exEditor').replaceChildren(...exceptions.map((ex, idx) => {
    const closed = h('input', { type: 'checkbox', class: 'form-check-input', id: `exc${idx}`, checked: !ex.start });
    const s = h('input', { type: 'time', class: 'form-control form-control-sm', value: ex.start || '09:00', 'aria-label': 'Special start', onchange: (e) => (ex.start = e.target.value) });
    const e2 = h('input', { type: 'time', class: 'form-control form-control-sm', value: ex.end || '17:00', 'aria-label': 'Special end', onchange: (e) => (ex.end = e.target.value) });
    const sync = () => { s.disabled = e2.disabled = closed.checked; if (closed.checked) { ex.start = ''; ex.end = ''; } else { ex.start = s.value; ex.end = e2.value; } };
    closed.addEventListener('change', sync); sync();
    return h('div', { class: 'ex-row' },
      h('input', { type: 'date', class: 'form-control form-control-sm', value: ex.date, 'aria-label': 'Exception date', onchange: (e) => (ex.date = e.target.value) }),
      h('label', { class: 'form-check-label d-flex align-items-center gap-2', for: `exc${idx}` }, closed, 'Closed all day'),
      s, h('span', { text: 'to' }), e2,
      h('button', { type: 'button', class: 'btn btn-sm btn-ghost', 'aria-label': 'Remove date', text: '✕', onclick: () => { exceptions.splice(idx, 1); renderEx(); } }));
  }));
}

$('presetBtn').addEventListener('click', () => { rules = [1, 2, 3, 4, 5].map((weekday) => ({ weekday, start: '09:00', end: '17:00' })); renderWeek(); });
$('addEx').addEventListener('click', () => { exceptions.push({ date: '', start: '', end: '' }); renderEx(); });
$('saveAvail').addEventListener('click', guard(async () => {
  if (exceptions.some((e) => !e.date)) throw new Error('Pick a date for every exception (or remove it)');
  await api('availability', 'PUT', { rules, exceptions });
  toast('Availability saved');
}));

async function loadAvailability() {
  const d = await api('availability');
  rules = d.rules; exceptions = d.exceptions.map((e) => ({ ...e, start: e.start || '', end: e.end || '' }));
  renderWeek(); renderEx();
}

/* ---------- Settings ---------- */
async function loadSettings() {
  const s = await api('settings');
  $('s_slot').value = s.slot_minutes; $('s_buffer').value = s.buffer_minutes; $('s_notice').value = s.min_notice_hours;
  $('s_horizon').value = s.horizon_days; $('s_provider').value = s.meeting_provider; $('s_url').value = s.meeting_url;
}
$('settingsForm').addEventListener('submit', guard(async (e) => {
  e.preventDefault();
  await api('settings', 'PUT', {
    slot_minutes: $('s_slot').value, buffer_minutes: $('s_buffer').value, min_notice_hours: $('s_notice').value,
    horizon_days: $('s_horizon').value, meeting_provider: $('s_provider').value, meeting_url: $('s_url').value,
  });
  toast('Settings saved');
}));

/* ---------- Password ---------- */
$('pwForm').addEventListener('submit', guard(async (e) => {
  e.preventDefault();
  await api('password', 'POST', { current: $('pw_cur').value, next: $('pw_new').value });
  $('pwForm').reset(); toast('Password changed. Other devices were signed out.');
}));

function loadAll() { guard(async () => { await Promise.all([loadBookings(), loadAvailability(), loadSettings()]); })(); }

api('me').then((d) => (d.authenticated ? showApp() : showLogin())).catch(showLogin);
