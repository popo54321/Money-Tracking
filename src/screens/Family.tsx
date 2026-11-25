// Family sharing: link phones (the phone that starts a family invites others with a code and can remove them; a
// removed phone loses access straight away), see the accounts shared, and keep a family backup so a lost phone can
// be put back onto a new one with a code from another phone in the family.
import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Field, Topbar } from '../components/ui';
import { db } from '../db/db';
import { fmtDate } from '../domain/dates';
import { fmtAgo } from '../domain/dates';
import {
  familyBackupNow,
  familyBackups,
  makeRecoveryCode,
  recoverPhone,
  syncNow,
  syncStatus,
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
  const { profile, toast, confirm, go } = useApp();
  const link = useLiveQuery(async () => ((await db.kv.get('syncLink'))?.value as SyncLink | undefined) ?? null, []);
  const [fam, setFam] = useState<FamilyInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState(`${profile.name}’s phone`);
  const [code, setCode] = useState('');
  const [invite, setInvite] = useState<{ code: string; expiresAt: number } | null>(null);
  const [now, setNow] = useState(Date.now());
  const [problem, setProblem] = useState<string | null>(null);
  const [recovery, setRecovery] = useState<{ code: string; expiresAt: number; name: string } | null>(null);
  const [lostCode, setLostCode] = useState('');
  const [backups, setBackups] = useState<Map<string, number>>(new Map());
  const status = useLiveQuery(() => syncStatus(), []);
  const sharedAccounts = useLiveQuery(async () => (await db.accounts.toArray()).filter((a) => a.shared && !a.removed), []);

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
    void familyBackups()
      .then((r) => setBackups(new Map(r.backups.map((b) => [b.id, b.at]))))
      .catch(() => undefined);
    void run(async () => setFam(await loadFamily()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linked]);
  useEffect(() => {
    if (!invite && !recovery) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [invite, recovery]);
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
            <div className="card">
              <h2>🆘 Lost your phone?</h2>
              <div className="small muted mb">
                On another phone in your family: Family sharing → your old phone → 🆘 Lost. Type the code it shows here: this
                phone takes the old one’s place (and role), with its data from the family backup. The lost phone stops working
                with the family.
              </div>
              <Field label="Recovery code">
                <input
                  value={lostCode}
                  onChange={(e) => setLostCode(e.target.value.toUpperCase())}
                  placeholder="ABCD-EFGH"
                  autoCapitalize="characters"
                  autoComplete="off"
                  maxLength={9}
                  style={{ letterSpacing: 2, fontWeight: 700 }}
                />
              </Field>
              <button
                className="btn block"
                disabled={busy || lostCode.replace(/[^A-Z0-9]/gi, '').length !== 8}
                onClick={async () => {
                  const ok = await confirm({
                    title: 'Put the lost phone back here?',
                    message: 'Everything on this phone is replaced by the lost phone’s family backup.',
                    ok: 'Put it back',
                    danger: true,
                  });
                  if (!ok) return;
                  await run(async () => {
                    const at = await recoverPhone(lostCode);
                    setLostCode('');
                    setFam(await loadFamily());
                    toast(
                      at
                        ? `✅ Back, with the backup from ${fmtDate(ISO(at))}`
                        : '✅ Back in the family (there was no backup yet)',
                    );
                  });
                }}
              >
                Put my old phone back here
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
                          {backups.get(d.id) ? ` · backed up ${fmtAgo(backups.get(d.id)!)}` : ''}
                        </div>
                      </div>
                      {!d.me && (
                        <button
                          className="btn sm ghost"
                          disabled={busy}
                          aria-label={`${d.name} was lost`}
                          onClick={async () => {
                            const ok = await confirm({
                              title: `Was ${d.name} lost?`,
                              message:
                                'You get a code to type on the new phone: it takes this phone’s place, with its family backup. The lost phone then stops working with the family.',
                              ok: 'Make a code',
                            });
                            if (!ok) return;
                            await run(async () => setRecovery(await makeRecoveryCode(d.id)));
                          }}
                        >
                          🆘 Lost
                        </button>
                      )}
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

            {recovery && now < recovery.expiresAt && (
              <div className="card">
                <h2>🆘 Code for {recovery.name}</h2>
                <button
                  type="button"
                  className="center block"
                  style={{
                    width: '100%',
                    background: 'none',
                    border: 'none',
                    color: 'inherit',
                    font: 'inherit',
                    cursor: 'pointer',
                  }}
                  onClick={async () => toast((await copyText(recovery.code)) ? '📋 Code copied' : 'Could not copy')}
                >
                  <span style={{ fontSize: 34, fontWeight: 800, letterSpacing: 4 }}>{recovery.code}</span>
                  <div className="tiny muted">tap to copy</div>
                </button>
                <div className="small muted center">
                  On the new phone: Settings → Family sharing → Lost your phone?, and type this code. It works once and stops in{' '}
                  {Math.floor((recovery.expiresAt - now) / 60000)}:
                  {String(Math.floor(((recovery.expiresAt - now) % 60000) / 1000)).padStart(2, '0')}.
                </div>
              </div>
            )}

            <div className="card">
              <h2>👨‍👩‍👧 Shared accounts</h2>
              {!sharedAccounts?.length ? (
                <div className="small muted">
                  None yet. To share one: open the account → ✏️ Edit → Share with family, and tick the phones.
                </div>
              ) : (
                <div className="list">
                  {sharedAccounts.map((a) => (
                    <button key={a.id} className="row" onClick={() => go({ name: 'account', id: a.id })}>
                      <div className={`bubble ${a.shared!.mine ? 'mint' : 'sky'}`}>{a.shared!.mine ? '📤' : '📥'}</div>
                      <div className="main">
                        <div className="title">{a.name}</div>
                        <div className="sub">
                          {a.shared!.mine
                            ? `You share it with ${a.shared!.members.length} ${a.shared!.members.length === 1 ? 'phone' : 'phones'}`
                            : `Shared with you by ${a.shared!.ownerName}`}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              <div className="small muted mt">
                {status?.lastError
                  ? `⚠️ ${status.lastError}`
                  : status?.lastSyncAt
                    ? `In step ${fmtAgo(status.lastSyncAt)}. It keeps itself in step while the app is open.`
                    : 'Not in step yet.'}
              </div>
              <button className="btn ghost block mt" disabled={busy} onClick={() => void run(() => syncNow())}>
                ↻ Sync now
              </button>
            </div>

            <div className="card">
              <h2>💾 Family backup</h2>
              <div className="small muted mb">
                Every phone in the family keeps a copy of all its data with the family (every 6 hours while the app is open). If a
                phone is lost, another phone makes a code (🆘 Lost) and the new phone gets its place and data back.
              </div>
              <div className="small">
                This phone: {status?.lastBackupAt ? `backed up ${fmtAgo(status.lastBackupAt)}` : 'not backed up yet'}
              </div>
              <button
                className="btn block mt"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await familyBackupNow();
                    const r = await familyBackups();
                    setBackups(new Map(r.backups.map((b) => [b.id, b.at])));
                    toast('💾 Backed up with the family');
                  })
                }
              >
                Back up now
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
