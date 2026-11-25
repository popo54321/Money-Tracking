// Family sharing: talks to the sync service (sync/ in this repository, on Cloudflare).
// This phone's link (its id and secret) is kept only on this phone, never in backups.
import { db } from '../db/db';

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
}

/** Forget the "this phone was removed" note. */
export const clearRemovedNote = () => setLink(null);
