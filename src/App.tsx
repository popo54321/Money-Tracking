import { lazy, Suspense, useEffect, useRef, useState, type ComponentType } from 'react';
import { AppProvider, useApp } from './state/app';
import { moveFeesIntoTheirCategory, postDuePaydays, postDueRecurring } from './db/repo';
import { refreshPrices } from './services/prices';
import { autoBackupIfDue } from './services/backup';
import { appInBackground, checkNativeUpdate, confirmRunningFiles, tryApplyNative } from './services/autoUpdate';
import { dataVerdict, markDataVersion, readDataVersion } from './services/safety';
import { applyWebUpdate, checkWebUpdate } from './services/updater';
import { getSettings } from './db/repo';
import { isNative } from './services/platform';
import { onUpdateProgress, takeUpdatedNote, type UpdateProgress } from './services/updateProgress';
import { keepDataSafe } from './services/storage';
import { APP_VERSION } from './services/platform';
import { compareVersions } from './services/version';
import { CHANGELOG, changesBetween, type ChangeEntry } from './changelog';
import { Sheet } from './components/ui';
import { ChangeNotes } from './screens/UpdateHistory';
import { Home } from './screens/Home';
import { Accounts } from './screens/Accounts';
import { AccountDetail } from './screens/AccountDetail';
import { AccountEdit } from './screens/AccountEdit';
import { Entry } from './screens/Entry';
import { TxList } from './screens/TxList';
import { Summary } from './screens/Summary';
import { More } from './screens/More';
import { RecurringList, RecurringEdit } from './screens/Recurring';
import { PaydayEdit } from './screens/Payday';
import { Retire } from './screens/Retire';
import { Family } from './screens/Family';
import { Tour } from './components/Tour';
import { ErrorBoundary } from './components/ErrorBoundary';

// Screens used less often load on first visit (they are still kept for offline use).
const loaders: (() => Promise<unknown>)[] = [];
function named<P extends object = object>(load: () => Promise<Record<string, unknown>>, key: string) {
  loaders.push(load);
  return lazy(async () => ({ default: (await load())[key] as ComponentType<P> }));
}
/** Load every screen soon after start, so all of them are ready even if the app's files change later. */
function preloadScreens() {
  for (const load of loaders) load().catch(() => undefined);
}
const MonthClose = named(() => import('./screens/MonthClose'), 'MonthClose');
const Budget = named(() => import('./screens/Budget'), 'Budget');
const BillList = named(() => import('./screens/BillSplit'), 'BillList');
const BillEdit = named<{ id: string }>(() => import('./screens/BillSplit'), 'BillEdit');
const TripList = named(() => import('./screens/Trips'), 'TripList');
const TripEdit = named<{ id: string }>(() => import('./screens/Trips'), 'TripEdit');
const DebtList = named(() => import('./screens/Debts'), 'DebtList');
const DebtDetail = named<{ id: string }>(() => import('./screens/Debts'), 'DebtDetail');
const Goals = named(() => import('./screens/Goals'), 'Goals');
const Wealth = named(() => import('./screens/Wealth'), 'Wealth');
const Convert = named(() => import('./screens/Convert'), 'Convert');
const Settings = named(() => import('./screens/Settings'), 'Settings');
const UpdateHistory = named(() => import('./screens/UpdateHistory'), 'UpdateHistory');
const Categories = named(() => import('./screens/Categories'), 'Categories');
const Setup = named(() => import('./screens/Setup'), 'Setup');

function Loading() {
  return <div className="empty">Loading…</div>;
}

function Screen() {
  const { route, data } = useApp();
  if (!data) return <Loading />;
  switch (route.name) {
    case 'home':
      return <Home />;
    case 'accounts':
      return <Accounts />;
    case 'account':
      return <AccountDetail id={route.id} />;
    case 'accountEdit':
      return <AccountEdit id={route.id} />;
    case 'entry':
      return <Entry key={route.id ?? 'new'} route={route} />;
    case 'txList':
      return <TxList route={route} />;
    case 'summary':
      return <Summary />;
    case 'more':
      return <More />;
    case 'recurring':
      return <RecurringList />;
    case 'recurringEdit':
      return <RecurringEdit id={route.id} />;
    case 'payday':
      return <PaydayEdit />;
    case 'retire':
      return <Retire />;
    case 'monthClose':
      return <MonthClose />;
    case 'budget':
      return <Budget />;
    case 'bills':
      return <BillList />;
    case 'bill':
      return <BillEdit id={route.id} />;
    case 'trips':
      return <TripList />;
    case 'trip':
      return <TripEdit id={route.id} />;
    case 'debts':
      return <DebtList />;
    case 'debt':
      return <DebtDetail id={route.id} />;
    case 'goals':
      return <Goals />;
    case 'convert':
      return <Convert />;
    case 'wealth':
      return <Wealth />;
    case 'family':
      return <Family />;
    case 'settings':
      return <Settings />;
    case 'changelog':
      return <UpdateHistory />;
    case 'categories':
      return <Categories />;
    case 'setup':
      return <Setup />;
  }
}

