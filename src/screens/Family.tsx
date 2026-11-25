// Family sharing, part 1: link phones. The phone that starts a family invites others with a code and can remove
// them; a removed phone loses access straight away. Sharing accounts comes next.
import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Field, Topbar } from '../components/ui';
import { db } from '../db/db';
import { fmtDate } from '../domain/dates';
import {
  clearRemovedNote,
  joinFamily,
  leaveFamily,
  loadFamily,
  makeInvite,
  removeDevice,
  renameDevice,
  startFamily,
  SyncError,
  type Family as FamilyInfo,
  type SyncLink,
} from '../services/sync';
import { copyText } from '../services/platform';
import { useApp } from '../state/app';

const ISO = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function Family() {
  const { profile, toast, confirm } = useApp();
  const link = useLiveQuery(async () => ((await db.kv.get('syncLink'))?.value as SyncLink | undefined) ?? null, []);
  const [fam, setFam] = useState<FamilyInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState(`${profile.name}’s phone`);
  const [code, setCode] = useState('');
  const [invite, setInvite] = useState<{ code: string; expiresAt: number } | null>(null);
  const [now, setNow] = useState(Date.now());
  const [problem, setProblem] = useState<string | null>(null);

  const linked = !!link?.token;
  const run = async <T,>(f: () => Promise<T>): Promise<T | undefined> => {
    setBusy(true);
    setProblem(null);
    try {
      return await f();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (e instanceof SyncError && e.code === 'offline') setProblem(msg);
      else toast(msg);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!linked) return;
    void run(async () => setFam(await loadFamily()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linked]);
  useEffect(() => {
    if (!invite) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [invite]);
  useEffect(() => {
    if (link?.name) setName(link.name);
  }, [link?.name]);

  if (link === undefined) return <Topbar title="👨‍👩‍👧 Family sharing" />;

  const left = invite ? Math.min(900, Math.max(0, Math.round((invite.expiresAt - now) / 1000))) : 0;

  return (
    <>
      <Topbar title="👨‍👩‍👧 Family sharing" />
      <div className="page">
        {link?.removedAt && !linked && (
          <div className="banner pink">
            <span>🔒</span>
            <span className="grow small">
              This phone was removed from its family on {fmtDate(ISO(link.removedAt))}, or the family ended. Nothing is shared
              with it any more. Your own data on this phone is untouched.
            </span>
            <button className="btn sm ghost" onClick={() => void clearRemovedNote()}>
              OK
            </button>
          </div>
        )}
        {problem && (
          <div className="banner">
            <span>📴</span>
            <span className="grow small">{problem}</span>
          </div>
        )}

        {!linked ? (
          <>
            <div className="card">
              <div className="small">
                Link up to 10 phones. Later you choose which accounts to share and with whom; everything else stays on each phone.
                Each person can see all entries on a shared account but only change their own.
              </div>
              <Field label="This phone’s name" hint="So the others know who is who.">
                <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
              </Field>
            </div>
            <div className="card" data-tour="family-start">
              <h2>Start a family</h2>
              <div className="small muted mb">This phone becomes the owner: it invites phones and can remove them.</div>
              <button
                className="btn primary block"
                disabled={busy || !name.trim()}
                onClick={() =>
                  void run(async () => {
                    setFam(await startFamily(name.trim()));
                    toast('👨‍👩‍👧 Family started. Invite a phone next.');
                  })
                }
              >
                Start a family
              </button>
            </div>
            <div className="card">
              <h2>Join a family</h2>
              <div className="small muted mb">On the owner’s phone: Family sharing → Invite a phone. Type the code it shows.</div>
              <Field label="Code">
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="ABCD-EFGH"
                  autoCapitalize="characters"
                  autoComplete="off"
                  maxLength={9}
                  style={{ letterSpacing: 2, fontWeight: 700 }}
                />
              </Field>
              <button
                className="btn mint block"
                disabled={busy || code.replace(/[^A-Z0-9]/gi, '').length !== 8 || !name.trim()}
                onClick={() =>
                  void run(async () => {
                    setFam(await joinFamily(code, name.trim()));
                    setCode('');
                    toast('🎉 Joined the family');
                  })
                }
              >
                Join
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="card" data-tour="family-start">
              <div className="between">
                <h2 style={{ margin: 0 }}>Phones in the family</h2>
                <span className="small muted">{fam ? `${fam.devices.length} of ${fam.max}` : ''}</span>
              </div>
              {!fam ? (
                <div className="small muted mt">{busy ? 'Loading…' : 'Couldn’t load the family.'}</div>
              ) : (
                <div className="list mt">
                  {fam.devices.map((d) => (
                    <div key={d.id} className="row" style={{ cursor: 'default' }}>
                      <div className={`bubble ${d.owner ? 'butter' : 'sky'}`}>{d.owner ? '👑' : '📱'}</div>
                      <div className="main">
                        <div className="title">
                          {d.name}
                          {d.me ? ' (this phone)' : ''}
                        </div>
                        <div className="sub">
                          {d.owner ? 'Owner · ' : ''}joined {fmtDate(ISO(d.joinedAt))}
                        </div>
                      </div>
                      {fam.isOwner && !d.owner && (
                        <button
                          className="btn sm danger"
                          disabled={busy}
                          onClick={async () => {
                            const ok = await confirm({
                              title: `Remove ${d.name}?`,
                              message:
                                'It loses access to everything shared, straight away. It can join again only with a new code.',
                              ok: 'Remove',
                              danger: true,
                            });
                            if (!ok) return;
                            await run(async () => {
                              setFam(await removeDevice(d.id));
                              toast(`${d.name} removed`);
                            });
                          }}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <button
                className="btn ghost block mt"
                disabled={busy}
                onClick={() => void run(async () => setFam(await loadFamily()))}
              >
                ↻ Refresh
              </button>
            </div>

            {fam?.isOwner && (
              <div className="card">
                <h2>Invite a phone</h2>
                {invite && left > 0 ? (
                  <>
                    <button
                      type="button"
                      className="center block"
                      aria-label="Copy the code"
                      style={{
                        fontSize: 34,
                        fontWeight: 800,
                        letterSpacing: 4,
                        margin: '8px 0',
                        width: '100%',
                        background: 'none',
                        border: 'none',
                        color: 'inherit',
                        font: 'inherit',
                        cursor: 'pointer',
                      }}
                      onClick={async () => toast((await copyText(invite.code)) ? '📋 Code copied' : 'Could not copy')}
                    >
                      <span style={{ fontSize: 34, fontWeight: 800, letterSpacing: 4 }}>{invite.code}</span>
                      <div className="tiny muted" style={{ letterSpacing: 0, fontWeight: 400 }}>
                        tap to copy
                      </div>
                    </button>
                    <div className="small muted center mb">
                      On the other phone: Settings → Family sharing → Join, and type this code. It works once and stops in{' '}
                      {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}.
                    </div>
                    <button
                      className="btn block"
                      onClick={async () => toast((await copyText(invite.code)) ? '📋 Code copied' : 'Could not copy')}
                    >
                      📋 Copy code
                    </button>
                  </>
                ) : (
                  <button
                    className="btn primary block"
                    disabled={busy || (!!fam && fam.devices.length >= fam.max)}
                    onClick={() => void run(async () => setInvite(await makeInvite()))}
                  >
                    {fam && fam.devices.length >= fam.max ? 'The family is full (10 phones)' : '＋ Make an invite code'}
                  </button>
                )}
              </div>
            )}

            <div className="card">
              <Field label="This phone’s name">
                <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
              </Field>
              {name.trim() && name.trim() !== link?.name && (
                <button
                  className="btn block"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      setFam(await renameDevice(name.trim()));
                      toast('✨ Name saved');
                    })
                  }
                >
                  Save name
                </button>
              )}
            </div>

            <div className="card">
              <div className="small muted mb">Coming next: choose accounts to share and who sees them.</div>
              <button
                className="btn danger block"
                disabled={busy}
                onClick={async () => {
                  const owner = !!fam?.isOwner;
                  const first = await confirm({
                    title: owner ? 'End the family?' : 'Leave the family?',
                    message: owner
                      ? 'Every phone loses access to everything shared. Data kept on each phone stays.'
                      : 'This phone loses access to everything shared. Your own data on this phone stays.',
                    ok: owner ? 'End it' : 'Leave',
                    danger: true,
                  });
                  if (!first) return;
                  if (owner) {
                    const sure = await confirm({
                      title: 'Really end it for everyone?',
                      ok: 'Yes, end it',
                      cancel: 'Keep it',
                      danger: true,
                      swap: true,
                    });
                    if (!sure) return;
                  }
                  await run(async () => {
                    await leaveFamily(owner);
                    setFam(null);
                    setInvite(null);
                    toast(owner ? 'Family ended' : 'Left the family');
                  });
                }}
              >
                {fam?.isOwner ? 'End the family' : 'Leave the family'}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
