// The Android update steps, with the phone's storage, the app info and the app switcher replaced by fakes.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fake = vi.hoisted(() => {
  const files = new Map<string, number>(); // path → size
  const dirs = new Set<string>();
  const calls: string[] = [];
  const state = { basePath: 'public', persisted: '', nativeVersion: '1.3.0', appVersion: '1.3.0' };
  return { files, dirs, calls, state };
});

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => true },
  WebView: {
    getServerBasePath: async () => ({ path: fake.state.basePath }),
    setServerBasePath: async ({ path }: { path: string }) => {
      fake.calls.push(`switch ${path}`);
      fake.state.basePath = path;
    },
    persistServerBasePath: async () => {
      fake.state.persisted = fake.state.basePath;
    },
    setServerAssetPath: async ({ path }: { path: string }) => {
      fake.calls.push(`assets ${path}`);
      fake.state.basePath = path;
    },
  },
}));
// the version of the app files that are running (it changes when the app switches to new files)
vi.mock('./platform', () => ({
  isNative: () => true,
  get APP_VERSION() {
    return fake.state.appVersion;
  },
}));
vi.mock('@capacitor/app', () => ({ App: { getInfo: async () => ({ version: fake.state.nativeVersion }) } }));
vi.mock('@capacitor/filesystem', () => {
  const parent = (p: string) => p.replace(/\/[^/]*$/, '');
  return {
    Directory: { Data: 'DATA' },
    Filesystem: {
      mkdir: async ({ path }: { path: string }) => {
        fake.dirs.add(path);
      },
      stat: async ({ path }: { path: string }) => {
        if (!fake.files.has(path)) throw new Error('missing');
        return { size: fake.files.get(path)! };
      },
      downloadFile: async ({ url, path }: { url: string; path: string }) => {
        // like Android: fails when the folder is missing
        if (!fake.dirs.has(parent(path))) throw new Error(`no folder for ${path}`);
        fake.calls.push(`get ${url.split('?')[0]}`);
        fake.files.set(path, Number(new URL(url).searchParams.get('size') ?? sizes[path.split('/').slice(2).join('/')]));
        return { path };
      },
      // like Android (java.io.File.toURI): an existing folder comes back with a slash at the end
      getUri: async ({ path }: { path: string }) => ({
        uri: `file:///data/user/0/app/files/${path}${fake.dirs.has(path) ? '/' : ''}`,
      }),
      readdir: async ({ path }: { path: string }) => ({
        files: [...fake.dirs].filter((d) => parent(d) === path).map((d) => ({ name: d.split('/').pop()! })),
      }),
      rmdir: async ({ path }: { path: string }) => {
        for (const d of [...fake.dirs]) if (d === path || d.startsWith(`${path}/`)) fake.dirs.delete(d);
        for (const f of [...fake.files.keys()]) if (f.startsWith(`${path}/`)) fake.files.delete(f);
        fake.calls.push(`remove ${path}`);
      },
    },
  };
});

const sizes: Record<string, number> = { 'index.html': 900, 'assets/index-abc.js': 50_000, 'icons/icon-192.png': 4000 };
const manifest = (version: string, minNative = '1.3.0') => ({
  version,
  build: `${version}-abc`,
  minNative,
  files: Object.entries(sizes).map(([path, size]) => ({ path, size })),
});
let served = manifest('1.4.0');

const store = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
} as Storage;
globalThis.fetch = (async () => ({ ok: true, json: async () => served })) as unknown as typeof fetch;

const load = async () => {
  vi.resetModules();
  const m = await import('./autoUpdate');
  m.setQuietCheck(() => true);
  return m;
};

