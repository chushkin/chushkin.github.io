// Memorics (ColorRects, CCR_*) — exact port of the original original game binary logic (see re/README.md):
//   createRound   FUN_4a0feb88   figures, field placement and question for one round
//   matches       FUN_4a0f5034   which figures answer the question
//   tap           FUN_4a0f5034 / FUN_4a0f4ebc / FUN_4a0f4d30   one tap = one try, right or wrong
//   totalScore    CCRGameWnd::v28   level cost split over all taps, wrong taps cost a percentage
export const COLS = 6, ROWS = 5, SLOTS = COLS * ROWS;
// Question types: 0 form, 1 colour, 2 state, 3 form+colour, 4 form+state, 5 state+colour.
export const QUESTION_TYPES = 6;

const rnd = (rand, n) => (rand() % 0x7fff) % n;

function pickDistinct(rand, pool, count) {
  const left = pool.slice(), picked = [];
  for (let i = 0; i < count && left.length; i++) picked.push(left.splice(rnd(rand, left.length), 1)[0]);
  return picked;
}

// level: {MIN_OBJ_COUNT, MAX_OBJ_COUNT, m_nTotalColors, m_nTotalForms, m_nTotalStates,
//         m_nEnableAnimRandom, m_nHowmuchCount, m_nShowCount}; frames(form, state) -> animation length.
export function createRound(level, rand, frames = () => 1) {
  const n = key => Number(String(level[key]).trim());
  const min = n('MIN_OBJ_COUNT'), max = n('MAX_OBJ_COUNT');
  const count = min + (max > min ? rnd(rand, max - min) : 0);
  const forms = pickDistinct(rand, [1, 2, 3, 4], n('m_nTotalForms'));
  const colors = pickDistinct(rand, [1, 2, 3, 4], n('m_nTotalColors'));
  const states = pickDistinct(rand, [1, 2, 3], n('m_nTotalStates'));
  const combos = [];
  for (const form of forms) for (const color of colors) for (const state of states) combos.push({form, color, state});
  // Show-only levels ask types 0..4; type 5 exists in the checker but is never generated.
  const type = n('m_nHowmuchCount') < 1 ? rnd(rand, 5) : n('m_nShowCount') < 1 ? 6 + rnd(rand, 5) : rnd(rand, 11);
  let pick = Math.floor(combos.length / 2);
  const question = {type, ...combos[pick]};
  const slots = Array.from({length: SLOTS}, (_, i) => i), figures = [];
  for (let i = 0; i < count; i++) {
    const slot = slots.splice(rnd(rand, slots.length), 1)[0];
    const figure = {slot, ...combos[pick], frame: 0};
    if (n('m_nEnableAnimRandom')) figure.frame = rnd(rand, Math.max(1, frames(figure.form, figure.state)));
    figures.push(figure);
    pick = count < combos.length ? rnd(rand, combos.length) : (pick + 1) % combos.length;
  }
  return {figures, question, tries: figures.filter(f => matches(question, f)).length};
}

export function matches(q, f) {
  switch (q.type) {
    case 0: return q.form === f.form;
    case 1: return q.color === f.color;
    case 2: return q.state === f.state;
    case 3: return q.form === f.form && q.color === f.color;
    case 4: return q.form === f.form && q.state === f.state;
    case 5: return q.state === f.state && q.color === f.color;
    default: return false;
  }
}

// One tap on a cell. Each new cell costs one try; repeated taps on a found or crossed cell are ignored.
export function tap(round, state, slot) {
  if (state.tries <= 0 || state.found.has(slot) || state.crossed.has(slot)) return null;
  const figure = round.figures.find(f => f.slot === slot);
  const right = Boolean(figure && matches(round.question, figure));
  if (right) state.found.add(slot); else state.crossed.add(slot);
  state.tries--;
  right ? state.right++ : state.wrong++;
  return right;
}

export function questionParts(q) {
  // [descriptor keys, uses the "figures on the field" ending]
  switch (q.type) {
    case 0: return {color: null, state: null, form: q.form};
    case 1: return {color: q.color, state: null, form: null};
    case 2: return {color: null, state: q.state, form: null};
    case 3: return {color: q.color, state: null, form: q.form};
    case 4: return {color: null, state: q.state, form: q.form};
    default: return {color: q.color, state: q.state, form: null};
  }
}

export function totalScore(right, wrong, levelCost, wrongPercent) {
  const answers = right + wrong;
  if (!answers) return {perRight: 0, perWrong: 0, total: 0};
  const perRight = Math.floor(Math.floor(levelCost / answers) / 10) * 10;
  const perWrong = -Math.floor(Math.floor(wrongPercent * perRight / 100) / 10) * 10;
  return {perRight, perWrong, total: right * perRight + wrong * perWrong};
}
