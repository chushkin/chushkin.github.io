// Source: scripts/extract_original_config.py, extracted APK INO records.
let configPromise;
export function loadOriginalConfig() {
  return configPromise ||= fetch('data/original_config.json').then(response => {
    if (!response.ok) throw new Error(`Original configuration: HTTP ${response.status}`);
    return response.json();
  });
}
export const difficultyIndex = value => ({easy: 0, med: 1, medium: 1, hard: 2}[value] ?? 0);
export const arrayValue = (value, index) => Number(value.trim().split(/\s+/)[index + 1]);
export const shuffle = values => {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};
// newlib rand() used by the original game: 64-bit LCG, returns bits 32..62 (FUN_4a19b9f0).
export function createRandom(seed = Date.now()) {
  let state = BigInt.asUintN(64, BigInt(seed));
  return () => {
    state = BigInt.asUintN(64, state * 6364136223846793005n + 1n);
    return Number((state >> 32n) & 0x7fffffffn);
  };
}
