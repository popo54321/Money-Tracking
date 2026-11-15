// Asking the phone to keep the app's data for good. Without that, a browser (Safari above all) may clear a site's
// data when space runs low or it hasn't been opened for a while. The Android app keeps its data inside the app.
import { useEffect, useState } from 'react';
import { isNative } from './platform';

/** Ask once at start: home-screen apps are usually allowed; a plain browser tab may be refused. */
export async function keepDataSafe(): Promise<boolean> {
  if (isNative()) return true;
  try {
    if (await navigator.storage?.persisted?.()) return true;
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}

/** Whether the data is protected from being cleared: true, false, or null while checking. */
export function useDataKept(): boolean | null {
  const [kept, setKept] = useState<boolean | null>(isNative() ? true : null);
  useEffect(() => {
    if (isNative()) return;
    let alive = true;
    (async () => {
      try {
        const v = (await navigator.storage?.persisted?.()) ?? false;
        if (alive) setKept(v);
      } catch {
        if (alive) setKept(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);
  return kept;
}
