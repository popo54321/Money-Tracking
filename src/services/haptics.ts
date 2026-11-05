// A short buzz when a key is pressed. Android app: the phone's own haptics; Android browser: a tiny vibration.
// iPhone does not let web apps vibrate, so there it is silent.
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { isNative } from './platform';

let enabled = true;

export function setHapticsEnabled(on: boolean): void {
  enabled = on;
}

function vibrate(ms: number) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    // not supported here
  }
}

/** light: a key press; medium: press and hold, or something done. */
export function buzz(strength: 'light' | 'medium' = 'light'): void {
  if (!enabled) return;
  if (isNative()) {
    Haptics.impact({ style: strength === 'light' ? ImpactStyle.Light : ImpactStyle.Medium }).catch(() =>
      vibrate(strength === 'light' ? 8 : 15),
    );
  } else vibrate(strength === 'light' ? 8 : 15);
}
