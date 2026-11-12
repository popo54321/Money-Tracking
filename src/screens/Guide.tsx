// "How to use this app": a short guide in pages. It opens by itself for someone new (no accounts yet) and can be
// reopened any time from More.
import { useState, type TouchEvent } from 'react';
import { Topbar } from '../components/ui';
import { updateSettings } from '../db/repo';
import { useApp } from '../state/app';

const PAGES: { e: string; t: string; lines: string[] }[] = [
  {
    e: '👋',
    t: 'Welcome to Money Tracking',
    lines: [
      'Log what you spend and earn, see what is truly free to spend, and plan ahead.',
      'Everything stays on your phone. It works offline; only live prices need the internet.',
      'Swipe or tap Next to see how it works. It takes about a minute.',
    ],
  },
  {
    e: '➕',
    t: 'Log money in seconds',
    lines: [
      'Tap the big + at the bottom. Choose Spend, Income or Move (between your own accounts).',
      'The keypad does sums for you, such as 120+45.',
      'Notes remember words you have used before; start typing and pick one.',
      'Splitting a bill or a trip? Use Bill split or Travel split in More.',
    ],
  },
  {
    e: '🏦',
    t: 'Accounts and what is Free',
    lines: [
      'Accounts shows every account, card and cash, with your net worth and liquid money at the top.',
      'Free = the balance, minus money set aside for bills, splits and saving targets. Red means more is claimed than is there.',
      'Credit cards show what you owe and when it is due. An overdue statement appears at the top of Home with Pay and Already paid.',
    ],
  },
  {
    e: '🔁',
    t: 'Repeating bills and Payday',
    lines: [
      'Add bills, subscriptions and income once (More → Repeating). They record themselves on the day.',
      'The next payment is set aside in its account, so Free stays honest. Yearly bills build up month by month.',
      'Set up 💰 Payday at the top of Repeating: full salary, take-home and what is taken off. If your pay comes early, tap “Payday’s here” on Home.',
    ],
  },
  {
    e: '🎯',
    t: 'Limits, saving targets and budget',
    lines: [
      'Monthly limits (set on Categories) show what is left and about how much a day, counting payments still to come.',
      'Saving targets keep track of money put aside in an account, with a monthly add on the day you choose.',
      'The budget plan is just for planning: phases, amounts and the monthly transfers checklist.',
    ],
  },
  {
    e: '🧾',
    t: 'Splitting and owing',
    lines: [
      'Bill split: who ate what, service charge, VAT, tip and rounding, and who pays for whom.',
      'Travel split: a trip’s costs in any currency, settled up at the end.',
      'Who owes me: loans and repayments, with interest if you want it.',
    ],
  },
  {
    e: '📋',
    t: 'Month close and handy tools',
    lines: [
      'Month close gives each month’s numbers in your spreadsheet’s order, with charts. Tap a number to copy it.',
      'The currency converter covers any currency, Bitcoin and gold.',
      '“Will my money be enough?” (the big button at the bottom of More) plans your money all the way to retirement.',
    ],
  },
  {
    e: '💡',
    t: 'Handy tips',
    lines: [
      'Press and hold almost anything to edit it, move it or see more.',
      'Every delete can be undone from the message that appears.',
      'Pick a theme, add a second user and back up your data in Settings. The app updates itself.',
      'You can read this guide again any time: More → How to use.',
    ],
  },
];

export function Guide() {
  const { back } = useApp();
  const [i, setI] = useState(0);
  const [x0, setX0] = useState<number | null>(null);
  const last = i === PAGES.length - 1;
  const finish = () => {
    void updateSettings({ guideSeen: true });
    back();
  };
  const go = (n: number) => setI(Math.max(0, Math.min(PAGES.length - 1, n)));
  const p = PAGES[i];
  return (
    <div className="guide-screen">
      <Topbar
        title="How to use"
        right={
          <button className="btn sm ghost" onClick={finish}>
            {last ? 'Done' : 'Skip'}
          </button>
        }
      />
      <div
        className="page guide-page"
        onTouchStart={(e: TouchEvent) => setX0(e.touches[0].clientX)}
        onTouchEnd={(e: TouchEvent) => {
          if (x0 === null) return;
          const dx = e.changedTouches[0].clientX - x0;
          if (dx < -50) go(i + 1);
          if (dx > 50) go(i - 1);
          setX0(null);
        }}
      >
        <div className="card guide-card" key={i}>
          <div className="guide-e">{p.e}</div>
          <h2>{p.t}</h2>
          {p.lines.map((l) => (
            <p key={l}>{l}</p>
          ))}
        </div>
        <div className="guide-dots" aria-label={`Page ${i + 1} of ${PAGES.length}`}>
          {PAGES.map((_, n) => (
            <button key={n} className={n === i ? 'on' : ''} onClick={() => go(n)} aria-label={`Page ${n + 1}`} />
          ))}
        </div>
        <div className="btn-row">
          <button className="btn ghost" disabled={i === 0} onClick={() => go(i - 1)}>
            ‹ Back
          </button>
          <button className="btn primary" onClick={() => (last ? finish() : go(i + 1))}>
            {last ? 'Start using the app' : 'Next ›'}
          </button>
        </div>
      </div>
    </div>
  );
}
