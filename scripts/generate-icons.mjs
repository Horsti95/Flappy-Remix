import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const OUT = path.resolve("public/icons");
await mkdir(OUT, { recursive: true });

const sky = "#87ceeb";
const paper = "#f4ead5";
const ink = "#1a1a1a";

function paperPlane(size, pad) {
  const inner = size - pad * 2;
  const planeSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <rect width="${size}" height="${size}" fill="${sky}"/>
      <g transform="translate(${pad},${pad})">
        <polygon
          points="${inner * 0.1},${inner * 0.7} ${inner * 0.95},${inner * 0.2} ${inner * 0.55},${inner * 0.5} ${inner * 0.95},${inner * 0.2} ${inner * 0.55},${inner * 0.85}"
          fill="${paper}" stroke="${ink}" stroke-width="${size / 40}" stroke-linejoin="round"/>
      </g>
    </svg>`;
  return Buffer.from(planeSvg);
}

async function emit(name, size, pad) {
  await sharp(paperPlane(size, pad)).png().toFile(path.join(OUT, name));
  console.log("wrote", name);
}

await emit("icon-192.png", 192, 16);
await emit("icon-512.png", 512, 40);
await emit("icon-maskable-512.png", 512, 96);
await emit("apple-touch-icon.png", 180, 12);
await emit("og-default.png", 1200, 200);
