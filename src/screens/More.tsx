import { SkinName, Topbar } from '../components/ui';
import { useApp } from '../state/app';
import { APP_VERSION } from '../services/platform';

import type { TileKey } from '../ui/skins';
import { ProfileSwitch } from './Home';
import { startTour } from '../components/Tour';

export function More() {
  const { go, skin } = useApp();
  const n = (k: 'budget' | 'goals' | 'wealth') => skin.names[k].replace(/\s*\p{Extended_Pictographic}.*$/u, '');
  type T = { k: TileKey; t: string; d: string; c: string; r: Parameters<typeof go>[0] };
  const groups: { label: string; tiles: T[] }[] = [
    {
      label: 'Everyday',
      tiles: [
        { k: 'recurring', t: 'Repeating', d: 'Salary, bills, subscriptions', c: 'lav', r: { name: 'recurring' } },
        { k: 'bills', t: 'Bill split', d: 'Eating out with friends', c: 'pink', r: { name: 'bills' } },
        { k: 'trips', t: 'Travel split', d: 'Trips with friends & family', c: 'butter', r: { name: 'trips' } },
        { k: 'debts', t: 'Who owes me', d: 'Loans, repayments, interest', c: 'sky', r: { name: 'debts' } },
      ],
    },
    {
      label: 'Plan & grow',
      tiles: [
        { k: 'budget', t: n('budget'), d: 'Phases & monthly transfers', c: 'mint', r: { name: 'budget' } },
        { k: 'goals', t: n('goals'), d: 'Wishlist & when to buy', c: 'peach', r: { name: 'goals' } },
        { k: 'wealth', t: n('wealth'), d: 'BTC & gold (ทองบาทละ)', c: 'butter', r: { name: 'wealth' } },
        { k: 'monthClose', t: 'Month close', d: 'Numbers for the workbook', c: 'sky', r: { name: 'monthClose' } },
      ],
    },
    {
      label: 'Tools & set up',
      tiles: [
        { k: 'convert', t: 'Currency converter', d: 'Any currency, BTC and gold', c: 'mint', r: { name: 'convert' } },
        { k: 'entries', t: 'All entries', d: 'Search every entry', c: 'peach', r: { name: 'txList', title: 'All entries' } },
        { k: 'categories', t: 'Categories', d: 'Add, rename, emoji', c: 'lav', r: { name: 'categories' } },
        { k: 'settings', t: 'Settings', d: 'Theme, users, backup, update', c: 'sky', r: { name: 'settings' } },
      ],
    },
  ];
  return (
    <>
      <Topbar title={<SkinName k="more" />} right={<ProfileSwitch />} noBack />
      <div className="page">
        <button className="guide-strip" data-tour="tile-guide" onClick={startTour}>
          <span className="e">{skin.tiles.guide}</span>
          <span className="grow">
            <b>How to use</b> · shows you where to tap
          </span>
          <span>›</span>
        </button>
        {groups.map((g) => (
          <div key={g.label}>
            <div className="group-label">{g.label}</div>
            <div className="tiles">
              {g.tiles.map((x) => (
                <button key={x.k} className={`tile ${x.c}`} data-tour={`tile-${x.k}`} onClick={() => go(x.r)}>
                  <span className="e">{skin.tiles[x.k]}</span>
                  <span>
                    <div className="t">{x.t}</div>
                    <div className="d">{x.d}</div>
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
        <button className="big-tile" data-tour="retire" onClick={() => go({ name: 'retire' })}>
          <span className="e">{skin.tiles.retire}</span>
          <span>
            <div className="t">Will my money be enough?</div>
            <div className="d">Plan to retirement, check your money’s health and meet your adventurer</div>
          </span>
          <span className="go">›</span>
        </button>
        <div className="center tiny muted mt">Money Tracking v{APP_VERSION}</div>
      </div>
    </>
  );
}
