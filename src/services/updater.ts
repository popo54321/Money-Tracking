// Updates: the Android app downloads the newest APK from GitHub Releases and opens the installer;
// the web app (iPhone) checks for a newer version of its offline files and reloads.
import { APP_VERSION, isNative, openExternal } from './platform';

export interface ReleaseInfo {
  version: string;
  tag: string;
  name: string;
  notes: string;
  pageUrl: string;
  apkUrl?: string;
  apkName?: string;
  publishedAt?: string;
}

/** -1 if a < b, 0 if equal, 1 if a > b (compares x.y.z numerically). */
export function compareVersions(a: string, b: string): number {
  const pa = a
    .replace(/^v/, '')
    .split(/[.+-]/)
    .map((x) => parseInt(x, 10) || 0);
  const pb = b
    .replace(/^v/, '')
    .split(/[.+-]/)
    .map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length, 3); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d < 0 ? -1 : 1;
  }
  return 0;
}

export async function latestRelease(repo: string): Promise<ReleaseInfo> {
  const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
    headers: { Accept: 'application/vnd.github+json' },
  });
  if (res.status === 404) throw new Error('No release has been published yet.');
  if (!res.ok) throw new Error(`GitHub answered ${res.status}.`);
  const d = (await res.json()) as {
    tag_name: string;
    name?: string;
    body?: string;
    html_url: string;
    published_at?: string;
    assets?: { name: string; browser_download_url: string }[];
  };
  const apk = d.assets?.find((a) => a.name.toLowerCase().endsWith('.apk'));
  return {
    version: d.tag_name.replace(/^v/, ''),
    tag: d.tag_name,
    name: d.name || d.tag_name,
    notes: d.body ?? '',
    pageUrl: d.html_url,
    apkUrl: apk?.browser_download_url,
    apkName: apk?.name,
    publishedAt: d.published_at,
  };
}

export function isNewer(release: ReleaseInfo): boolean {
  return compareVersions(release.version, APP_VERSION) > 0;
}

/** Android: download the APK into the app's cache and hand it to Android's installer. */
export async function installApk(release: ReleaseInfo, onStatus?: (s: string) => void): Promise<void> {
  if (!isNative() || !release.apkUrl) {
    await openExternal(release.pageUrl);
    return;
  }
  const { Filesystem, Directory } = await import('@capacitor/filesystem');
  const { FileOpener } = await import('@capacitor-community/file-opener');
  onStatus?.('Downloading…');
  const path = `update-${release.version}.apk`;
  try {
    const res = await Filesystem.downloadFile({ url: release.apkUrl, path, directory: Directory.Cache });
    const filePath = res.path ?? (await Filesystem.getUri({ path, directory: Directory.Cache })).uri;
    onStatus?.('Opening installer…');
    await FileOpener.open({ filePath, contentType: 'application/vnd.android.package-archive' });
    onStatus?.('');
  } catch (e) {
    onStatus?.(`In-app install failed (${(e as Error).message}). Opening the download page instead.`);
    await openExternal(release.apkUrl);
  }
}

// ---------- web app (service worker) ----------

let waitingWorker: ServiceWorker | null = null;
const listeners = new Set<() => void>();

export function onWebUpdateReady(fn: () => void): () => void {
  listeners.add(fn);
  if (waitingWorker) fn();
  return () => listeners.delete(fn);
}

function announce(w: ServiceWorker) {
  waitingWorker = w;
  listeners.forEach((fn) => fn());
}

export async function registerServiceWorker(): Promise<void> {
  if (isNative() || !('serviceWorker' in navigator) || (location.protocol === 'http:' && location.hostname !== 'localhost'))
    return;
  if (import.meta.env.DEV) return;
  try {
    const hadController = !!navigator.serviceWorker.controller;
    const reg = await navigator.serviceWorker.register('./sw.js', { scope: './' });
    if (reg.waiting && navigator.serviceWorker.controller) announce(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      if (!w) return;
      w.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) announce(w);
      });
    });
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      // the very first install takes control without needing a reload
      if (reloading || !hadController) return;
      reloading = true;
      location.reload();
    });
    // look for a new version whenever the app is opened again
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg.update().catch(() => undefined);
    });
  } catch {
    // offline support is a bonus; the app still works online without it
  }
}

/** Web: check for a newer version now. Returns true when one is ready to apply. */
export async function checkWebUpdate(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) return false;
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return false;
  await reg.update();
  await new Promise((r) => setTimeout(r, 1500));
  if (reg.waiting) {
    announce(reg.waiting);
    return true;
  }
  return !!waitingWorker;
}

export function applyWebUpdate(): void {
  if (waitingWorker) waitingWorker.postMessage({ type: 'SKIP_WAITING' });
  else location.reload();
}
