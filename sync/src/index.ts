// Money Tracking sync service.
// Phones link into a family (up to 10). The phone that starts it is the owner: it makes invite codes and removes
// phones. Each phone proves who it is with a secret only it holds; only a hash of it is stored here.
// A phone shares chosen accounts with chosen phones: everyone it is shared with sees all entries on it, and only
// the phone that wrote an entry can change it. Each phone also keeps a family backup here, so a lost phone can be
// put back onto a new one with a code from another phone in the family.

interface Env {
  DB: D1Database;
}

const VERSION = '4';
const RECOVERY_MINUTES = 30;
const MAX_NEW_FAMILIES_PER_HOUR = 20;
const MAX_ENTRIES_PER_PUSH = 12;
const MAX_PART = 1_500_000;
const MAX_PARTS = 40;
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
  view_by: string | null;
}

/** Can `viewer` see `target`'s whole money? (NULL: every phone in the family) */
function canView(target: Device, viewer: string): boolean {
  if (target.id === viewer) return false;
  if (!target.view_by) return true;
  return (JSON.parse(target.view_by) as string[]).includes(viewer);
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
    'SELECT d.*, (SELECT max(updated_at) FROM backups b WHERE b.device_id = d.id) AS backup_at FROM devices d WHERE d.group_id = ? AND d.removed_at IS NULL ORDER BY d.created_at',
  )
    .bind(d.group_id)
    .all<Device & { backup_at: number | null }>();
  const isOwner = d.id === owner;
  return json(req, {
    ok: true,
    groupId: d.group_id,
    deviceId: d.id,
    isOwner,
    devices: results.map((x) => ({
      id: x.id,
      name: x.name,
      joinedAt: x.created_at,
      owner: x.id === owner,
      me: x.id === d.id,
      backupAt: x.backup_at,
      canView: canView(x, d.id),
      // who may see this phone's money: only the owner is told (and sets it)
      viewers: isOwner ? (x.view_by ? (JSON.parse(x.view_by) as string[]) : null) : undefined,
    })),
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
    // a plain cap so a script can't fill the database with families
    const recent = await env.DB.prepare('SELECT count(*) AS n FROM groups WHERE created_at > ?').bind(Date.now() - 3600000).first<{ n: number }>();
    if ((recent?.n ?? 0) >= MAX_NEW_FAMILIES_PER_HOUR) throw new Fail(429, 'busy');
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

  // put a lost phone's place onto this phone, with a code made on another phone in the family
  if (path === '/recover' && method === 'POST') {
    const b = await body(req);
    const raw = typeof b.code === 'string' ? b.code.toUpperCase().replace(/[^A-Z0-9]/g, '') : '';
    const code = `${raw.slice(0, 4)}-${raw.slice(4)}`;
    const rc = await env.DB.prepare('SELECT * FROM recovery_codes WHERE code = ?')
      .bind(code)
      .first<{ code: string; group_id: string; device_id: string; expires_at: number; used_at: number | null }>();
    if (!rc || rc.used_at) throw new Fail(404, 'code not found');
    if (rc.expires_at < Date.now()) throw new Fail(410, 'code expired');
    const d = await env.DB.prepare('SELECT * FROM devices WHERE id = ?').bind(rc.device_id).first<Device>();
    if (!d || d.removed_at) throw new Fail(404, 'code not found');
    const used = await env.DB.prepare('UPDATE recovery_codes SET used_at = ? WHERE code = ? AND used_at IS NULL').bind(Date.now(), code).run();
    if (!used.meta.changes) throw new Fail(404, 'code not found');
    // a new secret: the lost phone can no longer get in
    const secret = randomId(32);
    await env.DB.prepare('UPDATE devices SET token_hash = ? WHERE id = ?').bind(await sha256(secret), d.id).run();
    const backup = await env.DB.prepare('SELECT max(updated_at) AS at FROM backups WHERE device_id = ?').bind(d.id).first<{ at: number | null }>();
    return json(req, { ok: true, groupId: d.group_id, deviceId: d.id, token: `${d.id}.${secret}`, name: d.name, backupAt: backup?.at ?? null });
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
    await env.DB.batch([
      env.DB.prepare('UPDATE devices SET removed_at = ? WHERE id = ? AND group_id = ? AND removed_at IS NULL').bind(
        Date.now(),
        target,
        device.group_id,
      ),
      // a removed phone's backup goes too, and it is taken off every shared account
      env.DB.prepare('DELETE FROM backups WHERE device_id = ?').bind(target),
    ]);
    await dropMember(env, device.group_id, target);
    return target === device.id ? json(req, { ok: true, left: true }) : family(req, env, device, owner);
  }

  // the owner ends the family: every phone loses access
  if (path === '/family' && method === 'DELETE') {
    if (!isOwner) throw new Fail(403, 'owner only');
    await env.DB.batch([
      env.DB.prepare('UPDATE devices SET removed_at = ? WHERE group_id = ? AND removed_at IS NULL').bind(Date.now(), device.group_id),
      env.DB.prepare('DELETE FROM invites WHERE group_id = ?').bind(device.group_id),
      env.DB.prepare('DELETE FROM backups WHERE device_id IN (SELECT id FROM devices WHERE group_id = ?)').bind(device.group_id),
      env.DB.prepare('UPDATE shared_accounts SET removed_at = ?, updated_at = ? WHERE group_id = ? AND removed_at IS NULL').bind(
        Date.now(),
        Date.now(),
        device.group_id,
      ),
    ]);
    return json(req, { ok: true, ended: true });
  }

  // ---------- Family view ----------

  // the owner sets which phones may see a phone's money (null = everyone)
  const vw = /^\/devices\/([A-Za-z0-9_-]+)\/viewers$/.exec(path);
  if (vw && method === 'PUT') {
    if (!isOwner) throw new Fail(403, 'owner only');
    const b = await body(req);
    const alive = await liveDevices(env, device.group_id);
    if (!alive.has(vw[1])) throw new Fail(404, 'phone not found');
    const viewers = Array.isArray(b.viewers) ? [...new Set(b.viewers.filter((x): x is string => typeof x === 'string' && alive.has(x) && x !== vw[1]))] : null;
    await env.DB.prepare('UPDATE devices SET view_by = ? WHERE id = ?').bind(viewers ? JSON.stringify(viewers) : null, vw[1]).run();
    return family(req, env, device, owner);
  }

  // see another phone's whole money: its latest family backup, if the owner lets this phone see it
  const view = /^\/view\/([A-Za-z0-9_-]+)$/.exec(path);
  if (view && method === 'GET') {
    const t = await env.DB.prepare('SELECT * FROM devices WHERE id = ? AND group_id = ? AND removed_at IS NULL').bind(view[1], device.group_id).first<Device>();
    if (!t) throw new Fail(404, 'phone not found');
    if (!canView(t, device.id)) throw new Fail(403, 'not allowed');
    const { results } = await env.DB.prepare('SELECT data, updated_at FROM backups WHERE device_id = ? ORDER BY part').bind(t.id).all<{ data: string; updated_at: number }>();
    if (!results.length) throw new Fail(404, 'no backup');
    return json(req, { ok: true, name: t.name, parts: results.map((r) => r.data), updatedAt: results[0].updated_at });
  }

  // ---------- shared accounts ----------

  const acc = /^\/accounts\/([A-Za-z0-9_-]+)$/.exec(path);
  if (acc && method === 'PUT') {
    // share an account (or change it, or who sees it): only the phone it belongs to
    const b = await body(req);
    const existing = await env.DB.prepare('SELECT * FROM shared_accounts WHERE id = ?').bind(acc[1]).first<SharedAccount>();
    if (existing && (existing.group_id !== device.group_id || existing.owner_device !== device.id)) throw new Fail(403, 'not yours');
    const alive = await liveDevices(env, device.group_id);
    const members = Array.isArray(b.members) ? [...new Set(b.members.filter((m): m is string => typeof m === 'string' && alive.has(m) && m !== device.id))] : [];
    const data = JSON.stringify(b.data ?? {});
    if (data.length > 20000) throw new Fail(413, 'too big');
    const now = Date.now();
    if (existing)
      await env.DB.prepare('UPDATE shared_accounts SET members = ?, data = ?, updated_at = ?, removed_at = NULL WHERE id = ?')
        .bind(JSON.stringify(members), data, now, acc[1])
        .run();
    else
      await env.DB.prepare('INSERT INTO shared_accounts (id, group_id, owner_device, members, data, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(acc[1], device.group_id, device.id, JSON.stringify(members), data, now)
        .run();
    return json(req, { ok: true, updatedAt: now });
  }
  if (acc && method === 'DELETE') {
    const existing = await env.DB.prepare('SELECT * FROM shared_accounts WHERE id = ?').bind(acc[1]).first<SharedAccount>();
    if (!existing) return json(req, { ok: true });
    if (existing.owner_device !== device.id) throw new Fail(403, 'not yours');
    const now = Date.now();
    await env.DB.prepare('UPDATE shared_accounts SET removed_at = ?, updated_at = ? WHERE id = ?').bind(now, now, acc[1]).run();
    return json(req, { ok: true });
  }

  // send entries on shared accounts: new ones, changes and deletions (only your own)
  if (path === '/entries' && method === 'POST') {
    const b = await body(req);
    // a few at a time: a free Cloudflare request may run only about 50 database queries
    const list = (Array.isArray(b.entries) ? b.entries.slice(0, MAX_ENTRIES_PER_PUSH) : []) as {
      id?: unknown;
      accountIds?: unknown;
      data?: unknown;
      deleted?: unknown;
    }[];
    const visible = await visibleAccounts(env, device);
    const ids = new Set(visible.filter((a) => !a.removed_at).map((a) => a.id));
    const now = Date.now();
    const done: string[] = [];
    const refused: string[] = [];
    // who wrote the ones that exist already, in one query
    const askIds = list.map((e) => e.id).filter((x): x is string => typeof x === 'string');
    const authors = new Map<string, string>();
    if (askIds.length) {
      const { results } = await env.DB.prepare(`SELECT id, author_device FROM entries WHERE id IN (${askIds.map(() => '?').join(',')})`)
        .bind(...askIds)
        .all<{ id: string; author_device: string }>();
      for (const r of results) authors.set(r.id, r.author_device);
    }
    for (const e of list) {
      if (typeof e.id !== 'string') continue;
      const accs = Array.isArray(e.accountIds) ? e.accountIds.filter((x): x is string => typeof x === 'string' && ids.has(x)) : [];
      const prev = authors.has(e.id) ? { author_device: authors.get(e.id)! } : null;
      if (prev && prev.author_device !== device.id) {
        refused.push(e.id);
        continue;
      }
      // changing an entry needs the account still in view (taking it away is always allowed)
      if (prev && !e.deleted && !accs.length) {
        refused.push(e.id);
        continue;
      }
      if (!accs.length && !prev) {
        refused.push(e.id);
        continue;
      }
      const data = JSON.stringify(e.data ?? {});
      if (data.length > 20000) {
        refused.push(e.id);
        continue;
      }
      if (prev)
        await env.DB.prepare('UPDATE entries SET data = ?, deleted = ?, updated_at = ?, account_id = COALESCE(?, account_id) WHERE id = ?')
          .bind(data, e.deleted ? 1 : 0, now, accs[0] ?? null, e.id)
          .run();
      else
        await env.DB.prepare('INSERT INTO entries (id, account_id, author_device, data, updated_at, deleted) VALUES (?, ?, ?, ?, ?, ?)')
          .bind(e.id, accs[0], device.id, data, now, e.deleted ? 1 : 0)
          .run();
      // an entry between two shared accounts is found from either one (only its current accounts)
      if (!e.deleted) await env.DB.prepare('DELETE FROM entry_accounts WHERE entry_id = ?').bind(e.id).run();
      if (accs.length > 1)
        await env.DB.prepare('INSERT OR REPLACE INTO entry_accounts (entry_id, account_id) VALUES (?, ?)').bind(e.id, accs[1]).run();
      done.push(e.id);
    }
    return json(req, { ok: true, done, refused });
  }

  // what changed since the last time: shared accounts this phone can see, and their entries
  if (path === '/sync' && method === 'GET') {
    const now = Date.now();
    const since = Number(url.searchParams.get('since') ?? 0) || 0;
    const visible = await visibleAccounts(env, device);
    const live = visible.filter((a) => !a.removed_at);
    const names = await deviceNames(env, device.group_id);
    const accounts = live.map((a) => ({
      id: a.id,
      owner: a.owner_device,
      ownerName: names.get(a.owner_device) ?? 'A phone',
      members: JSON.parse(a.members) as string[],
      updatedAt: a.updated_at,
      data: a.updated_at > since ? JSON.parse(a.data) : undefined,
    }));
    // newly visible (or changed) accounts send all their entries; the others only what changed: two queries
    const fresh = live.filter((a) => a.updated_at > since).map((a) => a.id);
    const steady = live.filter((a) => a.updated_at <= since).map((a) => a.id);
    type Row = { id: string; author_device: string; data: string; updated_at: number; deleted: number };
    const inList = (n: number) => Array(n).fill('?').join(',');
    const rows = new Map<string, Row>();
    if (fresh.length) {
      const { results } = await env.DB.prepare(
        `SELECT * FROM entries WHERE account_id IN (${inList(fresh.length)}) OR id IN (SELECT entry_id FROM entry_accounts WHERE account_id IN (${inList(fresh.length)}))`,
      )
        .bind(...fresh, ...fresh)
        .all<Row>();
      for (const r of results) rows.set(r.id, r);
    }
    if (steady.length) {
      const { results } = await env.DB.prepare(
        `SELECT * FROM entries WHERE updated_at > ? AND (account_id IN (${inList(steady.length)}) OR id IN (SELECT entry_id FROM entry_accounts WHERE account_id IN (${inList(steady.length)})))`,
      )
        .bind(since, ...steady, ...steady)
        .all<Row>();
      for (const r of results) rows.set(r.id, r);
    }
    const entries = [...rows.values()].map((r) => ({
      id: r.id,
      author: r.author_device,
      authorName: names.get(r.author_device) ?? 'A phone',
      deleted: !!r.deleted,
      updatedAt: r.updated_at,
      data: r.deleted ? undefined : JSON.parse(r.data),
    }));
    return json(req, { ok: true, now, accounts, entries, me: device.id });
  }

  // ---------- family backup and lost phones ----------

  if (path === '/backup' && method === 'PUT') {
    const b = await body(req);
    const parts = Array.isArray(b.parts) ? b.parts.filter((x): x is string => typeof x === 'string') : [];
    if (!parts.length || parts.length > MAX_PARTS || parts.some((x) => x.length > MAX_PART)) throw new Fail(413, 'too big');
    const now = Date.now();
    const version = typeof b.appVersion === 'string' ? b.appVersion.slice(0, 20) : null;
    await env.DB.batch([
      env.DB.prepare('DELETE FROM backups WHERE device_id = ?').bind(device.id),
      ...parts.map((data, i) =>
        env.DB.prepare('INSERT INTO backups (device_id, part, parts, data, app_version, updated_at) VALUES (?, ?, ?, ?, ?, ?)').bind(
          device.id,
          i,
          parts.length,
          data,
          version,
          now,
        ),
      ),
    ]);
    return json(req, { ok: true, updatedAt: now });
  }
  if (path === '/backup' && method === 'GET') {
    const { results } = await env.DB.prepare('SELECT part, data, app_version, updated_at FROM backups WHERE device_id = ? ORDER BY part')
      .bind(device.id)
      .all<{ part: number; data: string; app_version: string | null; updated_at: number }>();
    if (!results.length) throw new Fail(404, 'no backup');
    return json(req, { ok: true, parts: results.map((r) => r.data), appVersion: results[0].app_version, updatedAt: results[0].updated_at });
  }
  if (path === '/backups' && method === 'GET') {
    const { results } = await env.DB.prepare(
      'SELECT b.device_id AS id, max(b.updated_at) AS at, sum(length(b.data)) AS size FROM backups b JOIN devices d ON d.id = b.device_id WHERE d.group_id = ? AND d.removed_at IS NULL GROUP BY b.device_id',
    )
      .bind(device.group_id)
      .all<{ id: string; at: number; size: number }>();
    return json(req, { ok: true, backups: results });
  }
  if (path === '/recovery' && method === 'POST') {
    // another phone in the family vouches for the lost one
    const b = await body(req);
    const target = typeof b.deviceId === 'string' ? b.deviceId : '';
    if (target === device.id) throw new Fail(400, 'not this phone');
    const t = await env.DB.prepare('SELECT * FROM devices WHERE id = ? AND group_id = ? AND removed_at IS NULL').bind(target, device.group_id).first<Device>();
    if (!t) throw new Fail(404, 'phone not found');
    await env.DB.prepare('DELETE FROM recovery_codes WHERE device_id = ? AND used_at IS NULL').bind(target).run();
    const code = inviteCode();
    const expiresAt = Date.now() + RECOVERY_MINUTES * 60000;
    await env.DB.prepare('INSERT INTO recovery_codes (code, group_id, device_id, created_by, expires_at) VALUES (?, ?, ?, ?, ?)')
      .bind(code, device.group_id, target, device.id, expiresAt)
      .run();
    return json(req, { ok: true, code, expiresAt, name: t.name });
  }

  throw new Fail(404, 'not found');
}

interface SharedAccount {
  id: string;
  group_id: string;
  owner_device: string;
  members: string;
  data: string;
  updated_at: number;
  removed_at: number | null;
}

async function liveDevices(env: Env, groupId: string): Promise<Set<string>> {
  const { results } = await env.DB.prepare('SELECT id FROM devices WHERE group_id = ? AND removed_at IS NULL').bind(groupId).all<{ id: string }>();
  return new Set(results.map((r) => r.id));
}

async function deviceNames(env: Env, groupId: string): Promise<Map<string, string>> {
  const { results } = await env.DB.prepare('SELECT id, name FROM devices WHERE group_id = ?').bind(groupId).all<{ id: string; name: string }>();
  return new Map(results.map((r) => [r.id, r.name]));
}

/** Shared accounts this phone owns or is a member of (removed ones too, so phones drop them). */
async function visibleAccounts(env: Env, d: Device): Promise<SharedAccount[]> {
  const { results } = await env.DB.prepare('SELECT * FROM shared_accounts WHERE group_id = ?').bind(d.group_id).all<SharedAccount>();
  return results.filter((a) => a.owner_device === d.id || (JSON.parse(a.members) as string[]).includes(d.id));
}

/** A phone left or was removed: take it off every shared account; accounts it owned stop being shared. */
async function dropMember(env: Env, groupId: string, deviceId: string): Promise<void> {
  const { results } = await env.DB.prepare('SELECT * FROM shared_accounts WHERE group_id = ? AND removed_at IS NULL').bind(groupId).all<SharedAccount>();
  const now = Date.now();
  for (const a of results) {
    if (a.owner_device === deviceId) {
      await env.DB.prepare('UPDATE shared_accounts SET removed_at = ?, updated_at = ? WHERE id = ?').bind(now, now, a.id).run();
      continue;
    }
    const m = JSON.parse(a.members) as string[];
    if (m.includes(deviceId))
      await env.DB.prepare('UPDATE shared_accounts SET members = ?, updated_at = ? WHERE id = ?')
        .bind(JSON.stringify(m.filter((x) => x !== deviceId)), now, a.id)
        .run();
  }
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
