import type { Rarity } from "./rarity";

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (ctx) return ctx;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  try {
    ctx = new AC();
  } catch {
    return null;
  }
  return ctx;
}

function reducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

interface ToneOpts {
  freq: number;
  startAt: number;
  duration: number;
  type?: OscillatorType;
  peak?: number;
}

function tone(ac: AudioContext, dest: AudioNode, { freq, startAt, duration, type = "triangle", peak = 0.18 }: ToneOpts): void {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startAt);
  gain.gain.setValueAtTime(0, startAt);
  gain.gain.linearRampToValueAtTime(peak, startAt + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  osc.connect(gain).connect(dest);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.02);
}

export function playUnlockSound(rarity: Rarity): void {
  if (reducedMotion()) return;
  const ac = getCtx();
  if (!ac) return;
  if (ac.state === "suspended") ac.resume().catch(() => undefined);

  const master = ac.createGain();
  master.gain.value = 0.6;
  master.connect(ac.destination);

  const t = ac.currentTime + 0.02;

  switch (rarity) {
    case "common": {
      tone(ac, master, { freq: 660, startAt: t, duration: 0.18 });
      break;
    }
    case "uncommon": {
      tone(ac, master, { freq: 587.33, startAt: t, duration: 0.18 });
      tone(ac, master, { freq: 880, startAt: t + 0.08, duration: 0.22 });
      break;
    }
    case "rare": {
      const notes = [523.25, 659.25, 783.99];
      notes.forEach((f, i) => tone(ac, master, { freq: f, startAt: t + i * 0.07, duration: 0.26, peak: 0.2 }));
      break;
    }
    case "epic": {
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((f, i) => tone(ac, master, { freq: f, startAt: t + i * 0.06, duration: 0.32, peak: 0.22 }));
      tone(ac, master, { freq: 1567.98, startAt: t + 0.28, duration: 0.5, type: "sine", peak: 0.12 });
      break;
    }
    case "legendary": {
      const arp = [523.25, 659.25, 783.99, 1046.5, 1318.51];
      arp.forEach((f, i) => tone(ac, master, { freq: f, startAt: t + i * 0.055, duration: 0.4, peak: 0.22 }));
      const chord = [523.25, 659.25, 783.99];
      chord.forEach((f) => tone(ac, master, { freq: f, startAt: t + 0.32, duration: 0.9, type: "sine", peak: 0.14 }));
      tone(ac, master, { freq: 2093, startAt: t + 0.35, duration: 0.7, type: "sine", peak: 0.09 });
      tone(ac, master, { freq: 2637.02, startAt: t + 0.45, duration: 0.6, type: "sine", peak: 0.07 });
      break;
    }
  }
}

const HAPTIC: Record<Rarity, number | number[]> = {
  common: 15,
  uncommon: [10, 40, 15],
  rare: [12, 30, 18, 30, 25],
  epic: [15, 25, 20, 25, 30, 25, 40],
  legendary: [20, 20, 25, 20, 30, 20, 40, 30, 60],
};

export function triggerUnlockHaptic(rarity: Rarity): void {
  if (reducedMotion()) return;
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  try {
    navigator.vibrate(HAPTIC[rarity]);
  } catch {
    /* some browsers throw if not user-gesture */
  }
}
