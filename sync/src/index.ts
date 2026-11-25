// Money Tracking sync service.
// Release 2: phones link into a family (up to 10). The phone that starts it is the owner: it makes invite codes
// and removes phones. Each phone proves who it is with a secret only it holds; only a hash of it is stored here.
// Sharing accounts comes next.

interface Env {
  DB: D1Database;
}

const VERSION = '2';
const MAX_DEVICES = 10;
const INVITE_MINUTES = 15;

// the app runs from GitHub Pages (iPhone), inside the Android app, and locally while building
const ALLOWED = new Set([
  'https://popo54321.github.io',
  'capacitor://localhost',
  'https://localhost',
  'http://localhost',
  'http://localhost:5173',
  'http://localhost:4173',
]);

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

class Fail extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}

function randomId(bytes = 16): string {
  const a = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...a)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sha256(s: string): Promise<string> {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** 8 letters and digits people can read out (no 0/O, 1/I/L), shown as ABCD-EFGH */
function inviteCode(): string {
  const abc = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const a = crypto.getRandomValues(new Uint8Array(8));
  const s = [...a].map((b) => abc[b % abc.length]).join('');
  return `${s.slice(0, 4)}-${s.slice(4)}`;
}

function cleanName(v: unknown): string {
  const s = typeof v === 'string' ? v.trim().slice(0, 40) : '';
  if (!s) throw new Fail(400, 'name needed');
  return s;
}

async function body(req: Request): Promise<Record<string, unknown>> {
  try {
    const b = await req.json();
    return b && typeof b === 'object' ? (b as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

interface Device {
  id: string;
  group_id: string;
  name: string;
  token_hash: string;
  created_at: number;
  removed_at: number | null;
}

/** The phone making the request, from "Authorization: Bearer <device id>.<secret>" */
async function me(req: Request, env: Env): Promise<{ device: Device; owner: string }> {
  const auth = req.headers.get('Authorization') ?? '';
  const m = /^Bearer ([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/.exec(auth);
  if (!m) throw new Fail(401, 'not linked');
  const d = await env.DB.prepare('SELECT * FROM devices WHERE id = ?').bind(m[1]).first<Device>();
  if (!d || d.token_hash !== (await sha256(m[2]))) throw new Fail(401, 'not linked');
  if (d.removed_at) throw new Fail(401, 'removed');
  const g = await env.DB.prepare('SELECT owner_device FROM groups WHERE id = ?').bind(d.group_id).first<{ owner_device: string }>();
  if (!g) throw new Fail(401, 'removed');
  return { device: d, owner: g.owner_device };
}

async function newDevice(env: Env, groupId: string, name: string) {
  const id = randomId(12);
  const secret = randomId(32);
  await env.DB.prepare('INSERT INTO devices (id, group_id, name, token_hash, created_at) VALUES (?, ?, ?, ?, ?)')
    .bind(id, groupId, name, await sha256(secret), Date.now())
    .run();
  return { deviceId: id, token: `${id}.${secret}` };
}

async function family(req: Request, env: Env, d: Device, owner: string) {
  const { results } = await env.DB.prepare(
    'SELECT id, name, created_at FROM devices WHERE group_id = ? AND removed_at IS NULL ORDER BY created_at',
  )
    .bind(d.group_id)
    .all<{ id: string; name: string; created_at: number }>();
  return json(req, {
    ok: true,
    groupId: d.group_id,
    deviceId: d.id,
    isOwner: d.id === owner,
    devices: results.map((x) => ({ id: x.id, name: x.name, joinedAt: x.created_at, owner: x.id === owner, me: x.id === d.id })),
    max: MAX_DEVICES,
  });
}

async function route(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  if (path === '/health' && method === 'GET') {
    const row = await env.DB.prepare(
      "SELECT count(*) AS n FROM sqlite_master WHERE type = 'table' AND name IN ('groups','devices','invites','shared_accounts','entries')",
    ).first<{ n: number }>();
    return json(req, { ok: true, version: VERSION, tables: row?.n ?? 0 });
  }

  // start a family: this phone becomes its owner
  if (path === '/family' && method === 'POST') {
    const b = await body(req);
    const name = cleanName(b.name);
    const groupId = randomId(12);
    const ownerId = randomId(12);
    const secret = randomId(32);
    const now = Date.now();
    await env.DB.batch([
      env.DB.prepare('INSERT INTO groups (id, owner_device, created_at) VALUES (?, ?, ?)').bind(groupId, ownerId, now),
      env.DB.prepare('INSERT INTO devices (id, group_id, name, token_hash, created_at) VALUES (?, ?, ?, ?, ?)').bind(
        ownerId,
        groupId,
        name,
        await sha256(secret),
        now,
      ),
    ]);
    return json(req, { ok: true, groupId, deviceId: ownerId, token: `${ownerId}.${secret}` });
  }

  // join with a code from the owner's phone
  if (path === '/join' && method === 'POST') {
    const b = await body(req);
    const name = cleanName(b.name);
    const code = typeof b.code === 'string' ? b.code.toUpperCase().replace(/[^A-Z0-9]/g, '') : '';
    const pretty = `${code.slice(0, 4)}-${code.slice(4)}`;
    const inv = await env.DB.prepare('SELECT * FROM invites WHERE code = ?')
      .bind(pretty)
      .first<{ code: string; group_id: string; expires_at: number; used_by: string | null }>();
    if (!inv || inv.used_by) throw new Fail(404, 'code not found');
    if (inv.expires_at < Date.now()) throw new Fail(410, 'code expired');
    const count = await env.DB.prepare('SELECT count(*) AS n FROM devices WHERE group_id = ? AND removed_at IS NULL')
      .bind(inv.group_id)
      .first<{ n: number }>();
    if ((count?.n ?? 0) >= MAX_DEVICES) throw new Fail(409, 'family full');
    const dev = await newDevice(env, inv.group_id, name);
    // the code works once: if two phones raced, only the first keeps its place
    const used = await env.DB.prepare('UPDATE invites SET used_by = ? WHERE code = ? AND used_by IS NULL').bind(dev.deviceId, pretty).run();
    if (!used.meta.changes) {
      await env.DB.prepare('DELETE FROM devices WHERE id = ?').bind(dev.deviceId).run();
      throw new Fail(404, 'code not found');
    }
    return json(req, { ok: true, groupId: inv.group_id, ...dev });
  }

  // everything below needs a linked phone
  const { device, owner } = await me(req, env);
  const isOwner = device.id === owner;

  if (path === '/family' && method === 'GET') return family(req, env, device, owner);

  if (path === '/name' && method === 'PUT') {
    const b = await body(req);
    await env.DB.prepare('UPDATE devices SET name = ? WHERE id = ?').bind(cleanName(b.name), device.id).run();
    return family(req, env, device, owner);
  }

  if (path === '/invites' && method === 'POST') {
    if (!isOwner) throw new Fail(403, 'owner only');
    const count = await env.DB.prepare('SELECT count(*) AS n FROM devices WHERE group_id = ? AND removed_at IS NULL')
      .bind(device.group_id)
      .first<{ n: number }>();
    if ((count?.n ?? 0) >= MAX_DEVICES) throw new Fail(409, 'family full');
    const now = Date.now();
    // old codes of this family stop working, so only the newest one can be used
    await env.DB.prepare('DELETE FROM invites WHERE group_id = ? AND used_by IS NULL').bind(device.group_id).run();
    await env.DB.prepare('DELETE FROM invites WHERE expires_at < ?').bind(now - 86400000).run();
    const code = inviteCode();
    const expiresAt = now + INVITE_MINUTES * 60000;
    await env.DB.prepare('INSERT INTO invites (code, group_id, expires_at) VALUES (?, ?, ?)').bind(code, device.group_id, expiresAt).run();
    return json(req, { ok: true, code, expiresAt });
  }

  const del = /^\/devices\/([A-Za-z0-9_-]+)$/.exec(path);
  if (del && method === 'DELETE') {
    const target = del[1];
    if (!isOwner && target !== device.id) throw new Fail(403, 'owner only');
    if (target === owner) throw new Fail(400, 'owner stays');
    await env.DB.prepare('UPDATE devices SET removed_at = ? WHERE id = ? AND group_id = ? AND removed_at IS NULL')
      .bind(Date.now(), target, device.group_id)
      .run();
    return target === device.id ? json(req, { ok: true, left: true }) : family(req, env, device, owner);
  }

  // the owner ends the family: every phone loses access
  if (path === '/family' && method === 'DELETE') {
    if (!isOwner) throw new Fail(403, 'owner only');
    await env.DB.batch([
      env.DB.prepare('UPDATE devices SET removed_at = ? WHERE group_id = ? AND removed_at IS NULL').bind(Date.now(), device.group_id),
      env.DB.prepare('DELETE FROM invites WHERE group_id = ?').bind(device.group_id),
    ]);
    return json(req, { ok: true, ended: true });
  }

  throw new Fail(404, 'not found');
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
    try {
      return await route(req, env);
    } catch (e) {
      if (e instanceof Fail) return json(req, { ok: false, error: e.code }, e.status);
      return json(req, { ok: false, error: 'server' }, 500);
    }
  },
};
