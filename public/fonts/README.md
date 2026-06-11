# Self-hosted fonts

Drop font binaries here; they're served at `/fonts/<name>` and precached
by the PWA (offline-safe).

## Expected files

- `EmbolismSpark.ttf` — the handwritten display font ("Embolism Spark"
  from 1001fonts). The `.font-hand` class in `src/style.css` prefers it
  and falls back to system cursive stacks until the file exists, so the
  app builds and runs fine without it.

⚠ Rename the uploaded file from `Embolism Spark.ttf` to
`EmbolismSpark.ttf` (no space) — URLs with spaces invite encoding bugs.

Keep EULAs/licenses in `design/fonts/`, NOT here (don't ship legal text
to every client).
