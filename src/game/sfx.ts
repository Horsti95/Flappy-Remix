import type { Rarity } from "./rarity";
import type { AchievementStats } from "./achievements";
import { getEquippedGateSound } from "./gate-sounds";

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
    case "red":
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

/**
 * Crowd applause — a synthesized cheer for hitting a milestone (used by the
 * stadium theme every 20 points). Dense randomized "claps" over a swelling
 * envelope, band-passed to sound like hands rather than hiss. Visual-only;
 * never touches the sim.
 */
export function playCheer(): void {
  if (reducedMotion()) return;
  const ac = getCtx();
  if (!ac) return;
  if (ac.state === "suspended") ac.resume().catch(() => undefined);

  const dur = 1.3;
  const n = Math.floor(ac.sampleRate * dur);
  const buf = ac.createBuffer(1, n, ac.sampleRate);
  const data = buf.getChannelData(0);
  // Base wash of hiss.
  for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * 0.12;
  // Sparse louder claps with a fast decay so it reads as many hands.
  const claps = 260;
  const clapLen = Math.floor(ac.sampleRate * 0.018);
  for (let c = 0; c < claps; c++) {
    const start = Math.floor(Math.random() * n);
    for (let j = 0; j < clapLen && start + j < n; j++) {
      const env = Math.pow(1 - j / clapLen, 2);
      data[start + j] += (Math.random() * 2 - 1) * env * 0.5;
    }
  }
  // Overall swell: quick rise, hold, gentle fall.
  for (let i = 0; i < n; i++) {
    const x = i / n;
    const rise = Math.min(1, x / 0.16);
    const fall = Math.pow(1 - Math.max(0, (x - 0.55) / 0.45), 1.5);
    data[i] *= rise * fall;
  }

  const src = ac.createBufferSource();
  src.buffer = buf;
  const hp = ac.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 700;
  const bp = ac.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 2000;
  bp.Q.value = 0.7;
  const gain = ac.createGain();
  gain.gain.value = 0.4;
  src.connect(hp).connect(bp).connect(gain).connect(ac.destination);
  src.start();
}

let gatePitchEnabled = false;

/** Settings hook: gate chime pitch follows the gap height when enabled. */
export function setGatePitchEnabled(on: boolean): void {
  gatePitchEnabled = on;
}

export function playGatePass(gapCenterNorm = 0.5): void {
  if (reducedMotion()) return;
  const ac = getCtx();
  if (!ac) return;
  if (ac.state === "suspended") ac.resume().catch(() => undefined);
  const master = ac.createGain();
  master.gain.value = 0.72;
  master.connect(ac.destination);
  const t = ac.currentTime + 0.005;
  // Map the gap's vertical centre to pitch: a high gap (norm→0) rings higher,
  // a low gap (norm→1) lower. Behind the unlockable gatePitch setting —
  // default is a uniform chime so the rhythm anchor stays steady.
  const norm = gatePitchEnabled ? Math.min(1, Math.max(0, gapCenterNorm)) : 0.5;
  switch (getEquippedGateSound()) {
    case "glide":
      gateGlide(ac, master, t, norm);
      break;
    case "wide":
      gateWide(ac, master, t, norm);
      break;
    case "marimba":
      gateMarimba(ac, master, t, norm);
      break;
    case "koto":
      gateKoto(ac, master, t, norm);
      break;
    case "pop_choir":
      gatePopChoir(ac, master, t, norm);
      break;
    case "classic":
    default:
      gateClassic(ac, master, t, norm);
      break;
  }
}

// Classic: the original two-note chirp, pitched ±~half-octave by gap height.
function gateClassic(ac: AudioContext, master: GainNode, t: number, norm: number): void {
  const mult = Math.pow(2, 0.5 - norm);
  [523.25 * mult, 783.99 * mult].forEach((freq, i) => {
    tone(ac, master, { freq, startAt: t + i * 0.06, duration: 0.13, type: "sine", peak: 0.22 });
  });
}

