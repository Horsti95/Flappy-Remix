import type { Rarity } from "./rarity";
import type { AchievementStats } from "./achievements";

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

// ---- Flap-sound variants ---------------------------------------------------
// Five candidates. soft_pop is the always-on default; the rest are
// gated behind achievements (so each unlock gives an audible reward).
// off is a special "silence" option granted at modest playtime.

export type FlapSoundId = "soft_pop" | "paper_whoosh" | "wood_click" | "tonal_blip" | "bird_chirp" | "off";

export interface FlapSoundUnlock {
  unlocked: boolean;
  hint?: string;
}

export const FLAP_SOUND_OPTIONS: { id: FlapSoundId; label: string; blurb: string; unlock(stats: AchievementStats): FlapSoundUnlock }[] = [
  { id: "soft_pop", label: "Soft pop", blurb: "low-pitched bubble — default",
    unlock: () => ({ unlocked: true }) },
  { id: "off", label: "Off (silence)", blurb: "no tap sound",
    unlock: (s) => ({ unlocked: s.totalGames >= 25, hint: "play 25 games" }) },
  { id: "paper_whoosh", label: "Paper whoosh", blurb: "noisy air burst",
    unlock: (s) => ({ unlocked: s.bestScore >= 50, hint: "score 50 in a single run" }) },
  { id: "wood_click", label: "Wood click", blurb: "sharp percussive click",
    unlock: (s) => ({ unlocked: s.streakDays >= 7, hint: "7-day streak" }) },
  { id: "tonal_blip", label: "Tonal blip", blurb: "clean sine ping",
    unlock: (s) => ({ unlocked: s.totalGames >= 100, hint: "play 100 games" }) },
  { id: "bird_chirp", label: "Bird chirp", blurb: "ascending whistle",
    unlock: (s) => ({ unlocked: s.challengeWins >= 5, hint: "win 5 challenges" }) },
];

export function flapSoundUnlock(id: FlapSoundId, stats: AchievementStats): FlapSoundUnlock {
  return FLAP_SOUND_OPTIONS.find((o) => o.id === id)?.unlock(stats) ?? { unlocked: false };
}

const FLAP_KEY = "pflug.flapSound.v1";

export function getActiveFlapSound(): FlapSoundId {
  try {
    const stored = localStorage.getItem(FLAP_KEY) as FlapSoundId | null;
    if (stored && FLAP_SOUND_OPTIONS.some((o) => o.id === stored)) return stored;
  } catch {
    /* localStorage blocked */
  }
  return "soft_pop";
}

export function setActiveFlapSound(id: FlapSoundId): void {
  try {
    localStorage.setItem(FLAP_KEY, id);
  } catch {
    /* ignore */
  }
}

export function playFlap(id: FlapSoundId = getActiveFlapSound()): void {
  if (id === "off") return;
  if (reducedMotion()) return;
  const ac = getCtx();
  if (!ac) return;
  if (ac.state === "suspended") ac.resume().catch(() => undefined);
  const master = ac.createGain();
  master.gain.value = 0.5;
  master.connect(ac.destination);
  const t = ac.currentTime + 0.005;

  switch (id) {
    case "soft_pop": {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(420, t);
      osc.frequency.exponentialRampToValueAtTime(180, t + 0.08);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.18, t + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
      osc.connect(gain).connect(master);
      osc.start(t);
      osc.stop(t + 0.1);
      break;
    }
    case "paper_whoosh": {
      const buf = ac.createBuffer(1, ac.sampleRate * 0.08, ac.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        const env = Math.pow(1 - i / data.length, 1.6);
        data[i] = (Math.random() * 2 - 1) * env;
      }
      const src = ac.createBufferSource();
      src.buffer = buf;
      const hp = ac.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 800;
      const lp = ac.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 4500;
      const gain = ac.createGain();
      gain.gain.value = 0.5;
      src.connect(hp).connect(lp).connect(gain).connect(master);
      src.start(t);
      break;
    }
    case "wood_click": {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(900, t);
      osc.frequency.exponentialRampToValueAtTime(600, t + 0.025);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.13, t + 0.003);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      osc.connect(gain).connect(master);
      osc.start(t);
      osc.stop(t + 0.06);
      break;
    }
    case "tonal_blip": {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(660, t);
      osc.frequency.linearRampToValueAtTime(880, t + 0.06);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.16, t + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
      osc.connect(gain).connect(master);
      osc.start(t);
      osc.stop(t + 0.11);
      break;
    }
    case "bird_chirp": {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(1200, t);
      osc.frequency.exponentialRampToValueAtTime(2200, t + 0.05);
      osc.frequency.exponentialRampToValueAtTime(1500, t + 0.09);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.12, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      osc.connect(gain).connect(master);
      osc.start(t);
      osc.stop(t + 0.13);
      break;
    }
  }
}

// ---- Unlock haptics --------------------------------------------------------

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
