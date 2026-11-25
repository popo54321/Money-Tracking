// Family sharing: talks to the sync service (sync/ in this repository, on Cloudflare).
// This phone's link (its id and secret) is kept only on this phone, never in backups.
// sync, backups and recovery always work on this phone's own data, even while viewing another phone
import { mainDb as db } from '../db/db';
import type { Account, Tx } from '../domain/types';

export const SYNC_URL: string =
  (import.meta.env.VITE_SYNC_URL as string | undefined) || 'https://money-tracking-sync.r-artikhun.workers.dev';

const KEY = 'syncLink';

export interface SyncLink {
  groupId: string;
  deviceId: string;
  token: string;
  name: string;
  /** when this phone was told it was removed (or the family ended) */
  removedAt?: number;
}

export interface FamilyDevice {
  id: string;
  name: string;
  joinedAt: number;
  owner: boolean;
  me: boolean;
  /** when it last sent its family backup */
  backupAt?: number | null;
  /** this phone may see its money (Family view) */
  canView?: boolean;
  /** owner only: which phones may see its money (null = everyone) */
  viewers?: string[] | null;
}

export interface Family {
  groupId: string;
  deviceId: string;
  isOwner: boolean;
  devices: FamilyDevice[];
  max: number;
}

export async function getLink(): Promise<SyncLink | null> {
  const row = await db.kv.get(KEY);
  return (row?.value as SyncLink | undefined) ?? null;
}

async function setLink(link: SyncLink | null): Promise<void> {
  if (link) await db.kv.put({ key: KEY, value: link });
  else await db.kv.delete(KEY);
}

/** Plain-English reasons for what the service says. */
const MESSAGES: Record<string, string> = {
  'code not found': 'That code doesn’t work. Check it, or ask for a new one.',
  'code expired': 'That code has expired (they last 15 minutes). Ask for a new one.',
  'family full': 'The family already has 10 phones.',
  'owner only': 'Only the phone that started the family can do that.',
  'owner stays': 'The phone that started the family can’t be removed.',
  'name needed': 'Give this phone a name first.',
  removed: 'This phone was removed from the family.',
  'not linked': 'This phone isn’t linked any more.',
  'not yours': 'Only the phone that shares this account can change it.',
  'no backup': 'There is no family backup for this phone yet.',
  'phone not found': 'That phone isn’t in the family any more.',
  'too big': 'That is too big to send.',
  busy: 'The sharing service is busy. Try again in a while.',
  'not allowed': 'The family’s owner hasn’t let this phone see that one.',
};

export class SyncError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

async function call<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(SYNC_URL + path, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
  } catch {
    throw new SyncError('offline', 'Can’t reach the sharing service. Check the internet and try again.');
  }
  const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string } & T;
  if (!res.ok || body.ok === false) {
    const code = body.error ?? `http ${res.status}`;
    throw new SyncError(code, MESSAGES[code] ?? 'The sharing service had a problem. Try again in a minute.');
  }
  return body;
}

/** This phone was removed or the family ended: forget the link, remember why. */
async function lost(link: SyncLink): Promise<void> {
  await setLink({ ...link, token: '', removedAt: Date.now() });
  await forgetShared();
}

