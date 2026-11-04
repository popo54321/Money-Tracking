import { useState } from 'react';
import { AmountField, Field, Seg, Sheet, Topbar } from '../components/ui';
import { QuickActions } from '../components/QuickActions';
import { holdProps } from '../components/hold';
import type { Category, CategoryKind } from '../domain/types';
import { uid } from '../db/db';
import { deleteCategoryGroup, renameCategoryGroup, reorderRows, saveGroupOrder, setGroupLimit } from '../db/repo';
import { moveItem, orderGroups } from '../domain/groups';
import { fmtMoney } from '../domain/money';
import { useApp, useData } from '../state/app';
import { categoryEmoji, groupColour } from '../ui/emoji';
import { ProfileSwitch } from './Home';
import { CategoryEditor } from '../components/CategoryEditor';

const FOLD_KEY = 'fold.categories';

function loadFolded(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(FOLD_KEY) ?? '{}') as Record<string, boolean>;
  } catch {
    return {};
  }
}

type GroupSheet = { kind: 'rename' | 'limit' | 'delete'; group: string } | null;

export function Categories() {
  const { profile, currency, toast, removeWithUndo } = useApp();
  const data = useData();
  const [kind, setKind] = useState<CategoryKind>('expense');
  const [edit, setEdit] = useState<Category | null>(null);
  const [newGroup, setNewGroup] = useState('');
  const [folded, setFolded] = useState(loadFolded);
  const [menu, setMenu] = useState<string | null>(null);
  const [sheet, setSheet] = useState<GroupSheet>(null);
  const [text, setText] = useState('');
  const [limit, setLimit] = useState<number | null>(null);
  const [moveTo, setMoveTo] = useState<string | null>(null);

  const list = data.categories.filter((c) => c.kind === kind);
  // groups exist while they have categories; spending and income work the same way
  const groups = orderGroups(
    list.map((c) => c.group),
    profile.categoryGroupOrder,
  );
  const foldId = (g: string) => `${kind}:${g}`;
  const toggleFold = (g: string) => {
    const next = { ...folded, [foldId(g)]: !folded[foldId(g)] };
    setFolded(next);
    try {
      localStorage.setItem(FOLD_KEY, JSON.stringify(next));
    } catch {
      // still folds, just not remembered
    }
  };

  const newCategory = (group: string): Category => ({
    id: uid(),
    profileId: profile.id,
    kind,
    name: '',
    group,
    order: Math.max(0, ...data.categories.map((c) => c.order)) + 1,
    archived: false,
  });

  /** Swap a category with its neighbour in the same group, then number every category afresh. */
  const move = async (c: Category, dir: -1 | 1) => {
    const same = list.filter((x) => x.group === c.group);
    const other = same[same.findIndex((x) => x.id === c.id) + dir];
    if (!other) return;
    const ids = data.categories.map((x) => x.id);
    const i = ids.indexOf(c.id);
    const j = ids.indexOf(other.id);
    [ids[i], ids[j]] = [ids[j], ids[i]];
    await reorderRows('categories', ids);
  };
  // keep the other kind's groups in the saved order too
  const otherGroups = (profile.categoryGroupOrder ?? []).filter((g) => !groups.includes(g));
  const moveGroup = (g: string, dir: -1 | 1) =>
    saveGroupOrder(profile.id, 'category', [...moveItem(groups, g, dir), ...otherGroups]);

  const openSheet = (k: 'rename' | 'limit' | 'delete', group: string) => {
    setText(group);
    setLimit(profile.groupLimits?.[group] ?? null);
    setMoveTo(groups.find((g) => g !== group) ?? null);
    setSheet({ kind: k, group });
  };

  return (
    <>
      <Topbar title="Categories 🏷️" right={<ProfileSwitch />} />
      <div className="page">
        <Seg
          value={kind}
          onChange={setKind}
          options={[
            { v: 'expense', label: '💸 Spending', cls: 'expense' },
            { v: 'income', label: '💰 Income', cls: 'income' },
          ]}
        />
        <div className="tiny muted mb">
          Tap a group name to fold it. ▲ ▼ moves the whole group. ⋯ renames or deletes it
          {kind === 'expense' ? ', or sets a monthly limit' : ''}.
        </div>
        {groups.map((g, gi) => {
          const items = list.filter((c) => c.group === g);
          const isFolded = !!folded[foldId(g)];
          const gLimit = kind === 'expense' ? profile.groupLimits?.[g] : undefined;
          return (
            <div key={g}>
              <div className="section-title">
                <button
                  className="fold-head"
                  aria-expanded={!isFolded}
                  onClick={() => toggleFold(g)}
                  {...holdProps(() => setMenu(g))}
                >
                  <span className="fold-arrow">{isFolded ? '▸' : '▾'}</span> {g}
                  <span className="tiny muted">
                    {' '}
                    {items.length}
                    {gLimit ? ` · 🎯 ${fmtMoney(gLimit, currency, { compact: true })}` : ''}
                  </span>
                </button>
                <span className="grow" />
                <button className="btn sm ghost" aria-label={`Move ${g} up`} disabled={gi === 0} onClick={() => moveGroup(g, -1)}>
                  ▲
                </button>
                <button
                  className="btn sm ghost"
                  aria-label={`Move ${g} down`}
                  disabled={gi === groups.length - 1}
                  onClick={() => moveGroup(g, 1)}
                >
                  ▼
                </button>
                <button className="btn sm ghost" aria-label={`More for ${g}`} onClick={() => setMenu(g)}>
                  ⋯
                </button>
                <button className="btn sm ghost" aria-label={`Add a category to ${g}`} onClick={() => setEdit(newCategory(g))}>
                  ＋
                </button>
              </div>
              {!isFolded && items.length > 0 && (
                <div className="list">
                  {items.map((c, ci) => (
                    <div key={c.id} className="row" style={{ opacity: c.archived ? 0.5 : 1 }}>
                      <div className={`bubble ${kind === 'income' ? 'mint' : groupColour(g)}`}>{categoryEmoji(c)}</div>
                      <button
                        className="main"
                        style={{ border: 'none', background: 'none', textAlign: 'left', padding: 0 }}
                        onClick={() => setEdit(c)}
                      >
                        <div className="title">{c.name}</div>
                        <div className="sub">
                          {c.archived ? 'hidden' : 'tap to edit'}
                          {c.limit ? ` · 🎯 ${fmtMoney(c.limit, currency, { compact: true })} a month` : ''}
                        </div>
                      </button>
                      <button className="btn sm ghost" aria-label="Move up" disabled={ci === 0} onClick={() => move(c, -1)}>
                        ▲
                      </button>
                      <button
                        className="btn sm ghost"
                        aria-label="Move down"
                        disabled={ci === items.length - 1}
                        onClick={() => move(c, 1)}
                      >
                        ▼
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        <div className="hstack mt">
          <input
            placeholder={kind === 'income' ? 'New income group' : 'New spending group'}
            value={newGroup}
            onChange={(e) => setNewGroup(e.target.value)}
          />
          <button
            className="btn"
            onClick={() => {
              const g = newGroup.trim();
              if (!g) return toast('Type a group name');
              if (groups.includes(g)) return toast(`${g} already exists`);
              setEdit(newCategory(g));
              setNewGroup('');
            }}
          >
            ＋ Group
          </button>
        </div>
        <div className="tiny muted mt">A new group starts with its first category.</div>
      </div>

      {edit && <CategoryEditor key={edit.id} category={edit} onClose={() => setEdit(null)} />}

      {menu && (
        <QuickActions
          title={menu}
          onClose={() => setMenu(null)}
          actions={[
            { label: '✏️ Rename group', tone: 'plain', run: () => openSheet('rename', menu) },
            ...(kind === 'expense'
              ? [{ label: '🎯 Monthly limit for the group', tone: 'mint' as const, run: () => openSheet('limit', menu) }]
              : []),
            { label: '🗑️ Delete group', tone: 'danger', run: () => openSheet('delete', menu) },
          ]}
        />
      )}

      <Sheet
        open={!!sheet}
        onClose={() => setSheet(null)}
        title={
          sheet?.kind === 'rename'
            ? `Rename ${sheet.group}`
            : sheet?.kind === 'limit'
              ? `🎯 ${sheet.group}: monthly limit`
              : `Delete ${sheet?.group ?? ''}`
        }
      >
        {sheet?.kind === 'rename' && (
          <>
            <Field label="New name">
              <input value={text} onChange={(e) => setText(e.target.value)} autoFocus />
            </Field>
            <div className="tiny muted mb">Its categories, place in the list and limit stay the same.</div>
            <button
              className="btn primary block"
              onClick={async () => {
                if (!text.trim()) return toast('Type a name');
                await renameCategoryGroup(profile.id, kind, sheet.group, text);
                setSheet(null);
                toast('✅ Renamed');
              }}
            >
              Save
            </button>
          </>
        )}
        {sheet?.kind === 'limit' && (
          <>
            <Field label="Limit for all its categories together, each month" hint="Leave empty for no limit.">
              <AmountField value={limit} onChange={setLimit} currency={currency} placeholder="No limit" title={sheet.group} />
            </Field>
            <div className="btn-row mt">
              {profile.groupLimits?.[sheet.group] !== undefined && (
                <button
                  className="btn danger"
                  onClick={async () => {
                    await setGroupLimit(profile.id, sheet.group, null);
                    setSheet(null);
                  }}
                >
                  Remove limit
                </button>
              )}
              <button
                className="btn primary"
                onClick={async () => {
                  await setGroupLimit(profile.id, sheet.group, limit);
                  setSheet(null);
                  toast(limit ? '🎯 Limit set' : 'No limit');
                }}
              >
                Save
              </button>
            </div>
          </>
        )}
        {sheet?.kind === 'delete' && (
          <>
            <div className="small mb">
              {list.filter((c) => c.group === sheet.group).length} categories are in this group. Where should they go?
            </div>
            <div className="chips mb">
              {groups
                .filter((g) => g !== sheet.group)
                .map((g) => (
                  <button key={g} className={`chip ${moveTo === g ? 'on' : ''}`} onClick={() => setMoveTo(g)}>
                    Move to {g}
                  </button>
                ))}
              <button className={`chip ${moveTo === null ? 'on' : ''}`} onClick={() => setMoveTo(null)}>
                Delete them too
              </button>
            </div>
            {moveTo === null && (
              <div className="tiny muted mb">
                Categories that already have entries are hidden instead, so old entries keep them.
              </div>
            )}
            <button
              className="btn danger block"
              onClick={async () => {
                const g = sheet.group;
                setSheet(null);
                await removeWithUndo(() => deleteCategoryGroup(profile.id, kind, g, moveTo), `🗑️ ${g} deleted`);
              }}
            >
              Delete group
            </button>
          </>
        )}
      </Sheet>
    </>
  );
}
