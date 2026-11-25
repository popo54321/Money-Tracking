// "How to use": a tour that points at the real buttons. It switches to the right tab, dims the screen, rings the
// button and says where to tap. It starts by itself for someone new and again from More → How to use.
import { useCallback, useEffect, useLayoutEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { updateSettings } from '../db/repo';
import { useApp, type Route } from '../state/app';
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
      { at: 'home', target: '[data-tour="tab-home"]', title: 'This is Home', text: 'Tap Home any time to come back here.' },
      {
        at: 'home',
        target: '[data-tour="hero"]',
        title: 'Your money at a glance',
        text: 'Net worth, how much is liquid and how much is truly Free to spend, with this month’s income and spending.',
      },
      {
        at: 'home',
        target: '[data-tour="quick"]',
        title: 'Log money here',
        text: 'Tap Spend, Income or Move to add an entry. Move is for money going between your own accounts.',
      },
      { at: 'home', target: '[data-tour="add"]', title: 'Or tap +', text: 'The + adds a spending entry from any screen.' },
      {
        at: 'accounts',
        target: '[data-tour="tab-accounts"]',
        title: 'Your accounts',
        text: 'Tap Accounts to see every bank account, card and cash purse.',
      },
      {
        at: 'accounts',
        target: '[data-tour="add-account"]',
        title: 'Start here',
        text: 'Tap this to add your bank accounts, credit cards and cash. Do this first.',
      },
      {
        at: 'accounts',
        target: '.list button.row',
        title: 'Open an account',
        text: 'Tap an account to see its entries and what is set aside. Tap ✏️ Edit there to change its balance to match your bank.',
      },
    ],
  },
  {
    id: 'entries',
    emoji: '✍️',
    title: 'Entries and money back',
    steps: [
      {
        at: 'home',
        target: '.list button.row',
        title: 'Change an entry',
        text: 'Tap an entry to edit it. Press and hold it for quick actions: edit, duplicate, delete.',
      },
      {
        at: 'home',
        target: '.list button.row',
        title: 'Got money back?',
        text: 'Paid for friends, or got a refund? Hold the spending and pick “💸 Got money back” (or tap it and use “＋ Got money back”). It takes the amount off that category, not counted as income.',
      },
      {
        at: 'home',
        target: '[data-tour="quick"]',
        title: 'Typing amounts',
        text: 'The keypad does sums (500+120). When a number is already there, the first digit you type replaces it; start with + − × ÷ to add to it.',
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
        text: 'Tap Summary to see spending and income by category, for any month, compared with the month before.',
      },
      { at: 'more', target: '[data-tour="tab-more"]', title: 'Everything else', text: 'Tap More for all the other tools.' },
      {
        at: 'more',
        target: tile('categories'),
        title: 'Categories and limits',
        text: 'Tap Categories to rename them, change emoji or set a limit per month, quarter or year. Limits show on Home with how much is left a day.',
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
        text: 'Tap Repeating for anything that comes again: rent, Spotify, insurance. They record themselves on the day.',
      },
      {
        at: { name: 'recurring' },
        target: '[data-tour="payday"]',
        title: 'Your payday',
        text: 'Set up your salary here: the full pay comes in and deductions go out, so the account goes up by your take-home pay.',
      },
      {
        at: { name: 'recurring' },
        target: PAGE,
        title: 'Money set aside',
        text: 'Upcoming bills are set aside in the account that pays them, so Free shows what you can really spend. Yearly bills build up a little each month.',
      },
    ],
  },
  {
    id: 'bills',
    emoji: '🍽️',
    title: 'Bill split',
    steps: [
      { at: 'more', target: tile('bills'), title: 'Bill split', text: 'For eating out with friends: tap Bill split.' },
      {
        at: { name: 'bills' },
        target: '[data-tour="new-bill"]',
        title: 'Start a bill',
        text: 'Tap ＋ New bill, add the people, then each dish and who had it. Shared dishes are split between them. Add service charge and VAT and it shares those out fairly.',
      },
      {
        at: { name: 'bills' },
        target: '[data-tour="new-bill"]',
        title: 'Who paid, who owes',
        text: 'Say who paid (one or several people) and it shows the fewest payments to settle up. “Add to Who owes me” keeps track of what friends still owe you.',
      },
      {
        at: { name: 'bills' },
        target: '[data-tour="new-bill"]',
        title: 'Log it and settle it',
        text: '“💸 Log my spending” adds it to your money. Paid it all? Pick “I paid it all” and friends’ paybacks come off it later. When everyone has paid, mark it as settled to hide it.',
      },
    ],
  },
  {
    id: 'trips',
    emoji: '🧳',
    title: 'Trip split',
    steps: [
      {
        at: 'more',
        target: tile('trips'),
        title: 'Trip split',
        text: 'For trips, days out and anything you do with a group: tap Trip split.',
      },
      {
        at: { name: 'trips' },
        target: '[data-tour="new-trip"]',
        title: 'Start a trip',
        text: 'Tap ＋ New trip, add the people and the trip’s exchange rates. Add each bill: who paid, how much, in which currency, its day, and who shares it.',
      },
      {
        at: { name: 'trips' },
        target: '[data-tour="new-trip"]',
        title: 'Settle up',
        text: 'It shows who pays whom, in the currency you choose. Add what’s owed to Who owes me. A big dinner can be split in detail: tap the bill, then “Split this bill in detail”.',
      },
      {
        at: { name: 'trips' },
        target: '[data-tour="new-trip"]',
        title: 'Log the bills you paid',
        text: '“💸 Log the bills I paid” adds each bill you paid as its own entry, on its own day. Mark the trip as settled when everyone has paid.',
      },
    ],
  },
  {
    id: 'debts',
    emoji: '🤝',
    title: 'Who owes me',
    steps: [
      { at: 'more', target: tile('debts'), title: 'Who owes me', text: 'Tap here for money you lent or borrowed.' },
      {
        at: { name: 'debts' },
        target: '[data-tour="debt-add"]',
        title: 'Add a person',
        text: 'Add someone who owes you, or someone you owe, with interest if there is any. Bill split and Trip split can add people here for you.',
      },
      {
        at: { name: 'debts' },
        target: '[data-tour="debt-add"]',
        title: 'When they pay you back',
        text: 'Tap “＋ Paid back” on the person and log it as money back on a category (for a dinner you paid) or as income. Copy summary sends what is owed in a chat.',
      },
    ],
  },
  {
    id: 'budget',
    emoji: '🗺️',
    title: 'Budget plan',
    steps: [
      { at: 'more', target: tile('budget'), title: 'Budget plan', text: 'Tap here to plan where each month’s pay goes.' },
      {
        at: { name: 'budget' },
        target: PAGE,
        title: 'Phases and lines',
        text: 'Make a phase for each stage of life, with an amount per line (rent, investing, travel). It shows each as a % of income.',
      },
      {
        at: { name: 'budget' },
        target: '[data-tour="budget-transfers"]',
        title: 'Monthly transfers',
        text: 'Link each transfer to its accounts, tick them as you do them, then “Record ticked” records the moves, even into Bitcoin or another currency.',
      },
    ],
  },
  {
    id: 'goals',
    emoji: '🎯',
    title: 'Saving targets',
    steps: [
      { at: 'more', target: tile('goals'), title: 'Saving targets', text: 'Tap here to save towards things you want.' },
      {
        at: { name: 'goals' },
        target: '[data-tour="add-goal"]',
        title: 'Add a target',
        text: 'Add what it costs and how much you save a month; it says when you can buy it. Keep it in an account and it shows as part of that account.',
      },
    ],
  },
  {
    id: 'wealth',
    emoji: '📈',
    title: 'Investments, Bitcoin and gold',
    steps: [
      {
        at: 'more',
        target: tile('wealth'),
        title: 'Investments & wealth',
        text: 'Tap here for your funds, stocks, Bitcoin and gold together.',
      },
      {
        at: { name: 'wealth' },
        target: '[data-tour="wealth-invest"]',
        title: 'Each investment',
        text: 'Each shows what you put in, what it’s worth and the profit. Tap 📈 Value to update what it’s worth, and 💰 to set what you put in.',
      },
      {
        at: { name: 'wealth' },
        target: '[data-tour="wealth-invest"]',
        title: 'How money in and out counts',
        text: 'Money moved in adds to what you put in. Money moved out takes it out in the same share as the value, so your profit % stays true.',
      },
      {
        at: 'more',
        target: '[data-tour="retire"]',
        title: 'Will my money be enough?',
        text: 'Plan to retirement here (it has its own part in How to use). Its top button fills “Pot today” with your investments, Bitcoin and gold.',
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
      { at: 'more', target: tile('settings'), title: 'Settings', text: 'Family sharing lives in Settings.' },
      {
        at: { name: 'settings' },
        target: '[data-tour="settings-family"]',
        title: 'Family sharing',
        text: 'Link up to 10 phones to share chosen accounts. Everything else stays on each phone.',
      },
      {
        at: { name: 'family' },
        target: '[data-tour="family-start"]',
        title: 'Start or join',
        text: 'One phone starts the family and makes a one-time code (15 minutes). The other phone types it under Join. The phone that starts it can remove phones; a removed phone loses access straight away.',
      },
      {
        at: { name: 'family' },
        target: '[data-tour="family-start"]',
        title: 'Share an account',
        text: 'Open an account → ✏️ Edit → Share with family, and tick the phones. They see all its entries and add their own; each person can only change their own. It counts in full in everyone’s net worth.',
      },
      {
        at: { name: 'family' },
        target: '[data-tour="family-start"]',
        title: 'See each other’s money',
        text: '“👀 See their money” (or the user switcher at the top) opens another phone’s whole money, read-only. The family’s owner chooses who can see whose with “👥 Who can see”.',
      },
      {
        at: { name: 'family' },
        target: '[data-tour="family-start"]',
        title: 'Lost a phone?',
        text: 'Every phone keeps a family backup. On another phone tap 🆘 Lost next to the lost one: the code it shows puts that phone’s place and data back on a new phone.',
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
        text: 'Change the theme, the main currency, add a second user (each has their own money), and check for updates.',
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
/** 'all' runs every part (someone new); 'pick' lets them choose a part first (More → How to use). */
export function startTour(how: 'all' | 'pick' = 'all'): void {
  setRunning(how === 'pick' ? { mode: 'pick' } : { mode: 'run', steps: ALL_STEPS });
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
    setRunning({ mode: 'off' });
    setI(0);
    setRect(null);
    void updateSettings({ guideSeen: true });
    tab('home');
  }, [tab]);

  // go to the step's tab, then find its button (waiting for the screen to draw); skip steps with nothing to show
  useEffect(() => {
    if (!on) return;
    if (typeof step.at === 'string') {
      if (stackDepth !== 1 || route.name !== step.at) tab(step.at);
    } else if (route.name !== step.at.name) {
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
        <button className="btn primary block" onClick={() => setRunning({ mode: 'run', steps: ALL_STEPS })}>
          ▶ The whole tour
        </button>
        <div className="tour-pick-list">
          {SECTIONS.map((x) => (
            <button key={x.id} className="btn block" onClick={() => setRunning({ mode: 'run', steps: x.steps })}>
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