function TabBar() {
  const { route, tab, go, stackDepth, skin } = useApp();
  const root = stackDepth === 1 ? route.name : null;
  // forms keep their Save button at the bottom instead of the tab bar
  // the calculator uses the whole screen
  if (route.name === 'entry' || route.name === 'accountEdit' || route.name === 'recurringEdit' || route.name === 'retire')
    return null;
  const t = (name: 'home' | 'accounts' | 'summary' | 'more', emoji: string, label: string) => (
    <button className={`tab ${root === name ? 'on' : ''}`} onClick={() => tab(name)} aria-label={label} data-tour={`tab-${name}`}>
      <span className="ti">{emoji}</span>
      {label}
    </button>
  );
  return (
    <nav className="tabbar">
      <div className="tabbar-inner">
        {t('home', skin.tabs.home, 'Home')}
        {t('accounts', skin.tabs.accounts, 'Accounts')}
        <button className="tab-add" data-tour="add" aria-label="Add entry" onClick={() => go({ name: 'entry', kind: 'expense' })}>
          +
        </button>
        {t('summary', skin.tabs.summary, 'Summary')}
        {t('more', skin.tabs.more, 'More')}
      </div>
    </nav>
  );
}

/** A new version downloading (a spinner and how far it has got), then "Updating…" while the app restarts on it. */
function UpdateStatus() {
  const [p, setP] = useState<UpdateProgress | null>(null);
  useEffect(() => onUpdateProgress(setP), []);
  if (!p) return null;
  if (p.phase === 'applying')
    return (
      <div className="update-cover" role="status" aria-live="polite">
        <div className="update-box">
          <span className="spinner big" aria-hidden="true" />
          <b>Updating{p.version ? ` to ${p.version}` : ''}…</b>
          <span className="small muted">Back in a moment. Your data stays on this phone.</span>
        </div>
      </div>
    );
  const pct = Math.max(0, Math.min(100, Math.round((p.done / Math.max(1, p.total)) * 100)));
  return (
    <div className="update-pill" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <span className="grow">
        Downloading update{p.version ? ` ${p.version}` : ''} · <b>{pct}%</b>
        <span className="update-bar">
          <span style={{ width: `${pct}%` }} />
        </span>
      </span>
    </div>
  );
}

const LAST_SEEN = 'mt.lastSeenVersion';

/** After an update: what is new in the version(s) since the one last opened. A fresh install shows nothing. */
function WhatsNew() {
  const { go } = useApp();
  const [entries, setEntries] = useState<ChangeEntry[]>([]);
  useEffect(() => {
    const updated = takeUpdatedNote();
    let last: string | null = null;
    try {
      last = localStorage.getItem(LAST_SEEN);
      localStorage.setItem(LAST_SEEN, APP_VERSION);
    } catch {
      // without storage there is no way to know what is new
    }
    if (last && compareVersions(APP_VERSION, last) > 0) setEntries(changesBetween(last, APP_VERSION, compareVersions));
    // the first update after this feature arrived: just this version's notes
    else if (!last && updated) setEntries(CHANGELOG.filter((e) => e.version === APP_VERSION));
  }, []);
  if (!entries.length) return null;
  const close = () => setEntries([]);
  return (
    <Sheet open onClose={close} title={`✨ What’s new in ${APP_VERSION}`}>
      <div className="small muted mb">Updated to version {APP_VERSION}. Your data stays as it was.</div>
      {entries.map((e) => (
        <div key={e.version} className="mb">
          {entries.length > 1 && (
            <div className="bold small">
              {e.version} · {e.title}
            </div>
          )}
          {entries.length === 1 && <div className="bold">{e.title}</div>}
          <ChangeNotes notes={e.notes} />
        </div>
      ))}
      <div className="btn-row">
        <button
          className="btn ghost"
          onClick={() => {
            close();
            go({ name: 'changelog' });
          }}
        >
          All updates
        </button>
        <button className="btn primary" onClick={close}>
          Got it
        </button>
      </div>
    </Sheet>
  );
}

