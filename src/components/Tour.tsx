// "How to use": a tour that points at the real buttons. It switches to the right tab, dims the screen, rings the
// button and says where to tap. It starts by itself for someone new and again from More → How to use.
import { useCallback, useEffect, useLayoutEffect, useState, useSyncExternalStore } from 'react';
import { updateSettings } from '../db/repo';
import { useApp } from '../state/app';

type Tab = 'home' | 'accounts' | 'summary' | 'more';
interface Step {
  tab: Tab;
  /** what to point at (the first match on screen); missing on screen = the step is skipped */
  target: string;
  title: string;
  text: string;
}

const STEPS: Step[] = [
  { tab: 'home', target: '[data-tour="tab-home"]', title: 'This is Home', text: 'Tap Home any time to come back here.' },
  {
    tab: 'home',
    target: '[data-tour="hero"]',
    title: 'Your money at a glance',
    text: 'Net worth, how much is liquid and how much is truly Free to spend, with this month’s income and spending.',
  },
  {
    tab: 'home',
    target: '[data-tour="quick"]',
    title: 'Log money here',
    text: 'Tap Spend, Income or Move to add an entry. Move is for money going between your own accounts.',
  },
  { tab: 'home', target: '[data-tour="add"]', title: 'Or tap +', text: 'The + adds a spending entry from any screen.' },
  {
    tab: 'accounts',
    target: '[data-tour="tab-accounts"]',
    title: 'Your accounts',
    text: 'Tap Accounts to see every bank account, card and cash purse.',
  },
  {
    tab: 'accounts',
    target: '[data-tour="add-account"]',
    title: 'Start here',
    text: 'Tap this to add your bank accounts, credit cards and cash. Do this first.',
  },
  {
    tab: 'accounts',
    target: '.list button.row',
    title: 'Open an account',
    text: 'Tap an account to see its entries and what is set aside. Press and hold it to edit or move money.',
  },
  {
    tab: 'summary',
    target: '[data-tour="tab-summary"]',
    title: 'Where your money went',
    text: 'Tap Summary to see spending and income by category, for any month.',
  },
  { tab: 'more', target: '[data-tour="tab-more"]', title: 'Everything else', text: 'Tap More for all the other tools.' },
  {
    tab: 'more',
    target: '[data-tour="tile-recurring"]',
    title: 'Bills, subscriptions and salary',
    text: 'Tap Repeating to add what comes every month. Set up your Payday at the top of that page.',
  },
  {
    tab: 'more',
    target: '[data-tour="tile-goals"]',
    title: 'Saving for something',
    text: 'Tap here to save towards things you want to buy.',
  },
  {
    tab: 'more',
    target: '[data-tour="tile-bills"]',
    title: 'Splitting a bill',
    text: 'Tap Bill split when eating out with friends. Travel split, next to it, is for trips.',
  },
  {
    tab: 'more',
    target: '[data-tour="tile-categories"]',
    title: 'Categories and limits',
    text: 'Tap Categories to rename them, change emoji or set a monthly limit.',
  },
  {
    tab: 'more',
    target: '[data-tour="tile-settings"]',
    title: 'Settings',
    text: 'Tap Settings to change the theme, add a second user, back up your data or update.',
  },
  {
    tab: 'more',
    target: '[data-tour="retire"]',
    title: 'Plan to retirement',
    text: 'Tap this big button to see if your money will last all the way to retirement.',
  },
  {
    tab: 'more',
    target: '[data-tour="tile-guide"]',
    title: 'See this again',
    text: 'Tap How to use whenever you want this tour again.',
  },
];

// the tour's on/off state, shared with whoever starts it
let running = false;
const listeners = new Set<() => void>();
const setRunning = (v: boolean) => {
  running = v;
  listeners.forEach((l) => l());
};
export function startTour(): void {
  setRunning(true);
}
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

const visible = (el: Element) => {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
};

export function Tour() {
  const on = useSyncExternalStore(subscribe, () => running);
  const { tab, stackDepth, route } = useApp();
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const step = STEPS[i];

  const finish = useCallback(() => {
    setRunning(false);
    setI(0);
    setRect(null);
    void updateSettings({ guideSeen: true });
    tab('home');
  }, [tab]);

  // go to the step's tab, then find its button (waiting for the screen to draw); skip steps with nothing to show
  useEffect(() => {
    if (!on) return;
    if (stackDepth !== 1 || route.name !== step.tab) tab(step.tab);
    let tries = 0;
    let timer = 0;
    const find = () => {
      const el = [...document.querySelectorAll(step.target)].find(visible);
      if (el) {
        el.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
        setRect(el.getBoundingClientRect());
        return;
      }
      if (++tries < 20) timer = window.setTimeout(find, 60);
      else if (i < STEPS.length - 1) setI(i + 1);
      else finish();
    };
    setRect(null);
    timer = window.setTimeout(find, 80);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, i]);

  // keep the ring on the button when the screen moves
  useLayoutEffect(() => {
    if (!on || !rect) return;
    const again = () => {
      const el = [...document.querySelectorAll(step.target)].find(visible);
      if (el) setRect(el.getBoundingClientRect());
    };
    window.addEventListener('resize', again);
    window.addEventListener('scroll', again, true);
    return () => {
      window.removeEventListener('resize', again);
      window.removeEventListener('scroll', again, true);
    };
  }, [on, rect, step.target]);

  if (!on) return null;
  const pad = 6;
  const vh = window.innerHeight;
  const below = rect ? rect.bottom + 190 < vh : true;
  const bubbleTop = rect ? (below ? rect.bottom + pad + 12 : undefined) : vh / 2 - 90;
  const bubbleBottom = rect && !below ? vh - rect.top + pad + 12 : undefined;
  const last = i === STEPS.length - 1;
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
      {rect && (
        <div className={`tour-bubble ${below ? 'below' : 'above'}`} style={{ top: bubbleTop, bottom: bubbleBottom }}>
          <div className="tour-count">
            {i + 1} of {STEPS.length}
          </div>
          <div className="tour-title">👆 {step.title}</div>
          <div className="tour-text">{step.text}</div>
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
