// PLAN 7.4: vibration on answers — a soft, smooth tap for a right one and a sharp double buzz
// ("no-no") for a mistake. In the Android app the native bridge AmazeHaptics drives the vibration
// motor with amplitudes (MainActivity.HapticsBridge); in a browser the Vibration API is used where
// there is one (Android browsers; iOS Safari has none). Turned off in the options menu.
import { storage } from './storage.js';

// Browser fallback: no amplitude control, so the right answer is just one short pulse.
const WEB_PATTERNS = {good: [25], wrong: [70, 55, 95]};

export const haptics = {
  get enabled() { return storage.getSettings().vibration !== false; },
  play(kind) {
    if (!this.enabled || !WEB_PATTERNS[kind]) return;
    try {
      if (window.AmazeHaptics?.vibrate) window.AmazeHaptics.vibrate(kind);
      else navigator.vibrate?.(WEB_PATTERNS[kind]);
    } catch (e) { /* vibration is a nicety: never break the game */ }
  },
};
