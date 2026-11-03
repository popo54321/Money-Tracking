// The menu that opens when you press and hold an item: a few big buttons for the usual jobs.
import { Sheet } from './ui';

export interface QuickAction {
  label: string;
  /** button colour: mint, pink, sky, butter, peach, danger or plain */
  tone?: 'mint' | 'pink' | 'sky' | 'butter' | 'peach' | 'danger' | 'plain';
  run: () => void | Promise<void>;
}

export function QuickActions({ title, actions, onClose }: { title: string; actions: QuickAction[]; onClose: () => void }) {
  return (
    <Sheet open onClose={onClose} title={title}>
      <div className="vstack">
        {actions.map((a) => (
          <button
            key={a.label}
            className={`btn block ${a.tone && a.tone !== 'plain' ? a.tone : ''}`}
            onClick={async () => {
              onClose();
              await a.run();
            }}
          >
            {a.label}
          </button>
        ))}
      </div>
    </Sheet>
  );
}
