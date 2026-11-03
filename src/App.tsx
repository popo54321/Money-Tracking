import { useEffect, useRef } from 'react';
import { AppProvider, useApp } from './state/app';
import { postDueRecurring } from './db/repo';
import { refreshPrices } from './services/prices';
import { autoBackupIfDue } from './services/backup';
import { Home } from './screens/Home';
import { Accounts } from './screens/Accounts';
import { AccountDetail } from './screens/AccountDetail';
import { AccountEdit } from './screens/AccountEdit';
import { Entry } from './screens/Entry';
import { TxList } from './screens/TxList';
import { Summary } from './screens/Summary';
import { More } from './screens/More';
import { RecurringList, RecurringEdit } from './screens/Recurring';
import { MonthClose } from './screens/MonthClose';
import { Budget } from './screens/Budget';
import { BillList, BillEdit } from './screens/BillSplit';
import { TripList, TripEdit } from './screens/Trips';
import { DebtList, DebtDetail } from './screens/Debts';
import { Goals } from './screens/Goals';
import { Wealth } from './screens/Wealth';
import { Settings } from './screens/Settings';
import { Categories } from './screens/Categories';
import { Setup } from './screens/Setup';

function Screen() {
  const { route, data } = useApp();
  if (!data) return <div className="empty"><span className="e">🧚</span>Loading…</div>;
  switch (route.name) {
    case 'home': return <Home />;
    case 'accounts': return <Accounts />;
    case 'account': return <AccountDetail id={route.id} />;
    case 'accountEdit': return <AccountEdit id={route.id} />;
    case 'entry': return <Entry key={route.id ?? 'new'} route={route} />;
    case 'txList': return <TxList route={route} />;
    case 'summary': return <Summary />;
    case 'more': return <More />;
    case 'recurring': return <RecurringList />;
    case 'recurringEdit': return <RecurringEdit id={route.id} />;
    case 'monthClose': return <MonthClose />;
    case 'budget': return <Budget />;
    case 'bills': return <BillList />;
    case 'bill': return <BillEdit id={route.id} />;
    case 'trips': return <TripList />;
    case 'trip': return <TripEdit id={route.id} />;
    case 'debts': return <DebtList />;
    case 'debt': return <DebtDetail id={route.id} />;
    case 'goals': return <Goals />;
    case 'wealth': return <Wealth />;
    case 'settings': return <Settings />;
    case 'categories': return <Categories />;
    case 'setup': return <Setup />;
  }
}

function TabBar() {
  const { route, tab, go, stackDepth, skin } = useApp();
  const root = stackDepth === 1 ? route.name : null;
  if (route.name === 'entry') return null;
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
  const { rates, currency, today, toast } = useApp();
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
        <Screen />
      </div>
      <TabBar />
    </AppProvider>
  );
}