// Glide: a single tone that slides upward into its target pitch, so "pitch
// follows the gap" reads clearly. Target spans ~one octave by gap height.
function gateGlide(ac: AudioContext, master: GainNode, t: number, norm: number): void {
  const target = 660 * Math.pow(2, 0.5 - norm);
  const dur = 0.18;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(target * 0.72, t);
  osc.frequency.exponentialRampToValueAtTime(target, t + dur * 0.7);
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(0.24, t + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

// Wide: the two-note chirp but with a full two-octave pitch span, so a high
// gap and a low gap sound dramatically different.
function gateWide(ac: AudioContext, master: GainNode, t: number, norm: number): void {
  const mult = Math.pow(2, 1 - 2 * norm);
  [523.25 * mult, 783.99 * mult].forEach((freq, i) => {
    tone(ac, master, { freq, startAt: t + i * 0.06, duration: 0.14, type: "triangle", peak: 0.2 });
  });
}

// Marimba: warm mallet tone — a fast-decaying fundamental plus a soft fourth
// harmonic for the wooden "bonk". Pitched ~one octave by gap height.
function gateMarimba(ac: AudioContext, master: GainNode, t: number, norm: number): void {
  const freq = 523.25 * Math.pow(2, 0.5 - norm);
  tone(ac, master, { freq, startAt: t, duration: 0.22, type: "sine", peak: 0.24 });
  tone(ac, master, { freq: freq * 4, startAt: t, duration: 0.07, type: "sine", peak: 0.06 });
}

// Koto: a plucked east-asian string — a bright triangle whose lowpass sweeps
// shut fast (Karplus-Strong-ish damping), with a faint detuned second string
// for body. Pitched ~one octave by gap height.
function gateKoto(ac: AudioContext, master: GainNode, t: number, norm: number): void {
  const freq = 440 * Math.pow(2, 0.5 - norm);
  const dur = 0.28;
  [0, 1].forEach((i) => {
    const osc = ac.createOscillator();
    const lp = ac.createBiquadFilter();
    const gain = ac.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq * (i === 0 ? 1 : 2.01), t); // slightly off-octave shimmer
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(freq * 7, t);
    lp.frequency.exponentialRampToValueAtTime(freq * 1.4, t + dur * 0.8);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(i === 0 ? 0.24 : 0.07, t + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(lp).connect(gain).connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  });
}

// Pop choir: a tiny two-note major chime (root then major third), soft sines
// with a hint of overlap so it reads as a micro-chord. Pitched by gap height.
function gatePopChoir(ac: AudioContext, master: GainNode, t: number, norm: number): void {
  const root = 523.25 * Math.pow(2, 0.5 - norm);
  tone(ac, master, { freq: root, startAt: t, duration: 0.2, type: "sine", peak: 0.2 });
  tone(ac, master, { freq: root * 1.25, startAt: t + 0.07, duration: 0.22, type: "sine", peak: 0.18 });
}

export type DeathSoundId = "classic" | "crumple" | "whistle_down";

export interface DeathSoundUnlock {
  unlocked: boolean;
  hint?: string;
}

export const DEATH_SOUND_OPTIONS: {
  id: DeathSoundId;
  label: string;
  blurb: string;
  unlock(stats: AchievementStats): DeathSoundUnlock;
}[] = [
  { id: "classic",      label: "Classic thud",  blurb: "low descending thud — default",
    unlock: () => ({ unlocked: true }) },
  { id: "crumple",      label: "Crumple",       blurb: "papery crunch — matches the crumple",
    unlock: (s) => ({ unlocked: s.totalGames >= 40, hint: "play 40 games" }) },
  { id: "whistle_down", label: "Whistle down",  blurb: "cartoon falling whistle + soft thud",
    unlock: (s) => ({ unlocked: s.challengeWins >= 3, hint: "win 3 challenges" }) },
];

const DEATH_KEY = "pflug.deathSoundStyle.v1";

export function getActiveDeathSound(): DeathSoundId {
  try {
    const stored = localStorage.getItem(DEATH_KEY) as DeathSoundId | null;
    if (stored && DEATH_SOUND_OPTIONS.some((o) => o.id === stored)) return stored;
  } catch {
    /* localStorage blocked */
  }
  return "classic";
}

export function setActiveDeathSound(id: DeathSoundId): void {
  try {
    localStorage.setItem(DEATH_KEY, id);
  } catch {
    /* localStorage blocked */
  }
}

export function playDeath(id: DeathSoundId = getActiveDeathSound()): void {
  if (reducedMotion()) return;
  const ac = getCtx();
  if (!ac) return;
  if (ac.state === "suspended") ac.resume().catch(() => undefined);
  if (id === "crumple") {
    // Papery crunch: three quick noise bursts through a fast-falling lowpass.
    const master = ac.createGain();
    master.gain.value = 0.7;
    master.connect(ac.destination);
    const t0 = ac.currentTime + 0.005;
    for (let i = 0; i < 3; i++) {
      const t = t0 + i * 0.05;
      const noise = makeNoiseSource(ac, 0.06);
      const lp = ac.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.setValueAtTime(3200 - i * 800, t);
      lp.frequency.exponentialRampToValueAtTime(500, t + 0.05);
      const g = ac.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.3 - i * 0.07, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
      noise.connect(lp).connect(g).connect(master);
      noise.start(t);
    }
    return;
  }
  if (id === "whistle_down") {
    // Cartoon fall: a long descending sine gliss, then a soft thud.
    const master = ac.createGain();
    master.gain.value = 0.7;
    master.connect(ac.destination);
    const t = ac.currentTime + 0.005;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(1400, t);
    osc.frequency.exponentialRampToValueAtTime(280, t + 0.42);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.16, t + 0.02);
    g.gain.setValueAtTime(0.16, t + 0.34);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.44);
    osc.connect(g).connect(master);
    osc.start(t);
    osc.stop(t + 0.46);
    const thud = ac.createOscillator();
    const tg = ac.createGain();
    thud.type = "triangle";
    thud.frequency.setValueAtTime(140, t + 0.42);
    thud.frequency.exponentialRampToValueAtTime(60, t + 0.55);
    tg.gain.setValueAtTime(0, t + 0.42);
    tg.gain.linearRampToValueAtTime(0.3, t + 0.43);
    tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    thud.connect(tg).connect(master);
    thud.start(t + 0.42);
    thud.stop(t + 0.62);
    return;
  }
  playDeathClassic(ac);
}

