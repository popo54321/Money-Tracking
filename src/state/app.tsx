// App-wide state: settings, prices, the active profile and its data, navigation, toasts and dialogs.
import { useLiveQuery } from 'dexie-react-hooks';
import { createPortal } from 'react-dom';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { balancesByAccount } from '../domain/balances';
import { todayISO } from '../domain/dates';
import { withBtc, type RateTable } from '../domain/fx';
import { reservedByAccount, upcomingItems, type UpcomingItem } from '../domain/reserve';
import type { Account, Category, PriceCache, Profile, Recurring, Settings, Tx } from '../domain/types';
import { db } from '../db/db';
import { fitToAccounts, type GoalRow } from '../domain/goals';
import { accountClaims, splitAmount, type AccountClaims } from '../domain/splits';
import { FALLBACK_PRICES, recordChanges, updateSettings } from '../db/repo';
import { DEFAULT_SETTINGS } from '../db/seed';
import { getSkin, setPlainIcons, type SkinDef } from '../ui/skins';
import { setQuietCheck } from '../services/autoUpdate';
import { setHapticsEnabled } from '../services/haptics';

/** Currency of an account (targets in another currency are not lowered). */
function byIdCurrency(accounts: Account[], id: string | undefined): string | undefined {
  return accounts.find((a) => a.id === id)?.currency;
}

// ---------- navigation ----------

export type Route =
  | { name: 'home' }
  | { name: 'accounts' }
  | { name: 'summary' }
  | { name: 'more' }
  | { name: 'account'; id: string }
  | { name: 'accountEdit'; id?: string }
  | {
      name: 'entry';
      id?: string;
      kind?: Tx['kind'];
      accountId?: string;
      toAccountId?: string;
      amount?: number;
      categoryId?: string;
      note?: string;
      /** open with "Pay in instalments" switched on (from a card's page) */
      instalments?: boolean;
    }
  | { name: 'txList'; categoryId?: string; accountId?: string; from?: string; to?: string; title?: string }
  | { name: 'recurring' }
  | { name: 'recurringEdit'; id?: string }
  | { name: 'payday' }
  | { name: 'retire' }
  | { name: 'monthClose' }
  | { name: 'budget' }
  | { name: 'bills' }
  | { name: 'bill'; id: string }
  | { name: 'trips' }
  | { name: 'trip'; id: string }
  | { name: 'debts' }
  | { name: 'debt'; id: string }
  | { name: 'goals' }
  | { name: 'wealth' }
  | { name: 'convert' }
  | { name: 'settings' }
  | { name: 'categories' }
  | { name: 'setup' };

export const TAB_ROOTS = ['home', 'accounts', 'summary', 'more'] as const;

// ---------- context ----------

export interface ProfileData {
  accounts: Account[];
  categories: Category[];
  /** entries up to and including today: these count in balances and totals */
  txs: Tx[];
  /** entries dated in the future: shown faded as scheduled, counted from their day */
  scheduled: Tx[];
  /** every entry, for looking one up by id */
  allTxs: Tx[];
  recurring: Recurring[];
  balances: Map<string, number>;
  upcoming: UpcomingItem[];
  reserved: Map<string, number>;
  accountById: Map<string, Account>;
  categoryById: Map<string, Category>;
  /** saving targets, each with its saved amount today */
  goals: GoalRow[];
  /** per account: set aside for bills → splits → targets → Free */
  claims: Map<string, AccountClaims>;
  /** per card: how much of its debt a paying account has set aside */
  cardCovered: Map<string, number>;
}

interface ConfirmOpts {
  title: string;
  message?: string;
  ok?: string;
  cancel?: string;
  danger?: boolean;
}

