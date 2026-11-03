import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/nunito/wght.css';
import '@fontsource-variable/inter/wght.css';
import './styles.css';
import App from './App';
import { ensureSeeded, migrate } from './db/seed';
import { registerServiceWorker } from './services/updater';

async function start() {
  try {
    await navigator.storage?.persist?.();
  } catch {
    // not supported everywhere
  }
  await ensureSeeded();
  await migrate();
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  registerServiceWorker();
}

start().catch((e) => {
  document.getElementById('root')!.innerHTML =
    '<div style="padding:24px;font-family:sans-serif"><h2>Something went wrong</h2><p>' +
    String(e?.message ?? e) +
    '</p></div>';
});