function playDeathClassic(ac: AudioContext): void {
  const master = ac.createGain();
  master.gain.value = 0.78;
  master.connect(ac.destination);
  const t = ac.currentTime + 0.005;
  // Low descending thud
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(200, t);
  osc.frequency.exponentialRampToValueAtTime(80, t + 0.25);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.35, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
  osc.connect(g).connect(master);
  osc.start(t);
  osc.stop(t + 0.3);
  // Impact noise burst
  const bufLen = Math.floor(ac.sampleRate * 0.15);
  const buf = ac.createBuffer(1, bufLen, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) {
    const env = Math.pow(1 - i / bufLen, 3);
    data[i] = (Math.random() * 2 - 1) * env;
  }
  const src = ac.createBufferSource();
  src.buffer = buf;
  const bp = ac.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 400;
  bp.Q.value = 1.5;
  const ng = ac.createGain();
  ng.gain.value = 0.3;
  src.connect(bp).connect(ng).connect(master);
  src.start(t);
}

// ---- Flap-sound variants ---------------------------------------------------
// Five candidates. soft_pop is the always-on default; the rest are
// gated behind achievements (so each unlock gives an audible reward).
// off is a special "silence" option granted at modest playtime.

export type FlapSoundId =
  | "soft_pop"
  | "bubble"
  | "page_flick"
  | "off"
  | "paper_whoosh"
  | "wood_click"
  | "tonal_blip"
  | "bird_chirp"
  | "chip_blip"
  | "chip_arp"
  | "snap"
  | "water_drop"
  | "glass_tap"
  | "string_pluck"
  | "vinyl_click"
  | "shimmer"
  | "feather";

