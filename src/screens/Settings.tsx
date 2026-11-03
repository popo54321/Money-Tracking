import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { CurrencySheet, Field, Seg, Sheet, Topbar } from '../components/ui';
import { fmtAgo, fmtDate } from '../domain/dates';
import type { Profile, Settings as SettingsT } from '../domain/types';
import { db } from '../db/db';
import { updateSettings, wipeAll } from '../db/repo';
import { ensureSeeded } from '../db/seed';
import { backupStats, parseBackup, restoreBackup, shareBackup } from '../services/backup';
import { entriesCsv, shareEntriesCsv } from '../services/export';
import { refreshPrices } from '../services/prices';
import { APP_VERSION, isNative, openExternal, pickTextFile } from '../services/platform';
import { applyWebUpdate, checkWebUpdate, installApk, isNewer, latestRelease, type ReleaseInfo } from '../services/updater';
import { useApp } from '../state/app';
import { EMOJI_CHOICES } from '../ui/emoji';

function ProfileEditor({ p }: { p: Profile }) {
  const [name, setName] = useState(p.name);
  const [pick, setPick] = useState(false);
  useEffect(() => setName(p.name), [p.name]);
  return (
    <div className="item-line">
      <button className="icon-btn" onClick={() => setPick(!pick)} aria-label="Choose emoji">
        {p.emoji ?? '🙂'}
      </button>
      <input className="inline-input grow" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && db.profiles.update(p.id, { name: name.trim() })} />
      {pick && (
        <Sheet open={pick} onClose={() => setPick(false)} title={`Emoji for ${p.name}`}>
          <div className="chips">
            {EMOJI_CHOICES.map((e) => (
              <button
                key={e}
                className="chip"
                onClick={() => {
                  db.profiles.update(p.id, { emoji: e });
                  setPick(false);
                }}
              >
                {e}
              </button>
            ))}
          </div>
        </Sheet>
      )}
    </div>
  );
}

