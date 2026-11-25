// "Will My Money Be Enough?": the retirement and money-health calculator, built in (public/retire, English only).
// It runs in its own frame; saving and sharing its picture go through the app, because an app's built-in browser
// can't download files or open the share menu by itself.
import { useEffect, useRef } from 'react';
import { Topbar } from '../components/ui';
import { shareFile } from '../services/platform';
import { useApp } from '../state/app';
import { fmtMoney } from '../domain/money';
import { useWealthTotal } from './Wealth';
import { DEMO_CALC, isDemo } from '../services/demo';
import { isViewing } from '../db/db';

declare global {
  interface Window {
    mtCalcHost?: {
      saveFile: (blob: Blob, name: string) => Promise<void>;
      shareFile: (blob: Blob, name: string, text?: string) => Promise<void>;
    };
  }
}

export function Retire() {
  const { settings, skin, toast, currency } = useApp();
  const frame = useRef<HTMLIFrameElement>(null);
  const wealth = useWealthTotal();
  /** put what Investments & wealth is worth into the calculator's "Pot today" */
  const fillPot = () => {
    const box = frame.current?.contentDocument?.getElementById('start') as HTMLInputElement | null;
    if (!box) return toast('The calculator is still loading. Try again in a second.');
    box.value = Math.round(wealth.total).toLocaleString('en-GB');
    box.dispatchEvent(new Event('input', { bubbles: true }));
    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
    toast(
      `🔭 Pot today: ${fmtMoney(wealth.total, currency, { dp: 0 })} (investments ${fmtMoney(wealth.investments, currency, { compact: true })} + BTC & gold ${fmtMoney(wealth.btcGold, currency, { compact: true })})`,
    );
  };
  useEffect(() => {
    const hand = async (blob: Blob, name: string, text?: string) => {
      const res = await shareFile(name, new Uint8Array(await blob.arrayBuffer()), blob.type || 'image/png', text);
      if (res === 'downloaded') toast('💾 Picture saved');
    };
    window.mtCalcHost = { saveFile: (b, n) => hand(b, n), shareFile: hand };
    return () => {
      delete window.mtCalcHost;
    };
  }, [toast]);
  // the calculator wears the app's theme, in the app's light or dark look
  const dark =
    settings.theme === 'dark' || (settings.theme === 'system' && !!window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  return (
    <div className="retire-screen">
      <Topbar title="🔭 Will my money be enough?" />
      {wealth.total > 0 && (!isViewing() || isDemo()) && (
        <div style={{ padding: '6px 16px 8px' }}>
          <button className="btn mint block" data-tour="retire-fill" onClick={fillPot}>
            ＋ Use Investments & wealth as Pot today · {fmtMoney(wealth.total, currency, { compact: true })}
          </button>
        </div>
      )}
      <iframe
        ref={frame}
        onLoad={() => {
          // the tour's example money: example numbers too (this phone's own come back after the tour)
          if (!isDemo()) return;
          const doc = frame.current?.contentDocument;
          if (!doc) return;
          for (const [id, v] of Object.entries(DEMO_CALC)) {
            const el = doc.getElementById(id) as HTMLInputElement | null;
            if (!el) continue;
            el.value = v;
            el.dispatchEvent(new Event('input', { bubbles: true }));
          }
        }}
        className="retire-frame"
        src={`retire/index.html?look=${dark ? 'night' : 'cream'}&skin=${skin.id}`}
        title="Will my money be enough?"
      />
    </div>
  );
}