export interface FlapSoundUnlock {
  unlocked: boolean;
  hint?: string;
}

export const FLAP_SOUND_OPTIONS: { id: FlapSoundId; label: string; blurb: string; unlock(stats: AchievementStats): FlapSoundUnlock }[] = [
  { id: "soft_pop",     label: "Soft pop",     blurb: "low-pitched bubble — default",
    unlock: () => ({ unlocked: true }) },
  { id: "bubble",       label: "Bubble",       blurb: "a watery blip that rises as you flap",
    unlock: (s) => ({ unlocked: s.bestScore >= 35, hint: "score 35 in a single run" }) },
  { id: "page_flick",   label: "Page flick",   blurb: "a papery flick — straight out of the journal",
    unlock: (s) => ({ unlocked: s.totalGames >= 75, hint: "play 75 games" }) },
  { id: "off",          label: "Off (silence)", blurb: "no tap sound",
    unlock: (s) => ({ unlocked: s.totalGames >= 25, hint: "play 25 games" }) },
  { id: "paper_whoosh", label: "Paper whoosh", blurb: "noisy air burst",
    unlock: (s) => ({ unlocked: s.bestScore >= 50, hint: "score 50 in a single run" }) },
  { id: "wood_click",   label: "Wood click",   blurb: "sharp percussive click",
    unlock: (s) => ({ unlocked: s.streakDays >= 7, hint: "7-day streak" }) },
  { id: "tonal_blip",   label: "Tonal blip",   blurb: "clean sine ping",
    unlock: (s) => ({ unlocked: s.friendCount >= 5, hint: "add 5 friends" }) },
  { id: "bird_chirp",   label: "Bird chirp",   blurb: "ascending whistle",
    unlock: (s) => ({ unlocked: s.challengeWins >= 5, hint: "win 5 challenges" }) },
  { id: "chip_blip",    label: "Chip blip",    blurb: "8-bit square pop",
    unlock: (s) => ({ unlocked: s.totalGames >= 50, hint: "play 50 games" }) },
  { id: "chip_arp",     label: "Chip arpeggio", blurb: "ascending NES triplet",
    unlock: (s) => ({ unlocked: s.bestScore >= 75, hint: "score 75 in a single run" }) },
  { id: "snap",         label: "Snap",         blurb: "sharp percussive snap",
    unlock: (s) => ({ unlocked: s.totalGames >= 200, hint: "play 200 games" }) },
  { id: "water_drop",   label: "Water drop",   blurb: "watery dip + plop",
    unlock: (s) => ({ unlocked: s.dailyStreakDays >= 3, hint: "3-day daily streak with 20+ scores" }) },
  { id: "glass_tap",    label: "Glass tap",    blurb: "high crystal ping",
    unlock: (s) => ({ unlocked: s.bestScore >= 150, hint: "score 150 in a single run" }) },
  { id: "string_pluck", label: "String pluck", blurb: "soft plucked string",
    unlock: (s) => ({ unlocked: s.streakDays >= 14, hint: "14-day streak" }) },
  { id: "vinyl_click",  label: "Vinyl click",  blurb: "soft analog tick",
    unlock: (s) => ({ unlocked: s.totalGames >= 500, hint: "play 500 games" }) },
  { id: "shimmer",      label: "Shimmer",      blurb: "high triangle shimmer",
    unlock: (s) => ({ unlocked: s.totalGames >= 1000, hint: "play 1000 games" }) },
  { id: "feather",      label: "Feather",      blurb: "soft airy chime — grace over force",
    unlock: (s) => ({ unlocked: s.minimalistDone === true, hint: "earn the minimalist run (25+ with <80 taps)" }) },
];

