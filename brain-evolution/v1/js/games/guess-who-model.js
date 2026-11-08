// Guess Who (CAntHead_GameField) — exact port of the original round generator (see re/README.md):
//   createObject   FUN_4a07eecc   4 antennas (L,T,R,B), shape, texture, colour and a packed code
//   makeQuestion   FUN_4a080230   features from gen_var digits (1 antennas, 2 shape, 3 texture, 4 colour)
//   createRound    FUN_4a080c64   target + distractors that never satisfy the question, retried until
//                                 enough distractors share each asked feature (qa_gen_var)
export const COUNTS = {antennas: 7, shapes: 5, textures: 4, colors: 5};

const rnd = (rand, n) => n > 0 ? (rand() % 0x7fff) % n : 0;

// Packed like the original: colour+1 | (texture+1)<<4 | (shape+1)<<8 | antennaTypeMask<<16.
export function code(o) {
  const mask = o.antennas.reduce((m, t) => m | (1 << t), 0);
  return ((o.color + 1) & 0xf) | (((o.texture + 1) << 4) & 0xff) | (((o.shape + 1) & 0xf) << 8) | (mask << 16);
}

export function createPools(counts = COUNTS) {
  const range = n => Array.from({length: n}, (_, i) => i);
  return {color: range(counts.colors), shape: range(counts.shapes), texture: range(counts.textures), picked: {}};
}

// Target attributes come from pools so consecutive rounds avoid repeating them (FUN_4a08090c).
export function consumePools(pools, counts = COUNTS) {
  const total = {color: counts.colors, shape: counts.shapes, texture: counts.textures};
  for (const key of ['color', 'shape', 'texture']) {
    const index = pools.picked[key];
    if (index === undefined) continue;
    pools[key].splice(index, 1);
    if (!pools[key].length) pools[key] = Array.from({length: total[key]}, (_, i) => i);
  }
  pools.picked = {};
}

export function createObject(rand, question = 0, pools = null, counts = COUNTS) {
  for (let tries = 100; ; ) {
    const antennas = [0, 1, 2, 3].map(() => rnd(rand, counts.antennas));
    let shape, texture, color;
    if (pools) {
      pools.picked.shape = rnd(rand, pools.shape.length); shape = pools.shape[pools.picked.shape];
      pools.picked.texture = rnd(rand, pools.texture.length); texture = pools.texture[pools.picked.texture];
      pools.picked.color = rnd(rand, pools.color.length); color = pools.color[pools.picked.color];
    } else {
      shape = rnd(rand, counts.shapes); texture = rnd(rand, counts.textures); color = rnd(rand, counts.colors);
    }
    const object = {antennas, shape, texture, color};
    object.code = code(object);
    if (!question) return object;
    // A distractor must not contain every bit of the question (the original compares packed codes).
    if ((object.code & question) !== question) return object;
    if (--tries <= 0) return null;
  }
}

export function makeQuestion(target, features, maxFeatures, rand) {
  const parts = [0, 0, 0, 0]; // antennas mask, shape+1, texture+1, colour+1
  let digits = features || 1234, used = 0;
  for (let i = 0; i < 4; i++, digits = Math.trunc(digits / 10)) {
    const d = digits % 10;
    if (d === 1) parts[0] = target.code >>> 16;
    else if (d === 2) parts[1] = target.shape + 1;
    else if (d === 3) parts[2] = target.texture + 1;
    else if (d === 4) parts[3] = target.color + 1;
    else continue;
    used++;
  }
  for (; maxFeatures < used; maxFeatures++) {
    let slot;
    for (let tries = 100; tries > 0; tries--) { slot = Math.min(3, rnd(rand, 4)); if (parts[slot]) break; }
    parts[slot] = 0;
  }
  if (parts[0]) {
    const types = [];
    for (let t = 0; t < 16; t++) if (parts[0] & (1 << t)) types.push(t);
    parts[0] = 1 << types[Math.min(types.length - 1, rnd(rand, types.length))];
  }
  return (parts[3] & 0xf) | ((parts[2] & 0xf) << 4) | ((parts[1] & 0xf) << 8) | (parts[0] << 16);
}

export function decodeQuestion(q) {
  const mask = q >>> 16, shape = ((q >> 8) & 0xf) - 1, texture = ((q >> 4) & 0xf) - 1, color = (q & 0xf) - 1;
  return {antenna: mask ? Math.log2(mask & -mask) : -1, shape, texture, color};
}

// True when the object has every asked feature (the unique answer).
export function satisfies(object, q) {
  const d = decodeQuestion(q);
  return (d.antenna < 0 || object.antennas.includes(d.antenna)) && (d.shape < 0 || object.shape === d.shape)
    && (d.texture < 0 || object.texture === d.texture) && (d.color < 0 || object.color === d.color);
}

// genVar: [features, maxFeatures, objectCount, rounds]; qa: minimum distractors sharing [antenna, shape, texture, colour].
export function createRound(genVar, qa, pools, rand) {
  let best;
  for (let attempt = 0; attempt < 500; attempt++) {
    const target = createObject(rand, 0, pools);
    const question = makeQuestion(target, genVar[0], genVar[1], rand);
    const d = decodeQuestion(question);
    const shared = [d.antenna < 0 ? 1000 : 0, d.shape < 0 ? 1000 : 0, d.texture < 0 ? 1000 : 0, d.color < 0 ? 1000 : 0];
    const objects = [target];
    for (let i = 1; i < genVar[2]; i++) {
      const o = createObject(rand, question);
      if (!o) continue;
      if (((o.code >>> 16) & (question >>> 16)) !== 0) shared[0]++;
      if (o.shape === d.shape) shared[1]++;
      if (o.texture === d.texture) shared[2]++;
      if (o.color === d.color) shared[3]++;
      objects.push(o);
    }
    best = {objects, target, question};
    if (shared.every((n, i) => n >= qa[i])) break;
  }
  consumePools(pools);
  return best;
}

// Random centres keeping a minimum distance (FUN_4a080c64 placement), grid fallback if crowded.
export function place(count, width, height, radius, rand) {
  const min = (radius + Math.trunc(radius / 20) || radius + 1) * 2;
  for (let attempt = 0; attempt < 200; attempt++) {
    const points = [];
    for (let i = 0; i < count; i++) {
      let p, ok = false;
      for (let t = 0; t < 200 && !ok; t++) {
        p = {x: radius + rnd(rand, width - radius * 2), y: radius + rnd(rand, height - radius * 2)};
        ok = points.every(q => (q.x - p.x) ** 2 + (q.y - p.y) ** 2 >= min * min);
      }
      if (!ok) break;
      points.push(p);
    }
    if (points.length === count) return points;
  }
  const cols = Math.ceil(Math.sqrt(count)), rows = Math.ceil(count / cols);
  return Array.from({length: count}, (_, i) => ({x: (i % cols + 0.5) * width / cols, y: (Math.floor(i / cols) + 0.5) * height / rows}));
}