interface AppCtx {
  settings: Settings;
  skin: SkinDef;
  prices: PriceCache;
  rates: RateTable;
  currency: string;
  profiles: Profile[];
  profile: Profile;
  data: ProfileData | null;
  today: string;
  route: Route;
  stackDepth: number;
  go: (r: Route) => void;
  replace: (r: Route) => void;
  back: () => void;
  tab: (name: (typeof TAB_ROOTS)[number]) => void;
  setProfile: (id: string) => void;
  toast: (msg: string, opts?: { undo?: () => Promise<void> }) => void;
  /** delete with an Undo button in the message */
  removeWithUndo: (fn: () => Promise<void>, msg?: string) => Promise<void>;
  confirm: (o: ConfirmOpts) => Promise<boolean>;
  /** register a close handler for an open sheet so the Android back button closes it first */
  pushOverlay: (close: () => void) => () => void;
}

const Ctx = createContext<AppCtx | null>(null);

export function useApp(): AppCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useApp outside provider');
  return c;
}

/** The active profile's data; screens render only once it is loaded. */
export function useData(): ProfileData {
  const { data } = useApp();
  if (!data) throw new Error('data not loaded');
  return data;
}

function useToday(): string {
  const [today, setToday] = useState(todayISO());
  useEffect(() => {
    const t = setInterval(() => setToday(todayISO()), 60000);
    const vis = () => setToday(todayISO());
    document.addEventListener('visibilitychange', vis);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', vis);
    };
  }, []);
  return today;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const settingsRow = useLiveQuery(() => db.kv.get('settings'), []);
  const pricesRow = useLiveQuery(() => db.kv.get('prices'), []);
  const profiles = useLiveQuery(() => db.profiles.orderBy('id').toArray(), []);
  const settings: Settings = useMemo(
    () => ({ ...DEFAULT_SETTINGS, ...((settingsRow?.value as Partial<Settings>) ?? {}) }),
    [settingsRow],
  );
  const prices: PriceCache = (pricesRow?.value as PriceCache) ?? FALLBACK_PRICES;
  const goldSide = settings.goldPriceSide ?? 'buy';
  const rates = useMemo(
    () =>
      withBtc(
        prices.perUsd,
        prices.btcPrice ?? null,
        prices.btcPriceCurrency || 'THB',
        (goldSide === 'sell' ? prices.goldSellThb : prices.goldBuyThb) ?? prices.goldBuyThb ?? null,
      ),
    [prices, goldSide],
  );
  const today = useToday();

  const sortedProfiles = useMemo(() => (profiles ?? []).slice().sort((a, b) => a.order - b.order), [profiles]);
  const profile = sortedProfiles.find((p) => p.id === settings.activeProfileId) ?? sortedProfiles[0];
  const pid = profile?.id ?? '';

  const accounts = useLiveQuery(() => db.accounts.where('profileId').equals(pid).toArray(), [pid]);
  const categories = useLiveQuery(() => db.categories.where('profileId').equals(pid).toArray(), [pid]);
  const txs = useLiveQuery(() => db.txs.where('profileId').equals(pid).toArray(), [pid]);
  const recurring = useLiveQuery(() => db.recurring.where('profileId').equals(pid).toArray(), [pid]);
  const goalRows = useLiveQuery(() => db.goals.where('profileId').equals(pid).toArray(), [pid]);

  const data: ProfileData | null = useMemo(() => {
    if (!accounts || !categories || !txs || !recurring || !goalRows) return null;
    const accs = accounts.slice().sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
    const cats = categories.slice().sort((a, b) => a.order - b.order);
    const actual = txs.filter((t) => t.date <= today);
    const scheduled = txs.filter((t) => t.date > today).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    const balances = balancesByAccount(accs, actual);
    const upcoming = upcomingItems(accs, recurring, actual, today);
    const reserved = reservedByAccount(upcoming, accs);
    const out: ProfileData = {
      accounts: accs,
      categories: cats,
      txs: actual,
      scheduled,
      allTxs: txs,
      recurring,
      balances,
      upcoming,
      reserved,
      accountById: new Map(accs.map((a) => [a.id, a])),
      categoryById: new Map(cats.map((c) => [c.id, c])),
      claims: new Map(),
      cardCovered: new Map(),
      goals: fitToAccounts(
        goalRows,
        today,
        new Map(
          accs.map((a) => {
            // what the account holds for targets: its balance minus its own splits, in its own currency
            const own = actual.filter((t) => t.accountId === a.id);
            const splits = (a.splits ?? []).reduce((x, sp) => x + splitAmount(sp, own), 0);
            return [a.id, (balances.get(a.id) ?? 0) - splits];
          }),
        ),
      ).map((r) => (r.goal.currency === byIdCurrency(accs, r.goal.accountId) ? r : { ...r, saved: r.recorded })),
    };
    for (const a of accs)
      out.claims.set(a.id, accountClaims(a, balances.get(a.id) ?? 0, reserved.get(a.id) ?? 0, actual, out.goals));
    for (const u of upcoming) {
      if (u.source !== 'card' || !u.reserved || !u.reserveAccountId) continue;
      if (accs.find((a) => a.id === u.reserveAccountId)?.currency !== u.currency) continue;
      out.cardCovered.set(u.refId, (out.cardCovered.get(u.refId) ?? 0) + (u.reserveAmount ?? u.amount));
    }
    return out;
  }, [accounts, categories, txs, recurring, goalRows, today]);

  // An account fell below its targets: save the lower amounts. Money that left is treated as spent,
  // so targets do not come back by themselves when the account goes up again (Put back undoes a mistake).
  useEffect(() => {
    if (!data) return;
    const cuts = data.goals.filter((r) => r.saved < r.recorded - 0.005);
    if (!cuts.length) return;
    void db.transaction('rw', db.goals, async () => {
      for (const r of cuts)
        await db.goals.update(r.goal.id, {
          saved: r.saved,
          countFrom: today,
          // keep what it had before the first cut, so Put back restores all of it
          lowered: { date: today, from: r.goal.lowered?.from ?? r.recorded },
          updatedAt: Date.now(),
        });
    });
  }, [data, today]);

  // navigation stack
  const [stack, setStack] = useState<Route[]>([{ name: 'home' }]);
  const route = stack[stack.length - 1];
  const go = useCallback((r: Route) => {
    setStack((s) => [...s, r]);
    window.scrollTo(0, 0);
  }, []);
  const replace = useCallback((r: Route) => {
    setStack((s) => [...s.slice(0, -1), r]);
    window.scrollTo(0, 0);
  }, []);
  const back = useCallback(() => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)), []);
  const tab = useCallback((name: (typeof TAB_ROOTS)[number]) => {
    setStack([{ name } as Route]);
    window.scrollTo(0, 0);
  }, []);

  // overlays (sheets/dialogs) close before the page goes back
  const overlays = useRef<(() => void)[]>([]);
  const pushOverlay = useCallback((close: () => void) => {
    overlays.current.push(close);
    return () => {
      overlays.current = overlays.current.filter((c) => c !== close);
    };
  }, []);

  useEffect(() => setHapticsEnabled(settings.vibrate !== false), [settings.vibrate]);
  const stackRef = useRef(stack);
  stackRef.current = stack;
  // updates switch themselves in only when nothing is open, so nothing being typed is lost
  useEffect(() => {
    setQuietCheck(() => {
      const top = stackRef.current[stackRef.current.length - 1];
      return (TAB_ROOTS as readonly string[]).includes(top.name) && overlays.current.length === 0;
    });
  }, []);
  useEffect(() => {
    let remove: (() => void) | undefined;
    (async () => {
      const { Capacitor } = await import('@capacitor/core');
      if (!Capacitor.isNativePlatform()) return;
      const { App } = await import('@capacitor/app');
      const h = await App.addListener('backButton', () => {
        const top = overlays.current[overlays.current.length - 1];
        if (top) {
          top();
          return;
        }
        const s = stackRef.current;
        if (s.length > 1) setStack(s.slice(0, -1));
        else if (s[0].name !== 'home') setStack([{ name: 'home' }]);
        else App.exitApp();
      });
      remove = () => h.remove();
    })();
    return () => remove?.();
  }, []);

  // toasts
  const [toastMsg, setToastMsg] = useState<{ msg: string; undo?: () => Promise<void> } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const toast = useCallback((msg: string, opts?: { undo?: () => Promise<void> }) => {
    setToastMsg({ msg, undo: opts?.undo });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), opts?.undo ? 5000 : 2600);
  }, []);
  /** Delete something and offer Undo for a few seconds; Undo puts back exactly what was removed or changed. */
  const removeWithUndo = useCallback(
    async (fn: () => Promise<void>, msg = '🗑️ Deleted') => {
      const undo = await recordChanges(fn);
      toast(msg, { undo });
    },
    [toast],
  );

  // confirm dialog
  const [dialog, setDialog] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null);
  const confirm = useCallback((o: ConfirmOpts) => new Promise<boolean>((resolve) => setDialog({ ...o, resolve })), []);
  useEffect(() => {
    if (!dialog) return;
    return pushOverlay(() => {
      dialog.resolve(false);
      setDialog(null);
    });
  }, [dialog, pushOverlay]);

  const setProfile = useCallback((id: string) => {
    updateSettings({ activeProfileId: id });
    // pages tied to one record (an account, an entry…) don't exist in the other profile
    setStack((s) => {
      const top = s[s.length - 1];
      const keep = [
        'home',
        'accounts',
        'summary',
        'more',
        'recurring',
        'monthClose',
        'budget',
        'debts',
        'goals',
        'wealth',
        'categories',
        'bills',
        'trips',
        'settings',
        'txList',
      ];
      return keep.includes(top.name) ? s.filter((r) => keep.includes(r.name)) : [s[0]];
    });
  }, []);

  // theme
  const skin = getSkin(settings.skin);
  setPlainIcons(skin.plain);
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', settings.theme);
    root.setAttribute('data-skin', skin.id);
  }, [settings.theme, skin.id]);

  if (!profiles || !profile)
    return (
      <div className="empty">
        <span className="e">🌸</span>Loading…
      </div>
    );

  const value: AppCtx = {
    settings,
    skin,
    prices,
    rates,
    currency: settings.defaultCurrency,
    profiles: sortedProfiles,
    profile,
    data,
    today,
    route,
    stackDepth: stack.length,
    go,
    replace,
    back,
    tab,
    setProfile,
    toast,
    removeWithUndo,
    confirm,
    pushOverlay,
  };

  return (
    <Ctx.Provider value={value}>
      {children}
      {toastMsg && (
        <div className={`toast ${toastMsg.undo ? 'with-action' : ''}`} role="status">
          <span>{toastMsg.msg}</span>
          {toastMsg.undo && (
            <button
              className="toast-action"
              onClick={async () => {
                const undo = toastMsg.undo!;
                setToastMsg(null);
                await undo();
                toast('↩️ Put back');
              }}
            >
              Undo
            </button>
          )}
        </div>
      )}
      {dialog &&
        createPortal(
          <div
            className="backdrop dialog-backdrop"
            onClick={() => {
              dialog.resolve(false);
              setDialog(null);
            }}
          >
            <div className="dialog" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
              <h3>{dialog.title}</h3>
              {dialog.message && <p>{dialog.message}</p>}
              <div className="btn-row">
                <button
                  className="btn ghost"
                  onClick={() => {
                    dialog.resolve(false);
                    setDialog(null);
                  }}
                >
                  {dialog.cancel ?? 'Cancel'}
                </button>
                <button
                  className={dialog.danger ? 'btn danger' : 'btn primary'}
                  onClick={() => {
                    dialog.resolve(true);
                    setDialog(null);
                  }}
                >
                  {dialog.ok ?? 'OK'}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </Ctx.Provider>
  );
}
