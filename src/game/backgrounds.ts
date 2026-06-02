/**
 * Background image pipeline.
 *
 * Themes are normally painted with canvas gradients/shapes. A theme may also
 * declare a `backgroundImage` id; when its art is loaded the renderer paints
 * the image (cover-fit, centered) behind the world instead of the gradient.
 * The uploaded art keeps a clear vertical lane in the center, matching our
 * "background is static, pillars scroll" model.
 *
 * Cosmetic only — the sim never reads any of this, so determinism is intact.
 */

const sources: Record<string, string> = {
  "neo-city": "/backgrounds/neo-city.png",
  "fairy-spires": "/backgrounds/fairy-spires.png",
  "stadium": "/backgrounds/stadium.png",
  // Interactive "ascent" set — the backdrop zooms out with your score.
  // Lazy-loaded (not preloaded) so a player only downloads the stages they
  // actually reach.
  "ascent-street": "/backgrounds/ascent-street.webp",
  "ascent-suburb": "/backgrounds/ascent-suburb.webp",
  "ascent-city": "/backgrounds/ascent-city.webp",
  "ascent-countryside": "/backgrounds/ascent-countryside.webp",
  "ascent-mountains": "/backgrounds/ascent-mountains.webp",
  "ascent-world": "/backgrounds/ascent-world.webp",
  "ascent-solar": "/backgrounds/ascent-solar.webp",
  "ascent-milkyway": "/backgrounds/ascent-milkyway.webp",
  "ascent-galaxy": "/backgrounds/ascent-galaxy.webp",
};

interface Entry {
  img: HTMLImageElement;
  loaded: boolean;
}

const images = new Map<string, Entry>();

function load(id: string): Entry | null {
  let e = images.get(id);
  if (e) return e;
  const src = sources[id];
  if (!src || typeof Image === "undefined") return null;
  const img = new Image();
  e = { img, loaded: false };
  img.onload = () => {
    e!.loaded = true;
  };
  img.src = src;
  images.set(id, e);
  return e;
}

export function preloadBackgrounds(): void {
  if (typeof Image === "undefined") return; // SSR / test guard
  // Eager-load only the always-static backdrops. The ascent stages are
  // lazy-loaded on demand (see getBackgroundImage) to save bandwidth.
  for (const id of Object.keys(sources)) {
    if (id.startsWith("ascent-")) continue;
    load(id);
  }
}

export function hasBackgroundImage(id: string): boolean {
  return id in sources;
}

/** The loaded image element, or null if not (yet) available. Lazily kicks off
 *  the download the first time an id is requested. */
export function getBackgroundImage(id: string): HTMLImageElement | null {
  const e = load(id);
  return e && e.loaded ? e.img : null;
}
