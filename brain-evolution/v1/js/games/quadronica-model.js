// Quadronica (Znax, CZnax_GameField) — rules taken from the original game binary:
//   removal    FUN_4a142b4c   every cell of the rectangle shrinks and fades in place
//                             ([znax_game_field] number_disappear_speed per tick); nothing falls
//   refill     FUN_4a140784   empty cells get new random colours where they are; when fewer than
//                             gen_var[0] rectangles are left, rectangles are completed until there
//                             are (gen_var[0] + gen_var[1]) / 2 of them
//   points     FUN_4a142b4c   points_good_move_arr[diff] x removed cells, cells beyond half of the
//                             field count half; a wrong move adds points_wrong_move_arr[diff]
//   time       FUN_4a141900   diff_max_time, or bm_diff_max_time in Brain Marking
// [znax_game_field] *_gen_var = "min max colours -".
import { arrayValue } from '../original.js';

const rnd = (rand, n) => (n > 0 ? (rand() % 0x7fff) % n : 0);
const numbers = text => String(text ?? '').trim().split(/\s+/).map(Number);

export function fieldParams(field, diff, marking = false) {
  const gen = numbers(field?.[['easy_gen_var', 'med_gen_var', 'hard_gen_var'][diff] || 'easy_gen_var']);
  return {
    cols: Number(field?.field_width) || 8,
    rows: Number(field?.field_height) || 11,
    minRects: gen[0] || 5,
    maxRects: gen[1] || 10,
    colors: Math.min(6, gen[2] || 4),
    time: arrayValue(field?.[marking ? 'bm_diff_max_time' : 'diff_max_time'], diff) || 120,
    good: arrayValue(field?.points_good_move_arr, diff) || 20,
    wrong: arrayValue(field?.points_wrong_move_arr, diff) || -80,
    disappearSpeed: Number(field?.number_disappear_speed) || 2,
  };
}

export function findRectangles(grid) {
  const rows = grid.length, cols = grid[0]?.length || 0, list = [];
  for (let r1 = 0; r1 < rows; r1++) for (let r2 = r1 + 1; r2 < rows; r2++)
    for (let c1 = 0; c1 < cols; c1++) for (let c2 = c1 + 1; c2 < cols; c2++) {
      const color = grid[r1][c1];
      if (color >= 0 && grid[r1][c2] === color && grid[r2][c1] === color && grid[r2][c2] === color)
        list.push({r1, c1, r2, c2, color});
    }
  return list;
}

// Points for one rectangle of `cells` cells on a field of `total` cells.
export function rectanglePoints(cells, total, good) {
  const half = Math.floor(total / 2);
  const counted = cells > half ? half + Math.trunc((cells - half) / 2) : cells;
  return counted * good;
}

// Empty cells (-1) get a random colour where they are.
export function fillEmpty(grid, colors, rand) {
  for (const row of grid) for (let c = 0; c < row.length; c++) if (row[c] < 0) row[c] = rnd(rand, colors);
  return grid;
}

// Rectangles that miss one corner (or two) of a common colour; completing them adds a rectangle.
function nearRectangles(grid, need) {
  const rows = grid.length, cols = grid[0].length, out = [];
  for (let r1 = 0; r1 < rows; r1++) for (let r2 = r1 + 1; r2 < rows; r2++)
    for (let c1 = 0; c1 < cols; c1++) for (let c2 = c1 + 1; c2 < cols; c2++) {
      const corners = [grid[r1][c1], grid[r1][c2], grid[r2][c1], grid[r2][c2]];
      const counts = {};
      for (const v of corners) counts[v] = (counts[v] || 0) + 1;
      const [color, n] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
      if (n === need) out.push({r1, c1, r2, c2, color: Number(color)});
    }
  return out;
}

export function ensureRectangles(grid, params, rand) {
  let count = findRectangles(grid).length;
  if (count >= params.minRects) return count;
  const target = Math.floor((params.minRects + params.maxRects) / 2);
  for (let attempt = 0; count < target && attempt < 100; attempt++) {
    let list = nearRectangles(grid, 3);
    if (!list.length) list = nearRectangles(grid, 2);
    if (!list.length) break;
    const {r1, c1, r2, c2, color} = list[rnd(rand, list.length)];
    grid[r1][c1] = grid[r1][c2] = grid[r2][c1] = grid[r2][c2] = color;
    count = findRectangles(grid).length;
  }
  return count;
}

export function newField(params, rand) {
  const grid = Array.from({length: params.rows}, () => Array(params.cols).fill(-1));
  fillEmpty(grid, params.colors, rand);
  ensureRectangles(grid, params, rand);
  return grid;
}
