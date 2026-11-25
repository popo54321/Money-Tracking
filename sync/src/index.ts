// Money Tracking sync service. Release 1: the service and its database exist and answer a health check.
// Linking phones and sharing accounts come in the next releases.

interface Env {
  DB: D1Database;
}

const VERSION = '1';

// the app runs from GitHub Pages (iPhone), inside the Android app, and locally while building
const ALLOWED = new Set(['https://popo54321.github.io', 'capacitor://localhost', 'https://localhost', 'http://localhost', 'http://localhost:5173', 'http://localhost:4173']);

function cors(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? '';
  return ALLOWED.has(origin)
    ? {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
        Vary: 'Origin',
      }
    : {};
}

function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...cors(req) },
  });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
    const url = new URL(req.url);
    if (url.pathname === '/health' && req.method === 'GET') {
      try {
        const row = await env.DB.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type = 'table' AND name IN ('groups','devices','invites','shared_accounts','entries')").first<{ n: number }>();
        return json(req, { ok: true, version: VERSION, tables: row?.n ?? 0 });
      } catch (e) {
        return json(req, { ok: false, version: VERSION, error: 'database' }, 500);
      }
    }
    return json(req, { ok: false, error: 'not found' }, 404);
  },
};
