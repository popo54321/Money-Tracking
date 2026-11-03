import { SkinName, Topbar } from '../components/ui';
import { useApp } from '../state/app';
import { APP_VERSION } from '../services/platform';
import type { TileKey } from '../ui/skins';
import { ProfileSwitch } from './Home';

export function More() {
  const { go, skin } = useApp();
  const n = (k: 'budget' | 'goals' | 'wealth') => skin.names[k].replace(/\s*\p{Extended_Pictographic}.*$/u, '');
  const tiles: { k: TileKey; t: string; d: string; c: string; r: Parameters<typeof go>[0] }[] = [
    { k: 'recurring', t: 'Repeating', d: 'Salary, bills, subscriptions', c: 'lav', r: { name: 'recurring' } },
    { k: 'monthClose', t: 'Month close', d: 'Numbers for the workbook', c: 'sky', r: { name: 'monthClose' } },
    { k: 'budget', t: n('budget'), d: 'Phases & monthly transfers', c: 'mint', r: { name: 'budget' } },
    { k: 'wealth', t: n('wealth'), d: 'BTC & gold (ทองบาทละ)', c: 'butter', r: { name: 'wealth' } },
    { k: 'goals', t: n('goals'), d: 'Wishlist & when to buy', c: 'peach', r: { name: 'goals' } },
    { k: 'bills', t: 'Bill split', d: 'Eating out with friends', c: 'pink', r: { name: 'bills' } },
    { k: 'trips', t: 'Travel split', d: 'Trips with friends & family', c: 'butter', r: { name: 'trips' } },
    { k: 'debts', t: 'Who owes me', d: 'Loans, repayments, interest', c: 'sky', r: { name: 'debts' } },
    { k: 'categories', t: 'Categories', d: 'Add, rename, emoji', c: 'lav', r: { name: 'categories' } },
    { k: 'settings', t: 'Settings', d: 'Theme, currency, backup, update', c: 'mint', r: { name: 'settings' } },
  ];
  return (
    <>
      <Topbar title={<SkinName k="more" />} right={<ProfileSwitch />} noBack />
      <div className="page">
        <div className="tiles">
          {tiles.map((x) => (
            <button key={x.k} className={`tile ${x.c}`} onClick={() => go(x.r)}>
              <span className="e">{skin.tiles[x.k]}</span>
              <span>
                <div className="t">{x.t}</div>
                <div className="d">{x.d}</div>
              </span>
            </button>
          ))}
        </div>
        <div className="center tiny muted mt">Money Tracking v{APP_VERSION}</div>
      </div>
    </>
  );
}
