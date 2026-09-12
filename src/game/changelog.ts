/**
 * "What's new" patch notes.
 *
 * A hand-maintained changelog shown once per update: we store the last
 * version the player saw in localStorage and, on launch, if the newest entry
 * is newer, show the modal then record it. Version-based (not per-login) so
 * each player sees each update exactly once — no nagging, no push, dismissible.
 * Bump APP_VERSION + prepend an entry when shipping notable changes.
 */

export const APP_VERSION = "0.25.2";

export interface ChangeEntry {
  version: string;
  date: string;
  title: string;
  notes: string[];
}

// Newest first.
export const CHANGELOG: ChangeEntry[] = [
  {
    version: "0.25.2",
    date: "2026-09-12",
    title: "No more false alarms",
    notes: [
      "🧩 Fixed: the error screen was appearing for errors thrown by browser extensions — wallets, ad blockers, password managers — even though the game itself was running fine. Extensions inject code into every page, and the game was taking the blame for theirs. It now only interrupts you when the problem is actually Glide's.",
    ],
  },
  {
    version: "0.25.1",
    date: "2026-09-12",
    title: "Saving works again",
    notes: [
      "💾 Fixed: since the last update the game couldn't save runs at all — the menu showed “N queued” and scores stopped appearing on the leaderboards. Nothing was lost. Queued runs send themselves as soon as you open the game on this build, and the scores land with their original result.",
      "🙏 Sorry about that one. It came from moving the save server closer to the database, which is a real speed win everywhere else — the move was just wired up wrongly.",
    ],
  },
  {
    version: "0.25.0",
    date: "2026-09-12",
    title: "The beta is live",
    notes: [
      "🚀 This is the update everything below has been waiting for — the account rescue, the daily results screen, the faster first load and the proper error screen are all live now, not just in testing. If you've been away a while, the older entries below are your catch-up.",
      "🥊 “Duel their best run” loads again. For a couple of days it just said “couldn't load challenge”: the game and the database were briefly out of step while this update was being prepared. No runs, scores or streaks were affected — only that one button.",
      "🎟️ Promo codes can't be handed out without a use limit any more, not even by accident. An unlimited code is one screenshot away from being everyone's, and a rare skin that everyone has isn't rare.",
      "🐛 Something looks wrong? Settings → Feedback. It quietly attaches which exact build you were on, which is usually the difference between “we'll look into it” and a fix.",
    ],
  },
  {
    version: "0.24.1",
    date: "2026-09-12",
    title: "Old promo codes retired",
    notes: [
      "🎟️ Six early promo codes were retired. If you redeemed one, you keep the skin and badge — nothing was taken away. They just can't be used again, because the codes had been public for longer than intended.",
      "🔒 A few more server-side permission fixes behind the scenes.",
    ],
  },
  {
    version: "0.24.0",
    date: "2026-09-12",
    title: "Beta-ready: if it breaks, you can tell us",
    notes: [
      "🪂 If the game ever hits an error you now get a proper screen instead of a black one — with a one-tap \u201ccopy report\u201d that includes exactly which build you were on. Your progress is untouched, and \u201ckeep playing\u201d usually just works.",
      "🔖 Every build is stamped with its own id, so a bug report points at one exact version instead of \u201cit happened on 0.23\u201d.",
      "🔍 The beta is kept out of search results, so an unfinished build doesn't end up ranking on Google.",
    ],
  },
  {
    version: "0.23.0",
    date: "2026-09-12",
    title: "Daily results you can send to someone",
    notes: [
      "📊 New: when your three daily attempts are done, you get a results screen — all three scores side by side, the day's difficulty and twist, and your streak.",
      "📋 It comes with a little emoji block you can copy and paste into any chat. It shows the shape of your day without giving away the level, so it's safe to send to someone who hasn't played yet.",
      "🗂️ Your three daily scores are now remembered, not just your best — that's what the new screen shows. Old days are kept for two weeks and then tidied away.",
      "🔗 The finished daily also links straight to today's leaderboard.",
    ],
  },
  {
    version: "0.22.0",
    date: "2026-09-12",
    title: "Your account stays yours",
    notes: [
      "🔒 Fixed the big one: if the game couldn't sign you back in — a patchy connection, a server hiccup, a second device — it used to quietly hand you a brand-new empty account. Your real one was still there, but your phone could never find it again, so you'd open the app as a fresh guest with your scores, skins and streak gone. That can't happen any more: if sign-in fails the game now says so and offers to retry instead of replacing you. If this bit you, your old account was never deleted — get in touch and it can be found.",
      "📱 Installed-app fix: the odd blue strip across the top (a stray piece of the menu bleeding past the game) is gone, and the game no longer slides under your phone's status bar.",
      "⚡ Much faster first load — about 5× less to download before you can play, because three background images were shipping at full size. Backgrounds now load as you meet them.",
      "🏃 Scores sync a lot quicker. Finishing a run used to mean a long round trip for every single thing being saved; those now happen next to the database instead of across the world.",
      "🏅 Fairer leaderboards: a couple of ways to copy someone else's run, or to fake superhuman tapping, no longer work.",
      "🧮 Fixed rare cases where two runs finishing at the same time could lose one of them — a game, some XP, a level-up reward or a ranked result could quietly go missing.",
      "👋 Removing a friend now actually removes you from THEIR list too, not just yours. Before, they could still see you and challenge you.",
      "💾 You can now back up your account. Until now every account was anonymous — it lived only in your browser's storage, so clearing your data or changing phone lost everything with no way back. Account → “Secure this account” attaches an email (or Google/Discord) and your runs, skins and streak come with you. There's also a short recovery reference in Account → Progress, worth noting down.",
      "🕵️ Your tap-by-tap run data is no longer readable by anyone who asks — only for a challenge you were actually sent, or a duel against a named player's best run.",
      "📅 The daily's 3-attempt limit now actually holds. Finishing two runs at the same moment could slip extra attempts onto the daily board and pay the personal-best bonus twice; a run is now recorded in one go, so the count can't drift.",
      "🛡️ Under the hood: a serious permissions hole closed (it was possible to end the ranked season, or tamper with a future daily, from outside the game), plus promo-code limits, sign-out cleanup and account deletion all tightened.",
    ],
  },
  {
    version: "0.21.1",
    date: "2026-07-13",
    title: "The Hangar counts everything now",
    notes: [
      "🛖 The Hangar's collection counter now includes ALL the cosmetics — auras, flap effects, pillar styles & colours, and every sound — not just shapes, skies and colours. Your total grew, so your percentage may look lower: nothing was taken away, there's just more to earn.",
      "🧭 The death-screen “next unlock” tip can now point at those too.",
      "🧹 Under the hood: a big spring-clean — dead code removed, docs corrected, and a pile of copy-pasted internals unified. Nothing about the game itself changed.",
    ],
  },
  {
    version: "0.21.0",
    date: "2026-07-05",
    title: "Fair climb: reachable levels & rewards that match the effort",
    notes: [
      "⚡ Leveling no longer walls out — past about level 17 each level is a steady ~20–30 games, so the top tiers (and the wildcard colours past level 40) are actually reachable now. Your level probably just jumped up.",
      "🎨 Rewards finally match effort: the hardest feats now give the rarest, best-looking colours. Fixed a pile of backwards unlocks — a 3-day-streak colour used to out-rank a 60-day one, and winning 5 challenges gave a plain grey. Score 200/500, the ranked ladder and the big milestones all got a glow-up.",
      "🪶 New goal — Featherweight: coast without a single flap and earn it.",
      "🏆 New goal — Triple Crown: set 3 new personal bests in one day.",
      "⛈️ New Storm Chaser badge for scoring on the rare “extreme” daily — the hardest day of the week finally pays out.",
      "🗂️ The origami fleet (swan, dove, eagle, butterfly…) now has real unlock goals instead of being free from the start.",
      "🎨 Wildcard milestone colours now arrive every 5 levels past 40, keeping the level-40 pick special.",
      "🔧 Under the hood: tighter security, no more hung death screens on a bad connection, safer offline runs, and a big repo + naming cleanup.",
    ],
  },
  {
    version: "0.20.0",
    date: "2026-06-15",
    title: "Paper everywhere, World Cup & device sync",
    notes: [
      "📄 The whole app now wears the paper look: main menu, pause, daily, settings and account are folded-paper cards in the hand-drawn font.",
      "⚽ World Cup event is live — just play (any mode) to earn the kit: match ball, team palettes, an away kit, crowd-chant chime, confetti flap and trophy posts. Show up on the final day for the golden boot.",
      "🎨 Gallery colours fixed: every shape now previews its OWN colour (origami included), not the one you've got equipped.",
      "💌 The love letter is now a two-colour sprite, and the new origami planes sit truer to their hitbox. New “Show hitbox” option in Settings.",
      "📱 Link devices without an email: generate a code on one device, enter it on another to carry your profile across.",
      "🙌 Supporter badge can now be granted by a code.",
      "👋 New flyers get quick in-game tips on their very first run, whatever mode they start in.",
      "🎨 Milestones now let you PICK 1 of 3 colours (levels, a big goal, the World Cup finale) — choose wisely, the other two lock for good.",
      "⏸️ Your unfinished casual run is now protected: jump to daily or ranked and the game checks before you lose it.",
      "🔒 Locked items in the gallery (shapes, colours, backgrounds) are clearly greyed out now.",
      "🎯 Three new goals from level 5: crash a pillar, fly off the top, sink to the bottom — each grants a colour.",
    ],
  },
  {
    version: "0.19.0",
    date: "2026-06-11",
    title: "Pilot levels, paper crumple & a pile of secrets",
    notes: [
      "✈️ Pilot levels: every run earns XP — watch the bar fill on the new death screen. Every 5 levels mints you a fresh colour skin.",
      "📜 New death screen: a proper card in YOUR colours, with “2 away from your best”, your XP bar, and what unlocks next.",
      "💥 The plane now crumples like paper and flutters down where you crashed (and the rumble fires the instant you tap).",
      "🏆 Every goal now grants a real reward — no more “TBA”. Plus dozens of new goals… and a lot of hidden secrets. Numbers are your friends.",
      "🥇 Daily champions: yesterday's top 3 daily flyers each get a minted skin overnight.",
      "🔊 Sounds on by default for new players, two new tap sounds, two new gate chimes, and you can pick your crash sound in the gallery.",
      "🗂 Gallery: shapes are grouped (paper fleet vs… contraband), goals show starter paths first.",
      "💬 Send feedback straight from Settings — there's a little something in it for you.",
      "🔧 Under the hood: share links work for installed apps, daily-twist challenges replay with the right physics, ranked shows win/loss and can't be wedged anymore, and cheating got much, much harder.",
    ],
  },
  {
    version: "0.18.0",
    date: "2026-06-07",
    title: "One-tap gallery & readable unlocks",
    notes: [
      "Gallery redesigned: one row of boxes — shape, colours, effects, world, pillar, goals, badges — each a live mini of what you're flying with. Tap to jump.",
      "Unlocks now show as full-screen cards you click through one by one — skins and achievements alike, no more blink-and-miss toasts.",
      "Louder gate-pass and crash sounds.",
      "Fixed the share button silently doing nothing on desktop.",
      "Friendlier first run: short coach tips appear as you play.",
    ],
  },
  {
    version: "0.17.0",
    date: "2026-06-03",
    title: "Secrets & a tidier gallery",
    notes: [
      "Obscure unlocks (time-of-day, friend counts…) are now hidden 🔒 secrets to discover.",
      "Gallery decluttered: “what’s next” collapses, group subtitles removed, count moved to the title.",
    ],
  },
  {
    version: "0.16.0",
    date: "2026-06-03",
    title: "Pillar colours & clearer goals",
    notes: [
      "New pillar colour picker — recolour your pillars (candy red/white, Germany, mint…) or keep the theme's.",
      "“What’s next” now shows where to find each unlock and your progress (e.g. 6/7).",
      "Achievements & goals are now one “Goals” surface.",
    ],
  },
  {
    version: "0.15.0",
    date: "2026-06-02",
    title: "Tiers & what's next",
    notes: [
      "Every cosmetic now shows a Bronze / Silver / Gold / Legendary tier.",
      "The gallery sorts what you can equip to the top, then easiest-to-hardest.",
      "New “what’s next” strip points you at your 3 nearest unlocks.",
    ],
  },
  {
    version: "0.14.0",
    date: "2026-06-02",
    title: "The Ascent (legendary)",
    notes: [
      "New legendary interactive backdrop: the world zooms out as your score climbs — street, city, mountains, the planet, all the way to the galaxy.",
      "Unlocks at a 100-point run.",
    ],
  },
  {
    version: "0.13.1",
    date: "2026-06-02",
    title: "Pillars v2",
    notes: [
      "Pillars got an HD glow-up — the default pillar is now a rounded, shaded tube instead of a flat slab.",
      "New pillar styles: bamboo, brick, candy cane and (see-through) ice.",
    ],
  },
  {
    version: "0.13.0",
    date: "2026-06-02",
    title: "Race their best",
    notes: [
      "Open any player's profile and tap “race their best” to fly the same seed against a ghost of their best run.",
      "A local race — head-to-head result at the end, nothing submitted.",
    ],
  },
  {
    version: "0.12.3",
    date: "2026-06-02",
    title: "World-gen back to basics",
    notes: [
      "Gap tightness is again fully determined by score — same score, same difficulty, so it's learnable.",
      "Gap position is fully random again (no more drifting near the last gap) — more varied and less predictable.",
    ],
  },
  {
    version: "0.12.2",
    date: "2026-06-02",
    title: "Match-day polish",
    notes: [
      "Football redrawn as the classic 1960s black-and-white panel ball (no more smiley).",
      "New stadium pillar style — goal-net mesh (score 40 to unlock).",
    ],
  },
  {
    version: "0.12.1",
    date: "2026-06-02",
    title: "Stadium glow-up",
    notes: [
      "Stadium theme now uses full-art backdrop — stands sweeping down to the pitch, floodlights and confetti.",
      "Football now smiles and is roughly half black / half white.",
    ],
  },
  {
    version: "0.12.0",
    date: "2026-06-02",
    title: "Match day",
    notes: [
      "New ⚽ football shape (score 20) and 🥨 pretzel shape (play 30 games).",
      "New stadium theme — green pitch, packed stands and floodlights. The crowd cheers every 20 points!",
      "New Germany colour palette (play 20 games).",
    ],
  },
  {
    version: "0.11.0",
    date: "2026-06-02",
    title: "Welcome aboard",
    notes: [
      "New players get a quick how-to-play walkthrough, ending in a no-stakes practice run.",
      "Replay it any time from the menu → How to play.",
    ],
  },
  {
    version: "0.10.0",
    date: "2026-06-02",
    title: "Cleaner leaderboard",
    notes: [
      "Leaderboard filters are now full-width, three tidy rows: who · when · how.",
      "New 'ranked' filter — see the ranked boards on their own, and 'all' now counts ranked too.",
    ],
  },
  {
    version: "0.9.0",
    date: "2026-06-02",
    title: "Lifetime miles",
    notes: [
      "Six new milestones for total points scored across all your runs — 500 all the way to 100,000.",
      "Fixed the disc that appeared behind some legendary planes; the glow now only shows underwater, where it reads as a diver's light.",
    ],
  },
  {
    version: "0.8.0",
    date: "2026-06-02",
    title: "Goals, colors & a history book",
    notes: [
      "Quests folded into one place: everything to chase now lives under the Goals tab.",
      "Instant rewards for your 2nd and 3rd games — a warm welcome for newcomers.",
      "Tint your flap effect — pick from 16 colors in the gallery's effects tab.",
      "Patch notes never expire: read the full history any time from Settings → What's new.",
    ],
  },
  {
    version: "0.7.0",
    date: "2026-06-02",
    title: "Rewards that pop",
    notes: [
      "Unlocking anything now shows a little celebration — not just color skins.",
      "New submarine shape (play 60 games).",
      "Fairer pillars: no more brutal top-bottom-top zigzags every gate.",
    ],
  },
  {
    version: "0.6.0",
    date: "2026-06-02",
    title: "Living worlds",
    notes: [
      "Interactive backgrounds: in Ocean & Space the scene changes as you climb — every 25 points you descend deeper / soar higher, with a label and the sky shifting. Look for the 'interactive' tag in the gallery.",
      "Butterfly now banks into its flight; ocean light shafts glow warm.",
      "Casual runs feel fresher — gap tightness varies run to run.",
      "Cleaner buttons, grouped Settings, and a tidier Account page.",
    ],
  },
  {
    version: "0.5.0",
    date: "2026-06-01",
    title: "New worlds",
    notes: [
      "Two new themes: dive into the Ocean (with bubbles) or fly through Space (starfield).",
      "Set challenge-ghost transparency in Settings — turn it down or fully off.",
      "Settings tidy-up: menu look + feedback now live in Settings.",
    ],
  },
  {
    version: "0.4.0",
    date: "2026-06-01",
    title: "Practice & weather",
    notes: [
      "New origami crane shape (5-day streak) — another tintable sprite.",
      "Practice mode now has infinite lives — fly forever, nothing can end your run but you.",
      "Two new daily challenges: thick fog and blinding sun, the toughest weather yet.",
      "Send feedback right from the menu.",
    ],
  },
  {
    version: "0.3.0",
    date: "2026-06-01",
    title: "Style update",
    notes: [
      "Pick your pillar style — solid, stone, neon, or glass. Glass is see-through (and a harder daily!).",
      "Legendary skins now glow.",
      "Friend requests: add someone and they accept — no more instant friends.",
      "Patch notes (you're reading them) so you never miss what's new.",
    ],
  },
  {
    version: "0.2.0",
    date: "2026-06-01",
    title: "Flock update",
    notes: [
      "New origami toucan shape (score 40 to unlock) — a real sprite that tints to your color.",
      "Goals: a big new list of things to chase in the gallery's quests tab.",
      "Friend duels now flex the sender's shape + sky; challenge a friend to ranked too.",
      "Daily best-of-3, visual daily weather (night / sunset / blinding sun / rain).",
      "Public profiles, season badges, a 3-way leaderboard, and a practice mode.",
      "Support the game with a tip — thank you! ☕",
    ],
  },
];

const SEEN_KEY = "pflug.changelogSeen.v1";

/** Compare dotted semver-ish strings ("0.2.0"). Returns a>b ? 1 : a<b ? -1 : 0. */
function cmpVersion(a: string, b: string): number {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d > 0 ? 1 : -1;
  }
  return 0;
}

function lastSeenVersion(): string | null {
  try {
    return localStorage.getItem(SEEN_KEY);
  } catch {
    return null;
  }
}

export function markChangelogSeen(): void {
  try {
    localStorage.setItem(SEEN_KEY, APP_VERSION);
  } catch {
    /* localStorage blocked — show again next time, harmless */
  }
}

/**
 * Entries newer than what the player last saw. Empty when up to date OR on a
 * player's very first run (we don't ambush newcomers with a changelog —
 * mark-seen at first launch instead, handled by the caller).
 */
export function unseenChanges(): ChangeEntry[] {
  const seen = lastSeenVersion();
  if (seen === null) return []; // first run — nothing to "update" about
  return CHANGELOG.filter((e) => cmpVersion(e.version, seen) > 0);
}

export function isFirstRun(): boolean {
  return lastSeenVersion() === null;
}
