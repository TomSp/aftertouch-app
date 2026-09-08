import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import zlib from 'node:zlib';

const COLORS = {
  background: [17, 17, 17, 255],
  inactive: [238, 238, 238, 255],
  blue: [0, 85, 170, 255],
  yellow: [255, 204, 0, 255]
};

const SPRITE = {
  canvas: 1024,
  scale: 32
};

const ASSETS = [
  { output: 'assets/icon.png', transparent: false, splash: false },
  { output: 'assets/adaptive-icon.png', transparent: true, splash: false },
  { output: 'assets/splash.png', transparent: true, splash: true }
];

const svgPath = resolve('assets/logo.svg');
await mkdir('assets', { recursive: true });
await readFile(svgPath, 'utf8');

for (const asset of ASSETS) {
  const png = createPng(SPRITE.canvas, SPRITE.canvas, (x, y) => {
    if (!asset.transparent) {
      return COLORS.background;
    }
    return [0, 0, 0, 0];
  });

  const scale = asset.splash ? 24 : 32;
  const offset = Math.floor((SPRITE.canvas - 32 * scale) / 2);
  drawLogo(png.pixels, png.width, png.height, offset, offset, scale);
  await writeFile(resolve(asset.output), encodePng(png.width, png.height, png.pixels));
}

function drawLogo(pixels, width, height, offsetX, offsetY, scale) {
  drawCircle(pixels, width, height, offsetX + 10 * scale, offsetY + 8 * scale, 3 * scale, COLORS.inactive);
  drawCircle(pixels, width, height, offsetX + 10 * scale, offsetY + 16 * scale, 3 * scale, COLORS.blue);
  drawCircle(pixels, width, height, offsetX + 10 * scale, offsetY + 24 * scale, 3 * scale, COLORS.blue);
  drawCircle(pixels, width, height, offsetX + 22 * scale, offsetY + 8 * scale, 3 * scale, COLORS.blue);
  drawCircle(pixels, width, height, offsetX + 22 * scale, offsetY + 16 * scale, 3 * scale, COLORS.yellow);
  drawCircle(pixels, width, height, offsetX + 22 * scale, offsetY + 24 * scale, 3 * scale, COLORS.inactive);
}

function createPng(width, height, fill) {
  const pixels = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [r, g, b, a] = fill(x, y);
      const i = (y * width + x) * 4;
      pixels[i] = r;
      pixels[i + 1] = g;
      pixels[i + 2] = b;
      pixels[i + 3] = a;
    }
  }
  return { width, height, pixels };
}

function drawCircle(pixels, width, height, cx, cy, radius, color) {
  const [r, g, b, a] = color;
  const minX = Math.max(0, Math.floor(cx - radius));
  const maxX = Math.min(width - 1, Math.ceil(cx + radius));
  const minY = Math.max(0, Math.floor(cy - radius));
  const maxY = Math.min(height - 1, Math.ceil(cy + radius));
  const radiusSq = radius * radius;

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      if (dx * dx + dy * dy <= radiusSq) {
        const i = (y * width + x) * 4;
        pixels[i] = r;
        pixels[i + 1] = g;
        pixels[i + 2] = b;
        pixels[i + 3] = a;
      }
    }
  }
}

function encodePng(width, height, rgbaPixels) {
  const rowSize = width * 4 + 1;
  const raw = Buffer.alloc(rowSize * height);

  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * rowSize;
    raw[rowOffset] = 0;
    rgbaPixels.copy(raw, rowOffset + 1, y * width * 4, (y + 1) * width * 4);
  }

  const compressed = zlib.deflateSync(raw);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    makeChunk('IHDR', buildIhdr(width, height)),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0))
  ]);
}

function buildIhdr(width, height) {
  const buf = Buffer.alloc(13);
  buf.writeUInt32BE(width, 0);
  buf.writeUInt32BE(height, 4);
  buf[8] = 8;
  buf[9] = 6;
  buf[10] = 0;
  buf[11] = 0;
  buf[12] = 0;
  return buf;
}

function makeChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lengthBuf = Buffer.alloc(4);
  lengthBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lengthBuf, typeBuf, data, crcBuf]);
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
