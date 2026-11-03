# Redwood Growth

Marketing site for **REDWOOD GROWTH — Staffing & Workforce Solutions in Mexico** (`redwoodgrowth.io`), plus a small booking backend.

- **Site:** static HTML + Bootstrap 5.3 + Bootstrap Icons (`index.html`, `consultation.html`, `style.css`, `js/`).
- **Booking backend:** Vercel Functions in `api/` (Node), Postgres on [Neon](https://neon.tech), no email service.
- **Admin panel:** `/admin/` — one admin, password login.

## How booking works

1. The admin signs in at `/admin/` and sets weekly availability (**Mexico City time**), date exceptions, meeting length, buffer, minimum notice, booking window, and a single meeting link (Zoom, Meet, Teams… any `https://` URL).
2. `consultation.html` fetches free slots from `/api/slots` (UTC instants) and shows them in the **visitor's own time zone** (detected, changeable).
3. The visitor books; the server re-checks the slot, stores it, and returns the meeting link on screen (+ a downloadable `.ics`). A database constraint makes double-booking impossible, even with simultaneous requests.
4. The admin sees every booking in the panel. **No emails are sent** (add Resend or similar later if wanted).

Until a meeting link is saved in the panel, the booking page shows a "scheduling isn't available" message. The old LeadConnector chat widget was removed from the site.

## Environment variables (Vercel → Settings → Environment Variables, Production **and** Preview)

| Name | What it is | How to get it |
|---|---|---|
| `DATABASE_URL` | Neon connection string (pooled) | Neon console → project `redwood-growth` → Connect. Or Vercel → Storage → connect the Neon project. |
| `SESSION_SECRET` | Signs admin session cookies (32+ chars) | `openssl rand -hex 32` |
| `ADMIN_PASSWORD_HASH` | Bootstrap admin password (hashed) | `npm run hash -- "choose a long password"` and paste the output. After first login the password can be changed from the panel's **Password** tab (stored hashed in the DB, takes over from this variable). |

**Status:** all three are already configured in the Vercel project (Production + Preview, Sensitive). The initial admin password is a temporary one handed over privately; **change it from the panel's Password tab on first login.** Values can't be read back from Vercel; to rotate one, upsert it and redeploy.

Mark all three as **Sensitive**. Never commit them. Preview and Production share the same database unless you create a separate Neon branch for Preview.

## Database

Schema: [`db/schema.sql`](db/schema.sql) (idempotent). Already applied to the Neon project `redwood-growth`. To apply it elsewhere, run the file against the new database.

## Local development

```bash
npm install
npm test                                   # slot logic + full API flow, runs against in-memory Postgres (no network)
DEV_DB=pglite SESSION_SECRET=$(openssl rand -hex 32) \
  ADMIN_PASSWORD_HASH="$(npm run -s hash -- 'a-long-local-password')" npm run dev
# -> http://localhost:3000  (admin at /admin/, data lives in memory)
```

To develop against Neon instead, create `.env.local` (gitignored) with the three variables above and run `npm run dev`.

## Structure

```
index.html, consultation.html, privacy.html, terms.html, 404.html   pages
admin/            admin panel (noindex)
api/              slots.js (public), book.js (public), admin.js (login + panel actions)
lib/              db, auth (scrypt + signed cookie), slot generation (Luxon), http helpers
db/schema.sql     Postgres schema
js/booking.js     public booking widget
tests/            node:test suites
```

See `GRAPHIC_ASSET_PLAN.md` for brand/graphic assets.
