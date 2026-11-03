/* Public booking widget. Slots arrive as UTC instants and are rendered in the visitor's own time zone. */
(() => {
  const root = document.getElementById('bookingApp');
  if (!root) return;

  const $ = (tag, props = {}, ...kids) => {
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

  const state = { tz: guessTz(), slots: [], day: null, slot: null, biz: 'America/Mexico_City', minutes: 30 };

  function guessTz() {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Mexico_City'; } catch { return 'America/Mexico_City'; }
  }
  const fmt = (opts, tz) => new Intl.DateTimeFormat('en-US', { timeZone: tz, ...opts });
  const dayKey = (iso, tz) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
  const timeLabel = (iso, tz) => fmt({ hour: 'numeric', minute: '2-digit' }, tz).format(new Date(iso));
  const dayLabel = (iso, tz) => fmt({ weekday: 'short', month: 'short', day: 'numeric' }, tz).format(new Date(iso));
  const longLabel = (iso, tz) => fmt({ weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }, tz).format(new Date(iso));

  function show(...nodes) { root.replaceChildren(...nodes.filter((n) => n != null)); }

  function fallback(msg) {
    show($('div', { class: 'booking-note' },
      $('h2', { class: 'h4 fw-bold mb-3', text: 'Online scheduling isn’t available right now.' }),
      $('p', { text: msg || 'Please check back soon.' }),
      $('a', { class: 'btn btn-ghost', href: 'index.html#services', text: 'Review our services' })));
  }

  async function loadSlots() {
    const r = await fetch('/api/slots', { headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error('slots');
    return r.json();
  }

  function groupByDay() {
    const m = new Map();
    for (const iso of state.slots) {
      const k = dayKey(iso, state.tz);
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(iso);
    }
    return m;
  }

  function tzSelect() {
    let zones = [];
    try { zones = Intl.supportedValuesOf('timeZone'); } catch {}
    if (!zones.includes(state.tz)) zones = [state.tz, ...zones];
    const sel = $('select', { id: 'tzSelect', class: 'form-select form-select-sm' },
      zones.map((z) => $('option', { value: z, text: z.replace(/_/g, ' '), selected: z === state.tz })));
    sel.addEventListener('change', () => { state.tz = sel.value; state.day = null; state.slot = null; renderPicker(); });
    return sel;
  }

  function renderPicker(notice) {
    const days = groupByDay();
    const keys = [...days.keys()];
    if (!state.day || !days.has(state.day)) state.day = keys[0];

    const dayBtns = keys.map((k) => {
      const first = days.get(k)[0];
      return $('button', {
        type: 'button', class: 'day-chip', 'aria-pressed': String(k === state.day),
        onclick: () => { state.day = k; renderPicker(); },
      }, $('span', { text: dayLabel(first, state.tz) }), $('small', { text: `${days.get(k).length} open` }));
    });

    const times = (days.get(state.day) || []).map((iso) =>
      $('button', { type: 'button', class: 'time-btn', onclick: () => { state.slot = iso; renderForm(); } }, timeLabel(iso, state.tz)));

    show(
      notice ? $('div', { class: 'notice mb-3', role: 'alert', text: notice }) : null,
      $('h2', { class: 'h4 fw-bold mb-1', text: 'Pick a time' }),
      $('p', { class: 'text-secondary small mb-3', text: `${state.minutes}-minute call. Times shown in your time zone; our business hours are in Mexico City time.` }),
      $('div', { class: 'mb-3' }, $('label', { for: 'tzSelect', class: 'form-label small fw-semibold', text: 'Your time zone' }), tzSelect()),
      $('div', { class: 'day-grid', role: 'group', 'aria-label': 'Available days' }, dayBtns),
      $('div', { class: 'time-grid', role: 'group', 'aria-label': 'Available times' }, times),
    );
  }

  function renderForm(error) {
    const f = $('form', { class: 'booking-form', novalidate: true },
      $('div', { class: 'summary' }, $('i', { class: 'bi bi-calendar-check', 'aria-hidden': 'true' }), $('span', { text: longLabel(state.slot, state.tz) })),
      $('div', { class: 'mb-3' }, $('label', { class: 'form-label', for: 'bkName', text: 'Name *' }), $('input', { class: 'form-control', id: 'bkName', name: 'name', required: true, maxlength: 120, autocomplete: 'name' })),
      $('div', { class: 'mb-3' }, $('label', { class: 'form-label', for: 'bkEmail', text: 'Email *' }), $('input', { class: 'form-control', id: 'bkEmail', name: 'email', type: 'email', required: true, maxlength: 200, autocomplete: 'email' })),
      $('div', { class: 'mb-3' }, $('label', { class: 'form-label', for: 'bkCompany', text: 'Company' }), $('input', { class: 'form-control', id: 'bkCompany', name: 'company', maxlength: 160, autocomplete: 'organization' })),
      $('div', { class: 'mb-3' }, $('label', { class: 'form-label', for: 'bkNotes', text: 'What roles are you looking to hire?' }), $('textarea', { class: 'form-control', id: 'bkNotes', name: 'notes', rows: 3, maxlength: 1000 })),
      $('div', { class: 'hp', 'aria-hidden': 'true' }, $('label', { for: 'bkWebsite', text: 'Website' }), $('input', { id: 'bkWebsite', name: 'website', tabindex: '-1', autocomplete: 'off' })),
      error ? $('div', { class: 'notice mb-3', role: 'alert', text: error }) : null,
      $('div', { class: 'd-flex flex-wrap gap-2' },
        $('button', { class: 'btn btn-brand', type: 'submit', text: 'Confirm booking' }),
        $('button', { class: 'btn btn-ghost', type: 'button', text: 'Back', onclick: () => renderPicker() })),
    );
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(f));
      if (!d.name.trim()) return renderFormKeep(f, 'Please enter your name.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email.trim())) return renderFormKeep(f, 'Please enter a valid email.');
      const btn = f.querySelector('button[type=submit]');
      btn.disabled = true; btn.textContent = 'Booking…';
      try {
        const r = await fetch('/api/book', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...d, start: state.slot, visitorTz: state.tz }),
        });
        const data = await r.json().catch(() => ({}));
        if (r.ok && data.booking) return renderDone(data.booking);
        if (data.error === 'slot_unavailable') {
          const fresh = await loadSlots(); state.slots = fresh.slots; state.slot = null;
          return renderPicker('Sorry, that time was just taken. Please choose another.');
        }
        if (r.status === 429) return renderFormKeep(f, 'Too many attempts. Please try again later.');
        renderFormKeep(f, 'Something went wrong. Please try again.');
      } catch {
        renderFormKeep(f, 'Network error. Please try again.');
      }
    });
    show($('h2', { class: 'h4 fw-bold mb-3', text: 'Your details' }), f);
    f.querySelector('input').focus();
  }

  function renderFormKeep(form, msg) {
    const old = form.querySelector('[role=alert]');
    if (old) old.remove();
    form.querySelector('.d-flex').before($('div', { class: 'notice mb-3', role: 'alert', text: msg }));
    const b = form.querySelector('button[type=submit]'); b.disabled = false; b.textContent = 'Confirm booking';
  }

  function ics(b) {
    const z = (iso) => new Date(iso).toISOString().replace(/[-:]|\.\d{3}/g, '');
    const esc = (s) => String(s).replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
    return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Redwood Growth//Booking//EN', 'BEGIN:VEVENT',
      `UID:${b.id}@redwoodgrowth.io`, `DTSTAMP:${z(new Date().toISOString())}`, `DTSTART:${z(b.start)}`, `DTEND:${z(b.end)}`,
      'SUMMARY:Call with Redwood Growth', `DESCRIPTION:${esc(`Join: ${b.meetingUrl}`)}`, `LOCATION:${esc(b.meetingUrl)}`, `URL:${esc(b.meetingUrl)}`,
      'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  }

  function renderDone(b) {
    const url = new URL(b.meetingUrl); // validated https on save
    const provider = b.meetingProvider ? ` (${b.meetingProvider})` : '';
    const copy = $('button', { class: 'btn btn-ghost', type: 'button', text: 'Copy link' });
    copy.addEventListener('click', async () => { try { await navigator.clipboard.writeText(b.meetingUrl); copy.textContent = 'Copied'; } catch { copy.textContent = 'Select the link above'; } });
    const dl = $('button', { class: 'btn btn-ghost', type: 'button', text: 'Add to calendar (.ics)' });
    dl.addEventListener('click', () => {
      const a = $('a', { href: URL.createObjectURL(new Blob([ics(b)], { type: 'text/calendar' })), download: 'redwood-growth-call.ics' });
      document.body.append(a); a.click(); a.remove();
    });
    show($('div', { class: 'booking-done' },
      $('div', { class: 'done-icon', 'aria-hidden': 'true' }, $('i', { class: 'bi bi-check-lg' })),
      $('h2', { class: 'h4 fw-bold mb-2', text: 'You’re booked.' }),
      $('p', { class: 'mb-1', text: longLabel(b.start, state.tz) }),
      state.tz !== b.timezone ? $('p', { class: 'text-secondary small', text: `That is ${longLabel(b.start, b.timezone)}.` }) : null,
      $('p', { class: 'mt-3 mb-1 fw-semibold', text: `Your meeting link${provider}:` }),
      $('p', {}, $('a', { href: url.href, target: '_blank', rel: 'noopener noreferrer', text: url.href })),
      $('div', { class: 'd-flex flex-wrap gap-2 mb-3' }, copy, dl),
      $('div', { class: 'notice', text: 'Please save this link now. We don’t send a confirmation email, so this page is the only place it appears.' })));
  }

  show($('p', { class: 'text-secondary', text: 'Loading available times…' }));
  loadSlots().then((d) => {
    state.slots = d.slots; state.biz = d.timezone; state.minutes = d.slotMinutes;
    if (!d.configured || !d.slots.length) return fallback(d.configured ? 'There are no open times right now. Please check back soon.' : undefined);
    renderPicker();
  }).catch(() => fallback());
})();
