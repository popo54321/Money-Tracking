import { useState } from 'react';
import { Seg, Topbar } from '../components/ui';
import { EXPENSE_GROUPS, type Category, type CategoryKind } from '../domain/types';
import { db, uid } from '../db/db';
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
  const groups = kind === 'income' ? ['Income'] : [...new Set([...EXPENSE_GROUPS, ...list.map((c) => c.group)])];

  const move = async (c: Category, dir: -1 | 1) => {
    const same = list.filter((x) => x.group === c.group);
    const i = same.findIndex((x) => x.id === c.id);
    const j = i + dir;
    if (j < 0 || j >= same.length) return;
    const a = same[i];
    const b = same[j];
    await db.transaction('rw', db.categories, async () => {
      await db.categories.update(a.id, { order: b.order });
      await db.categories.update(b.id, { order: a.order });
    });
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
        {groups.map((g) => {
          const items = list.filter((c) => c.group === g);
          return (
            <div key={g}>
              <div className="section-title">
                {g} <span className="grow" />
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
                  {items.map((c) => (
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
                      <button className="btn sm ghost" aria-label="Move up" onClick={() => move(c, -1)}>
                        ▲
                      </button>
                      <button className="btn sm ghost" aria-label="Move down" onClick={() => move(c, 1)}>
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