export async function startFamily(name: string): Promise<Family> {
  const r = await call<{ groupId: string; deviceId: string; token: string }>('/family', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
  await setLink({ groupId: r.groupId, deviceId: r.deviceId, token: r.token, name });
  return loadFamily();
}

export async function joinFamily(code: string, name: string): Promise<Family> {
  const r = await call<{ groupId: string; deviceId: string; token: string }>('/join', {
    method: 'POST',
    body: JSON.stringify({ code, name }),
  });
  await setLink({ groupId: r.groupId, deviceId: r.deviceId, token: r.token, name });
  return loadFamily();
}

async function authed<T>(path: string, init: RequestInit = {}): Promise<T> {
  const link = await getLink();
  if (!link?.token) throw new SyncError('not linked', MESSAGES['not linked']);
  try {
    return await call<T>(path, init, link.token);
  } catch (e) {
    if (e instanceof SyncError && (e.code === 'removed' || e.code === 'not linked')) await lost(link);
    throw e;
  }
}

export const loadFamily = () => authed<Family>('/family');

export const makeInvite = () => authed<{ code: string; expiresAt: number }>('/invites', { method: 'POST' });

export const removeDevice = (id: string) => authed<Family>(`/devices/${id}`, { method: 'DELETE' });

export async function renameDevice(name: string): Promise<Family> {
  const f = await authed<Family>('/name', { method: 'PUT', body: JSON.stringify({ name }) });
  const link = await getLink();
  if (link) await setLink({ ...link, name });
  return f;
}

/** Leave the family (a phone that joined) or end it for everyone (the phone that started it). */
export async function leaveFamily(isOwner: boolean): Promise<void> {
  const link = await getLink();
  if (!link?.token) return setLink(null);
  try {
    if (isOwner) await call('/family', { method: 'DELETE' }, link.token);
    else await call(`/devices/${link.deviceId}`, { method: 'DELETE' }, link.token);
  } catch (e) {
    if (!(e instanceof SyncError && (e.code === 'removed' || e.code === 'not linked'))) throw e;
  }
  await setLink(null);
  await forgetShared();
}

/** Forget the "this phone was removed" note. */
export const clearRemovedNote = () => setLink(null);

// ---------- sharing accounts ----------

interface SyncState {
  /** server time of the last pull (a little overlap is kept) */
  since: number;
  /** my entries already sent: id → its updatedAt then */
  pushed: Record<string, number>;
  /** accounts I share: id → what was last sent */
  accounts: Record<string, string>;
  lastSyncAt?: number;
  lastBackupAt?: number;
  /** the last time a backup was tried (a failed one waits too) */
  lastBackupTry?: number;
  lastError?: string;
}

const STATE = 'syncState';
const PUSH_BATCH = 10;
const emptyState = (): SyncState => ({ since: 0, pushed: {}, accounts: {} });

async function getState(): Promise<SyncState> {
  const row = await db.kv.get(STATE);
  return { ...emptyState(), ...((row?.value as SyncState | undefined) ?? {}) };
}
async function putState(s: SyncState): Promise<void> {
  await db.kv.put({ key: STATE, value: s });
}

/** What other phones get of an account: what it is, not how this phone organises it. */
function sendable(a: Account) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  // what was put in, and whether it is an investment, go too: it shows on the others' Investments page
  const { profileId, order, payFromAccountId, splits, shared, ...rest } = a;
  return rest;
}

/** Share an account of this phone with chosen phones (none = stop sharing). */
export async function shareAccount(account: Account, members: string[]): Promise<void> {
  const link = await getLink();
  if (!link?.token) throw new SyncError('not linked', MESSAGES['not linked']);
  if (!members.length) return stopSharing(account.id);
  await authed(`/accounts/${account.id}`, { method: 'PUT', body: JSON.stringify({ data: sendable(account), members }) });
  await db.accounts.update(account.id, { shared: { mine: true, ownerDevice: link.deviceId, ownerName: link.name, members } });
  const st = await getState();
  st.accounts[account.id] = JSON.stringify([sendable({ ...account }), members]);
  await putState(st);
  void syncNow();
}

export async function stopSharing(accountId: string): Promise<void> {
  await authed(`/accounts/${accountId}`, { method: 'DELETE' });
  await db.accounts.update(accountId, { shared: undefined });
  const st = await getState();
  delete st.accounts[accountId];
  for (const t of await db.txs.filter((x) => x.accountId === accountId || x.toAccountId === accountId).toArray())
    delete st.pushed[t.id];
  await putState(st);
}

interface PullAccount {
  id: string;
  owner: string;
  ownerName: string;
  members: string[];
  updatedAt: number;
  data?: Partial<Account>;
}
interface PullEntry {
  id: string;
  author: string;
  authorName: string;
  deleted: boolean;
  updatedAt: number;
  data?: Tx;
}

let running: Promise<void> | null = null;
/** writing what came from the service: those changes don't need sending back */
let applying = false;
let again = false;

/** Send this phone's changes on shared accounts and fetch everyone else's. Safe to call often. */
export function syncNow(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    try {
      do {
        again = false;
        await syncOnce();
      } while (again);
    } finally {
      running = null;
    }
  })();
  return running;
}

async function syncOnce(): Promise<void> {
  const link = await getLink();
  if (!link?.token) return;
  const st = await getState();
  try {
    await pushAccounts(link, st);
    await pushEntries(st);
    await pull(link, st);
    st.lastSyncAt = Date.now();
    st.lastError = undefined;
    await putState(st);
    await maybeFamilyBackup(st);
  } catch (e) {
    if (e instanceof SyncError && (e.code === 'removed' || e.code === 'not linked')) {
      await forgetShared();
      return;
    }
    st.lastError = e instanceof Error ? e.message : String(e);
    await putState(st);
  }
}

