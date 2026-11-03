// Full backup and restore of every table, as one JSON file.
import { db, TABLES, type TableName } from '../db/db';
import { getSettings, updateSettings } from '../db/repo';
import { todayISO } from '../domain/dates';
import { APP_VERSION, isNative, shareFile } from './platform';

export interface BackupFile {
  app: 'money-tracking';
  format: 1;
  appVersion: string;
  exportedAt: string;
  data: Partial<Record<TableName, unknown[]>>;
}

export async function buildBackup(): Promise<BackupFile> {
  const data: BackupFile['data'] = {};
  for (const t of TABLES) data[t] = await db.table(t).toArray();
  return { app: 'money-tracking', format: 1, appVersion: APP_VERSION, exportedAt: new Date().toISOString(), data };
}

export function backupFileName(prefix = 'money-tracking-backup'): string {
  const d = new Date();
  const time = `${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
  return `${prefix}-${todayISO()}-${time}.json`;
}

export async function shareBackup(): Promise<string> {
  const b = await buildBackup();
  const res = await shareFile(backupFileName(), JSON.stringify(b), 'application/json');
  if (res !== 'cancelled') await updateSettings({ lastBackupAt: Date.now() });
  return res;
}

export function parseBackup(text: string): BackupFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('This file is not a backup (it is not valid JSON).');
  }
  const b = parsed as Partial<BackupFile>;
  if (!b || b.app !== 'money-tracking' || typeof b.data !== 'object' || !b.data) {
    throw new Error('This file is not a Money Tracking backup.');
  }
  if (b.format !== 1) throw new Error(`This backup's format (${String(b.format)}) is newer than this app. Update the app first.`);
  for (const [k, v] of Object.entries(b.data)) {
    if (!(TABLES as readonly string[]).includes(k)) throw new Error(`Unknown section "${k}" in backup.`);
    if (!Array.isArray(v)) throw new Error(`Section "${k}" in backup is damaged.`);
  }
  if (!Array.isArray(b.data.profiles) || b.data.profiles.length === 0) throw new Error('The backup has no profiles.');
  return b as BackupFile;
}

export function backupStats(b: BackupFile): { accounts: number; entries: number; exportedAt: string } {
  return {
    accounts: b.data.accounts?.length ?? 0,
    entries: b.data.txs?.length ?? 0,
    exportedAt: b.exportedAt,
  };
}

/** Replace everything on this phone with the backup. */
export async function restoreBackup(b: BackupFile): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    for (const t of TABLES) {
      await db.table(t).clear();
      const rows = b.data[t];
      if (rows && rows.length) await db.table(t).bulkPut(rows);
    }
  });
  await updateSettings({ lastBackupAt: Date.now() });
}

const AUTO_DIR = 'MoneyTracking';
const KEEP = 7;

/**
 * Android only: once a day, save a copy to Documents/MoneyTracking (keeps the last 7).
 * These files stay on the phone even if the app is removed.
 */
export async function autoBackupIfDue(): Promise<string | null> {
  if (!isNative()) return null;
  const s = await getSettings();
  if (s.lastAutoBackupAt && Date.now() - s.lastAutoBackupAt < 20 * 60 * 60 * 1000) return null;
  const txCount = await db.txs.count();
  if (txCount === 0) return null;
  const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
  const b = await buildBackup();
  const name = `auto-backup-${todayISO()}.json`;
  let dir = Directory.Documents;
  try {
    await Filesystem.writeFile({
      path: `${AUTO_DIR}/${name}`,
      data: JSON.stringify(b),
      directory: dir,
      encoding: Encoding.UTF8,
      recursive: true,
    });
  } catch {
    dir = Directory.External;
    await Filesystem.writeFile({
      path: `${AUTO_DIR}/${name}`,
      data: JSON.stringify(b),
      directory: dir,
      encoding: Encoding.UTF8,
      recursive: true,
    });
  }
  try {
    const list = await Filesystem.readdir({ path: AUTO_DIR, directory: dir });
    const old = list.files
      .map((f) => f.name)
      .filter((n) => n.startsWith('auto-backup-'))
      .sort()
      .slice(0, -KEEP);
    for (const n of old) await Filesystem.deleteFile({ path: `${AUTO_DIR}/${n}`, directory: dir });
  } catch {
    // keeping old copies is harmless
  }
  await updateSettings({ lastAutoBackupAt: Date.now() });
  return dir === Directory.Documents ? `Documents/${AUTO_DIR}/${name}` : `Android/data/…/files/${AUTO_DIR}/${name}`;
}
