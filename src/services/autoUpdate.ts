// Updates that install themselves, switched in at a quiet moment so nothing you are typing is lost.
// - Web app (iPhone): the service worker fetches the new offline files in the background (see updater.ts).
// - Android app: the newest app files are downloaded from the web app's site into the phone's storage and
//   the app switches to them. Same app, same storage, so all data stays. Only when the Android shell itself
//   changed (a new APK is needed) does Android's own installer have to be confirmed with one tap.
import { compareVersions } from './version';
import { APP_VERSION, isNative } from './platform';

// ---------- when is it safe to reload? ----------

let quietCheck: () => boolean = () => false;
let shownAt = Date.now();
let background = false;

/** The app tells us when nothing is open: a main tab, no sheet, no dialog. */
export function setQuietCheck(fn: () => boolean): void {
  quietCheck = fn;
}

/** Switch now if nothing is open and the app is in the background, or was opened in the last few seconds. */
export function canApplyNow(): boolean {
  if (!quietCheck()) return false;
  const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
  return background || hidden || Date.now() - shownAt < 15_000;
}

/** Android tells us when the app goes to the background or comes back (the page may not notice). */
export function appInBackground(isBackground: boolean): void {
  background = isBackground;
  if (!isBackground) shownAt = Date.now();
  appliers.forEach((fn) => fn());
}

const appliers = new Set<() => void>();

/** Register something to try again whenever a quiet moment may have come. */
export function onQuietMoment(fn: () => void): () => void {
  appliers.add(fn);
  return () => appliers.delete(fn);
}

let watching = false;
function watchVisibility() {
  if (watching || typeof document === 'undefined') return;
  watching = true;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') shownAt = Date.now();
    appliers.forEach((fn) => fn());
  });
}
watchVisibility();

// ---------- Android: new app files without reinstalling ----------

export interface WebManifest {
  version: string;
  build: string;
  minNative: string;
  files: { path: string; size: number }[];
}

export type NativeUpdateState = 'none' | 'downloading' | 'ready' | 'needsApk' | 'error';

const KEY_TRYING = 'autoUpdate.trying';
const KEY_TRIES = 'autoUpdate.tries';
const KEY_BAD = 'autoUpdate.bad';
const KEY_CHECKED = 'autoUpdate.checkedAt';
const ROOT = 'web';

function ls(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function lsSet(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // storage blocked: updates still work, just without the safety notes
  }
}
function badVersions(): string[] {
  try {
    return JSON.parse(ls(KEY_BAD) ?? '[]') as string[];
  } catch {
    return [];
  }
}

export function siteUrl(repo: string): string {
  const [owner, name] = repo.split('/');
  return `https://${owner.toLowerCase()}.github.io/${name}/`;
}

/** Should the files of `m` replace the running ones? */
export function shouldUse(m: WebManifest, running: string, nativeVersion: string, bad: string[]): NativeUpdateState {
  if (compareVersions(m.version, running) <= 0) return 'none';
  if (compareVersions(nativeVersion, m.minNative) < 0) return 'needsApk';
  if (bad.includes(m.build)) return 'none';
  return 'ready';
}

let state: NativeUpdateState = 'none';
let pending: { build: string; version: string } | null = null;
const stateListeners = new Set<(s: NativeUpdateState) => void>();
function setState(s: NativeUpdateState) {
  state = s;
  stateListeners.forEach((fn) => fn(s));
}
export function onNativeUpdateState(fn: (s: NativeUpdateState) => void): () => void {
  stateListeners.add(fn);
  fn(state);
  return () => stateListeners.delete(fn);
}

