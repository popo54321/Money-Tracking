// Small building blocks used across screens.
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { evaluate, hasOperator } from '../domain/calculator';
import { COMMON_CURRENCIES } from '../domain/fx';
import { decimalsFor, fmtMoney, fmtNumber, roundTo } from '../domain/money';
import { orderGroups } from '../domain/groups';
import { noteSuggestions } from '../domain/notes';
import { ACCOUNT_GROUPS, type Account, type Category, type CategoryKind } from '../domain/types';
import { useApp } from '../state/app';
import { accountColour, accountEmoji, categoryEmoji, nameColour } from '../ui/emoji';
import { Mascot } from '../ui/Mascot';
import { uid } from '../db/db';
import { CategoryEditor } from './CategoryEditor';
import { holdProps } from './hold';

// ---------- layout ----------

export function Topbar({ title, right, noBack }: { title: ReactNode; right?: ReactNode; noBack?: boolean }) {
  const { back, stackDepth } = useApp();
  return (
    <div className="topbar">
      {!noBack && stackDepth > 1 && (
        <button className="icon-btn" aria-label="Back" onClick={back}>
          ‹
        </button>
      )}
      <h1>{title}</h1>
      {right}
    </div>
  );
}

export function Field({ label, hint, children }: { label: ReactNode; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="field">
      <div className="label">{label}</div>
      {children}
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

export function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={`switch ${on ? 'on' : ''}`}
      onClick={() => onChange(!on)}
    />
  );
}

export function ToggleRow({
  title,
  desc,
  on,
  onChange,
}: {
  title: ReactNode;
  desc?: ReactNode;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="toggle-row">
      <div className="grow">
        <div>{title}</div>
        {desc && <div className="small muted">{desc}</div>}
      </div>
      <Switch on={on} onChange={onChange} label={typeof title === 'string' ? title : undefined} />
    </div>
  );
}

