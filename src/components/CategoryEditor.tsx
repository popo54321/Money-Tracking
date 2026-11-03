// Add or edit a category: used by the Categories screen and by press-and-hold anywhere a category is shown.
import { useState } from 'react';
import { EXPENSE_GROUPS, type Category } from '../domain/types';
import { categoryInUse, deleteCategory, saveCategory } from '../db/repo';
import { useApp, useData } from '../state/app';
import { EMOJI_CHOICES, categoryEmoji } from '../ui/emoji';
import { Field, Sheet, ToggleRow } from './ui';

export function CategoryEditor({ category, onClose }: { category: Category; onClose: () => void }) {
  const { toast, confirm, skin } = useApp();
  const data = useData();
  const [c, setC] = useState<Category>(category);
  const exists = data.categoryById.has(c.id);
  const groups =
    c.kind === 'income'
      ? ['Income']
      : [...new Set([...EXPENSE_GROUPS, ...data.categories.filter((x) => x.kind === 'expense').map((x) => x.group), c.group])];

  return (
    <Sheet open onClose={onClose} title={exists ? 'Edit category' : 'New category'}>
      <Field label="Name">
        <input
          value={c.name}
          onChange={(e) => setC({ ...c, name: e.target.value })}
          placeholder="e.g. Coffee"
          autoFocus={!exists}
        />
      </Field>
      {!skin.plain && (
        <Field label="Emoji">
          <div className="chips">
            {EMOJI_CHOICES.map((e) => (
              <button key={e} className={`chip ${categoryEmoji(c) === e ? 'on' : ''}`} onClick={() => setC({ ...c, emoji: e })}>
                {e}
              </button>
            ))}
          </div>
        </Field>
      )}
      {c.kind === 'expense' && (
        <Field label="Group">
          <div className="chips">
            {groups.map((g) => (
              <button key={g} className={`chip lav ${c.group === g ? 'on' : ''}`} onClick={() => setC({ ...c, group: g })}>
                {g}
              </button>
            ))}
          </div>
        </Field>
      )}
      {exists && (
        <ToggleRow
          title="Hide"
          desc="Keeps old entries, hides it when adding new ones"
          on={c.archived}
          onChange={(v) => setC({ ...c, archived: v })}
        />
      )}
      <div className="btn-row mt">
        {exists && (
          <button
            className="btn danger"
            onClick={async () => {
              if (await categoryInUse(c.id)) {
                toast('It has entries, so hide it instead');
                return;
              }
              if (!(await confirm({ title: `Delete ${c.name}?`, ok: 'Delete', danger: true }))) return;
              await deleteCategory(c.id);
              onClose();
            }}
          >
            Delete
          </button>
        )}
        <button
          className="btn primary"
          onClick={async () => {
            if (!c.name.trim()) return toast('Give it a name');
            await saveCategory({ ...c, name: c.name.trim() });
            toast('✅ Saved');
            onClose();
          }}
        >
          Save
        </button>
      </div>
    </Sheet>
  );
}
