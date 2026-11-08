// Sudoku puzzle preparation following the original selection (FUN_4a0afc50 / FUN_4a130144):
//   easy   -> generated with rules [diflev_0] "very easy"
//   medium -> generated with rules [diflev_1] "easy"
//   hard   -> an original pattern from _SUDOKU_PUZZLES2 unchanged (index 1..count-1 like the original)
// In the original rule statistics r1 + r2 equal the number of empty cells, so rule 1 places a naked
// single and rule 2 a hidden single; rules 3+ are elimination steps. diflev_0/1 allow only rules 1-2.
// Hard and ultra read "%d_global" puzzles_count and "%d_puzzle%d" (FUN_4a130144); the single
// ultra puzzle can never be drawn (rand % 1 is always 0), and training stops at hard.
const UNITS = [];
for (let i = 0; i < 9; i++) {
  UNITS.push(Array.from({length: 9}, (_, c) => i * 9 + c));
  UNITS.push(Array.from({length: 9}, (_, r) => r * 9 + i));
  UNITS.push(Array.from({length: 9}, (_, k) => (Math.floor(i / 3) * 3 + Math.floor(k / 3)) * 9 + (i % 3) * 3 + k % 3));
}
const PEERS = Array.from({length: 81}, (_, i) => [...new Set(UNITS.filter(u => u.includes(i)).flat())].filter(j => j !== i));
const rnd = (rand, n) => (rand() % 0x7fff) % n;

function candidates(grid, i) {
  if (grid[i]) return [];
  const used = new Set(PEERS[i].map(j => grid[j]));
  return [1, 2, 3, 4, 5, 6, 7, 8, 9].filter(d => !used.has(d));
}

export function fullGrid(rand) {
  const grid = Array(81).fill(0);
  const fill = i => {
    if (i === 81) return true;
    const options = candidates(grid, i);
    for (let k = options.length - 1; k > 0; k--) { const j = rnd(rand, k + 1); [options[k], options[j]] = [options[j], options[k]]; }
    for (const d of options) { grid[i] = d; if (fill(i + 1)) return true; }
    grid[i] = 0;
    return false;
  };
  fill(0);
  return grid;
}

// Solve with rule 1 (naked single) before rule 2 (hidden single); counts placements per rule.
export function solveWithSingles(puzzle) {
  const grid = puzzle.slice();
  let r1 = 0, r2 = 0;
  for (;;) {
    let placed = false;
    for (let i = 0; i < 81 && !placed; i++) {
      const c = candidates(grid, i);
      if (!grid[i] && c.length === 1) { grid[i] = c[0]; r1++; placed = true; }
    }
    if (!placed) {
      outer: for (const unit of UNITS) for (let d = 1; d <= 9; d++) {
        if (unit.some(i => grid[i] === d)) continue;
        const spots = unit.filter(i => !grid[i] && candidates(grid, i).includes(d));
        if (spots.length === 1) { grid[spots[0]] = d; r2++; placed = true; break outer; }
      }
    }
    if (!placed) break;
  }
  return {solved: !grid.includes(0), r1, r2, grid};
}

export function rulesFor(diflev) {
  const n = key => Number(String(diflev[key] ?? 0).trim());
  return {r1: [n('rule1min'), n('rule1max')], r2: [n('rule2min'), n('rule2max')]};
}

// FUN_4a05a4cc: cells are taken out of a full grid one step at a time. A step that leaves the
// puzzle unsolvable for the rules goes back to the previous kept state; a solvable state is kept,
// and the first one whose rule counts are all inside the [diflev] ranges is the puzzle. After 150
// steps the search starts again from a new grid. (The original removes cells through symmetric
// templates; here a step takes out one random cell.)
export function generate(diflev, rand) {
  const rules = rulesFor(diflev);
  const inRange = s => s.r1 >= rules.r1[0] && s.r1 <= rules.r1[1] && s.r2 >= rules.r2[0] && s.r2 <= rules.r2[1];
  let best = null;
  for (let restart = 0; restart < 60; restart++) {
    const solution = fullGrid(rand);
    let puzzle = solution.slice();
    const kept = [];
    for (let step = 0; step < 150; step++) {
      const filled = [];
      for (let i = 0; i < 81; i++) if (puzzle[i]) filled.push(i);
      if (!filled.length) break;
      const next = puzzle.slice();
      next[filled[rnd(rand, filled.length)]] = 0;
      const s = solveWithSingles(next);
      if (!s.solved) {
        if (!kept.length) break;
        puzzle = kept.pop();
        continue;
      }
      if (inRange(s)) return {puzzle: next, solution, r1: s.r1, r2: s.r2};
      kept.push(puzzle);
      puzzle = next;
      if (!best || s.r1 + s.r2 > best.r1 + best.r2) best = {puzzle: next, solution, r1: s.r1, r2: s.r2};
    }
  }
  return best;
}

export function pickHard(patterns, rand) {
  // The original draws puzzle numbers 1..count-1 (never the last 1-based name).
  return patterns[patterns.length > 1 ? rnd(rand, patterns.length - 1) : 0];
}
