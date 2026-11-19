// Generates crisp, dependency-free PNG app icons for the PWA manifest.
// Run with: node scripts/generate-icons.mjs
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c >>> 0;
}

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeAndData = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([length, typeAndData, crc]);
}

// Foreground geometry in normalized [0,1] space.
const LEAF = [1, -1].map((side) => {
  const angle = -side * 0.61;
  return {
    cx: 0.5 + side * 0.052,
    cy: 0.195,
    ca: Math.cos(angle),
    sa: Math.sin(angle),
    a: 0.075,
    b: 0.03,
  };
});

function foreground(nx, ny) {
  // Egg: tapered toward the top so the sprout emerges from the point.
  const u = (nx - 0.5) / 0.19;
  const v = (ny - 0.56) / 0.25;
  if (u * u + v * v * (1 - 0.2 * v) <= 1) return 0;

  // Sprout stem rising out of the egg.
  if (Math.abs(nx - 0.5) <= 0.013 && ny >= 0.15 && ny <= 0.36) return 1;

  // Two leaves angled outward from the stem.
  for (const leaf of LEAF) {
    const dx = nx - leaf.cx;
    const dy = ny - leaf.cy;
    const lx = dx * leaf.ca + dy * leaf.sa;
    const ly = -dx * leaf.sa + dy * leaf.ca;
    if ((lx / leaf.a) ** 2 + (ly / leaf.b) ** 2 <= 1) return 1;
  }
  return -1;
}

const SS = 3; // 3x3 supersampling for crisp anti-aliased edges

function makeIcon(size) {
  const raw = Buffer.alloc(size * (1 + size * 4));
  for (let y = 0; y < size; y++) {
    const rowStart = y * (1 + size * 4);
    raw[rowStart] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      let eggHits = 0;
      let sproutHits = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = (x + (sx + 0.5) / SS) / size;
          const py = (y + (sy + 0.5) / SS) / size;
          const hit = foreground(px, py);
          if (hit === 0) eggHits++;
          else if (hit === 1) sproutHits++;
        }
      }

      const shade = y / size;
      // Emerald background (#047857) with a subtle vertical gradient.
      let r = Math.round(4 + 2 * shade);
      let g = Math.round(120 - 25 * shade);
      let b = Math.round(87 - 17 * shade);

      const eggAlpha = eggHits / (SS * SS);
      if (eggAlpha > 0) {
        r = Math.round(r + (255 - r) * eggAlpha);
        g = Math.round(g + (255 - g) * eggAlpha);
        b = Math.round(b + (255 - b) * eggAlpha);
      }

      const sproutAlpha = sproutHits / (SS * SS);
      if (sproutAlpha > 0) {
        // Light mint (#D1FAE5) sprout reads clearly on emerald and on the egg.
        r = Math.round(r + (209 - r) * sproutAlpha);
        g = Math.round(g + (250 - g) * sproutAlpha);
        b = Math.round(b + (229 - b) * sproutAlpha);
      }

      const offset = rowStart + 1 + x * 4;
      raw[offset] = r;
      raw[offset + 1] = g;
      raw[offset + 2] = b;
      raw[offset + 3] = 255;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const outDir = join(process.cwd(), "public");
mkdirSync(outDir, { recursive: true });

for (const size of [192, 512]) {
  writeFileSync(join(outDir, `icon-${size}.png`), makeIcon(size));
}

console.log("Generated public/icon-192.png and public/icon-512.png");
