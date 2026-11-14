// Add or edit a category: used by the Categories screen and by press-and-hold anywhere a category is shown.
import { useState } from 'react';
import type { Category, LimitPeriod } from '../domain/types';
import { orderGroups } from '../domain/groups';
import { categoryInUse, deleteCategory, saveCategory } from '../db/repo';
import { useApp, useData } from '../state/app';
import { EMOJI_CHOICES, categoryEmoji } from '../ui/emoji';
import { AmountField, Field, Seg, Sheet, ToggleRow } from './ui';

export function CategoryEditor({ category, onClose }: { category: Category; onClose: () => void }) {
  const { toast, confirm, skin, profile, removeWithUndo, currency } = useApp();
  const data = useData();
  const [c, setC] = useState<Category>(category);
  const exists = data.categoryById.has(c.id);
  const groups = orderGroups(
    [...data.categories.filter((x) => x.kind === c.kind).map((x) => x.group), c.group],
    profile.categoryGroupOrder,
  );

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
      {groups.length > 1 && (
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
      {c.kind === 'expense' && (
        <Field label="🎯 Spending limit (optional)" hint="Leave empty for no limit. Home shows what is left.">
          <div className="mb">
            <LimitPeriodSeg
              value={c.limitPeriod ?? 'month'}
              onChange={(p) => setC({ ...c, limitPeriod: p === 'month' ? undefined : p })}
            />
          </div>
          <AmountField
            value={c.limit ?? null}
            onChange={(v) => setC({ ...c, limit: v && v > 0 ? v : undefined })}
            currency={currency}
            placeholder="No limit"
            title={`${c.name || 'Category'} limit`}
          />
          {c.limit ? (
            <button
              type="button"
              className="btn sm ghost mt"
              onClick={() => setC({ ...c, limit: undefined, limitPeriod: undefined })}
            >
              Remove limit
            </button>
          ) : null}
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
              await removeWithUndo(() => deleteCategory(c.id));
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

/** Each month / quarter / year: how often a spending limit starts again. */
export function LimitPeriodSeg({ value, onChange }: { value: LimitPeriod; onChange: (p: LimitPeriod) => void }) {
  return (
    <Seg
      value={value}
      options={[
        { v: 'month', label: 'Each month' },
        { v: 'quarter', label: 'Each quarter' },
        { v: 'year', label: 'Each year' },
      ]}
      onChange={onChange}
    />
  );
}
