// Pressing a button shows: it turns darker while your finger is on it (lighter in dark mode), and stays that way
// for a moment even after a quick tap. Scrolling instead of tapping takes it off again.
export function showPresses(doc: Document = document): void {
  doc.addEventListener(
    'pointerdown',
    (e) => {
      const b = (e.target as Element | null)?.closest?.('button, [role="button"]');
      if (!b || (b as HTMLButtonElement).disabled) return;
      b.classList.add('is-pressed');
      const since = Date.now();
      const view = doc.defaultView ?? window;
      const off = () => {
        view.removeEventListener('pointerup', off);
        view.removeEventListener('pointercancel', off);
        view.setTimeout(() => b.classList.remove('is-pressed'), Math.max(0, 160 - (Date.now() - since)));
      };
      view.addEventListener('pointerup', off);
      view.addEventListener('pointercancel', off);
    },
    { passive: true },
  );
  // iPhone only shows :active when the page listens for touches
  doc.addEventListener('touchstart', () => {}, { passive: true });
}

/** The browser's own "install this app" offer (Android Chrome), kept for the tour's Install button. */
interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
}
let installPrompt: InstallPrompt | null = null;
export function keepInstallPrompt(): void {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installPrompt = e as InstallPrompt;
  });
  window.addEventListener('appinstalled', () => {
    installPrompt = null;
  });
}
export function canInstallNow(): boolean {
  return !!installPrompt;
}
export async function installNow(): Promise<void> {
  if (!installPrompt) return;
  await installPrompt.prompt();
  installPrompt = null;
}
