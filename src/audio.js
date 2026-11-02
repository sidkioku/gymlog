let audioCtx = null;

export function unlockAudio() {
  if (typeof window === 'undefined') return;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  if (!audioCtx) {
    audioCtx = new Ctx();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
}

export function triggerHaptic(type = 'light') {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      if (type === 'success') navigator.vibrate([18, 40, 28]);
      else if (type === 'medium') navigator.vibrate(18);
      else navigator.vibrate(10);
    } catch {
      // Ignore on unsupported devices
    }
  }
}

export function playRestFinishedChime() {
  triggerHaptic('success');
  if (typeof window === 'undefined') return;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;

  try {
    if (!audioCtx) audioCtx = new Ctx();
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    const now = audioCtx.currentTime;
    // Pleasant 3-note ascending chime (C5 -> E5 -> G5 -> C6)
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.11);

      gain.gain.setValueAtTime(0.0001, now + idx * 0.11);
      gain.gain.exponentialRampToValueAtTime(0.22, now + idx * 0.11 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.11 + 0.36);

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now + idx * 0.11);
      osc.stop(now + idx * 0.11 + 0.38);
    });
  } catch {
    // Graceful no-op if audio blocked
  }
}

export class WakeLockController {
  constructor() {
    this.sentinel = null;
    this.desired = false;

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && this.desired) {
          this.acquire();
        }
      });
    }
  }

  async setDesired(shouldKeepAwake) {
    this.desired = Boolean(shouldKeepAwake);
    if (this.desired) {
      await this.acquire();
    } else {
      await this.release();
    }
  }

  async acquire() {
    if (
      typeof navigator === 'undefined' ||
      !navigator.wakeLock ||
      typeof navigator.wakeLock.request !== 'function'
    ) {
      return false;
    }
    if (this.sentinel && !this.sentinel.released) return true;
    try {
      this.sentinel = await navigator.wakeLock.request('screen');
      this.sentinel.addEventListener?.('release', () => {
        this.sentinel = null;
      });
      return true;
    } catch {
      return false;
    }
  }

  async release() {
    if (this.sentinel) {
      try {
        await this.sentinel.release();
      } catch {
        // Ignore
      }
      this.sentinel = null;
    }
  }
}
