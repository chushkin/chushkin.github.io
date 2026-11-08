// Geometry (CGeometry_GameField) — exact port of the original figure comparison (see re/README.md):
//   normalize       FUN_4a0684c8   interior angles in 1/100 degree, drawing direction normalised
//   figureAccuracy  FUN_4a069f2c   best start alignment among top vertices, percentage of tolerance
// Coordinates are compared in field pixels (geometry_game_field is 443x443) as integers.
export const FIELD_PIXELS = 443;

export function toFieldPixels(points, fieldSize = 100) {
  return points.map(p => ({x: Math.round(p.x * FIELD_PIXELS / fieldSize), y: Math.round(p.y * FIELD_PIXELS / fieldSize)}));
}

export function normalize(points) {
  const n = points.length;
  const angles = points.map((cur, i) => {
    const prev = points[(i + n - 1) % n], next = points[(i + 1) % n];
    let degrees = (Math.atan2(prev.y - cur.y, prev.x - cur.x) - Math.atan2(next.y - cur.y, next.x - cur.x)) * 180 / Math.PI;
    if (degrees < 0) degrees += 360;
    return Math.trunc(degrees * 100);
  });
  const sum = list => list.reduce((total, value) => total + value, 0);
  const complement = angles.map(a => 36000 - a);
  // Keep the direction whose angle sum is the interior one; otherwise walk the figure backwards.
  if (sum(angles) <= sum(complement)) return {angles, points: points.slice()};
  return {angles: complement.reverse(), points: points.slice().reverse()};
}

// Indices of vertices within the top tenth of the figure height (screen y grows downwards).
export function topVertices(points) {
  const ys = points.map(p => p.y), min = Math.min(...ys), max = Math.max(...ys);
  let limit = min + Math.trunc(Math.abs(max - min) / 10);
  if (limit <= min) limit = min + 1;
  return ys.map((y, i) => (y >= min && y <= limit ? i : -1)).filter(i => i >= 0);
}

const rotate = (list, start) => list.slice(start).concat(list.slice(0, start));

// Returns 0..100. missPercent is max_fig_diff_miss_percent for the difficulty (default 50).
export function figureAccuracy(original, copy, missPercent = 50) {
  if (original.length !== copy.length || copy.length < 3) return 0;
  const a = normalize(original), b = normalize(copy);
  const starts = topVertices(a.points), userStarts = topVertices(b.points);
  if (!starts.length) return 0;
  let error = Infinity;
  for (const i of starts) for (const j of userStarts) {
    const x = rotate(a.angles, i), y = rotate(b.angles, j);
    error = Math.min(error, x.reduce((total, value, k) => total + Math.abs(value - y[k]), 0));
  }
  if (!Number.isFinite(error)) return 0;
  const tolerance = Math.trunc(a.angles.reduce((total, v) => total + v, 0) * missPercent / 100);
  if (error >= tolerance) return 0;
  return Math.max(0, Math.min(100, 100 + Math.trunc(-error * 100 / tolerance)));
}