/** Things to do when the app opens or comes back to the front. */
function Housekeeping() {
  const { rates, currency, today, toast, settings } = useApp();

  const repo = settings.githubRepo;
  const ratesRef = useRef(rates);
  ratesRef.current = rates;
  useEffect(() => {
    let alive = true;
    const run = async () => {
      // ask the phone to keep the data for good (a browser may otherwise clear it)
      void keepDataSafe();
      // fees saved before the hidden Move fee category go into it (does nothing once done)
      await moveFeesIntoTheirCategory();
      const n = await postDueRecurring(ratesRef.current, currency, today);
      if (alive && n > 0) toast(`🔁 Recorded ${n} repeating ${n === 1 ? 'entry' : 'entries'}`);
      const paid = await postDuePaydays(ratesRef.current, currency, today);
      if (alive && paid > 0) toast(`💰 Payday recorded${paid > 1 ? ` (${paid} months)` : ''}`);
    };
    run();
    return () => {
      alive = false;
    };
  }, [today, currency, toast]);
  // family sharing: keep shared accounts in step while the app is open (does nothing until a phone is linked)
  useEffect(() => {
    void import('./services/sync').then((m) => m.startAutoSync());
  }, []);
  // Android: keep app files that started fine, then look for newer ones (they switch in by themselves)
  useEffect(() => {
    if (!isNative()) return;
    let off: (() => void) | undefined;
    (async () => {
      await confirmRunningFiles().catch(() => undefined);
      checkNativeUpdate(repo);
      const { App } = await import('@capacitor/app');
      const a = await App.addListener('pause', () => appInBackground(true));
      const b = await App.addListener('resume', () => {
        appInBackground(false);
        checkNativeUpdate(repo);
      });
      off = () => {
        a.remove();
        b.remove();
      };
    })();
    return () => off?.();
  }, [repo]);
  useEffect(() => {
    const t = setTimeout(preloadScreens, 2500);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    refreshPrices();
    autoBackupIfDue().catch(() => undefined);
    const onVis = () => {
      if (document.visibilityState === 'visible') refreshPrices();
    };
    const onOnline = () => refreshPrices();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('online', onOnline);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('online', onOnline);
    };
  }, []);
  return null;
}

/**
 * Before anything reads or writes: data last saved by a newer app version (an update that failed and fell back to
 * older files, for example) is not touched by this older version. It asks to update instead.
 */
function DataGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<'checking' | 'ok' | { newer: string }>('checking');
  const [status, setStatus] = useState('');
  useEffect(() => {
    (async () => {
      const v = await readDataVersion();
      if (dataVerdict(v, APP_VERSION) === 'newer') return setState({ newer: v! });
      await markDataVersion();
      setState('ok');
    })().catch(() => setState('ok'));
  }, []);
  if (state === 'checking') return <Loading />;
  if (state === 'ok') return <>{children}</>;
  const update = async () => {
    setStatus('Looking for the newest version…');
    try {
      if (isNative()) {
        const s = await checkNativeUpdate((await getSettings()).githubRepo, true);
        if (s === 'ready') tryApplyNative(true);
        else
          setStatus(
            s === 'needsApk' ? 'Install the newest Android app from the download page.' : 'Not found yet. Try again when online.',
          );
      } else if (await checkWebUpdate()) applyWebUpdate();
      else location.reload();
    } catch {
      setStatus('Could not check. Try again when online.');
    }
  };
  return (
    <div className="page" style={{ paddingTop: 60 }}>
      <div className="card center">
        <div style={{ fontSize: 44 }}>🛡️</div>
        <h2>Update needed</h2>
        <p className="small">
          Your data was last saved by version {state.newer}, which is newer than this one ({APP_VERSION}). To keep it safe, this
          version won’t open it. Update to the newest version and everything will be there.
        </p>
        <button className="btn primary block" onClick={update}>
          🔄 Update now
        </button>
        {status && <div className="small muted mt">{status}</div>}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <DataGate>
      <AppProvider>
        <Housekeeping />
        <div className="app">
          <ErrorBoundary>
            <Suspense fallback={<Loading />}>
              <Screen />
            </Suspense>
          </ErrorBoundary>
        </div>
        <TabBar />
        <Tour />
        <UpdateStatus />
        <WhatsNew />
      </AppProvider>
    </DataGate>
  );
}
