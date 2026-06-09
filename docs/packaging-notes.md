# Packaging & Store Notes

Living checklist for turning Pflug (web PWA) into a shippable native app
(Apple App Store / Google Play). This is a **notes file** — decisions and
constraints to remember, not code. Update it as things land.

---

## 1. Identity & trademark (avoid the "Flappy clone" rejection)

Apple and Google reject lazy reskins of Flappy Bird. We already differentiate
deliberately — keep it that way:

- **The character is a paper plane, not a bird.** Chosen on purpose to be
  visually distinct. Do not switch to a bird sprite.
- **The store name must NOT be "Flappy…".** The repo is `flappy-remix`, but the
  *published* title must be our own brand (working title "Pflug"; pick the final
  name from the README brand options). The git/repo name is irrelevant to the
  store — the listing title, icon, and screenshots are what reviewers judge.
- **Icon + screenshots must be original** — no green pipes-and-bird pastiche.
  Lean into the paper-plane + clean arcade look.
- Our depth (daily seeds, ranked ELO, challenges, ghosts, cosmetics) is the best
  anti-clone signal: it's clearly an original game, not a 1-screen ripoff.
- Before submitting: a quick trademark sanity check on the final name
  (no "Flappy", no other game's mark).

## 2. Buy Me a Coffee — supporter tiers (PLAN OF RECORD — do not change copy)

These tiers are the agreed monetization plan. Recorded verbatim so they don't
drift. **Do not edit the wording** without an explicit decision.

> **Glider — €3/month**
> Exclusive Member Badge next to your name on the social feed/leaderboard.
> Support me on a monthly basis.
>
> **High Flyer — €5/month**
> Everything above and: Unlock the Exclusive Supporter Skin.
>
> **Orbiter — €13/month**
> Everything above and:
> - The Orbital Strike: Direct in-game friend slot with hossi95
> - Name featured in the game's "Special Thanks" credits menu
> - Vote on the next cosmetic or social feature

### How to ship these WITHOUT breaking store rules

The badge / skin / friend slot are **digital in-app benefits**. Apple (rule
3.1.1) and Google both require their own billing for digital goods bought and
consumed inside the app — and Apple forbids even *linking* to an external
purchase for them from inside iOS. So:

- **Do NOT sell these via BMC from inside the iOS app.** No "subscribe on BMC"
  button, no link to the paid tiers on the iOS surface.
- **Deliver perks via the existing redeem-code system** (`api/redeem-code.ts` +
  `skin_codes` table). Flow: supporter pays on BMC **on the website** → we send
  a redeem code → they enter it in the in-app account panel → skin/badge
  granted. We're *granting* an externally-earned perk, not selling in-app —
  this is the safe, accepted pattern.
- **Make supporter perks permanent thank-you grants**, not subscription-gated
  cosmetics. Avoids having to revoke a skin when someone cancels. Once a
  supporter, keep the cosmetic.
- The "Member Badge" needs a small badge/title system (not built yet — see §4).
- The Orbiter perks (friend slot, Special Thanks credits, feature vote) are
  community/service perks handled off-app — fine to run via BMC.

### Safe in-app "Support" link (the question we keep hitting)

We want a support entry in the app. Safe approach:

- **iOS:** omit any BMC / donate / "support us" link entirely. Surface support
  only on the website.
- **Android:** Google is somewhat more permissive post-DMA, but selling digital
  goods via BMC still risks Play policy. Safest: an in-app link that goes to our
  **website** (not a direct BMC checkout), where the BMC button lives. A pure
  "tip the dev, no digital good attached" link is the most defensible; anything
  that unlocks an in-app cosmetic must go through the redeem-code grant flow.
- Implementation hint: gate the link behind a build-time platform flag so it
  renders on web/Android and is hidden on iOS.

## 3. Apple / Google requirements

**Already done ✅**
- **In-app account deletion** — `api/me-delete.ts` + account panel
  ("delete me forever"). Required by Apple once you have account creation.
- **Data export** — `api/me-export.ts` (GDPR portability).
- **No trackers / no ads in v1** — clean privacy story (see `PRIVACY.md`).

**Pending / required before/at submission ⏳**
- **Sign in with Apple** — mandatory on iOS *if* we offer any other social login
  (Google/Discord). Only needed for the iOS build; web/Android can ship
  Google+Discord+email without it.
- **IAP via StoreKit / Play Billing** for any skins sold *inside* the app
  (the BMC path above sidesteps this for supporter perks).
- **Restore Purchases** button — required by Apple if/when we add IAP.
- **Consent layer for ads** (Google UMP/CMP + iOS App Tracking Transparency) —
  only when ads are added. UMP auto-serves non-personalized ads on decline.
  Not built yet (no ads today).
- **Native haptics bridge** — `navigator.vibrate` (used by the in-app Vibration
  setting) is a no-op on iOS Safari. Wrapped iOS build needs a Capacitor Haptics
  plugin driving the Taptic Engine. Web/Android work today.
- Store metadata: privacy "nutrition labels" / Play Data Safety form, age
  rating, screenshots, support + privacy-policy URLs. As a German dev, likely an
  **Impressum** too.

## 4. Not-yet-built systems referenced above
- **Badge / title system** for the supporter "Member Badge" and the
  feedback-reward badge. Today badges are only season top-100 + a hardcoded dev
  badge (`src/social/badges.ts`). The feedback reward currently ships as a
  *secret achievement* ("kinda game dev") that grants a skin — the achievement
  itself acts as the badge in the gallery for now.
