import { useState } from 'react';
import { Seg, Topbar } from '../components/ui';
import { EXPENSE_GROUPS, type Category, type CategoryKind } from '../domain/types';
import { uid } from '../db/db';
import { reorderRows, saveGroupOrder } from '../db/repo';
import { moveItem, orderGroups } from '../domain/groups';
import { useApp, useData } from '../state/app';
import { categoryEmoji, groupColour } from '../ui/emoji';
import { ProfileSwitch } from './Home';
import { CategoryEditor } from '../components/CategoryEditor';

export function Categories() {
  const { profile } = useApp();
  const data = useData();
  const [kind, setKind] = useState<CategoryKind>('expense');
  const [edit, setEdit] = useState<Category | null>(null);
  const [newGroup, setNewGroup] = useState('');
  const list = data.categories.filter((c) => c.kind === kind);
  const groups =
    kind === 'income' ? ['Income'] : orderGroups([...EXPENSE_GROUPS, ...list.map((c) => c.group)], profile.categoryGroupOrder);

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
  const moveGroup = (g: string, dir: -1 | 1) => saveGroupOrder(profile.id, 'category', moveItem(groups, g, dir));

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
        {kind === 'expense' && <div className="tiny muted mb">▲ ▼ next to a group name moves the whole group.</div>}
        {groups.map((g, gi) => {
          const items = list.filter((c) => c.group === g);
          return (
            <div key={g}>
              <div className="section-title">
                {g} <span className="grow" />
                {kind === 'expense' && (
                  <>
                    <button
                      className="btn sm ghost"
                      aria-label={`Move ${g} up`}
                      disabled={gi === 0}
                      onClick={() => moveGroup(g, -1)}
                    >
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
                  </>
                )}
                <button
                  className="btn sm ghost"
                  onClick={() =>
                    setEdit({
                      id: uid(),
                      profileId: profile.id,
                      kind,
                      name: '',
                      group: g,
                      order: Math.max(0, ...data.categories.map((c) => c.order)) + 1,
                      archived: false,
                    })
                  }
                >
                  ＋ Add
                </button>
              </div>
              {items.length > 0 && (
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
                        <div className="sub">{c.archived ? 'hidden' : 'tap to edit'}</div>
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
        {kind === 'expense' && (
          <div className="hstack mt">
            <input placeholder="New group name" value={newGroup} onChange={(e) => setNewGroup(e.target.value)} />
            <button
              className="btn"
              onClick={() => {
                const g = newGroup.trim();
                if (!g) return;
                setEdit({
                  id: uid(),
                  profileId: profile.id,
                  kind,
                  name: '',
                  group: g,
                  order: Math.max(0, ...data.categories.map((c) => c.order)) + 1,
                  archived: false,
                });
                setNewGroup('');
              }}
            >
              ＋ Group
            </button>
          </div>
        )}
      </div>

      {edit && <CategoryEditor key={edit.id} category={edit} onClose={() => setEdit(null)} />}
    </>
  );
}
