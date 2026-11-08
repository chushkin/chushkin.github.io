// Matches solution check — port of the original FUN_4a0909a4 (see re/README.md).
// Boards are 13 strings of 13 cells. Matches are encoded as direction codes 0..7
// (0 up, 1 up-right, 2 right, ... 7 up-left); without test_derection a match and its
// reverse are the same (0/4 -> 0, 1/5 -> 1, 2/6 -> 2, 3/7 -> 7). The board is compared
// cell by cell (no shifting) with each solution as given, rotated by 90/180/270 degrees,
// mirrored left-right or top-bottom and those mirrors rotated — except where the
// solution's no_mirror flags ("1", "2", "3", "x", "y") switch steps of that search off.
const N = 13;
const EMPTY = -1;

const DIRECTED = {'(': 3, ')': 5, '-': 2, '>': 2, '/': 1, '<': 6, '\\': 7, '^': 0, '|': 0, 'v': 4};
const UNDIRECTED = {'(': 7, '\\': 7, ')': 1, '/': 1, '-': 2, '<': 2, '>': 2, '^': 0, 'v': 0, '|': 0};
const fold = code => ({0: 0, 4: 0, 1: 1, 5: 1, 2: 2, 6: 2, 3: 7, 7: 7}[code] ?? EMPTY);

// Grid indexed [column][row] like the original (string index = column, string number = row).
export function encode(rows, directed = false) {
  const map = directed ? DIRECTED : UNDIRECTED;
  const grid = Array.from({length: N}, () => Array(N).fill(EMPTY));
  for (let row = 0; row < N; row++) {
    const text = String(rows[row] ?? '').slice(0, N);
    for (let col = 0; col < text.length; col++) grid[col][row] = map[text[col]] ?? EMPTY;
  }
  return grid;
}

const CHAR = {0: '|', 1: '/', 2: '-', 7: '\\'};
// Back to board strings (undirected codes), e.g. to build rotated boards in tests.
export function decode(grid) {
  return Array.from({length: N}, (_, row) => Array.from({length: N}, (_, col) => CHAR[grid[col][row]] ?? '.').join(''));
}

const turn = (code, directed) => {
  if (code === EMPTY || code >= 8) return code;
  const next = (code + 2) % 8;
  return directed ? next : fold(next);
};
// A mirror keeps vertical/horizontal matches and swaps the diagonals.
const flip = (code, directed) => (code !== EMPTY && code < 8 && code % 2 === 1 ? turn(code, directed) : code);

// new[12 - m][k] = turn(old[k][m])
export function rotate(grid, directed = false) {
  const out = Array.from({length: N}, () => Array(N).fill(EMPTY));
  for (let k = 0; k < N; k++) for (let m = 0; m < N; m++) out[N - 1 - m][k] = turn(grid[k][m], directed);
  return out;
}

// First mirror flips the first index (left-right), the second flips the second index (top-bottom).
export function mirror(grid, second, directed = false) {
  const out = Array.from({length: N}, () => Array(N).fill(EMPTY));
  for (let k = 0; k < N; k++) for (let m = 0; m < N; m++) {
    if (second) out[k][N - 1 - m] = flip(grid[k][m], directed);
    else out[N - 1 - k][m] = flip(grid[k][m], directed);
  }
  return out;
}

const same = (a, b) => a.every((column, i) => column.every((code, j) => code === b[i][j]));

export function matchesSolution(board, solution, noMirror = '', directed = false) {
  const flag = ch => noMirror.includes(ch);
  const noX = flag('x') || flag('X'), noY = flag('y') || flag('Y');
  const no1 = flag('1'), no2 = flag('2'), no3 = flag('3');
  const target = encode(board, directed), base = encode(solution, directed);
  let current = base, mirrors = 0;
  for (;;) {
    let turns = 0, equal = same(current, target);
    for (;;) {
      if (equal) return true;
      let step;
      if (no1 && turns === 0) { step = true; turns = 1; } else step = turns === 1;
      if (step && no2) { step = true; turns = 2; } else step = turns === 2;
      if ((step && no3) || turns > 2) break;
      current = rotate(current, directed); turns++; equal = same(current, target);
    }
    let step;
    if (noX && mirrors === 0) { step = true; mirrors = 1; } else step = mirrors === 1;
    if ((step && noY) || mirrors > 1) break;
    current = mirror(base, mirrors !== 0, directed); mirrors++;
  }
  return false;
}

export function isSolved(board, level) {
  const flags = level.no_mirror || [];
  return (level.solutions || []).some((solution, i) => matchesSolution(board, solution, flags[i] || '', Boolean(level.test_direction)));
}

// Level choice of the original (FUN_4a14d318): the profile keeps, per difficulty, the numbers of
// the levels not solved yet ("not_done_lev"); an empty list is refilled with 1..d<n>_count and one
// level is drawn, index = n * 100 * (rand() % 0x7fff) / 3276700. A solved level leaves the list.
export function pickLevel(notDone, count, rand) {
  const list = notDone?.length ? notDone.slice() : Array.from({length: count}, (_, i) => i + 1);
  const index = Math.min(list.length - 1, Math.trunc(list.length * 100 * (rand() % 0x7fff) / 3276700));
  return {level: list[index], list};
}

// FUN_4a14db10: prize fund (@DIST) = mips * points_good_move_arr; total = prize + MovesWrong *
// points_wrong_move_arr. The time is zeroed before time_penalty_arr is applied, so it never counts.
export function score(mips, wrongMoves, goodPoints, wrongPoints) {
  const prize = mips * goodPoints;
  return {prize, total: prize + wrongMoves * wrongPoints};
}
