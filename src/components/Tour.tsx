// "How to use": a tour that points at the real buttons. It switches to the right tab, dims the screen, rings the
// button and says where to tap. It starts by itself for someone new and again from More → How to use.
import { useCallback, useEffect, useLayoutEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { updateSettings } from '../db/repo';
import { useApp, type Route } from '../state/app';
import { onViewChange } from '../db/db';
import { closeDemo, isDemo, openDemo } from '../services/demo';
import { isNative, openExternal } from '../services/platform';
import { canInstallNow, installNow } from '../services/press';

type Tab = 'home' | 'accounts' | 'summary' | 'more';
interface Step {
  /** a tab, or a screen opened from More (Bill split, Settings…) */
  at: Tab | Route;
  /** what to point at (the first match on screen); missing on screen = the step is skipped */
  target: string;
  title: string;
  text: string;
  /** the "install it on your phone" card (only when the app is open in a browser, not installed) */
  install?: boolean;
  /** the target is inside the built-in "Will my money be enough?" calculator (after opening this tab of it) */
  calc?: 'tabCalc' | 'tabDet' | 'tabSum';
}
interface Section {
  id: string;
  emoji: string;
  title: string;
  steps: Step[];
}

/** Open in a phone or computer browser, not yet installed (the Android app and a home-screen app skip the step). */
function needsInstall(): boolean {
  if (isNative()) return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return !(window.matchMedia?.('(display-mode: standalone)').matches || nav.standalone);
}
const isIPhone = () =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes('Mac') && navigator.maxTouchPoints > 1);
const isAndroid = () => /Android/.test(navigator.userAgent);

const tile = (k: string) => `[data-tour="tile-${k}"]`;
const PAGE = '.topbar h1';

