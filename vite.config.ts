import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
  /** minNativeVersion: the oldest Android app (APK) these files run in. Raise it when android/ or a Capacitor plugin changes. */
  config: { minNativeVersion: string };
};

/** Writes dist/sw.js: a service worker that keeps every app file for offline use (web app / iPhone). */
function offlineServiceWorker(): Plugin {
  let outDir = 'dist';
  return {
    name: 'offline-service-worker',
    apply: 'build',
    configResolved(c) {
      outDir = c.build.outDir;
    },
    closeBundle() {
      const files: string[] = [];
      const walk = (dir: string) => {
        for (const name of readdirSync(dir)) {
          const p = join(dir, name);
          if (statSync(p).isDirectory()) walk(p);
          else files.push(relative(outDir, p).split('\\').join('/'));
        }
      };
      walk(outDir);
      const list = files.filter((f) => f !== 'sw.js' && !f.endsWith('.map')).sort();
      const hash = createHash('sha256');
      for (const f of list) hash.update(f).update(readFileSync(join(outDir, f)));
      const version = `${pkg.version}-${hash.digest('hex').slice(0, 10)}`;
      const template = readFileSync(new URL('./src/sw-template.js', import.meta.url), 'utf8');
      const sw = template
        .replace('__VERSION__', version)
        .replace('__FILES__', JSON.stringify(['./', ...list.map((f) => `./${f}`)], null, 2));
      writeFileSync(join(outDir, 'sw.js'), sw);
      // version.json: lets the Android app fetch these exact files and switch to them without a reinstall
      const manifest = {
        version: pkg.version,
        build: version,
        minNative: pkg.config.minNativeVersion,
        files: list.map((f) => ({ path: f, size: statSync(join(outDir, f)).size })),
      };
      writeFileSync(join(outDir, 'version.json'), JSON.stringify(manifest, null, 1));
    },
  };
}

export default defineConfig({
  plugins: [react(), offlineServiceWorker()],
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    outDir: 'dist',
    target: 'es2020',
    chunkSizeWarningLimit: 600,
  },
});
