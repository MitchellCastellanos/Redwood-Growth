import { neon } from '@neondatabase/serverless';

let client;
export function sql() {
  if (!client) {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
    client = neon(process.env.DATABASE_URL);
  }
  return client;
}

// Lets scripts/dev.mjs and the tests swap in an in-memory Postgres (PGlite). Never used in production.
export function setSql(fn) {
  client = fn;
}