describe('Android: new app files without reinstalling', () => {
  beforeEach(() => {
    fake.files.clear();
    fake.dirs.clear();
    fake.calls.length = 0;
    Object.assign(fake.state, { basePath: 'public', persisted: '', nativeVersion: '1.3.0', appVersion: '1.3.0' });
    store.clear();
    served = manifest('1.4.0');
  });

  it('downloads every file into its own folder, then switches to them', async () => {
    const u = await load();
    expect(await u.checkNativeUpdate('popo54321/Money-Tracking', true)).toBe('ready');
    await new Promise((r) => setTimeout(r, 0));
    expect(fake.calls.filter((c) => c.startsWith('get'))).toHaveLength(3);
    expect(fake.calls).toContain('get https://popo54321.github.io/Money-Tracking/assets/index-abc.js');
    expect(fake.state.basePath).toBe('/data/user/0/app/files/web/1.4.0-abc');
    expect(JSON.parse(store.get('autoUpdate.trying')!)).toEqual({ build: '1.4.0-abc', version: '1.4.0' });
  });

  it('waits while something is open, and switches at the next quiet moment', async () => {
    const u = await load();
    let quiet = false;
    u.setQuietCheck(() => quiet);
    await u.checkNativeUpdate('popo54321/Money-Tracking', true);
    await new Promise((r) => setTimeout(r, 0));
    expect(fake.state.basePath).toBe('public');
    quiet = true;
    u.appInBackground(true);
    await new Promise((r) => setTimeout(r, 0));
    expect(fake.state.basePath).toContain('/web/1.4.0-abc');
  });

  it('asks for the APK when the Android app itself is too old', async () => {
    served = manifest('1.5.0', '1.5.0');
    const u = await load();
    expect(await u.checkNativeUpdate('popo54321/Money-Tracking', true)).toBe('needsApk');
    expect(fake.calls).toEqual([]);
  });

  it('new files that started keep themselves and old downloads are tidied', async () => {
    fake.dirs.add('web/1.2.0-old');
    fake.dirs.add('web/1.4.0-abc');
    fake.state.basePath = '/data/user/0/app/files/web/1.4.0-abc';
    fake.state.appVersion = '1.4.0';
    store.set('autoUpdate.trying', JSON.stringify({ build: '1.4.0-abc', version: '1.4.0' }));
    const u = await load();
    await u.confirmRunningFiles();
    expect(fake.state.persisted).toBe('/data/user/0/app/files/web/1.4.0-abc');
    expect(fake.calls).toContain('remove web/1.2.0-old');
    expect(fake.dirs.has('web/1.4.0-abc')).toBe(true);
    expect(store.has('autoUpdate.trying')).toBe(false);
  });

  it('files that never start are given up after two tries', async () => {
    store.set('autoUpdate.trying', JSON.stringify({ build: '1.4.0-abc', version: '1.4.0' }));
    let u = await load();
    await u.confirmRunningFiles();
    expect(store.get('autoUpdate.bad')).toBeUndefined();
    u = await load();
    await u.confirmRunningFiles();
    expect(JSON.parse(store.get('autoUpdate.bad')!)).toEqual(['1.4.0-abc']);
    expect(await u.checkNativeUpdate('popo54321/Money-Tracking', true)).toBe('none');
  });

  it('after switching, the new files keep their own folder (Android reports it with a slash at the end)', async () => {
    let u = await load();
    await u.checkNativeUpdate('popo54321/Money-Tracking', true);
    await new Promise((r) => setTimeout(r, 0));
    expect(fake.state.basePath).toBe('/data/user/0/app/files/web/1.4.0-abc');
    // what Android itself would report for a folder, if it kept the slash
    fake.state.basePath = '/data/user/0/app/files/web/1.4.0-abc/';
    fake.state.appVersion = '1.4.0';
    fake.dirs.add('web/1.3.0-old');
    u = await load();
    await u.confirmRunningFiles();
    expect(fake.dirs.has('web/1.4.0-abc')).toBe(true);
    expect(fake.files.has('web/1.4.0-abc/assets/index-abc.js')).toBe(true);
    expect(fake.calls).not.toContain('remove web/1.4.0-abc');
    expect(fake.calls).toContain('remove web/1.3.0-old');
  });

  it('a missing screen file: go back to the built-in files, forget the broken copy, and do not loop', async () => {
    fake.dirs.add('web/1.5.0-bad');
    fake.state.basePath = '/data/user/0/app/files/web/1.5.0-bad';
    const u = await load();
    expect(
      u.isMissingFileError(new TypeError('Failed to fetch dynamically imported module: https://localhost/assets/Settings-x.js')),
    ).toBe(true);
    expect(await u.repairMissingFiles()).toBe(true);
    expect(fake.calls).toContain('assets public');
    expect(fake.dirs.has('web/1.5.0-bad')).toBe(false);
    expect(JSON.parse(store.get('autoUpdate.bad')!)).toContain('1.5.0-bad');
    // a second failure straight away shows the error instead of repairing again
    expect(await u.repairMissingFiles()).toBe(false);
  });
});
