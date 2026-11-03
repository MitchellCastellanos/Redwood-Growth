import crypto from 'node:crypto';

const COOKIE = 'rg_admin';
const SESSION_DAYS = 7;
const N = 16384;

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const key = crypto.scryptSync(password, salt, 64, { N });
  return `scrypt:${N}:${salt}:${key.toString('hex')}`;
}

export function verifyPassword(password, stored) {
  const [scheme, n, salt, hash] = String(stored || '').split(':');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'hex');
  const key = crypto.scryptSync(String(password), salt, expected.length, { N: Number(n) });
  return key.length === expected.length && crypto.timingSafeEqual(key, expected);
}

// The hash currently in force: the one changed from the panel (DB) or the bootstrap env var.
export async function currentHash(sql) {
  const rows = await sql`SELECT password_hash FROM admin_auth WHERE id = 1`;
  return rows[0]?.password_hash || process.env.ADMIN_PASSWORD_HASH || '';
}

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error('SESSION_SECRET must be set (32+ chars)');
  return s;
}
const b64 = (b) => Buffer.from(b).toString('base64url');
const fingerprint = (hash) => crypto.createHash('sha256').update(hash).digest('hex').slice(0, 12);
const mac = (data) => crypto.createHmac('sha256', secret()).update(data).digest('base64url');

// Token embeds a fingerprint of the password hash, so changing the password logs everyone out.
export function createToken(hash) {
  const payload = b64(JSON.stringify({ exp: Date.now() + SESSION_DAYS * 864e5, pv: fingerprint(hash) }));
  return `${payload}.${mac(payload)}`;
}

export function tokenValid(token, hash) {
  const [payload, sig] = String(token || '').split('.');
  if (!payload || !sig) return false;
  const good = mac(payload);
  if (sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return false;
  try {
    const { exp, pv } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return exp > Date.now() && pv === fingerprint(hash);
  } catch {
    return false;
  }
}

function readCookie(req) {
  const m = String(req.headers.cookie || '').match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  return m ? m[1] : '';
}

export async function isAdmin(req, sql) {
  const token = readCookie(req);
  if (!token) return false;
  const hash = await currentHash(sql);
  return !!hash && tokenValid(token, hash);
}

export function setSessionCookie(res, token) {
  const secure = process.env.NODE_ENV === 'development' ? '' : '; Secure';
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_DAYS * 86400}${secure}`);
}

export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`);
}
