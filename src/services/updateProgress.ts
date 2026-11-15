// What the update is doing, for the on-screen progress: downloading (with how much is done), then switching over.
// The switch reloads the app; a note saved just before lets the restarted app say "Updated to …".

export interface UpdateProgress {
  phase: 'downloading' | 'applying';
  /** files or bytes done, of total (downloading) */
  done: number;
  total: number;
  version?: string;
}

let current: UpdateProgress | null = null;
const listeners = new Set<(p: UpdateProgress | null) => void>();

export function onUpdateProgress(fn: (p: UpdateProgress | null) => void): () => void {
  listeners.add(fn);
  fn(current);
  return () => listeners.delete(fn);
}

export function setUpdateProgress(p: UpdateProgress | null): void {
  current = p;
  listeners.forEach((fn) => fn(p));
}

const KEY = 'mt.updatedTo';
/** how long "Updating…" shows before the restart (none in tests) */
const pauseMs = import.meta.env.MODE === 'test' ? 0 : 900;

/** Show "Updating…" for a moment, note the version, then run the switch (which reloads the app). */
export async function switchOver(version: string | undefined, run: () => void | Promise<void>): Promise<void> {
  setUpdateProgress({ phase: 'applying', done: 1, total: 1, version });
  try {
    localStorage.setItem(KEY, version ?? 'new');
  } catch {
    // only for the "Updated" note
  }
  if (pauseMs > 0) await new Promise((r) => setTimeout(r, pauseMs));
  await run();
}

/** After a switch: the version just updated to (once), so the app can say so. */
export function takeUpdatedNote(): string | null {
  try {
    const v = localStorage.getItem(KEY);
    if (v) localStorage.removeItem(KEY);
    return v;
  } catch {
    return null;
  }
}
