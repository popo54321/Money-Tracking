// Safety nets for the two actions that replace everything: a copy taken just before Restore or Erase (kept for
// 7 days, in its own small database so the action itself can't touch it; on Android also as a file), and a guard
// so an older app version never edits data a newer version wrote.
import Dexie, { type Table } from 'dexie';
import { db } from '../db/db';
import { buildBackup, restoreBackup, type BackupFile } from './backup';
import { APP_VERSION, isNative } from './platform';
import { compareVersions } from './version';

interface SafetyCopy {
  id: 'last';
  at: number;
  reason: 'restore' | 'erase' | 'currency';
  backup: BackupFile;
}

class SafetyDB extends Dexie {
  copies!: Table<SafetyCopy, string>;
  constructor() {
    super('money-tracking-safety');
    this.version(1).stores({ copies: 'id' });
  }
}
const safety = new SafetyDB();
const KEEP_MS = 7 * 24 * 60 * 60 * 1000;

/** Take a copy of everything before Restore or Erase. */
export async function saveSafetyCopy(reason: SafetyCopy['reason']): Promise<void> {
  const backup = await buildBackup();
  await safety.copies.put({ id: 'last', at: Date.now(), reason, backup });
  if (isNative()) {
    try {
      const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
      const d = new Date();
      const stamp = `${d.toISOString().slice(0, 10)}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
      await Filesystem.writeFile({
        path: `MoneyTracking/before-${reason}-${stamp}.json`,
        data: JSON.stringify(backup),
        directory: Directory.Documents,
        encoding: Encoding.UTF8,
        recursive: true,
      });
    } catch {
      // the copy inside the app is enough
    }
  }
}

/** The copy taken before the last Restore or Erase, while it is less than 7 days old. */
export async function lastSafetyCopy(): Promise<{ at: number; reason: SafetyCopy['reason'] } | null> {
  const c = await safety.copies.get('last');
  if (!c || Date.now() - c.at > KEEP_MS) return null;
  return { at: c.at, reason: c.reason };
}

/** Put everything back as it was before the last Restore or Erase. */
export async function undoWithSafetyCopy(): Promise<boolean> {
  const c = await safety.copies.get('last');
  if (!c) return false;
  await restoreBackup(c.backup);
  await markDataVersion();
  await safety.copies.delete('last');
  return true;
}

// ---------- newer data, older app ----------

const KEY = 'dataVersion';

/** 'newer' when the data on this phone was last written by a newer app version than this one. */
export function dataVerdict(stored: string | undefined, running: string): 'ok' | 'newer' {
  return stored && compareVersions(stored, running) > 0 ? 'newer' : 'ok';
}

export async function readDataVersion(): Promise<string | undefined> {
  return (await db.kv.get(KEY))?.value as string | undefined;
}

/** Remember the newest app version that has used this data (never lowers it). */
export async function markDataVersion(): Promise<void> {
  const stored = await readDataVersion();
  if (dataVerdict(stored, APP_VERSION) === 'ok' && stored !== APP_VERSION) await db.kv.put({ key: KEY, value: APP_VERSION });
}
