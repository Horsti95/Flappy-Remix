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
};

interface Entry {
  img: HTMLImageElement;
  loaded: boolean;
}

const images = new Map<string, Entry>();

export function preloadBackgrounds(): void {
  if (typeof Image === "undefined") return; // SSR / test guard
  for (const [id, src] of Object.entries(sources)) {
    if (images.has(id)) continue;
    const img = new Image();
    const entry: Entry = { img, loaded: false };
    img.onload = () => {
      entry.loaded = true;
    };
    img.src = src;
    images.set(id, entry);
  }
}

export function hasBackgroundImage(id: string): boolean {
  return id in sources;
}

/** The loaded image element, or null if not (yet) available. */
export function getBackgroundImage(id: string): HTMLImageElement | null {
  const e = images.get(id);
  return e && e.loaded ? e.img : null;
}
