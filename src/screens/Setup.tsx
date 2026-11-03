import { AmountField, Topbar } from '../components/ui';
import { db } from '../db/db';
import { getFlag, setFlag } from '../db/repo';
import { useApp, useData } from '../state/app';
import { accountEmoji } from '../ui/emoji';

/** First launch: type today's balance for each account, or hide the ones not needed. */
export function Setup() {
  const { profile, back, toast, go } = useApp();
  const data = useData();
  const withEntries = new Set(data.txs.flatMap((t) => [t.accountId, t.toAccountId ?? '']));
  const list = data.accounts.filter((a) => !withEntries.has(a.id));

  const finish = async () => {
    const f = await getFlag<Record<string, boolean>>('needsSetup', {});
    await setFlag('needsSetup', { ...f, [profile.id]: false });
    toast('🌸 All set!');
    back();
  };

  return (
    <>
      <Topbar title={`Starting balances ${profile.emoji ?? ''}`} />
      <div className="page">
        <div className="banner sky">
          <span>🌱</span>
          <span className="grow">
            Type what each account has today. For credit cards, type what you owe. BTC accounts take the BTC amount. Hide the ones
            you don’t use.
          </span>
        </div>
        <div className="list">
          {list.map((a) => {
            const isCard = a.type === 'credit';
            return (
              <div key={a.id} className="row" style={{ opacity: a.archived ? 0.45 : 1, flexWrap: 'wrap' }}>
                <div className="bubble">{accountEmoji(a.type)}</div>
                <div className="main">
                  <div className="title">{a.name}</div>
                  <div className="sub">
                    {a.group} · {a.currency}
                  </div>
                </div>
                <div style={{ width: 150 }}>
                  {!a.archived && (
                    <AmountField
                      value={a.openingBalance ? (isCard ? -a.openingBalance : a.openingBalance) : null}
                      onChange={(v) => db.accounts.update(a.id, { openingBalance: isCard ? -v : v })}
                      currency={a.currency}
                      placeholder="0"
                      title={a.name}
                      allowNegative={!isCard}
                    />
                  )}
                </div>
                <button className="btn sm ghost" onClick={() => db.accounts.update(a.id, { archived: !a.archived })}>
                  {a.archived ? 'Show' : 'Hide'}
                </button>
              </div>
            );
          })}
        </div>
        <button className="btn ghost block" onClick={() => go({ name: 'accountEdit' })}>
          ＋ Add a credit card or another account
        </button>
        <button className="btn primary block mt" onClick={finish}>
          Done
        </button>
      </div>
    </>
  );
}
