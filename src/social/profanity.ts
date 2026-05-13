// Small curated English wordlist for username gating. Intentionally
// minimal — we'll iterate based on user reports. Substring match on a
// lowercased candidate, so leetspeak slips through. That's accepted
// for v1 — see ETHICS.md.

const BLOCKED: readonly string[] = [
  "admin",
  "system",
  "official",
  "moderator",
  "support",
  "pflug",
  "anus",
  "ass",
  "bitch",
  "cock",
  "cunt",
  "dick",
  "fag",
  "fuck",
  "gook",
  "kike",
  "nigg",
  "nazi",
  "porn",
  "rape",
  "retard",
  "sex",
  "shit",
  "slut",
  "spic",
  "tit",
  "tranny",
  "twat",
  "wank",
  "whore",
];

const RESERVED: readonly string[] = ["pflug", "admin", "system", "official", "support", "team"];

export function validateUsername(raw: string): { ok: true; value: string } | { ok: false; reason: string } {
  const v = raw.trim().toLowerCase();
  if (v.length < 3) return { ok: false, reason: "min 3 characters" };
  if (v.length > 8) return { ok: false, reason: "max 8 characters" };
  if (!/^[a-z0-9]+$/.test(v)) return { ok: false, reason: "letters and digits only" };
  if (RESERVED.includes(v)) return { ok: false, reason: "reserved" };
  for (const bad of BLOCKED) {
    if (v.includes(bad)) return { ok: false, reason: "not allowed" };
  }
  return { ok: true, value: v };
}