async function pushAccounts(link: SyncLink, st: SyncState): Promise<void> {
  const mine = (await db.accounts.toArray()).filter((a) => a.shared?.mine);
  for (const a of mine) {
    // removed or archived here: stop sharing it
    if (a.removed) {
      await stopSharing(a.id).catch(() => undefined);
      continue;
    }
    const sig = JSON.stringify([sendable(a), a.shared!.members]);
    if (st.accounts[a.id] === sig) continue;
    await authed(`/accounts/${a.id}`, { method: 'PUT', body: JSON.stringify({ data: sendable(a), members: a.shared!.members }) });
    st.accounts[a.id] = sig;
  }
  // deleted here altogether
  const ids = new Set(mine.map((a) => a.id));
  for (const id of Object.keys(st.accounts))
    if (!ids.has(id)) {
      await authed(`/accounts/${id}`, { method: 'DELETE' }).catch(() => undefined);
      delete st.accounts[id];
    }
  void link;
}

async function pushEntries(st: SyncState): Promise<void> {
  const accounts = await db.accounts.toArray();
  const shared = new Set(accounts.filter((a) => a.shared && !a.removed).map((a) => a.id));
  if (!shared.size && !Object.keys(st.pushed).length) return;
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const cats = new Map((await db.categories.toArray()).map((c) => [c.id, c.name]));
  const txs = await db.txs.toArray();
  const out: { id: string; accountIds: string[]; data?: Tx; deleted?: boolean }[] = [];
  const seen = new Set<string>();
  for (const t of txs) {
    if (t.remoteAuthor) continue;
    const accIds = [t.accountId, t.toAccountId].filter((x): x is string => !!x && shared.has(x));
    seen.add(t.id);
    if (!accIds.length) {
      // no longer on a shared account (moved to another account): take it off the others' phones
      if (st.pushed[t.id] !== undefined) out.push({ id: t.id, accountIds: [], deleted: true });
      continue;
    }
    if (st.pushed[t.id] === t.updatedAt) continue;
    const names: Record<string, string> = {};
    for (const id of [t.accountId, t.toAccountId]) if (id && byId.get(id)) names[id] = byId.get(id)!.name;
    out.push({
      id: t.id,
      accountIds: [...new Set(accIds)],
      data: { ...t, remoteNames: names, categoryName: t.categoryId ? cats.get(t.categoryId) : undefined },
    });
  }
  // deleted here
  for (const id of Object.keys(st.pushed)) if (!seen.has(id)) out.push({ id, accountIds: [], deleted: true });
  // small batches: a free Cloudflare request may run only about 50 database queries
  for (let i = 0; i < out.length; i += PUSH_BATCH) {
    const part = out.slice(i, i + PUSH_BATCH);
    const r = await authed<{ done: string[]; refused: string[] }>('/entries', {
      method: 'POST',
      body: JSON.stringify({ entries: part }),
    });
    for (const e of part) {
      if (!r.done.includes(e.id) && !r.refused.includes(e.id)) continue;
      if (e.deleted) delete st.pushed[e.id];
      else st.pushed[e.id] = e.data!.updatedAt;
    }
  }
}