const SECTIONS: Section[] = [
  {
    id: 'start',
    emoji: '🚀',
    title: 'Getting started',
    steps: [
      { at: 'home', target: '', title: 'Install it on your phone', text: '', install: true },
      {
        at: 'home',
        target: '[data-tour="tab-home"]',
        title: 'This is Home (with example money)',
        text: 'The tour shows a made-up person, Alex, so every screen is filled in. Your own money is safe and comes back when the tour ends.',
      },
      {
        at: 'home',
        target: '[data-tour="hero"]',
        title: 'Your money at a glance',
        text: 'Net worth (everything you own minus what you owe), Liquid (money you can reach) and Free: what’s left after bills, splits and saving targets are set aside. Spend from Free.',
      },
      {
        at: 'home',
        target: '[data-tour="quick"]',
        title: 'Log money here',
        text: 'Spend, Income or Move. Move is money between your own accounts, like paying the card from the bank: it isn’t spending.',
      },
      {
        at: 'home',
        target: '[data-tour="limits"]',
        title: 'Spending limits',
        text: 'Each limit shows what’s left and about how much a day you can spend. Bills still to come this month are counted already.',
      },
      { at: 'home', target: '[data-tour="add"]', title: 'Or tap +', text: 'The + adds a spending entry from any screen.' },
      {
        at: 'accounts',
        target: '[data-tour="add-account"]',
        title: 'Add your accounts first',
        text: 'Bank accounts, cash, credit cards, investments, Bitcoin and gold. Type the balance your bank shows; you can correct it any time in ✏️ Edit.',
      },
      {
        at: 'accounts',
        target: '.list button.row',
        title: 'Every account',
        text: 'Each shows its balance and what’s Free in it. Press and hold one for quick actions (spend, move, pay the card).',
      },
      {
        at: { name: 'account', id: 'd-bank' },
        target: '[data-tour="acct-hero"]',
        title: 'Inside an account',
        text: 'Balance, what’s set aside for bills and targets, and what’s Free. Its entries are listed below.',
      },
      {
        at: { name: 'account', id: 'd-bank' },
        target: '[data-tour="acct-reserve"]',
        title: 'Set aside for bills',
        text: 'Rent and other bills paid from this account are kept aside before they’re due, so you don’t spend them by mistake.',
      },
      {
        at: { name: 'account', id: 'd-card' },
        target: '[data-tour="acct-statement"]',
        title: 'Credit cards',
        text: 'A card shows this statement, when it’s due and a Pay button. Its paying bank keeps the money aside until you pay.',
      },
    ],
  },
  {
    id: 'entries',
    emoji: '✍️',
    title: 'Entries and money back',
    steps: [
      {
        at: { name: 'entry', id: 'demo-dinner' },
        target: '.amount-display',
        title: 'An entry',
        text: 'Amount (the keypad does sums like 500+120), which account, a note, the date and the category. Tap an entry anywhere to open it like this.',
      },
      {
        at: { name: 'entry', id: 'demo-dinner' },
        target: '.card.flat:has(.btn.mint)',
        title: 'Money back',
        text: 'Alex paid ฿2,400 for dinner and Ben sent ฿1,600 back. Money back takes it off Dinner (so the limit gets room back), not counted as income. “＋ Got money back” adds more.',
      },
      {
        at: 'home',
        target: '.list button.row',
        title: 'Quick actions',
        text: 'Press and hold any entry: edit, duplicate, delete, or “💸 Got money back”.',
      },
    ],
  },
  {
    id: 'summary',
    emoji: '📊',
    title: 'Summary, categories and limits',
    steps: [
      {
        at: 'summary',
        target: '[data-tour="tab-summary"]',
        title: 'Where your money went',
        text: 'Income and spending by category for any month, quarter or year, compared with the one before.',
      },
      {
        at: 'summary',
        target: '[data-tour="summary-cat"]',
        title: 'Each category',
        text: 'Its total, its share of spending and what came back. Tap it for its entries; press and hold to edit it or set a limit.',
      },
      {
        at: 'more',
        target: tile('categories'),
        title: 'Categories and limits',
        text: 'Rename, add emoji, group them, and set a limit per month, quarter or year on a category or a whole group.',
      },
    ],
  },
  {
    id: 'repeating',
    emoji: '🔁',
    title: 'Bills, subscriptions and payday',
    steps: [
      {
        at: 'more',
        target: tile('recurring'),
        title: 'Repeating',
        text: 'Rent, subscriptions, insurance and salary: tap Repeating.',
      },
      {
        at: { name: 'recurring' },
        target: '.list button.row',
        title: 'Each repeating entry',
        text: 'It records itself on the day. Yearly ones (like insurance) build up a little each month so the money is there in time.',
      },
      {
        at: { name: 'payday' },
        target: '[data-tour="payday-card"]',
        title: 'Your payday',
        text: 'Full salary in, tax and deductions out, so the account goes up by your take-home pay. It records itself on the day, or tap “Pay arrived” early.',
      },
    ],
  },
  {
    id: 'bills',
    emoji: '🍽️',
    title: 'Bill split',
    steps: [
      { at: 'more', target: tile('bills'), title: 'Bill split', text: 'For eating out with friends.' },
      {
        at: { name: 'bills' },
        target: '[data-tour="new-bill"]',
        title: 'Start a bill',
        text: 'Tap ＋ New bill. Here is Alex’s Friday dinner, already filled in.',
      },
      {
        at: { name: 'bill', id: 'demo-bill' },
        target: '[data-tour="bill-total"]',
        title: 'The total and each share',
        text: 'Food, service charge and VAT add up to the bill; each person’s share is worked out fairly from what they had.',
      },
      {
        at: { name: 'bill', id: 'demo-bill' },
        target: '[data-tour="bill-people"]',
        title: 'People',
        text: 'Add everyone at the table.',
      },
      {
        at: { name: 'bill', id: 'demo-bill' },
        target: '[data-tour="bill-shared-items"]',
        title: 'Shared dishes',
        text: 'Dishes shared by some or all: tick who had them and the price is split between just those people (the tom yum is everyone’s, the beers just two).',
      },
      {
        at: { name: 'bill', id: 'demo-bill' },
        target: '[data-tour="bill-own"]',
        title: 'Own orders',
        text: 'Each person’s own dishes; a dish two people shared (the beers) is split between just them.',
      },
      {
        at: { name: 'bill', id: 'demo-bill' },
        target: '[data-tour="bill-charges"]',
        title: 'Service charge, VAT and tip',
        text: 'Set the %; they are shared out in proportion to what each person ordered.',
      },
      {
        at: { name: 'bill', id: 'demo-bill' },
        target: '[data-tour="bill-payers"]',
        title: 'Who paid',
        text: 'One person or several. It shows the fewest payments to settle up, and “Add to Who owes me” keeps track of who still owes.',
      },
      {
        at: { name: 'bill', id: 'demo-bill' },
        target: '[data-tour="bill-log"]',
        title: 'Log it in your money',
        text: '“I paid it all” logs the whole bill and adds friends to Who owes me; their paybacks come off Dinner as money back.',
      },
      {
        at: { name: 'bill', id: 'demo-bill' },
        target: '[data-tour="bill-settled"]',
        title: 'Settled',
        text: 'When everyone has paid, mark it as settled to hide it from the list.',
      },
    ],
  },
  {
    id: 'trips',
    emoji: '🧳',
    title: 'Trip split',
    steps: [
      { at: 'more', target: tile('trips'), title: 'Trip split', text: 'For trips, days out and anything you do with a group.' },
      {
        at: { name: 'trip', id: 'demo-trip' },
        target: '[data-tour="trip-settle"]',
        title: 'Settle up',
        text: 'Who pays whom at the end, in the currency you choose, with the fewest payments.',
      },
      {
        at: { name: 'trip', id: 'demo-trip' },
        target: '[data-tour="trip-people"]',
        title: 'People',
        text: 'Everyone on the trip.',
      },
      {
        at: { name: 'trip', id: 'demo-trip' },
        target: '[data-tour="trip-rates"]',
        title: 'Exchange rates',
        text: 'The trip’s own fixed rates, filled in from today’s and editable, so everyone agrees on the numbers.',
      },
      {
        at: { name: 'trip', id: 'demo-trip' },
        target: '[data-tour="trip-bills"]',
        title: 'Bills',
        text: 'Each bill: who paid, how much, in which currency, which day, and who shares it (everyone, some, or just the payer). A big dinner can be split in detail like Bill split.',
      },
      {
        at: { name: 'trip', id: 'demo-trip' },
        target: '[data-tour="trip-log"]',
        title: 'Log the bills you paid',
        text: 'Each bill you paid goes into your money as its own entry, on its own day.',
      },
      {
        at: { name: 'trip', id: 'demo-trip' },
        target: '[data-tour="trip-settled"]',
        title: 'Settled',
        text: 'Mark the trip as settled when everyone has paid.',
      },
    ],
  },
  {
    id: 'debts',
    emoji: '🤝',
    title: 'Who owes me',
    steps: [
      { at: 'more', target: tile('debts'), title: 'Who owes me', text: 'Money you lent or borrowed.' },
      {
        at: { name: 'debts' },
        target: '.list button.row',
        title: 'Everyone',
        text: 'Who owes you, and who you owe. “Summary for everyone” copies it all for a group chat.',
      },
      {
        at: { name: 'debt', id: 'demo-debt-ben' },
        target: '[data-tour="debt-hero"]',
        title: 'One person',
        text: 'What they owe now, what was paid back, and interest if you set any.',
      },
      {
        at: { name: 'debt', id: 'demo-debt-ben' },
        target: '[data-tour="debt-paid"]',
        title: 'When they pay you back',
        text: '“＋ Paid back”, then log it in your money: as money back on a category (for a dinner you paid) or as income.',
      },
    ],
  },
  {
    id: 'budget',
    emoji: '🗺️',
    title: 'Budget plan',
    steps: [
      {
        at: { name: 'budget' },
        target: '[data-tour="budget-hero"]',
        title: 'Your monthly plan',
        text: 'Your income and how much of it the plan uses. Make a phase for each stage of life.',
      },
      {
        at: { name: 'budget' },
        target: '[data-tour="budget-lines"]',
        title: 'Where the money goes',
        text: 'An amount for each line (saving, investing, living costs, fun), each shown as a % of income.',
      },
      {
        at: { name: 'budget' },
        target: '[data-tour="budget-transfers"]',
        title: 'Monthly transfers',
        text: 'Tick each transfer as you do it; “Record ticked” records the moves (even into Bitcoin or another currency).',
      },
      {
        at: { name: 'budget' },
        target: '[data-tour="budget-bonus"]',
        title: 'Bonus split',
        text: 'How a bonus is shared out, by %.',
      },
      {
        at: { name: 'budget' },
        target: '[data-tour="budget-leftover"]',
        title: 'Leftover money rule',
        text: 'Where money left over goes, depending on whether your emergency fund is big enough yet.',
      },
    ],
  },
  {
    id: 'goals',
    emoji: '🎯',
    title: 'Saving targets',
    steps: [
      {
        at: { name: 'goals' },
        target: '[data-tour="goals-hero"]',
        title: 'Saving targets',
        text: 'Everything you’re saving for, together.',
      },
      {
        at: { name: 'goals' },
        target: '[data-tour="goal-card"]',
        title: 'One target',
        text: 'Price, saved so far and the monthly saving: it says when you can buy it. Kept in an account, it’s set aside there so Free stays true.',
      },
      {
        at: { name: 'goals' },
        target: '[data-tour="add-goal"]',
        title: 'Add one',
        text: 'Tap ＋ Add to wishlist.',
      },
    ],
  },
  {
    id: 'wealth',
    emoji: '📈',
    title: 'Investments, Bitcoin and gold',
    steps: [
      {
        at: { name: 'wealth' },
        target: '.hero',
        title: 'Everything you invest',
        text: 'Funds, stocks, Bitcoin and gold: what they’re worth, what you put in, and the profit.',
      },
      {
        at: { name: 'wealth' },
        target: '[data-tour="wealth-invest"]',
        title: 'Each investment',
        text: 'Put in ฿110,000, now worth more: the profit and %. 📈 Value updates what it’s worth; 💰 sets what you put in.',
      },
      {
        at: { name: 'wealth' },
        target: '[data-tour="wealth-invest"]',
        title: 'Money in and out',
        text: 'Money moved in adds to what you put in. Money moved out takes it out in the same share as the value, so your profit % stays true. Dividends count as profit.',
      },
      {
        at: { name: 'wealth' },
        target: '[data-tour="wealth-btc"]',
        title: 'Bitcoin and gold',
        text: 'Live prices, your holding across all wallets, the overall capital (tap Paid) and the average cost.',
      },
    ],
  },
  {
    id: 'retire',
    emoji: '🔭',
    title: 'Will my money be enough?',
    steps: [
      {
        at: 'more',
        target: '[data-tour="retire"]',
        title: 'Will my money be enough?',
        text: 'Your retirement and money-health check. Tap this big button to open it.',
      },
      {
        at: { name: 'retire' },
        target: '[data-tour="retire-fill"]',
        title: 'Fill it from your money',
        text: 'One tap puts what your investments, Bitcoin and gold are worth into “Pot today”.',
      },
      {
        at: { name: 'retire' },
        calc: 'tabCalc',
        target: '#h-inputs',
        title: 'Your numbers',
        text: 'Everything starts here. The tabs at the top are Calculator (your numbers), Details (the deeper answers) and Result (your level).',
      },
      {
        at: { name: 'retire' },
        calc: 'tabCalc',
        target: '#start',
        title: 'Pot today',
        text: 'What you have invested now. The Investments & wealth button above can fill it for you.',
      },
      {
        at: { name: 'retire' },
        calc: 'tabCalc',
        target: '#monthly',
        title: 'Investing each month',
        text: 'How much you add every month. Next to it you can raise it each year and set inflation.',
      },
      {
        at: { name: 'retire' },
        calc: 'tabCalc',
        target: '#growth',
        title: 'Growth',
        text: 'How much your investments grow a year on average, before inflation. The next box is the growth after you retire (usually lower and safer).',
      },
      {
        at: { name: 'retire' },
        calc: 'tabCalc',
        target: '#age',
        title: 'Ages',
        text: 'Your age now and when you want to retire. You can also tick that you never plan to retire.',
      },
      {
        at: { name: 'retire' },
        calc: 'tabCalc',
        target: '#spend',
        title: 'Spending after retirement',
        text: 'What you would spend each month then, in today’s money. Inflation is added for you.',
      },
      {
        at: { name: 'retire' },
        calc: 'tabCalc',
        target: '#s-today',
        title: 'Your money today',
        text: 'Income, spending, debts and cash. It checks your money’s health: emergency cash, debt load and how much you keep each month.',
      },
      {
        at: { name: 'retire' },
        calc: 'tabCalc',
        target: '#s-life',
        title: 'Life checklist',
        text: 'Job, home, car, children, big plans, a will: each answer adjusts the advice.',
      },
      {
        at: { name: 'retire' },
        calc: 'tabCalc',
        target: '#s-ins',
        title: 'Insurance',
        text: 'Health, life, home, car and income cover. It flags what is missing for your situation.',
      },
      {
        at: { name: 'retire' },
        calc: 'tabSum',
        target: '#rpg',
        title: 'Your result and adventurer',
        text: 'Result shows your level (1 to 30) with your theme’s adventurer, and what would take you to the next level. Save or share it as a picture.',
      },
      {
        at: { name: 'retire' },
        calc: 'tabDet',
        target: '#s-ret',
        title: 'After you retire',
        text: 'How long your money lasts, year by year, and the age it runs out (if it does).',
      },
      {
        at: { name: 'retire' },
        calc: 'tabDet',
        target: '#s-scen',
        title: 'When could you stop adding money?',
        text: 'The age from which your pot can grow on its own and still be enough.',
      },
      {
        at: { name: 'retire' },
        calc: 'tabDet',
        target: '#s-mkt',
        title: 'Markets up and down',
        text: 'What happens with good and bad years along the way, not just the average.',
      },
      {
        at: { name: 'retire' },
        calc: 'tabDet',
        target: '#s-ages',
        title: 'Retiring earlier or later',
        text: 'How a few years earlier or later changes the answer.',
      },
      {
        at: { name: 'retire' },
        calc: 'tabDet',
        target: '#s-pay',
        title: 'How much to invest',
        text: 'The monthly amount that makes the money last all the way, if what you invest now isn’t enough.',
      },
      {
        at: { name: 'retire' },
        calc: 'tabDet',
        target: '#s-plans',
        title: 'Compare plans',
        text: 'Save two plans (A and B) and see them side by side.',
      },
    ],
  },
  {
    id: 'family',
    emoji: '👨‍👩‍👧',
    title: 'Family sharing',
    steps: [
      {
        at: { name: 'settings' },
        target: '[data-tour="settings-family"]',
        title: 'Family sharing',
        text: 'In Settings. Link up to 10 phones.',
      },
      {
        at: { name: 'family' },
        target: '[data-tour="family-start"]',
        title: 'Start or join',
        text: 'One phone starts the family and makes a one-time code (15 minutes); the others type it under Join. The phone that starts it is the head: it invites and removes phones.',
      },
      {
        at: { name: 'account', id: 'd-joint' },
        target: '.banner',
        title: 'Shared accounts',
        text: 'Open an account → ✏️ Edit → Share with family, and tick phones. Everyone sees all its entries and adds their own (Sam’s groceries here); each can only change their own. Any phone can share, like a spare card for a child.',
      },
      {
        at: { name: 'family' },
        target: '[data-tour="family-start"]',
        title: 'See each other’s money',
        text: '“👀 See their money” (or the user switcher) opens another phone’s whole money, read-only. The head chooses who can see whose with “👥 Who can see”.',
      },
      {
        at: { name: 'family' },
        target: '[data-tour="family-start"]',
        title: 'Lost a phone?',
        text: 'Every phone keeps a family backup. On another phone tap 🆘 Lost next to it: the code it shows puts that phone’s place and data back on a new phone.',
      },
    ],
  },
  {
    id: 'settings',
    emoji: '⚙️',
    title: 'Settings and backup',
    steps: [
      {
        at: { name: 'settings' },
        target: '[data-tour="backup"]',
        title: 'Back up',
        text: 'Save a backup file now and then (to Drive, email or Files). Restore puts it back on any phone.',
      },
      {
        at: { name: 'settings' },
        target: PAGE,
        title: 'Make it yours',
        text: 'Theme, main currency, a second user (each with their own money) and updates.',
      },
      {
        at: 'more',
        target: '[data-tour="tile-guide"]',
        title: 'See this again',
        text: 'Tap How to use whenever you want to learn a part again.',
      },
    ],
  },
];