function UpdateCard() {
  const { settings, toast } = useApp();
  const [rel, setRel] = useState<ReleaseInfo | null>(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const native = isNative();
  const releasesUrl = `https://github.com/${settings.githubRepo}/releases/latest`;
  const webUrl = `https://${settings.githubRepo.split('/')[0].toLowerCase()}.github.io/${settings.githubRepo.split('/')[1]}/`;

  const check = async () => {
    setBusy(true);
    setStatus('Checking…');
    try {
      if (native) {
        const r = await latestRelease(settings.githubRepo);
        setRel(r);
        setStatus(isNewer(r) ? `Version ${r.version} is available 🎉` : `You have the latest version (${APP_VERSION}) ✨`);
      } else {
        const ready = await checkWebUpdate();
        setStatus(ready ? 'A new version is ready 🎉' : `You have the latest version (${APP_VERSION}) ✨`);
        if (ready) setRel({ version: 'new', tag: '', name: '', notes: '', pageUrl: '' });
      }
    } catch (e) {
      setStatus(`😿 ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <h2>🚀 Updates</h2>
      <div className="small muted mb">
        You have version {APP_VERSION} ({native ? 'Android app' : 'web app'}).
      </div>
      <button className="btn sky block" onClick={check} disabled={busy}>
        {busy ? '…' : '🔍 Check for a new version'}
      </button>
      {status && <div className="small mt">{status}</div>}
      {rel && native && isNewer(rel) && (
        <>
          {rel.notes && <div className="tiny muted mt" style={{ whiteSpace: 'pre-line' }}>{rel.notes.slice(0, 600)}</div>}
          <button
            className="btn primary block mt"
            onClick={async () => {
              await installApk(rel, (s) => s && toast(s));
            }}
          >
            ⬇️ Download & install {rel.version}
          </button>
          <div className="tiny muted mt">Android asks once to allow installing from this app. Your data stays.</div>
        </>
      )}
      {rel && !native && rel.version === 'new' && (
        <button className="btn primary block mt" onClick={applyWebUpdate}>
          ✨ Update now
        </button>
      )}
      <div className="btn-row mt">
        <button className="btn sm ghost" onClick={() => openExternal(releasesUrl)}>
          Android download page ↗
        </button>
        {native && (
          <button className="btn sm ghost" onClick={() => openExternal(webUrl)}>
            iPhone web app ↗
          </button>
        )}
      </div>
    </div>
  );
}

export function Settings() {
  const { settings, prices, profiles, toast, confirm, profile } = useApp();
  const [curOpen, setCurOpen] = useState(false);
  const [favOpen, setFavOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const counts = useLiveQuery(async () => ({ txs: await db.txs.count(), accounts: await db.accounts.count() }), []);
  const set = (p: Partial<SettingsT>) => updateSettings(p);

  const restore = async () => {
    const f = await pickTextFile('.json,application/json');
    if (!f) return;
    try {
      const b = parseBackup(f.text);
      const st = backupStats(b);
      const ok = await confirm({
        title: 'Restore this backup?',
        message: `${f.name}\nMade ${fmtDate(st.exportedAt.slice(0, 10))} with ${st.accounts} accounts and ${st.entries} entries.\n\nEverything on this phone will be replaced.`,
        ok: 'Restore',
        danger: true,
      });
      if (!ok) return;
      await restoreBackup(b);
      toast('✅ Restored');
    } catch (e) {
      toast(`😿 ${(e as Error).message}`);
    }
  };

  const exportAll = async () => {
    const [txs, accounts, categories] = await Promise.all([db.txs.toArray(), db.accounts.toArray(), db.categories.toArray()]);
    await shareEntriesCsv(`money-tracking-entries-${new Date().toISOString().slice(0, 10)}.csv`, entriesCsv(txs, accounts, categories, profiles));
  };

  return (
    <>
      <Topbar title="Settings ⚙️" />
      <div className="page">
        <div className="card">
          <h2>💱 Money</h2>
          <Field label="Main currency" hint="Totals, net worth and summaries are shown in this currency.">
            <button type="button" className="amount-field" onClick={() => setCurOpen(true)}>
              {settings.defaultCurrency} <span className="cur">▾</span>
            </button>
          </Field>
          <Field label="Favourite currencies" hint="Shown first when you pick a currency.">
            <div className="chips">
              {settings.favouriteCurrencies.map((c) => (
                <button key={c} className="chip on" onClick={() => set({ favouriteCurrencies: settings.favouriteCurrencies.filter((x) => x !== c) })}>
                  {c} ✕
                </button>
              ))}
              <button className="chip" onClick={() => setFavOpen(true)}>
                ＋
              </button>
            </div>
          </Field>
        </div>

        <div className="card">
          <h2>🌈 Live prices</h2>
          <div className="small">
            Exchange rates: {prices.ratesFetchedAt ? `${prices.ratesSource}, ${fmtAgo(prices.ratesFetchedAt)}` : prices.ratesSource}
          </div>
          <div className="small">
            BTC price: {prices.btcFetchedAt ? `${prices.btcSource}, ${fmtAgo(prices.btcFetchedAt)}` : prices.btcSource ?? 'not yet'}
          </div>
          <div className="tiny muted mt">Only these use the internet. Everything else works offline. Saved prices are used until the next update.</div>
          <button
            className="btn sky block mt"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const r = await refreshPrices(true);
              setBusy(false);
              toast(r.ok ? '🌈 Updated' : r.error === 'offline' ? '📴 Offline' : `😿 ${r.error}`);
            }}
          >
            ↻ Update prices now
          </button>
        </div>

        <div className="card">
          <h2>💾 Backup & export</h2>
          <div className="small muted mb">
            {counts ? `${counts.accounts} accounts, ${counts.txs} entries on this ${isNative() ? 'phone' : 'device'}.` : ''} Last backup:{' '}
            {settings.lastBackupAt ? fmtAgo(settings.lastBackupAt) : 'never'}.
            {isNative() && settings.lastAutoBackupAt ? ` Daily copy in Documents/MoneyTracking (${fmtAgo(settings.lastAutoBackupAt)}).` : ''}
          </div>
          <div className="vstack">
            <button
              className="btn primary block"
              onClick={async () => {
                const r = await shareBackup();
                if (r !== 'cancelled') toast('💾 Backup saved');
              }}
            >
              💾 Save backup (Drive, email, Files…)
            </button>
            <button className="btn block" onClick={restore}>
              📂 Restore from a backup file
            </button>
            <button className="btn mint block" onClick={exportAll}>
              📄 Export all entries (CSV for Excel)
            </button>
          </div>
          {!isNative() && (
            <div className="tiny muted mt">
              On iPhone, data lives in this web app only. Save a backup regularly, for example to iCloud Drive.
            </div>
          )}
        </div>

        <UpdateCard />

        <div className="card">
          <h2>🐻 Profiles</h2>
          <div className="tiny muted mb">Each person has separate accounts, entries and categories.</div>
          {profiles.map((p) => (
            <ProfileEditor key={p.id} p={p} />
          ))}
        </div>

        <div className="card">
          <h2>🎨 Look</h2>
          <Seg
            value={settings.theme}
            onChange={(v) => set({ theme: v })}
            options={[
              { v: 'system', label: 'Auto' },
              { v: 'light', label: '☀️ Light' },
              { v: 'dark', label: '🌙 Dark' },
            ]}
          />
        </div>

        {!isNative() && (
          <div className="card">
            <h2>📱 Install on iPhone</h2>
            <div className="small">
              In Safari tap <b>Share</b> → <b>Add to Home Screen</b>. It then opens full-screen and works offline.
            </div>
          </div>
        )}

        <div className="card">
          <h2>⚠️ Start again</h2>
          <button
            className="btn danger block"
            onClick={async () => {
              const ok = await confirm({
                title: 'Erase everything?',
                message: 'All accounts, entries, splits and settings on this device are deleted. Save a backup first if unsure.',
                ok: 'Erase',
                danger: true,
              });
              if (!ok) return;
              await wipeAll();
              await ensureSeeded();
              toast('🌱 Fresh start');
            }}
          >
            Erase all data
          </button>
        </div>
        <div className="center tiny muted">
          v{APP_VERSION} · {profile.name}’s view · github.com/{settings.githubRepo}
        </div>
      </div>
      <CurrencySheet open={curOpen} onClose={() => setCurOpen(false)} value={settings.defaultCurrency} onPick={(c) => set({ defaultCurrency: c })} />
      <CurrencySheet
        open={favOpen}
        onClose={() => setFavOpen(false)}
        onPick={(c) => !settings.favouriteCurrencies.includes(c) && set({ favouriteCurrencies: [...settings.favouriteCurrencies, c] })}
      />
    </>
  );
}
