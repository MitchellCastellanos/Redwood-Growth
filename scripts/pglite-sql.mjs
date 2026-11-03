// Dev/test only: an in-memory Postgres (PGlite) exposing the same tagged-template API as @neondatabase/serverless.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

export async function createPgliteSql() {
  const pg = new PGlite();
  await pg.exec(fs.readFileSync(fileURLToPath(new URL('../db/schema.sql', import.meta.url)), 'utf8'));
  const run = (q) => pg.query(q.text, q.params).then((r) => r.rows);
  const tag = (strings, ...values) => {
    let text = strings[0];
    values.forEach((_, i) => (text += `$${i + 1}${strings[i + 1]}`));
    const q = { text, params: values };
    return { _q: q, then: (ok, fail) => run(q).then(ok, fail), catch: (fail) => run(q).catch(fail) };
  };
  tag.transaction = (queries) =>
    pg.transaction(async (tx) => {
      const out = [];
      for (const q of queries) out.push((await tx.query(q._q.text, q._q.params)).rows);
      return out;
    });
  return tag;
}
