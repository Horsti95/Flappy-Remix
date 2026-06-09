# Auth provider setup

The client code for Google, Discord and email sign-in (plus anonymous→account
linking) is wired in `src/social/auth.ts` and surfaced in the account panel, but
it stays **dormant until you configure the providers**. None of it is testable
before these steps. Do them in the Supabase dashboard + each provider's console.

## 0. Required for progress to carry over: enable Manual Linking

Supabase → **Authentication → Sign In / Providers → (settings)** → enable
**Manual linking**. Without it, `linkIdentity()` fails and a first-time sign-in
falls back to creating a fresh account (anonymous skins/streak/scores are lost
on that device).

Also set **Authentication → URL Configuration**:
- **Site URL**: your production URL (e.g. `https://pflug.vercel.app`).
- **Redirect URLs**: add the production URL *and* `http://localhost:5173`
  (the client passes `redirectTo: window.location.origin`).

## 1. Google

1. Google Cloud Console → APIs & Services → **Credentials** → Create OAuth client
   ID (type: Web application).
2. Authorized redirect URI:
   `https://<your-project-ref>.supabase.co/auth/v1/callback`.
3. Copy the **Client ID + Client secret** into Supabase →
   Authentication → Providers → **Google** → enable + paste.
4. (Optional) Configure the OAuth consent screen + a privacy-policy URL to drop
   the "unverified app" warning for basic email/profile scopes.

## 2. Discord

1. https://discord.com/developers/applications → New Application → **OAuth2**.
2. Add redirect: `https://<your-project-ref>.supabase.co/auth/v1/callback`.
3. Copy **Client ID + Client secret** into Supabase → Providers → **Discord**.

## 3. Email (magic link / OTP)

1. Supabase → Providers → **Email** → enable. Magic-link / OTP works out of the
   box on the built-in mailer for low volume.
2. For real volume, set **Project Settings → Auth → SMTP** to your own sender
   (otherwise Supabase rate-limits the shared mailer).
3. Anonymous users are upgraded in place via `updateUser({ email })`; if the
   email is already taken the client falls back to an OTP sign-in.

## 4. Apple (later — iOS only requirement)

Not needed for web/Android. Required on iOS once Google/Discord ship there
(App Store rule 4.8). Needs the Apple Developer Program ($99/yr), a Services ID
+ signing key, then enable **Apple** in Supabase with the same callback URL.

## Notes / gotchas

- **Returning user on a new device**: their provider identity already exists, so
  linking is skipped and they sign in normally. If they had built up anonymous
  progress on the new device first, reconcile with
  `scripts/sql/merge-accounts.sql`. Nudge sign-in early to minimize this.
- **Native app redirects**: `redirectTo` uses `window.location.origin`, which is
  fine for web. A wrapped (Capacitor) build needs deep-link redirect handling
  (custom scheme / universal links) added at packaging time.
