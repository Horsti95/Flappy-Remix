/** Mechanical export of generated source art; generation prompts live in the manifest. */
import sharp from "sharp";
import { readFile, mkdir } from "node:fs/promises";
import { prep } from "./prep-sprite-2color.mjs";

const manifest = JSON.parse(await readFile(new URL("../design/paper-packs/sources.json", import.meta.url), "utf8"));
await mkdir("public/backgrounds", { recursive: true });
for (const asset of manifest) {
  if (asset.kind === "background") {
    const result = await sharp(asset.source).resize({ width: 1080, withoutEnlargement: true })
      .webp({ quality: 87 }).toFile(`public/backgrounds/${asset.id}.webp`);
    console.log(`${asset.id}: ${result.size} bytes`);
  } else {
    const result = await prep(asset.source, "public/sprites", asset.id, { preserveAlpha: true });
    if (!result.twoLayer) throw new Error(`${asset.id} needs a distinct accent layer`);
  }
}
