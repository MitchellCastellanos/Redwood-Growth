// Small, framework-free helpers so handlers run the same on Vercel and in scripts/dev.mjs.
export function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

export function query(req) {
  return new URL(req.url, 'http://localhost').searchParams;
}

export async function readJson(req, limit = 32 * 1024) {
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > limit) throw Object.assign(new Error('Body too large'), { status: 413 });
    chunks.push(c);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw Object.assign(new Error('Invalid JSON'), { status: 400 });
  }
}

export function clientIp(req) {
  const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return fwd || req.socket?.remoteAddress || 'unknown';
}

// State-changing requests must come from our own origin (defense in depth on top of SameSite=Strict).
export function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true; // non-browser clients (curl) carry no Origin; cookies still required for admin
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

// Returns true when the bucket exceeded `max` hits in the last `windowSeconds`; otherwise records a hit.
export async function rateLimited(sql, bucket, max, windowSeconds) {
  await sql`DELETE FROM rate_limits WHERE at < now() - interval '1 day'`;
  const rows = await sql`
    SELECT count(*)::int AS n FROM rate_limits
    WHERE bucket = ${bucket} AND at > now() - make_interval(secs => ${windowSeconds})`;
  if (rows[0].n >= max) return true;
  await sql`INSERT INTO rate_limits (bucket) VALUES (${bucket})`;
  return false;
}

export function handle(fn) {
  return async (req, res) => {
    try {
      await fn(req, res);
    } catch (err) {
      const status = err.status || 500;
      if (status >= 500) console.error(err);
      send(res, status, { error: status >= 500 ? 'server_error' : err.message });
    }
  };
}