async function fetchManifest(repo: string): Promise<WebManifest> {
  const res = await fetch(`${siteUrl(repo)}version.json?t=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`site answered ${res.status}`);
  return (await res.json()) as WebManifest;
}

/**
 * Runs once at start-up, in whichever app files are running. Keeps files that started fine
 * (so they are used next time too), notes files that never started, and tidies old downloads.
 */
export async function confirmRunningFiles(): Promise<void> {
  if (!isNative()) return;
  const { WebView } = await import('@capacitor/core');
  const { Filesystem, Directory } = await import('@capacitor/filesystem');
  let trying: { build: string; version: string } | null = null;
  try {
    trying = JSON.parse(ls(KEY_TRYING) ?? 'null');
  } catch {
    trying = null;
  }
  if (trying && trying.version !== APP_VERSION) {
    // switched to new files but they never started: try once more, then leave them alone
    const tries = Number(ls(KEY_TRIES) ?? '0') + 1;
    lsSet(KEY_TRIES, String(tries));
    if (tries >= 2) {
      lsSet(KEY_BAD, JSON.stringify([...badVersions(), trying.build]));
      lsSet(KEY_TRYING, null);
      lsSet(KEY_TRIES, null);
    }
  } else if (trying) {
    lsSet(KEY_TRYING, null);
    lsSet(KEY_TRIES, null);
  }
  const { path } = await WebView.getServerBasePath();
  const runningDownloaded = path.includes(`/${ROOT}/`);
  if (runningDownloaded) await WebView.persistServerBasePath();
  try {
    const { files } = await Filesystem.readdir({ path: ROOT, directory: Directory.Data });
    for (const f of files) {
      // keep the files in use; when running the app's own files, keep only downloads that are newer
      const keep = runningDownloaded ? path.endsWith(`/${ROOT}/${f.name}`) : compareVersions(f.name, APP_VERSION) > 0;
      if (!keep) await Filesystem.rmdir({ path: `${ROOT}/${f.name}`, directory: Directory.Data, recursive: true });
    }
  } catch {
    // nothing downloaded yet
  }
}

/** Android: look for newer app files, download them in the background, and switch at a quiet moment. */
export async function checkNativeUpdate(repo: string, force = false): Promise<NativeUpdateState> {
  if (!isNative() || state === 'downloading') return state;
  if (pending) {
    tryApplyNative();
    return 'ready';
  }
  const last = Number(ls(KEY_CHECKED) ?? '0');
  if (!force && Date.now() - last < 30 * 60_000) return state;
  lsSet(KEY_CHECKED, String(Date.now()));
  try {
    const { App } = await import('@capacitor/app');
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const m = await fetchManifest(repo);
    const native = (await App.getInfo()).version;
    const verdict = shouldUse(m, APP_VERSION, native, badVersions());
    if (verdict !== 'ready') {
      setState(verdict);
      return verdict;
    }
    setState('downloading');
    const dir = `${ROOT}/${m.build}`;
    const site = siteUrl(repo);
    // Android's download ignores "recursive", so make every folder first (an existing folder is fine)
    const folders = new Set([dir, ...m.files.map((f) => `${dir}/${f.path}`.replace(/\/[^/]*$/, ''))]);
    for (const folder of [...folders].sort())
      await Filesystem.mkdir({ path: folder, directory: Directory.Data, recursive: true }).catch(() => undefined);
    for (const f of m.files) {
      const path = `${dir}/${f.path}`;
      const have = await Filesystem.stat({ path, directory: Directory.Data }).catch(() => null);
      if (have && have.size === f.size) continue;
      await Filesystem.downloadFile({ url: `${site}${f.path}?b=${m.build}`, path, directory: Directory.Data, recursive: true });
      const got = await Filesystem.stat({ path, directory: Directory.Data });
      if (got.size !== f.size) throw new Error(`${f.path} did not download fully`);
    }
    // the site may have moved on to an even newer version while we downloaded: start again next time
    if ((await fetchManifest(repo)).build !== m.build) throw new Error('the site changed during the download');
    pending = { build: m.build, version: m.version };
    setState('ready');
    tryApplyNative();
    return 'ready';
  } catch {
    setState('error');
    lsSet(KEY_CHECKED, null);
    return 'error';
  }
}

/** Switch to the downloaded files now if nothing is open; otherwise wait for the next quiet moment. */
export function tryApplyNative(now = false): void {
  if (!pending || (!now && !canApplyNow())) return;
  const next = pending;
  pending = null;
  void (async () => {
    const { WebView } = await import('@capacitor/core');
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const { uri } = await Filesystem.getUri({ path: `${ROOT}/${next.build}`, directory: Directory.Data });
    lsSet(KEY_TRYING, JSON.stringify(next));
    // reloads the app from the new files; the new files keep themselves once they start (confirmRunningFiles)
    await WebView.setServerBasePath({ path: decodeURIComponent(uri.replace(/^file:\/\//, '')) });
  })().catch(() => {
    pending = next;
  });
}

onQuietMoment(() => tryApplyNative());