export function Seg<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { v: T; label: ReactNode; cls?: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="seg" role="tablist">
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          role="tab"
          aria-selected={value === o.v}
          className={`${value === o.v ? 'on' : ''} ${o.cls ?? ''}`}
          onClick={() => onChange(o.v)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Money({
  v,
  cur,
  sign,
  cls,
  compact,
}: {
  v: number | null | undefined;
  cur: string;
  sign?: boolean;
  cls?: boolean;
  compact?: boolean;
}) {
  const c = cls && v ? (v > 0 ? 'pos' : v < 0 ? 'neg' : '') : '';
  return <span className={c}>{fmtMoney(v, cur, { sign, compact })}</span>;
}

// ---------- note with remembered words ----------

/**
 * A note box that remembers what was typed before: a scrolling list of earlier notes drops up
 * while typing (capitals ignored). Only the words are filled in, nothing else.
 */
export function NoteInput({
  value,
  onChange,
  placeholder = 'Optional',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const { data } = useApp();
  const [open, setOpen] = useState(false);
  const list = useMemo(() => noteSuggestions(data?.allTxs ?? [], value), [data?.allTxs, value]);
  const keep = (e: { preventDefault: () => void }) => e.preventDefault(); // keep the keyboard open
  return (
    <div className="note-input">
      {open && list.length > 0 && (
        <div className="suggest" role="listbox" onMouseDown={keep} onPointerDown={keep}>
          {list.map((n) => (
            <button
              key={n}
              type="button"
              role="option"
              aria-selected={false}
              onClick={() => {
                onChange(n);
                setOpen(false);
              }}
            >
              {n}
            </button>
          ))}
        </div>
      )}
      <input
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      />
    </div>
  );
}

// ---------- sheets ----------

export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
}) {
  const { pushOverlay } = useApp();
  useEffect(() => {
    if (!open) return;
    const pop = pushOverlay(onClose);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      pop();
      document.body.style.overflow = prev;
    };
  }, [open, onClose, pushOverlay]);
  if (!open) return null;
  // Rendered at the top of the page so nothing (top bar, tab bar) can cover it.
  return createPortal(
    <div className="backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <div className="grab" />
          {title ? <h3>{title}</h3> : <span className="grow" />}
          <button className="icon-btn" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

// ---------- calculator ----------

// Phone-style keypad: brackets, clear and delete on top; operators down the right in the order
// people use them most (+ − × ÷); 0 in the middle of the bottom row like a phone dial pad.
const KEYS = ['(', ')', 'C', '⌫', '7', '8', '9', '+', '4', '5', '6', '−', '1', '2', '3', '×', '.', '0', '=', '÷'];

export function useCalc(initial = '') {
  const [expr, setExpr] = useState(initial);
  const value = useMemo(() => evaluate(expr), [expr]);
  const press = (k: string) => {
    if (k === 'C') return setExpr('');
    if (k === '⌫') return setExpr((e) => e.slice(0, -1));
    if (k === '=') {
      const v = evaluate(expr);
      if (v !== null) setExpr(String(roundTo(v, 8)));
      return;
    }
    setExpr((e) => {
      const last = e.slice(-1);
      const isOp = (c: string) => '+−×÷'.includes(c);
      if (isOp(k) && isOp(last)) return e.slice(0, -1) + k;
      if (isOp(k) && e === '' && k !== '−') return e;
      if (k === '.') {
        const lastNum = e.split(/[+−×÷()]/).pop() ?? '';
        if (lastNum.includes('.')) return e;
        if (lastNum === '') return e + '0.';
      }
      return e + k;
    });
  };
  return { expr, setExpr, value, press, showResult: hasOperator(expr) };
}

export function Keypad({ onKey, okLabel }: { onKey: (k: string) => void; okLabel?: string }) {
  return (
    <div className="keypad">
      {KEYS.map((k) => (
        <button
          key={k}
          type="button"
          className={'+−×÷'.includes(k) ? 'op' : k === '=' ? 'ok' : k === 'C' ? 'clear' : '()⌫'.includes(k) ? 'fn' : ''}
          onClick={() => onKey(k)}
          aria-label={k === '⌫' ? 'Delete' : k === 'C' ? 'Clear' : k}
        >
          {k === '=' && okLabel ? okLabel : k}
        </button>
      ))}
    </div>
  );
}

/** Show a typed sum with thousands separators, e.g. 1250+300 → 1,250+300. */
export function fmtExpr(expr: string): string {
  return expr.replace(/\d+(\.\d*)?/g, (m) => {
    const [i, d] = m.split('.');
    const grouped = i.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return d !== undefined ? `${grouped}.${d}` : grouped;
  });
}

export function CalcSheet({
  open,
  onClose,
  title,
  initial,
  currency,
  allowNegative,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  initial?: number | null;
  currency: string;
  allowNegative?: boolean;
  onDone: (v: number) => void;
}) {
  const calc = useCalc('');
  useEffect(() => {
    if (open) calc.setExpr(initial ? String(roundTo(initial, decimalsFor(currency))) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const finish = () => {
    const v = calc.expr === '' ? 0 : calc.value;
    if (v === null) return;
    if (!allowNegative && v < 0) return;
    onDone(v);
    onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="amount-display transfer">
        <div className="expr">{calc.showResult ? fmtExpr(calc.expr) : ' '}</div>
        <div className="val">
          {calc.expr === '' ? fmtMoney(0, currency) : calc.value === null ? fmtExpr(calc.expr) : fmtMoney(calc.value, currency)}
        </div>
      </div>
      <Keypad onKey={(k) => (k === '=' && !calc.showResult ? finish() : calc.press(k))} okLabel={calc.showResult ? '=' : '✓'} />
      <button className="btn primary block" onClick={finish} disabled={calc.expr !== '' && calc.value === null}>
        Done
      </button>
    </Sheet>
  );
}

/** A tappable amount that opens the calculator. */
export function AmountField({
  value,
  onChange,
  currency,
  placeholder = 'Tap to enter',
  title = 'Amount',
  allowNegative,
  compact,
}: {
  value: number | null | undefined;
  onChange: (v: number) => void;
  currency: string;
  placeholder?: string;
  title?: ReactNode;
  allowNegative?: boolean;
  /** small box without the currency label, for tight rows */
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const empty = value === null || value === undefined;
  return (
    <>
      <button type="button" className={`amount-field ${empty ? 'is-empty' : ''}`} onClick={() => setOpen(true)}>
        <span>{empty ? placeholder : fmtNumber(value, decimalsFor(currency), 0)}</span>
        {!compact && <span className="cur">{currency} 🧮</span>}
      </button>
      <CalcSheet
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        initial={value}
        currency={currency}
        allowNegative={allowNegative}
        onDone={onChange}
      />
    </>
  );
}

/** A plain number input for percentages, rates and similar small numbers. */
export function NumberInput({
  value,
  onChange,
  placeholder,
  step = 'any',
  className = '',
}: {
  value: number | null | undefined;
  onChange: (v: number) => void;
  placeholder?: string;
  step?: string;
  className?: string;
}) {
  const [text, setText] = useState(value === null || value === undefined ? '' : String(value));
  useEffect(() => {
    const parsed = Number(text);
    if (value !== undefined && value !== null && parsed !== value) setText(String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <input
      className={className}
      inputMode="decimal"
      type="text"
      step={step}
      placeholder={placeholder}
      value={text}
      onChange={(e) => {
        const t = e.target.value.replace(',', '.');
        setText(t);
        const v = evaluate(t);
        if (v !== null) onChange(v);
        else if (t === '') onChange(0);
      }}
    />
  );
}

// ---------- pickers ----------

export function CurrencySheet({
  open,
  onClose,
  value,
  onPick,
  extra = [],
}: {
  open: boolean;
  onClose: () => void;
  value?: string;
  onPick: (c: string) => void;
  extra?: string[];
}) {
  const { prices, settings } = useApp();
  const [q, setQ] = useState('');
  const all = useMemo(() => {
    const set = new Set<string>([
      ...settings.favouriteCurrencies,
      ...COMMON_CURRENCIES,
      ...extra,
      ...Object.keys(prices.perUsd).sort(),
    ]);
    set.delete('BTC');
    return [...set];
  }, [prices.perUsd, settings.favouriteCurrencies, extra]);
  const query = q.trim().toLowerCase();
  const list = all.filter((c) => c.toLowerCase().includes(query));
  const top = query
    ? []
    : [...new Set([...settings.favouriteCurrencies, ...COMMON_CURRENCIES, ...extra])].filter((c) => c !== 'BTC');
  const rest = query ? list : list.filter((c) => !top.includes(c));
  const chip = (c: string) => (
    <button
      key={c}
      className={`chip ${c === value ? 'on' : ''}`}
      onClick={() => {
        onPick(c);
        onClose();
        setQ('');
      }}
    >
      {c}
    </button>
  );
  return (
    <Sheet open={open} onClose={onClose} title="Currency">
      <div className="sheet-sticky">
        <input placeholder="Search, e.g. JPY" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {top.length > 0 && (
        <>
          <div className="cat-group-name">Favourites & common</div>
          <div className="chips">{top.map(chip)}</div>
          <div className="cat-group-name">All currencies</div>
        </>
      )}
      <div className="chips">{rest.map(chip)}</div>
      {list.length === 0 && <div className="small muted mt">No currency matches “{q}”.</div>}
    </Sheet>
  );
}

export function AccountRowView({ a, right, onClick }: { a: Account; right?: ReactNode; onClick?: () => void }) {
  const { go } = useApp();
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      className="row"
      onClick={onClick}
      type={onClick ? 'button' : undefined}
      {...holdProps(() => go({ name: 'accountEdit', id: a.id }))}
    >
      <div className={`bubble ${accountColour(a.type)}`}>{accountEmoji(a.type)}</div>
      <div className="main">
        <div className="title">{a.name}</div>
        <div className="sub">
          {a.group} · {a.currency}
        </div>
      </div>
      {right && <div className="end">{right}</div>}
    </Tag>
  );
}

export function AccountSheet({
  open,
  onClose,
  accounts,
  value,
  onPick,
  title = 'Choose account',
  exclude,
}: {
  open: boolean;
  onClose: () => void;
  accounts: Account[];
  value?: string;
  onPick: (id: string) => void;
  title?: string;
  exclude?: string;
}) {
  const { data, profile } = useApp();
  const list = accounts.filter((a) => !a.archived && a.id !== exclude);
  const groups = orderGroups([...ACCOUNT_GROUPS, ...list.map((a) => a.group)], profile.accountGroupOrder);
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      {groups.map((g) => {
        const items = list.filter((a) => a.group === g);
        if (!items.length) return null;
        return (
          <div key={g}>
            <div className="cat-group-name">{g}</div>
            <div className="list">
              {items.map((a) => (
                <AccountRowView
                  key={a.id}
                  a={a}
                  onClick={() => {
                    onPick(a.id);
                    onClose();
                  }}
                  right={
                    <>
                      <div className="amt">{fmtMoney(data?.balances.get(a.id) ?? 0, a.currency)}</div>
                      {a.id === value && <div className="amt2">✓ selected</div>}
                    </>
                  }
                />
              ))}
            </div>
          </div>
        );
      })}
    </Sheet>
  );
}

export function AccountPickerButton({
  accounts,
  value,
  onChange,
  placeholder = 'Choose account',
  title,
  exclude,
}: {
  accounts: Account[];
  value?: string;
  onChange: (id: string) => void;
  placeholder?: string;
  title?: string;
  exclude?: string;
}) {
  const [open, setOpen] = useState(false);
  const a = accounts.find((x) => x.id === value);
  return (
    <>
      <button type="button" className={`amount-field ${a ? '' : 'is-empty'}`} onClick={() => setOpen(true)}>
        <span className="hstack" style={{ minWidth: 0 }}>
          {a ? (
            <>
              <span>{accountEmoji(a.type)}</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</span>
            </>
          ) : (
            placeholder
          )}
        </span>
        <span className="cur">{a ? a.currency : ''} ▾</span>
      </button>
      <AccountSheet
        open={open}
        onClose={() => setOpen(false)}
        accounts={accounts}
        value={value}
        onPick={onChange}
        title={title}
        exclude={exclude}
      />
    </>
  );
}

export function CategoryGrid({
  categories,
  kind,
  value,
  onPick,
}: {
  categories: Category[];
  kind: CategoryKind;
  value?: string;
  onPick: (id: string) => void;
}) {
  const { profile } = useApp();
  const [editing, setEditing] = useState<Category | null>(null);
  const list = categories.filter((c) => c.kind === kind && (!c.archived || c.id === value));
  const groups = orderGroups(
    list.map((c) => c.group),
    profile.categoryGroupOrder,
  );
  const newCategory = (group: string): Category => ({
    id: uid(),
    profileId: profile.id,
    kind,
    name: '',
    group,
    order: Math.max(0, ...categories.map((c) => c.order)) + 1,
    archived: false,
  });
  return (
    <div>
      {groups.map((g, gi) => (
        <div key={g}>
          {kind === 'expense' && <div className="cat-group-name">{g}</div>}
          <div className="cat-grid">
            {list
              .filter((c) => c.group === g)
              .map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`cat ${c.id === value ? 'on' : ''}`}
                  onClick={() => onPick(c.id)}
                  {...holdProps(() => setEditing(c))}
                >
                  <span className="e">{categoryEmoji(c)}</span>
                  <span className="n">{c.name}</span>
                </button>
              ))}
            {gi === groups.length - 1 && (
              <button
                type="button"
                className="cat cat-new"
                onClick={() => setEditing(newCategory(kind === 'income' ? 'Income' : g))}
              >
                <span className="e">＋</span>
                <span className="n">New</span>
              </button>
            )}
          </div>
        </div>
      ))}
      {groups.length === 0 && (
        <button
          type="button"
          className="btn block"
          onClick={() => setEditing(newCategory(kind === 'income' ? 'Income' : 'Discretionary'))}
        >
          ＋ New category
        </button>
      )}
      <div className="tiny muted mt">Tip: press and hold a category to edit it.</div>
      {editing && <CategoryEditor category={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

export function ProgressBar({ value, colour = '' }: { value: number; colour?: string }) {
  return (
    <div className={`bar ${colour}`}>
      <div style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
    </div>
  );
}

// ---------- theme decorations ----------

/** The little picture in the corner of a top card; nothing in the Financial theme. */
export function Sparkle({ k, override }: { k: string; override?: string }) {
  const { skin } = useApp();
  if (skin.mascot)
    return (
      <span className="sparkle mascot">
        <Mascot kind={skin.mascot} pose={skin.poses?.[k] ?? 'happy'} size={46} />
      </span>
    );
  const e = skin.plain ? '' : (override ?? skin.sparkle[k] ?? '');
  return e ? <span className="sparkle">{e}</span> : null;
}

/** A screen name that follows the theme (e.g. Accounts / Treasury). */
export function SkinName({ k }: { k: 'accounts' | 'more' | 'summary' | 'budget' | 'goals' | 'wealth' }) {
  const { skin } = useApp();
  return <>{skin.names[k]}</>;
}

/** A round initial in a pastel colour that stays the same for each name. */
export function Avatar({ name }: { name: string }) {
  const c = nameColour(name || '?');
  return (
    <span className="avatar" style={{ background: `var(--${c})`, color: `var(--${c}-ink)` }}>
      {name.trim().slice(0, 1).toUpperCase() || '?'}
    </span>
  );
}