/** When true, every sound in the picker shows as unlocked so the
 *  player can preview the full catalogue. Enabled via ?sounds=lab. */
let labMode = false;
export function setSoundLabMode(on: boolean): void { labMode = on; }
export function isSoundLabMode(): boolean { return labMode; }

export function flapSoundUnlock(id: FlapSoundId, stats: AchievementStats): FlapSoundUnlock {
  if (labMode) return { unlocked: true };
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

/** Short white-noise buffer source — shared by the papery/percussive sfx. */
function makeNoiseSource(ac: AudioContext, durSeconds: number): AudioBufferSourceNode {
  const n = Math.max(1, Math.floor(ac.sampleRate * durSeconds));
  const buf = ac.createBuffer(1, n, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = buf;
  return src;
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
    case "bubble": {
      // Watery blip: a sine that bends UP with a tiny noise transient on top.
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(300, t);
      osc.frequency.exponentialRampToValueAtTime(720, t + 0.07);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.16, t + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
      osc.connect(gain).connect(master);
      osc.start(t);
      osc.stop(t + 0.1);
      const noise = makeNoiseSource(ac, 0.02);
      const ng = ac.createGain();
      const nf = ac.createBiquadFilter();
      nf.type = "bandpass";
      nf.frequency.value = 2400;
      ng.gain.setValueAtTime(0.05, t);
      ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.02);
      noise.connect(nf).connect(ng).connect(master);
      noise.start(t);
      break;
    }
    case "page_flick": {
      // Papery flick: a very short highpassed noise burst with a fast
      // downward filter sweep — reads as a page corner snapping past.
      const noise = makeNoiseSource(ac, 0.06);
      const nf = ac.createBiquadFilter();
      nf.type = "highpass";
      nf.frequency.setValueAtTime(2600, t);
      nf.frequency.exponentialRampToValueAtTime(900, t + 0.05);
      const ng = ac.createGain();
      ng.gain.setValueAtTime(0, t);
      ng.gain.linearRampToValueAtTime(0.22, t + 0.004);
      ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
      noise.connect(nf).connect(ng).connect(master);
      noise.start(t);
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
    case "chip_blip": {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(880, t);
      osc.frequency.linearRampToValueAtTime(1100, t + 0.04);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.12, t + 0.003);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
      osc.connect(gain).connect(master);
      osc.start(t);
      osc.stop(t + 0.09);
      break;
    }
    case "chip_arp": {
      const notes = [523.25, 783.99, 1046.5];
      notes.forEach((f, i) => {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        const at = t + i * 0.035;
        osc.type = "square";
        osc.frequency.setValueAtTime(f, at);
        gain.gain.setValueAtTime(0, at);
        gain.gain.linearRampToValueAtTime(0.09, at + 0.002);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.05);
        osc.connect(gain).connect(master);
        osc.start(at);
        osc.stop(at + 0.06);
      });
      break;
    }
    case "snap": {
      const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.03), ac.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        const env = Math.pow(1 - i / data.length, 4);
        data[i] = (Math.random() * 2 - 1) * env;
      }
      const src = ac.createBufferSource();
      src.buffer = buf;
      const bp = ac.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 2800;
      bp.Q.value = 2;
      const gain = ac.createGain();
      gain.gain.value = 0.6;
      src.connect(bp).connect(gain).connect(master);
      src.start(t);
      break;
    }
    case "water_drop": {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(800, t);
      osc.frequency.exponentialRampToValueAtTime(200, t + 0.18);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.18, t + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      osc.connect(gain).connect(master);
      osc.start(t);
      osc.stop(t + 0.21);
      break;
    }
    case "glass_tap": {
      const fund = ac.createOscillator();
      const harm = ac.createOscillator();
      const g1 = ac.createGain();
      const g2 = ac.createGain();
      fund.type = "sine";
      harm.type = "sine";
      fund.frequency.setValueAtTime(1500, t);
      harm.frequency.setValueAtTime(3700, t);
      g1.gain.setValueAtTime(0, t);
      g1.gain.linearRampToValueAtTime(0.13, t + 0.002);
      g1.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      g2.gain.setValueAtTime(0, t);
      g2.gain.linearRampToValueAtTime(0.06, t + 0.002);
      g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
      fund.connect(g1).connect(master);
      harm.connect(g2).connect(master);
      fund.start(t); fund.stop(t + 0.19);
      harm.start(t); harm.stop(t + 0.09);
      break;
    }
    case "string_pluck": {
      const osc = ac.createOscillator();
      const lp = ac.createBiquadFilter();
      const gain = ac.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(330, t);
      lp.type = "lowpass";
      lp.frequency.setValueAtTime(2000, t);
      lp.frequency.exponentialRampToValueAtTime(400, t + 0.18);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.18, t + 0.003);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      osc.connect(lp).connect(gain).connect(master);
      osc.start(t);
      osc.stop(t + 0.23);
      break;
    }
    case "vinyl_click": {
      const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.04), ac.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        const env = Math.pow(1 - i / data.length, 2.5);
        data[i] = (Math.random() * 2 - 1) * env;
      }
      const src = ac.createBufferSource();
      src.buffer = buf;
      const lp = ac.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 1200;
      const gain = ac.createGain();
      gain.gain.value = 0.4;
      src.connect(lp).connect(gain).connect(master);
      src.start(t);
      break;
    }
    case "shimmer": {
      const freqs = [2093, 2637.02, 3135.96];
      freqs.forEach((f, i) => {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        const at = t + i * 0.012;
        osc.type = "triangle";
        osc.frequency.setValueAtTime(f, at);
        gain.gain.setValueAtTime(0, at);
        gain.gain.linearRampToValueAtTime(0.04, at + 0.003);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.16);
        osc.connect(gain).connect(master);
        osc.start(at);
        osc.stop(at + 0.17);
      });
      break;
    }
    case "feather": {
      // A breathy band-passed noise puff with a faint high sine on top —
      // soft and weightless, the "minimalist" reward.
      const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.12), ac.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        const env = Math.sin((Math.PI * i) / data.length); // gentle swell + fade
        data[i] = (Math.random() * 2 - 1) * env * 0.5;
      }
      const src = ac.createBufferSource();
      src.buffer = buf;
      const bp = ac.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 2600;
      bp.Q.value = 0.8;
      const ng = ac.createGain();
      ng.gain.value = 0.35;
      src.connect(bp).connect(ng).connect(master);
      src.start(t);
      const osc = ac.createOscillator();
      const g = ac.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(1760, t);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.05, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      osc.connect(g).connect(master);
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
  red: [25, 20, 30, 20, 35, 20, 45, 30, 60, 40, 80],
};

export function triggerUnlockHaptic(rarity: Rarity): void {
  if (reducedMotion()) return;
  vibrate(HAPTIC[rarity]);
}

// ---- Gameplay haptics ------------------------------------------------------
// Distinct, short patterns so flap / score / crash each *feel* different in
// the hand. Callers gate these on the `haptics` setting (independent of sound),
// so there's no reducedMotion check here — the toggle is the control. iOS
// Safari ignores navigator.vibrate (no-op today); a native Taptic bridge takes
// over once the app is wrapped.

/** Tiny tick on every flap — the lightest pattern so rapid tapping isn't buzzy. */
export function triggerFlapHaptic(): void {
  vibrate(8);
}

/** Soft blip as a gate is cleared (one per point). */
export function triggerGateHaptic(): void {
  vibrate(12);
}

/** A heavier, two-stage thud when the run ends. */
export function triggerDeathHaptic(): void {
  vibrate([35, 40, 70]);
}

/** Feature-detected vibration. Silent no-op where unsupported or blocked. */
function vibrate(pattern: number | number[]): void {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* some browsers throw if not in a user-gesture */
  }
}
