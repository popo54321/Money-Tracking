// Settings → Update history: every version, newest first, with what changed.
import { Topbar } from '../components/ui';
import { CHANGELOG } from '../changelog';
import { fmtDate } from '../domain/dates';
import { APP_VERSION } from '../services/platform';

export function UpdateHistory() {
  return (
    <>
      <Topbar title="📜 Update history" />
      <div className="page">
        <div className="small muted mb">Every version so far, newest first. You have version {APP_VERSION}.</div>
        {CHANGELOG.map((e) => (
          <div key={e.version} className="card">
            <div className="between">
              <b>
                {e.version} · {e.title}
              </b>
              {e.version === APP_VERSION && <span className="pill mint">You have this</span>}
            </div>
            <div className="tiny muted mb">{fmtDate(e.date)}</div>
            <ChangeNotes notes={e.notes} />
          </div>
        ))}
      </div>
    </>
  );
}

export function ChangeNotes({ notes }: { notes: string[] }) {
  return (
    <ul className="change-notes">
      {notes.map((n) => (
        <li key={n}>{n}</li>
      ))}
    </ul>
  );
}
