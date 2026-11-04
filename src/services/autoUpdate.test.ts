import { describe, expect, it } from 'vitest';
import { canRemoveDownload, folderInUse, shouldUse, siteUrl, type WebManifest } from './autoUpdate';
import { compareVersions } from './version';

const m = (version: string, minNative: string): WebManifest => ({
  version,
  build: `${version}-abc`,
  minNative,
  files: [],
});

describe('updates that install themselves', () => {
  it('compares versions and ignores the build tag after a dash', () => {
    expect(compareVersions('1.3.0', '1.2.9')).toBe(1);
    expect(compareVersions('1.3.0-12ab', '1.3.0')).toBe(0);
    expect(compareVersions('v1.10.0', '1.9.9')).toBe(1);
  });
  it('uses newer files when the installed Android app can run them', () => {
    expect(shouldUse(m('1.4.0', '1.3.0'), '1.3.0', '1.3.0', [])).toBe('ready');
    expect(shouldUse(m('1.3.0', '1.3.0'), '1.3.0', '1.3.0', [])).toBe('none');
    expect(shouldUse(m('1.2.0', '1.0.0'), '1.3.0', '1.3.0', [])).toBe('none');
  });
  it('asks for a new APK only when the Android app itself is too old', () => {
    expect(shouldUse(m('1.5.0', '1.5.0'), '1.4.0', '1.3.0', [])).toBe('needsApk');
  });
  it('never retries files that failed to start', () => {
    expect(shouldUse(m('1.4.0', '1.3.0'), '1.3.0', '1.3.0', ['1.4.0-abc'])).toBe('none');
  });
  it('finds the web app site from the repository name', () => {
    expect(siteUrl('popo54321/Money-Tracking')).toBe('https://popo54321.github.io/Money-Tracking/');
  });
  it('knows the folder in use however Android writes it, and never removes it', () => {
    expect(folderInUse('/data/user/0/app/files/web/1.5.0-abc')).toBe('1.5.0-abc');
    expect(folderInUse('/data/user/0/app/files/web/1.5.0-abc/')).toBe('1.5.0-abc');
    expect(folderInUse('public')).toBeNull();
    expect(canRemoveDownload('1.5.0-abc', '1.5.0-abc', '1.5.0')).toBe(false);
    expect(canRemoveDownload('1.4.1-old', '1.5.0-abc', '1.5.0')).toBe(true);
    // a newer download waiting to be used stays
    expect(canRemoveDownload('1.6.0-new', '1.5.0-abc', '1.5.0')).toBe(false);
    expect(canRemoveDownload('1.6.0-new', null, '1.5.0')).toBe(false);
  });
});
