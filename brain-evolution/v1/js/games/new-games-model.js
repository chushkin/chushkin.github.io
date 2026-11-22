// Logic of the five games made for the web (PLAN 5), without any drawing: tested in
// scripts/test-restoration.mjs. rand() returns a number in [0, 1); seeded() gives a repeatable one.

export function seeded(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (n, rand) => Math.floor(rand() * n);
export function shuffled(values, rand = Math.random) {
  const out = [...values];
  for (let i = out.length - 1; i > 0; i--) { const j = pick(i + 1, rand); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}

// ---- Colour and Word (Stroop) ----------------------------------------------------------------
// The words are translated colour names; the ink is one of the same colours.
export const STROOP_COLORS = [
  {key: 'Red', rgb: '#e53935'}, {key: 'Blue', rgb: '#1e63d6'}, {key: 'Green', rgb: '#2e9d3a'},
  {key: 'Yellow', rgb: '#e6b800'}, {key: 'Purple', rgb: '#8e3fc4'}, {key: 'Orange', rgb: '#f57c00'},
];
// One round: the word and the ink differ with the given probability (percent).
export function stroopRound(colorCount, mismatchPercent, rand = Math.random, previous = null) {
  let word, ink;
  do {
    ink = pick(colorCount, rand);
    word = rand() * 100 < mismatchPercent ? (ink + 1 + pick(colorCount - 1, rand)) % colorCount : ink;
  } while (previous && previous.word === word && previous.ink === ink);
  return {word, ink};
}

// ---- Schulte table -----------------------------------------------------------------------------
export const schulteGrid = (size, rand = Math.random) => shuffled(Array.from({length: size * size}, (_, i) => i + 1), rand);

// ---- Repeat the sequence -----------------------------------------------------------------------
// The next tile is random, but never the same tile three times in a row.
export function extendSequence(sequence, tiles, rand = Math.random) {
  let next;
  do next = pick(tiles, rand);
  while (sequence.length >= 2 && sequence.at(-1) === next && sequence.at(-2) === next);
  return [...sequence, next];
}

// ---- Turn the figure ---------------------------------------------------------------------------
// A figure is a list of [x, y] cells. Normalised: moved to the origin and sorted, as a key string.
export function normalize(cells) {
  const minX = Math.min(...cells.map(c => c[0])), minY = Math.min(...cells.map(c => c[1]));
  return cells.map(([x, y]) => [x - minX, y - minY]).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
}
export const keyOf = cells => normalize(cells).map(c => c.join(',')).join(';');
export const rotate = (cells, quarter = 1) => {
  let out = cells;
  for (let i = 0; i < ((quarter % 4) + 4) % 4; i++) out = out.map(([x, y]) => [-y, x]);
  return normalize(out);
};
export const mirror = cells => normalize(cells.map(([x, y]) => [-x, y]));
export const rotations = cells => [0, 1, 2, 3].map(q => keyOf(rotate(cells, q)));
export const isRotationOf = (candidate, target) => rotations(target).includes(keyOf(candidate));
// Chiral: its mirror image cannot be obtained by turning it (needed for mirror distractors).
export const isChiral = cells => !isRotationOf(mirror(cells), cells);
// A random connected figure of n cells.
export function randomFigure(n, rand = Math.random) {
  const cells = [[0, 0]], has = new Set(['0,0']);
  while (cells.length < n) {
    const [x, y] = cells[pick(cells.length, rand)], [dx, dy] = [[1, 0], [-1, 0], [0, 1], [0, -1]][pick(4, rand)];
    const key = `${x + dx},${y + dy}`;
    if (!has.has(key)) { has.add(key); cells.push([x + dx, y + dy]); }
  }
  return normalize(cells);
}
// One round: a sample, the right answer (the sample turned 90/180/270 degrees) and distractors —
// mirrored copies (turned at random) and, unless onlyMirrors, other figures of the same size.
export function rotationRound(cellCount, optionCount, onlyMirrors, rand = Math.random) {
  // With mirrors only, the sample must have four different turns, so its mirror image gives
  // enough different distractors (an S-like figure has only two).
  let sample;
  do sample = randomFigure(cellCount, rand);
  while (!isChiral(sample) || (onlyMirrors && new Set(rotations(sample)).size < 4));
  const answer = rotate(sample, 1 + pick(3, rand));
  const used = new Set([keyOf(answer)]), options = [answer];
  const mirrored = mirror(sample);
  let guard = 0;
  while (options.length < optionCount && guard++ < 200) {
    const useMirror = onlyMirrors || options.length === 1 || rand() < 0.5;
    let figure = useMirror ? rotate(mirrored, pick(4, rand)) : randomFigure(cellCount, rand);
    if (!useMirror && isRotationOf(figure, sample)) continue;
    const key = keyOf(figure);
    if (!used.has(key)) { used.add(key); options.push(figure); }
  }
  const order = shuffled(options.map((_, i) => i), rand);
  return {sample, options: order.map(i => options[i]), answer: order.indexOf(0)};
}

// ---- Tower of Hanoi ----------------------------------------------------------------------------
// pegs: three arrays of disc sizes, bottom first. The tower starts on the left peg.
export const hanoiStart = discs => [Array.from({length: discs}, (_, i) => discs - i), [], []];
export const minMoves = discs => 2 ** discs - 1;
export const canMove = (pegs, from, to) => from !== to && pegs[from].length > 0 &&
  (pegs[to].length === 0 || pegs[to].at(-1) > pegs[from].at(-1));
export function moveDisc(pegs, from, to) {
  if (!canMove(pegs, from, to)) return null;
  const next = pegs.map(p => [...p]);
  next[to].push(next[from].pop());
  return next;
}
export const hanoiSolved = (pegs, discs) => pegs[2].length === discs;
