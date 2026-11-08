// Canvas helpers that reproduce the original Amaze widget drawing (480x800 layout units).
// Resource IDs from INO configs resolve through data/resource_ids.json (scripts/extract_resource_ids.py)
// to textures decoded into assets/textures/restored/.

const TEXTURE_DIR = 'assets/textures/restored/';
let resourceTable;
const images = new Map();

export function loadResourceTable() {
  return resourceTable ||= fetch('data/resource_ids.json').then(response => {
    if (!response.ok) throw new Error(`Resource table: HTTP ${response.status}`);
    return response.json();
  });
}

function loadImage(src) {
  if (!images.has(src)) {
    images.set(src, new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`Texture ${src} failed to load`));
      image.src = src;
    }));
  }
  return images.get(src);
}

// Load bitmap resources by ID: {id: {image, width, height, frames, frame_height, tile...}}.
export async function loadResources(ids) {
  const table = await loadResourceTable();
  const result = {};
  await Promise.all(ids.map(async id => {
    const entry = table[String(id)];
    if (!entry?.file) throw new Error(`Unknown bitmap resource ${id}`);
    const image = await loadImage(TEXTURE_DIR + entry.file.replace(/\.(bmp|png)$/i, '.png'));
    result[id] = {...entry, image};
  }));
  return result;
}

export const numbers = value => String(value ?? '').trim().split(/\s+/).filter(Boolean).map(Number);
// INO rects are "x y w h"; the engine keeps them as left/top/right/bottom.
export function rect(value) { const [x, y, w, h] = numbers(value); return {x, y, w, h, r: x + w, b: y + h}; }
export function rgba(value, alpha = 255) {
  const [r = 0, g = 0, b = 0] = numbers(value);
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(255, alpha)) / 255})`;
}

export function drawFrame(ctx, res, frame, x, y, alpha = 1) {
  const h = res.frame_height || res.height;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.drawImage(res.image, 0, frame * h, res.width, h, x, y, res.width, h);
  ctx.restore();
}

// 3-slice tiled bitmap (FUN_4a0416fc / FUN_4a0430c4): fixed start and end, repeated middle.
// The drawn length is rounded up to whole middle repeats, like the original.
export function drawTiled(ctx, res, x, y, length) {
  const horizontal = res.tile !== 2;
  const size = horizontal ? res.width : res.frame_height || res.height;
  const thickness = horizontal ? res.frame_height || res.height : res.width;
  const from = res.tile_from ?? 0, to = res.tile_to ?? size, middle = Math.max(1, to - from);
  const piece = (src, len, at) => horizontal
    ? ctx.drawImage(res.image, src, 0, len, thickness, x + at, y, len, thickness)
    : ctx.drawImage(res.image, 0, src, thickness, len, x, y + at, thickness, len);
  piece(0, from, 0);
  let at = from;
  const endLength = size - to;
  while (at + endLength < length) { piece(from, middle, at); at += middle; }
  piece(to, endLength, at);
  return at + endLength;
}

function outline(ctx, l, t, r, b, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  if (b - t <= 1) { ctx.beginPath(); ctx.moveTo(l, t + 0.5); ctx.lineTo(r, t + 0.5); ctx.stroke(); return; }
  ctx.strokeRect(l + 0.5, t + 0.5, r - l - 1, b - t - 1);
}

// Generic "*_field_border" / "*_bottom_border" section (FUN_4a06c268).
export function drawBorderSection(ctx, cfg, res) {
  if (cfg.fill_rect && cfg.fill_color) {
    const f = rect(cfg.fill_rect);
    ctx.fillStyle = rgba(cfg.fill_color, numbers(cfg.fill_transparent ?? '255')[0]);
    ctx.fillRect(f.x, f.y, f.w, f.h);
  }
  if (cfg.tile_rect) {
    const t = rect(cfg.tile_rect);
    const left = res[cfg.left_tile], top = res[cfg.top_tile], right = res[cfg.right_tile], bottom = res[cfg.bott_tile];
    if (left) drawTiled(ctx, left, t.x, t.y, t.h);
    if (top) drawTiled(ctx, top, t.x, t.y, t.w);
    if (right) drawTiled(ctx, right, t.r - right.width, t.y, t.h);
    if (bottom) drawTiled(ctx, bottom, t.x, t.b - (bottom.frame_height || bottom.height), t.w);
  }
  for (let i = 1; i <= Number(cfg.fill_count || 0); i++) {
    const f = rect(cfg[`f${i}_rect`]);
    ctx.fillStyle = rgba(cfg[`f${i}_color`], numbers(cfg[`f${i}_transparent`] ?? '255')[0]);
    ctx.fillRect(f.x, f.y, f.w, f.h);
  }
  if (cfg.start_b_rect) {
    let {x: l, y: t, r, b} = rect(cfg.start_b_rect);
    for (let i = 1; i <= Number(cfg.borders_count || 0); i++) {
      const color = rgba(cfg[`b${i}_color`], numbers(cfg[`b${i}_transparent`] ?? '255')[0]);
      for (let k = 0; k < Number(cfg[`b${i}_thick`] || 1); k++) {
        outline(ctx, l, t, r, b, color);
        if (b - t > 1) { l--; t--; r++; b++; } else { t++; b++; }
      }
    }
  }
}

// Map a pointer event to layout units of a canvas drawn at its intrinsic size.
export function canvasPoint(canvas, event) {
  const box = canvas.getBoundingClientRect();
  return {x: (event.clientX - box.left) * canvas.width / box.width, y: (event.clientY - box.top) * canvas.height / box.height};
}
