import { lazy, Suspense, useEffect, useRef, type ComponentType } from 'react';
import { AppProvider, useApp } from './state/app';
import { postDueRecurring } from './db/repo';
import { refreshPrices } from './services/prices';
import { autoBackupIfDue } from './services/backup';
import { appInBackground, checkNativeUpdate, confirmRunningFiles } from './services/autoUpdate';
import { isNative } from './services/platform';
import { Home } from './screens/Home';
import { Accounts } from './screens/Accounts';
import { AccountDetail } from './screens/AccountDetail';
import { AccountEdit } from './screens/AccountEdit';
import { Entry } from './screens/Entry';
import { TxList } from './screens/TxList';
import { Summary } from './screens/Summary';
import { More } from './screens/More';
import { RecurringList, RecurringEdit } from './screens/Recurring';
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
const Settings = named(() => import('./screens/Settings'), 'Settings');
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
    case 'wealth':
      return <Wealth />;
    case 'settings':
      return <Settings />;
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
  if (route.name === 'entry' || route.name === 'accountEdit' || route.name === 'recurringEdit') return null;
  const t = (name: 'home' | 'accounts' | 'summary' | 'more', emoji: string, label: string) => (
    <button className={`tab ${root === name ? 'on' : ''}`} onClick={() => tab(name)} aria-label={label}>
      <span className="ti">{emoji}</span>
      {label}
    </button>
  );
  return (
    <nav className="tabbar">
      <div className="tabbar-inner">
        {t('home', skin.tabs.home, 'Home')}
        {t('accounts', skin.tabs.accounts, 'Accounts')}
        <button className="tab-add" aria-label="Add entry" onClick={() => go({ name: 'entry', kind: 'expense' })}>
          +
        </button>
        {t('summary', skin.tabs.summary, 'Summary')}
        {t('more', skin.tabs.more, 'More')}
      </div>
    </nav>
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
      const n = await postDueRecurring(ratesRef.current, currency, today);
      if (alive && n > 0) toast(`🔁 Recorded ${n} repeating ${n === 1 ? 'entry' : 'entries'}`);
    };
    run();
    return () => {
      alive = false;
    };
  }, [today, currency, toast]);
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

export default function App() {
  return (
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
    </AppProvider>
  );
}