const ALL_STEPS = SECTIONS.flatMap((x) => x.steps);

// the tour's state, shared with whoever starts it: off, choosing a part, or running some steps
type TourState = { mode: 'off' } | { mode: 'pick' } | { mode: 'run'; steps: Step[] };
let running: TourState = { mode: 'off' };
const listeners = new Set<() => void>();
const setRunning = (v: TourState) => {
  running = v;
  listeners.forEach((l) => l());
};
/** Run some steps on the example money (opened first, so the app is already showing it). */
async function runSteps(steps: Step[]): Promise<void> {
  try {
    await openDemo();
  } catch {
    // without the example money the steps still point at this phone's own screens
  }
  setRunning({ mode: 'run', steps });
}

/** 'all' runs every part (someone new); 'pick' lets them choose a part first (More → How to use). */
export function startTour(how: 'all' | 'pick' = 'all'): void {
  if (how === 'pick') setRunning({ mode: 'pick' });
  else void runSteps(ALL_STEPS);
}

/** Stop the tour and go back to this phone's own money. */
export function endTour(): void {
  setRunning({ mode: 'off' });
  closeDemo();
  void updateSettings({ guideSeen: true });
}
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** The built-in calculator's page, when it is on screen. */
function calcFrame(): HTMLIFrameElement | null {
  return document.querySelector('iframe.retire-frame');
}

