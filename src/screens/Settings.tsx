import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { CurrencySheet, Field, Seg, Sheet, ToggleRow, Topbar } from '../components/ui';
import { fmtAgo, fmtDate } from '../domain/dates';
import type { Profile, Settings as SettingsT } from '../domain/types';
import { db } from '../db/db';
import { updateSettings, wipeAll } from '../db/repo';
import { createProfile, deleteProfile, ensureSeeded } from '../db/seed';
import { backupStats, parseBackup, restoreBackup, shareBackup } from '../services/backup';
import { lastSafetyCopy, markDataVersion, saveSafetyCopy, undoWithSafetyCopy } from '../services/safety';
import { useDataKept } from '../services/storage';
import { entriesCsv, shareEntriesCsv } from '../services/export';
import { refreshPrices } from '../services/prices';
import { APP_VERSION, isNative, openExternal, pickTextFile } from '../services/platform';
import { applyWebUpdate, checkWebUpdate, installApk, isNewer, latestRelease, type ReleaseInfo } from '../services/updater';
import { useApp } from '../state/app';
import { watchedCurrencies } from './Home';
import { checkNativeUpdate, tryApplyNative } from '../services/autoUpdate';
import { EMOJI_CHOICES } from '../ui/emoji';
import { SKINS } from '../ui/skins';
import { Mascot } from '../ui/Mascot';