async function pull(link: SyncLink, st: SyncState): Promise<void> {
  const r = await authed<{ now: number; accounts: PullAccount[]; entries: PullEntry[]; me: string }>(`/sync?since=${st.since}`);
  // accounts shared with this phone go to its first user
  const profile = (await db.profiles.toArray()).sort((x, y) => x.order - y.order)[0];
  const visible = new Set(r.accounts.map((a) => a.id));
  const local = await db.accounts.toArray();
  applying = true;
  try {
    await db.transaction('rw', [db.accounts, db.txs], async () => {
      for (const a of r.accounts) {
        const here = local.find((x) => x.id === a.id);
        if (a.owner === r.me) {
          // mine: keep who it is shared with in step (a lost phone put back, or members changed elsewhere)
          if (here && !here.shared)
            await db.accounts.update(a.id, {
              shared: { mine: true, ownerDevice: r.me, ownerName: link.name, members: a.members },
            });
          continue;
        }
        const shared = { mine: false, ownerDevice: a.owner, ownerName: a.ownerName, members: a.members };
        if (a.data)
          await db.accounts.put({
            ...(a.data as Account),
            // what this phone keeps about it (its splits, paying account) stays
            splits: here?.splits,
            payFromAccountId: here?.payFromAccountId,
            id: a.id,
            profileId: here?.profileId ?? profile?.id ?? '',
            order: here?.order ?? 900 + local.length,
            includeInNetWorth: (a.data as Account).includeInNetWorth ?? true,
            shared,
          });
        else if (here) await db.accounts.update(a.id, { shared });
      }
      // no longer shared with this phone: it goes, with the others' entries on it
      for (const a of local)
        if (a.shared && !a.shared.mine && !visible.has(a.id)) {
          await db.accounts.delete(a.id);
          await db.txs.filter((t) => !!t.remoteAuthor && (t.accountId === a.id || t.toAccountId === a.id)).delete();
          // my entries on it stay on the others' phones: don't send them as deleted
          const mineOnIt = await db.txs
            .filter((t) => !t.remoteAuthor && (t.accountId === a.id || t.toAccountId === a.id))
            .toArray();
          for (const t of mineOnIt) delete st.pushed[t.id];
        } else if (a.shared?.mine && !visible.has(a.id)) {
          await db.accounts.update(a.id, { shared: undefined });
          delete st.accounts[a.id];
        }
      for (const e of r.entries) {
        const here = await db.txs.get(e.id);
        if (e.author === r.me) {
          // my own entries (coming back after a lost phone is put back)
          if (e.deleted || !e.data) continue;
          if (!here || here.updatedAt < e.data.updatedAt) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { remoteNames, categoryName, remoteAuthor, ...own } = e.data;
            await db.txs.put(own);
            st.pushed[e.id] = own.updatedAt;
          }
          continue;
        }
        if (e.deleted || !e.data) {
          if (here?.remoteAuthor) await db.txs.delete(e.id);
          continue;
        }
        // it belongs to whichever user on this phone has the account it is on
        const owner = local.find((x) => x.id === e.data!.accountId || x.id === e.data!.toAccountId);
        const profileId = owner?.profileId ?? profile?.id ?? e.data.profileId;
        await db.txs.put({ ...e.data, profileId, remoteAuthor: { id: e.author, name: e.authorName } });
      }
    });
  } finally {
    applying = false;
  }
  st.since = Math.max(0, r.now - 5000);
}

/** This phone was removed (or the family ended): shared accounts from others and their entries go. */
async function forgetShared(): Promise<void> {
  await db.transaction('rw', [db.accounts, db.txs, db.kv], async () => {
    const accs = await db.accounts.toArray();
    for (const a of accs) {
      if (!a.shared) continue;
      if (a.shared.mine) await db.accounts.update(a.id, { shared: undefined });
      else await db.accounts.delete(a.id);
    }
    await db.txs.filter((t) => !!t.remoteAuthor).delete();
    await db.kv.delete(STATE);
  });
}

export async function syncStatus(): Promise<{ lastSyncAt?: number; lastBackupAt?: number; lastError?: string }> {
  const st = await getState();
  return { lastSyncAt: st.lastSyncAt, lastBackupAt: st.lastBackupAt, lastError: st.lastError };
}

let started = false;
let timer: ReturnType<typeof setTimeout> | undefined;
/** Sync soon (after a change), at most once every few seconds. */
export function syncSoon(ms = 2500): void {
  clearTimeout(timer);
  timer = setTimeout(() => void syncNow(), ms);
}

/** Keep shared accounts in step while the app is open: on start, every 30 seconds, and soon after any change. */
export function startAutoSync(): void {
  if (started) return;
  started = true;
  const tick = () => {
    if (typeof document === 'undefined' || document.visibilityState === 'visible') void syncNow();
  };
  setInterval(tick, 30000);
  document.addEventListener('visibilitychange', tick);
  window.addEventListener('online', tick);
  // any change to entries or accounts here
  const soon = () => {
    changedSinceBackup = true;
    if (!applying) syncSoon();
  };
  db.txs.hook('creating', soon);
  db.txs.hook('updating', soon);
  db.txs.hook('deleting', soon);
  db.accounts.hook('updating', soon);
  db.accounts.hook('deleting', soon);
  // other changes only need the family backup to follow
  const changed = () => {
    changedSinceBackup = true;
  };
  for (const t of [db.accounts, db.categories, db.recurring, db.budgets, db.goals, db.debts, db.bills, db.trips, db.profiles]) {
    t.hook('creating', changed);
    t.hook('updating', changed);
    t.hook('deleting', changed);
  }
  tick();
}

