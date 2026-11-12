// "Will My Money Be Enough?": the retirement and money-health calculator, built in (public/retire, English only).
// It runs in its own frame; saving and sharing its picture go through the app, because an app's built-in browser
// can't download files or open the share menu by itself.
import { useEffect } from 'react';
import { Topbar } from '../components/ui';
import { shareFile } from '../services/platform';
import { useApp } from '../state/app';

declare global {
  interface Window {
    mtCalcHost?: {
      saveFile: (blob: Blob, name: string) => Promise<void>;
      shareFile: (blob: Blob, name: string, text?: string) => Promise<void>;
    };
  }
}

export function Retire() {
  const { settings, skin, toast } = useApp();
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
      <iframe
        className="retire-frame"
        src={`retire/index.html?look=${dark ? 'night' : 'cream'}&skin=${skin.id}`}
        title="Will my money be enough?"
      />
    </div>
  );
}
