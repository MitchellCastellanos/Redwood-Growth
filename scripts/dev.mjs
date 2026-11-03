// Local dev server: static files + /api/* handlers (mirrors Vercel routing). Reads .env.local.
//   npm run dev                       -> uses DATABASE_URL (Neon)
//   DEV_DB=pglite npm run dev         -> offline in-memory Postgres (data is lost on restart)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
try {
  for (const line of fs.readFileSync(path.join(root, '.env.local'), 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
  }
} catch {}
process.env.NODE_ENV ??= 'development';

const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.xml': 'application/xml', '.txt': 'text/plain' };

export function createDevServer() {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const api = url.pathname.match(/^\/api\/([a-z]+)$/);
    if (api && fs.existsSync(path.join(root, 'api', `${api[1]}.js`))) {
      const mod = await import(`../api/${api[1]}.js`);
      return mod.default(req, res);
    }
    let file = path.join(root, decodeURIComponent(url.pathname));
    if (!file.startsWith(root)) { res.statusCode = 403; return res.end(); }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) { res.statusCode = 404; return res.end('Not found'); }
    res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.env.DEV_DB === 'pglite') {
    const { setSql } = await import('../lib/db.js');
    const { createPgliteSql } = await import('./pglite-sql.mjs');
    setSql(await createPgliteSql());
  }
  const port = Number(process.env.PORT || 3000);
  createDevServer().listen(port, () => console.log(`http://localhost:${port}`));
}
