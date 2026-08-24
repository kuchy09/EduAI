// Haptic and acoustic tactile feedback engine for interactive UI capsules

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!audioCtx && AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  } catch {
    return null;
  }
}

/**
 * Triggers a subtle, premium tactile vibration on supported mobile devices
 */
export function triggerHapticFeedback(pattern: number | number[] = 15): void {
  if (typeof window === 'undefined') return;
  try {
    if ('vibrate' in navigator && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
    }
  } catch {
    // Ignore unsupported vibration permissions or hardware limitations
  }
}

/**
 * Synthesizes a crisp, liquid-glass acoustic pop/click using Web Audio API
 */
export function playCapsuleClickSound(options?: { pitch?: number; volume?: number }): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const basePitch = options?.pitch ?? 560;
    const volume = options?.volume ?? 0.18;

    // Primary gentle tone
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    // Secondary subtle overtone for glassy acoustic depth
    const overtoneOsc = ctx.createOscillator();
    const overtoneGain = ctx.createGain();

    osc.type = 'sine';
    // Smooth micro pitch slide for tactile bubble/click sensation
    osc.frequency.setValueAtTime(basePitch * 1.25, now);
    osc.frequency.exponentialRampToValueAtTime(basePitch * 0.5, now + 0.055);

    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);

    overtoneOsc.type = 'triangle';
    overtoneOsc.frequency.setValueAtTime(basePitch * 2.1, now);
    overtoneOsc.frequency.exponentialRampToValueAtTime(basePitch * 0.9, now + 0.04);

    overtoneGain.gain.setValueAtTime(volume * 0.35, now);
    overtoneGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);

    // Filter to soften any harsh high frequencies
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2400, now);

    osc.connect(gain);
    overtoneOsc.connect(overtoneGain);

    gain.connect(filter);
    overtoneGain.connect(filter);
    filter.connect(ctx.destination);

    osc.start(now);
    overtoneOsc.start(now);

    osc.stop(now + 0.065);
    overtoneOsc.stop(now + 0.05);
  } catch {
    // Audio playback fallback safe fail
  }
}

/**
 * Combined tactile feedback (vibration + sound) for transition capsules
 */
export function triggerCapsuleFeedback(options?: { pitch?: number; volume?: number; hapticDuration?: number }): void {
  triggerHapticFeedback(options?.hapticDuration ?? 14);
  playCapsuleClickSound(options);
}
