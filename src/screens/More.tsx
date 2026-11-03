import { Topbar } from '../components/ui';
import { useApp } from '../state/app';
import { APP_VERSION } from '../services/platform';
import { ProfileSwitch } from './Home';

export function More() {
  const { go } = useApp();
  const tiles: { e: string; t: string; d: string; c: string; r: Parameters<typeof go>[0] }[] = [
    { e: '🌙', t: 'Repeating', d: 'Salary, bills, subscriptions', c: 'lav', r: { name: 'recurring' } },
    { e: '📖', t: 'Month close', d: 'Numbers for the workbook', c: 'sky', r: { name: 'monthClose' } },
    { e: '📜', t: 'Budget spell', d: 'Phases & monthly transfers', c: 'mint', r: { name: 'budget' } },
    { e: '🐉', t: 'Wealth preserve', d: 'BTC & gold (ทองบาทละ)', c: 'butter', r: { name: 'wealth' } },
    { e: '🌠', t: 'Wishes', d: 'Saving targets & when to buy', c: 'peach', r: { name: 'goals' } },
    { e: '🍄', t: 'Bill split', d: 'Eating out with friends', c: 'pink', r: { name: 'bills' } },
    { e: '🗺️', t: 'Travel split', d: 'Trips with friends & family', c: 'butter', r: { name: 'trips' } },
    { e: '🦉', t: 'Who owes me', d: 'Loans, repayments, interest', c: 'sky', r: { name: 'debts' } },
    { e: '🦋', t: 'Categories', d: 'Add, rename, emoji', c: 'lav', r: { name: 'categories' } },
    { e: '🪄', t: 'Settings', d: 'Currency, backup, update', c: 'mint', r: { name: 'settings' } },
  ];
  return (
    <>
      <Topbar title="Enchantments 🍄" right={<ProfileSwitch />} noBack />
      <div className="page">
        <div className="tiles">
          {tiles.map((x) => (
            <button key={x.t} className={`tile ${x.c}`} onClick={() => go(x.r)}>
              <span className="e">{x.e}</span>
              <span>
                <div className="t">{x.t}</div>
                <div className="d">{x.d}</div>
              </span>
            </button>
          ))}
        </div>
        <div className="center tiny muted mt">Money Tracking v{APP_VERSION} · made with fairy dust ✨</div>
      </div>
    </>
  );
}
