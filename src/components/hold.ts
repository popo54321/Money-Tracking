// Press and hold: returns props for any element so a long press runs `onHold`
// and the tap that ends the press does not also count as a normal tap.
import type React from 'react';
import { buzz } from '../services/haptics';

let timer: ReturnType<typeof setTimeout> | undefined;
let fired = false;
let sx = 0;
let sy = 0;

const HOLD_MS = 500;

export function holdProps(onHold: () => void) {
  const cancel = () => clearTimeout(timer);
  return {
    onPointerDown(e: React.PointerEvent) {
      fired = false;
      sx = e.clientX;
      sy = e.clientY;
      cancel();
      timer = setTimeout(() => {
        fired = true;
        // the finger is still down: make sure the phone doesn't start selecting text in the menu that opens
        window.getSelection()?.removeAllRanges();
        buzz('medium');
        onHold();
      }, HOLD_MS);
    },
    onPointerMove(e: React.PointerEvent) {
      if (Math.abs(e.clientX - sx) > 10 || Math.abs(e.clientY - sy) > 10) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onPointerLeave: cancel,
    onContextMenu(e: React.MouseEvent) {
      e.preventDefault();
    },
    onClickCapture(e: React.MouseEvent) {
      if (fired) {
        e.preventDefault();
        e.stopPropagation();
        fired = false;
      }
    },
  };
}