// ---------- family backup and lost phones ----------

const BACKUP_EVERY = 6 * 60 * 60 * 1000;
/** after a change, the family's copy (and Family view) follows within a few minutes */
const BACKUP_AFTER_CHANGE = 3 * 60 * 1000;
let changedSinceBackup = true;
const PART = 1_000_000;

async function toBase64(bytes: Uint8Array): Promise<string> {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
function fromBase64(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}
async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

/** Everything on this phone, squeezed ("g": gzip, "p": plain), in parts the service can keep. */
export async function packBackup(json: string): Promise<string[]> {
  const raw = new TextEncoder().encode(json);
  const packed =
    typeof CompressionStream !== 'undefined'
      ? 'g' + (await toBase64(await pipe(raw, new CompressionStream('gzip'))))
      : 'p' + (await toBase64(raw));
  const parts: string[] = [];
  for (let i = 0; i < packed.length; i += PART) parts.push(packed.slice(i, i + PART));
  return parts;
}

export async function unpackBackup(parts: string[]): Promise<string> {
  const packed = parts.join('');
  const bytes = fromBase64(packed.slice(1));
  const raw = packed[0] === 'g' ? await pipe(bytes, new DecompressionStream('gzip')) : bytes;
  return new TextDecoder().decode(raw);
}

export async function familyBackupNow(): Promise<number> {
  const { buildBackup } = await import('./backup');
  const { APP_VERSION } = await import('./platform');
  const parts = await packBackup(JSON.stringify(await buildBackup(db)));
  const r = await authed<{ updatedAt: number }>('/backup', {
    method: 'PUT',
    body: JSON.stringify({ parts, appVersion: APP_VERSION }),
  });
  const st = await getState();
  st.lastBackupAt = r.updatedAt;
  await putState(st);
  return r.updatedAt;
}

async function maybeFamilyBackup(st: SyncState): Promise<void> {
  const since = Date.now() - (st.lastBackupTry ?? 0);
  if (since < (changedSinceBackup ? BACKUP_AFTER_CHANGE : BACKUP_EVERY)) return;
  st.lastBackupTry = Date.now();
  await putState(st);
  changedSinceBackup = false;
  await familyBackupNow().catch(() => {
    changedSinceBackup = true;
  });
}

export const familyBackups = () => authed<{ backups: { id: string; at: number; size: number }[] }>('/backups');

/** On a phone in the family: a code that puts a lost phone's place onto a new phone. */
export const makeRecoveryCode = (deviceId: string) =>
  authed<{ code: string; expiresAt: number; name: string }>('/recovery', { method: 'POST', body: JSON.stringify({ deviceId }) });

/**
 * On the new phone: take the lost phone's place with the code, then bring back its data from the family backup.
 * The lost phone loses access. Returns when its backup was made (null: none, only shared accounts come back).
 */
export async function recoverPhone(code: string): Promise<number | null> {
  const r = await call<{ groupId: string; deviceId: string; token: string; name: string; backupAt: number | null }>('/recover', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
  await setLink({ groupId: r.groupId, deviceId: r.deviceId, token: r.token, name: r.name });
  if (r.backupAt) {
    const b = await authed<{ parts: string[] }>('/backup');
    const { parseBackup, restoreBackup } = await import('./backup');
    await restoreBackup(parseBackup(await unpackBackup(b.parts)), db);
  }
  await syncNow();
  return r.backupAt;
}

// ---------- Family view ----------

/** Open another phone's whole money, read-only (from its latest family backup). */
export async function viewPhone(deviceId: string): Promise<void> {
  const r = await authed<{ name: string; parts: string[]; updatedAt: number }>(`/view/${deviceId}`);
  const { parseBackup } = await import('./backup');
  const b = parseBackup(await unpackBackup(r.parts));
  const { openView } = await import('../db/db');
  await openView({ deviceId, name: r.name, updatedAt: r.updatedAt }, b.data);
}

/** The family's owner: which phones may see `deviceId`'s money (null = everyone). */
export const setViewers = (deviceId: string, viewers: string[] | null) =>
  authed<Family>(`/devices/${deviceId}/viewers`, { method: 'PUT', body: JSON.stringify({ viewers }) });