function ProfileEditor({ p, canDelete }: { p: Profile; canDelete: boolean }) {
  const { confirm, profile, profiles, setProfile, removeWithUndo } = useApp();
  const [name, setName] = useState(p.name);
  const [pick, setPick] = useState(false);
  useEffect(() => setName(p.name), [p.name]);
  return (
    <div className="item-line">
      <button className="icon-btn" onClick={() => setPick(!pick)} aria-label="Choose emoji">
        {p.emoji ?? '🙂'}
      </button>
      <input
        className="inline-input grow"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => name.trim() && db.profiles.update(p.id, { name: name.trim() })}
      />
      {canDelete && (
        <button
          className="btn sm ghost"
          aria-label={`Delete ${p.name}`}
          onClick={async () => {
            const ok = await confirm({
              title: `Delete ${p.name}?`,
              message:
                'All of their accounts, entries, categories, budget, loans and saving targets are deleted from this device.',
              ok: 'Delete',
              danger: true,
            });
            if (!ok) return;
            if (profile.id === p.id) setProfile(profiles.find((x) => x.id !== p.id)!.id);
            await removeWithUndo(() => deleteProfile(p.id), '🗑️ User deleted');
          }}
        >
          🗑️
        </button>
      )}
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
  const { settings, toast, go } = useApp();
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
        // first try the quick way: new app files, no reinstall
        const quick = await checkNativeUpdate(settings.githubRepo, true);
        if (quick === 'downloading') {
          setStatus('Downloading the new version… it switches in by itself. ⏳');
          return;
        }
        if (quick === 'ready') {
          setStatus('New version downloaded. Switching now… ✨');
          tryApplyNative(true);
          return;
        }
        const r = await latestRelease(settings.githubRepo);
        setRel(r);
        setStatus(
          quick === 'needsApk' || (quick === 'error' && isNewer(r))
            ? `Version ${r.version} is available 🎉`
            : `You have the latest version (${APP_VERSION}) ✨`,
        );
        if (quick === 'none') setRel(null);
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
    <Section title="🚀 Updates">
      <div className="small muted mb">
        You have version {APP_VERSION} ({native ? 'Android app' : 'web app'}). New versions install themselves: when the app is
        opened or left with nothing open, so nothing you are typing is lost.
      </div>
      <button className="btn sky block" onClick={check} disabled={busy}>
        {busy ? '…' : '🔍 Check for a new version'}
      </button>
      <button className="btn block mt" onClick={() => go({ name: 'changelog' })}>
        📜 Update history
      </button>
      {status && <div className="small mt">{status}</div>}
      {rel && native && isNewer(rel) && (
        <>
          {rel.notes && (
            <div className="tiny muted mt" style={{ whiteSpace: 'pre-line' }}>
              {rel.notes.slice(0, 600)}
            </div>
          )}
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
    </Section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <h2>{title}</h2>
      {children}
    </div>
  );
}

export function Settings() {
  const { settings, prices, profiles, toast, confirm, profile, setProfile, skin, go } = useApp();
  const [curOpen, setCurOpen] = useState(false);
  const [favOpen, setFavOpen] = useState(false);
  const [watchOpen, setWatchOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const counts = useLiveQuery(async () => ({ txs: await db.txs.count(), accounts: await db.accounts.count() }), []);
  const dataKept = useDataKept();
  // the copy taken before the last Restore or Erase (7 days)
  const [safetyCopy, setSafetyCopy] = useState<Awaited<ReturnType<typeof lastSafetyCopy>>>(null);
  useEffect(() => {
    void lastSafetyCopy().then(setSafetyCopy);
  }, [counts]);
  /** Restore and Erase replace everything: ask twice (the buttons swap sides), then keep a copy to undo with. */
  const sureTwice = async (title: string, message: string, ok: string) =>
    (await confirm({ title, message, ok, danger: true })) &&
    (await confirm({
      title: 'Are you really sure?',
      message: 'A copy of everything now is kept for 7 days: Settings → Backup → Undo.',
      ok: `Yes, ${ok.toLowerCase()}`,
      cancel: 'Keep my data',
      danger: true,
      swap: true,
    }));
  const set = (p: Partial<SettingsT>) => updateSettings(p);

  const restore = async () => {
    const f = await pickTextFile('.json,application/json');
    if (!f) return;
    try {
      const b = parseBackup(f.text);
      const st = backupStats(b);
      const ok = await sureTwice(
        'Restore this backup?',
        `${f.name}\nMade ${fmtDate(st.exportedAt.slice(0, 10))} with ${st.accounts} accounts and ${st.entries} entries.\n\nEverything on this phone will be replaced.`,
        'Restore',
      );
      if (!ok) return;
      await saveSafetyCopy('restore');
      await restoreBackup(b);
      await markDataVersion();
      toast('✅ Restored. Settings → Backup can undo it for 7 days.');
    } catch (e) {
      toast(`😿 ${(e as Error).message}`);
    }
  };

  const exportAll = async () => {
    const [txs, accounts, categories] = await Promise.all([db.txs.toArray(), db.accounts.toArray(), db.categories.toArray()]);
    await shareEntriesCsv(
      `money-tracking-entries-${new Date().toISOString().slice(0, 10)}.csv`,
      entriesCsv(txs, accounts, categories, profiles),
    );
  };

  return (
    <>
      <Topbar title="Settings" />
      <div className="page">
        <Section title="🧚 Users">
          <div className="tiny muted mb">Each person has separate accounts, entries and categories.</div>
          {profiles.map((p) => (
            <ProfileEditor key={p.id} p={p} canDelete={profiles.length > 1} />
          ))}
          <button
            className="btn block mt"
            onClick={async () => {
              const p = await createProfile();
              setProfile(p.id);
              toast(`✨ ${p.name} added`);
            }}
          >
            ＋ Add a user
          </button>
        </Section>

        <Section title="👨‍👩‍👧 Family sharing">
          <div className="small muted mb">Link phones to share chosen accounts. Everything else stays on each phone.</div>
          <button className="btn block" onClick={() => go({ name: 'family' })}>
            Open Family sharing ›
          </button>
        </Section>

        <Section title="🎨 Theme">
          <div className="theme-grid mb">
            {SKINS.map((t) => (
              <button
                key={t.id}
                className={`theme-tile ${skin.id === t.id ? 'on' : ''}`}
                onClick={() => set({ skin: t.id })}
                aria-pressed={skin.id === t.id}
              >
                <span className="theme-icon">{t.mascot ? <Mascot kind={t.mascot} size={38} /> : t.icon}</span>
                <span className="bold">{t.label}</span>
                <span className="tiny muted">{t.desc}</span>
              </button>
            ))}
          </div>
          <Seg
            value={settings.theme}
            onChange={(v) => set({ theme: v })}
            options={[
              { v: 'system', label: 'Auto' },
              { v: 'light', label: '☀️ Light' },
              { v: 'dark', label: '🌙 Dark' },
            ]}
          />
          <ToggleRow
            title="📳 Vibrate when typing"
            desc={isNative() ? 'A light buzz on each calculator key' : 'Android only: iPhone does not let web apps vibrate'}
            on={settings.vibrate !== false}
            onChange={(v) => set({ vibrate: v })}
          />
        </Section>

        <Section title="💱 Money">
          <Field label="Main currency" hint="Totals, net worth and summaries are shown in this currency.">
            <button type="button" className="amount-field" onClick={() => setCurOpen(true)}>
              {settings.defaultCurrency} <span className="cur">▾</span>
            </button>
          </Field>
          <Field label="Favourite currencies" hint="Shown first when you pick a currency.">
            <div className="chips">
              {settings.favouriteCurrencies.map((c) => (
                <button
                  key={c}
                  className="chip on"
                  onClick={() => set({ favouriteCurrencies: settings.favouriteCurrencies.filter((x) => x !== c) })}
                >
                  {c} ✕
                </button>
              ))}
              <button className="chip" onClick={() => setFavOpen(true)}>
                ＋
              </button>
            </div>
          </Field>
        </Section>

        <Section title="💾 Backup & export">
          <div className="small muted mb">
            {counts
              ? `${counts.accounts} ${counts.accounts === 1 ? 'account' : 'accounts'}, ${counts.txs} ${counts.txs === 1 ? 'entry' : 'entries'} on this ${isNative() ? 'phone' : 'device'}.`
              : ''}{' '}
            Last backup: {settings.lastBackupAt ? fmtAgo(settings.lastBackupAt) : 'never'}.
            {isNative() && settings.lastAutoBackupAt
              ? ` Daily copy in Documents/MoneyTracking (${fmtAgo(settings.lastAutoBackupAt)}).`
              : ''}
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
            {safetyCopy && (
              <button
                className="btn butter block"
                onClick={async () => {
                  const ok = await confirm({
                    title: `Undo the ${safetyCopy.reason === 'currency' ? 'currency change' : safetyCopy.reason}?`,
                    message: `Everything goes back to how it was on ${new Date(safetyCopy.at).toLocaleString()}. Anything added since is replaced.`,
                    ok: 'Undo it',
                  });
                  if (!ok) return;
                  if (await undoWithSafetyCopy()) toast('↩️ Back to how it was');
                  setSafetyCopy(null);
                }}
              >
                ↩️ Undo the last {safetyCopy.reason === 'currency' ? 'currency change' : safetyCopy.reason} (
                {fmtAgo(safetyCopy.at)})
              </button>
            )}
            <button className="btn mint block" onClick={exportAll}>
              📄 Export all entries (CSV for Excel)
            </button>
          </div>
          <div className={`small mt ${dataKept === false ? 'warn-ink' : 'muted'}`}>
            {isNative()
              ? '🔒 Your data is kept inside the app, with a daily copy in Documents.'
              : dataKept
                ? '🔒 This phone keeps the data safely. Still save a backup now and then, for example to iCloud Drive.'
                : dataKept === false
                  ? '⚠️ This browser may clear the data if the app isn’t opened for a while. Add it to your home screen (Share → Add to Home Screen) and save backups often.'
                  : ''}
          </div>
        </Section>

        <UpdateCard />

        <Section title="🌈 Live prices">
          <div className="small">
            Exchange rates:{' '}
            {prices.ratesFetchedAt ? `${prices.ratesSource}, ${fmtAgo(prices.ratesFetchedAt)}` : prices.ratesSource}
          </div>
          <div className="small">
            BTC price:{' '}
            {prices.btcFetchedAt ? `${prices.btcSource}, ${fmtAgo(prices.btcFetchedAt)}` : (prices.btcSource ?? 'not yet')}
          </div>
          <div className="tiny muted mt">
            Only these use the internet. Everything else works offline. Saved prices are used until the next update.
          </div>
          <div className="cat-group-name">Shown on Home</div>
          <div className="chips">
            <span className="chip on">🔒 BTC</span>
            <span className="chip on">🔒 Gold</span>
            {watchedCurrencies(settings.watchCurrencies, settings.defaultCurrency).map((c, _i, list) => (
              <button
                key={c}
                className="chip"
                aria-label={`Stop watching ${c}`}
                onClick={() => updateSettings({ watchCurrencies: list.filter((x) => x !== c) })}
              >
                {c} ✕
              </button>
            ))}
            <button className="chip" onClick={() => setWatchOpen(true)}>
              ＋ Currency
            </button>
          </div>
          <div className="tiny muted mt">BTC and gold are always shown. Add as many currencies as you like.</div>
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
        </Section>

        {!isNative() && (
          <Section title="📱 Install on iPhone">
            <div className="small">
              In Safari tap <b>Share</b> → <b>Add to Home Screen</b>. It then opens full-screen and works offline.
            </div>
          </Section>
        )}

        <Section title="⚠️ Start again">
          <button
            className="btn danger block"
            onClick={async () => {
              const ok = await sureTwice(
                'Erase everything?',
                'All accounts, entries, splits and settings on this device are deleted.',
                'Erase',
              );
              if (!ok) return;
              await saveSafetyCopy('erase');
              await wipeAll();
              await ensureSeeded();
              await markDataVersion();
              toast('🌱 Fresh start');
            }}
          >
            Erase all data
          </button>
        </Section>
        <div className="center tiny muted">
          v{APP_VERSION} · {profile.name}’s view · github.com/{settings.githubRepo}
        </div>
      </div>
      <CurrencySheet
        open={watchOpen}
        onClose={() => setWatchOpen(false)}
        onPick={(c) => {
          if (c === settings.defaultCurrency) return toast(`${c} is your main currency`);
          const list = watchedCurrencies(settings.watchCurrencies, settings.defaultCurrency);
          updateSettings({ watchCurrencies: [...list.filter((x) => x !== c), c] });
          toast(`👀 Watching ${c}`);
        }}
      />
      <CurrencySheet
        open={curOpen}
        onClose={() => setCurOpen(false)}
        value={settings.defaultCurrency}
        onPick={(c) => set({ defaultCurrency: c })}
      />
      <CurrencySheet
        open={favOpen}
        onClose={() => setFavOpen(false)}
        onPick={(c) =>
          !settings.favouriteCurrencies.includes(c) && set({ favouriteCurrencies: [...settings.favouriteCurrencies, c] })
        }
      />
    </>
  );
}
