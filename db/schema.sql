-- Redwood Growth booking backend schema (Neon Postgres). Idempotent.

CREATE TABLE IF NOT EXISTS settings (
  id               smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  timezone         text     NOT NULL DEFAULT 'America/Mexico_City',
  slot_minutes     integer  NOT NULL DEFAULT 30  CHECK (slot_minutes BETWEEN 10 AND 240),
  buffer_minutes   integer  NOT NULL DEFAULT 0   CHECK (buffer_minutes BETWEEN 0 AND 120),
  min_notice_hours integer  NOT NULL DEFAULT 24  CHECK (min_notice_hours BETWEEN 0 AND 720),
  horizon_days     integer  NOT NULL DEFAULT 30  CHECK (horizon_days BETWEEN 1 AND 180),
  meeting_provider text     NOT NULL DEFAULT '',
  meeting_url      text     NOT NULL DEFAULT ''
);
INSERT INTO settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Weekly recurring availability, in the business timezone (settings.timezone). weekday: 1 = Monday ... 7 = Sunday
CREATE TABLE IF NOT EXISTS availability_rules (
  id         serial PRIMARY KEY,
  weekday    smallint NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  start_time time NOT NULL,
  end_time   time NOT NULL,
  CHECK (end_time > start_time)
);

-- Date overrides. Row with NULL times = whole day blocked. Rows with times = only those windows apply that date.
CREATE TABLE IF NOT EXISTS availability_exceptions (
  id         serial PRIMARY KEY,
  date       date NOT NULL,
  start_time time,
  end_time   time,
  CHECK ((start_time IS NULL AND end_time IS NULL) OR (start_time IS NOT NULL AND end_time IS NOT NULL AND end_time > start_time))
);
CREATE INDEX IF NOT EXISTS availability_exceptions_date_idx ON availability_exceptions (date);

CREATE TABLE IF NOT EXISTS bookings (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  start_utc  timestamptz NOT NULL,
  end_utc    timestamptz NOT NULL,
  name       text NOT NULL,
  email      text NOT NULL,
  company    text NOT NULL DEFAULT '',
  notes      text NOT NULL DEFAULT '',
  visitor_tz text NOT NULL DEFAULT '',
  status     text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_utc > start_utc)
);
CREATE INDEX IF NOT EXISTS bookings_start_idx ON bookings (start_utc);
-- Two confirmed bookings can never overlap, even under concurrent requests.
DO $$ BEGIN
  ALTER TABLE bookings ADD CONSTRAINT bookings_no_overlap
    EXCLUDE USING gist (tstzrange(start_utc, end_utc) WITH &&) WHERE (status = 'confirmed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tiny rate limiter (login attempts, public booking attempts)
CREATE TABLE IF NOT EXISTS rate_limits (
  id     bigserial PRIMARY KEY,
  bucket text NOT NULL,
  at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rate_limits_bucket_idx ON rate_limits (bucket, at);

-- Admin password (changeable from the panel). If empty, ADMIN_PASSWORD_HASH env var is used to bootstrap.
CREATE TABLE IF NOT EXISTS admin_auth (
  id            smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  password_hash text NOT NULL,
  updated_at    timestamptz NOT NULL DEFAULT now()
);