/** Find a step's button on screen (inside the calculator for its steps), with where it is on the whole screen. */
function locate(step: Step): { el: Element; rect: DOMRect } | null {
  if (!step.calc) {
    const el = [...document.querySelectorAll(step.target)].find(visible);
    return el ? { el, rect: el.getBoundingClientRect() } : null;
  }
  const frame = calcFrame();
  const doc = frame?.contentDocument;
  if (!frame || !doc || doc.readyState !== 'complete') return null;
  const el = [...doc.querySelectorAll(step.target)].find(visible);
  if (!el) return null;
  const f = frame.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  // only the part showing inside the calculator's frame
  const top = Math.max(f.top + r.top, f.top);
  const bottom = Math.min(f.top + r.bottom, f.bottom);
  return { el, rect: new DOMRect(f.left + r.left, top, r.width, Math.max(24, bottom - top)) };
}

const visible = (el: Element) => {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
};

export function Tour() {
  const state = useSyncExternalStore(subscribe, () => running);
  const on = state.mode === 'run';
  const { tab, go, stackDepth, route, settings } = useApp();
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  // the steps for this run: the install card only for someone using the app in a browser
  const steps = useMemo(
    () => (state.mode === 'run' ? state.steps.filter((s) => !s.install || needsInstall()) : ALL_STEPS),
    [state],
  );
  const step = steps[Math.min(i, steps.length - 1)];
  // a new run (a part picked) starts from its first step
  useEffect(() => setI(0), [state]);

  const finish = useCallback(() => {
    setI(0);
    setRect(null);
    endTour();
    tab('home');
  }, [tab]);
  // the example money was closed some other way: the tour ends too
  useEffect(
    () =>
      onViewChange(() => {
        if (running.mode === 'run' && !isDemo()) setRunning({ mode: 'off' });
      }),
    [],
  );

  // go to the step's tab, then find its button (waiting for the screen to draw); skip steps with nothing to show
  useEffect(() => {
    if (!on) return;
    if (typeof step.at === 'string') {
      if (stackDepth !== 1 || route.name !== step.at) tab(step.at);
    } else if (route.name !== step.at.name || (step.at as { id?: string }).id !== (route as { id?: string }).id) {
      // a screen opened from More (or from Settings for Family sharing)
      tab('more');
      if (step.at.name === 'family') go({ name: 'settings' });
      go(step.at);
    }
    if (step.install) {
      setRect(null);
      return;
    }
    let tries = 0;
    let timer = 0;
    let tabbed = false;
    const find = () => {
      // calculator steps: open the right tab of it first
      if (step.calc && !tabbed) {
        const tabBtn = calcFrame()?.contentDocument?.getElementById(step.calc) as HTMLElement | null;
        if (tabBtn) {
          tabBtn.click();
          tabbed = true;
        }
      }
      const hit = locate(step);
      if (hit) {
        hit.el.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
        setRect(locate(step)?.rect ?? hit.rect);
        return;
      }
      // the calculator takes a moment to load
      if (++tries < (step.calc ? 60 : 20)) timer = window.setTimeout(find, step.calc ? 100 : 60);
      else if (i < steps.length - 1) setI(i + 1);
      else finish();
    };
    setRect(null);
    timer = window.setTimeout(find, 80);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, i]);

  // keep the ring on the button when the screen moves
  useLayoutEffect(() => {
    if (!on || !rect || !step.target) return;
    const again = () => {
      const hit = locate(step);
      if (hit) setRect(hit.rect);
    };
    const inner = step.calc ? calcFrame()?.contentWindow : null;
    window.addEventListener('resize', again);
    window.addEventListener('scroll', again, true);
    inner?.addEventListener('scroll', again, true);
    return () => {
      window.removeEventListener('resize', again);
      window.removeEventListener('scroll', again, true);
      inner?.removeEventListener('scroll', again, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, rect, step.target]);

  if (state.mode === 'pick') return <TourPicker />;
  if (!on) return null;
  const pad = 6;
  const vh = window.innerHeight;
  const below = rect ? rect.bottom + 190 < vh : true;
  const bubbleTop = rect ? (below ? rect.bottom + pad + 12 : undefined) : vh / 2 - 90;
  const bubbleBottom = rect && !below ? vh - rect.top + pad + 12 : undefined;
  const last = i === steps.length - 1;
  const androidApp = `https://github.com/${settings.githubRepo}/releases/latest`;
  return (
    <div className="tour" role="dialog" aria-label="How to use this app" onClick={(e) => e.stopPropagation()}>
      {rect ? (
        <div
          className="tour-ring"
          style={{ left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }}
        />
      ) : (
        <div className="tour-dim" />
      )}
      {(rect || step.install) && (
        <div
          className={`tour-bubble ${step.install ? 'centre' : below ? 'below' : 'above'}`}
          style={step.install ? undefined : { top: bubbleTop, bottom: bubbleBottom }}
        >
          <div className="tour-count">
            {i + 1} of {steps.length}
          </div>
          <div className="tour-title">
            {step.install ? '📲' : '👆'} {step.title}
          </div>
          {step.install ? <InstallSteps androidApp={androidApp} /> : <div className="tour-text">{step.text}</div>}
          <div className="tour-buttons">
            <button className="btn sm ghost" onClick={finish}>
              Skip
            </button>
            <span className="grow" />
            {i > 0 && (
              <button className="btn sm ghost" onClick={() => setI(i - 1)}>
                ‹ Back
              </button>
            )}
            <button className="btn sm primary" onClick={() => (last ? finish() : setI(i + 1))}>
              {last ? 'Done' : 'Next ›'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** More → How to use: the whole tour, or one part of it. */
function TourPicker() {
  const close = () => setRunning({ mode: 'off' });
  return (
    <div className="tour" role="dialog" aria-label="How to use this app">
      <div className="tour-dim" onClick={close} />
      <div className="tour-bubble centre tour-pick">
        <div className="tour-title">📖 What would you like to learn?</div>
        <button className="btn primary block" onClick={() => void runSteps(ALL_STEPS)}>
          ▶ The whole tour
        </button>
        <div className="tour-pick-list">
          {SECTIONS.map((x) => (
            <button key={x.id} className="btn block" onClick={() => void runSteps(x.steps)}>
              <span>{x.emoji}</span> <span className="grow">{x.title}</span> <span className="muted small">{x.steps.length}</span>
            </button>
          ))}
        </div>
        <button className="btn ghost block" onClick={close}>
          Close
        </button>
      </div>
    </div>
  );
}

/** How to put the app on this phone: iPhone (Safari), Android (install now, Chrome's menu, or the Android app). */
function InstallSteps({ androidApp }: { androidApp: string }) {
  const [canNow, setCanNow] = useState(canInstallNow());
  const iphone = isIPhone();
  const android = isAndroid();
  return (
    <div className="tour-text">
      {iphone ? (
        <ol className="tour-steps">
          <li>
            Open this page in <b>Safari</b>.
          </li>
          <li>
            Tap the <b>Share</b> button <span className="tour-key">⬆︎</span> at the bottom of the screen.
          </li>
          <li>
            Scroll down and tap <b>Add to Home Screen</b>, then <b>Add</b>.
          </li>
          <li>Open Money Tracking from your home screen. It works offline.</li>
        </ol>
      ) : android ? (
        <>
          {canNow ? (
            <button
              className="btn primary block"
              onClick={async () => {
                await installNow();
                setCanNow(false);
              }}
            >
              📲 Install now
            </button>
          ) : (
            <ol className="tour-steps">
              <li>
                In Chrome, tap the menu <span className="tour-key">⋮</span> at the top right.
              </li>
              <li>
                Tap <b>Install app</b> (or <b>Add to Home screen</b>).
              </li>
            </ol>
          )}
          <p className="tour-or">
            Or get the full Android app:{' '}
            <a
              href={androidApp}
              onClick={(e) => {
                e.preventDefault();
                void openExternal(androidApp);
              }}
            >
              download it here
            </a>
            , then open the file and allow the install.
          </p>
        </>
      ) : (
        <ol className="tour-steps">
          <li>
            Open this page on your phone. <b>iPhone:</b> in Safari, tap Share <span className="tour-key">⬆︎</span>, then{' '}
            <b>Add to Home Screen</b>.
          </li>
          <li>
            <b>Android:</b> in Chrome, tap <span className="tour-key">⋮</span>, then <b>Install app</b>, or{' '}
            <a
              href={androidApp}
              onClick={(e) => {
                e.preventDefault();
                void openExternal(androidApp);
              }}
            >
              download the Android app
            </a>
            .
          </li>
        </ol>
      )}
    </div>
  );
}
