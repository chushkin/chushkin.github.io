// PLAN 5: five games made for Amaze Brain Evolution in the style of the original twelve.
// Their sections follow the original config format and are merged into it at load time
// (loadOriginalConfig), so training, unlocking, awards, high scores, help and the results window
// treat them exactly like the original games. data/original_config.json itself stays the APK's.
//
//   MG_<name>_<diff>   ID (game number), diff, mg_id, level_up_param "down up required unlock"
//                       (the same meaning as in the original: FUN_4a0214d4 / updateSkill)
//   <name>_wnd          the game's own parameters per difficulty ("3 easy med hard")
//   <name>_show_results the results window items (titles are original, already translated)
//   <name>_help         "2_value": how to play (translated in web_extra.json)

export const NEW_GAME_IDS = {201: 'stroop', 202: 'schulte', 203: 'sequence', 204: 'rotation', 205: 'hanoi'};

const DIFFS = ['easy', 'med', 'hard'];
// Training goals: easy "-1 up 3 unlock" (opens after <unlock> level-ups in any game), then medium
// and hard "500 up 5/10 -1" — the same shape as the original games' sections.
const LEVELS = {
  stroop:   {id: 201, up: [3000, 5500, 8000], unlock: 4},
  schulte:  {id: 202, up: [3000, 5500, 9000], unlock: 5},
  sequence: {id: 203, up: [2500, 4500, 6500], unlock: 7},
  rotation: {id: 204, up: [3000, 5000, 7000], unlock: 9},
  hanoi:    {id: 205, up: [2500, 5000, 10000], unlock: 12},
};

const sections = {};
for (const [name, {id, up, unlock}] of Object.entries(LEVELS)) {
  DIFFS.forEach((diff, i) => {
    const required = [3, 5, 10][i];
    sections[`MG_${name}_${diff}`] = {ID: String(id), diff: String(i), mg_id: String(id * 10 + i),
      level_up_param: i === 0 ? `-1 ${up[0]} ${required} ${unlock}` : `500 ${up[i]} ${required} -1`};
  });
}

const results = items => ({
  items_count: String(items.length), total_param: '5 0 0 0',
  ...Object.fromEntries(items.flatMap(([title, text, points], i) => [
    [`i${i + 1}_title`, title], [`i${i + 1}_text`, text], [`i${i + 1}_points_arr`, points], [`i${i + 1}_param`, i ? '5 0 0 0' : '10 0 0 0']])),
});

export const NEW_GAME_SECTIONS = {
  ...sections,
  // Colour and Word: name the colour of the ink, not the word.
  stroop_wnd: {rounds: '3 15 20 25', colors: '3 4 5 6', mismatch_percent: '3 50 75 90', shuffle_buttons: '3 0 0 1',
    points_good_move_arr: '3 300 350 400', points_wrong_move_arr: '3 -300 -400 -500', time_penalty_arr: '3 -20 -25 -30'},
  stroop_show_results: results([['Right Answers', '@P1', '3 300 350 400'], ['Wrong Answers', '@P2', '3 -300 -400 -500'], ['Time Penalty', '@TIME', '3 -20 -25 -30']]),
  stroop_help: {'1_value': 'How to play Colour and Word', '2_value': 'A colour name is written in another colour. Tap the colour of the ink, not the colour the word names. Answer quickly: time costs points.'},

  // Schulte table: tap the numbers in order.
  schulte_wnd: {size: '3 4 5 6', points_good_move_arr: '3 250 300 350', points_wrong_move_arr: '3 -200 -300 -400', time_penalty_arr: '3 -20 -25 -30'},
  schulte_show_results: results([['Right Moves', '@P1', '3 250 300 350'], ['Wrong Moves', '@P2', '3 -200 -300 -400'], ['Time Penalty', '@TIME', '3 -20 -25 -30']]),
  schulte_help: {'1_value': 'How to play Schulte Table', '2_value': 'The numbers are mixed up in the table. Tap them in order, starting from 1, as fast as you can. Keep your eyes on the centre of the table and look for each number with your peripheral vision.'},

  // Repeat the sequence: the tiles light up one after another; repeat them. Each round is one longer.
  sequence_wnd: {tiles: '3 4 6 9', start_length: '3 2 3 3', rounds: '3 8 9 10', lives: '3 3 3 3', show_ms: '3 700 550 450',
    points_good_move_arr: '3 100 120 150', points_wrong_move_arr: '3 -200 -300 -400'},
  sequence_show_results: results([['Right Moves', '@P1', '3 100 120 150'], ['Wrong Moves', '@P2', '3 -200 -300 -400']]),
  sequence_help: {'1_value': 'How to play Repeat the Sequence', '2_value': 'Watch the tiles light up one after another, then tap them in the same order. Every round the sequence gets one step longer. After three mistakes the game ends.'},

  // Turn the figure: which of the figures is the sample turned, not mirrored?
  rotation_wnd: {rounds: '3 10 12 15', options: '3 3 4 4', cells: '3 4 5 6', only_mirrors: '3 0 0 1',
    points_good_move_arr: '3 450 550 650', points_wrong_move_arr: '3 -450 -550 -650', time_penalty_arr: '3 -15 -20 -25'},
  rotation_show_results: results([['Right Answers', '@P1', '3 450 550 650'], ['Wrong Answers', '@P2', '3 -450 -550 -650'], ['Time Penalty', '@TIME', '3 -15 -20 -25']]),
  rotation_help: {'1_value': 'How to play Turn the Figure', '2_value': 'Find the figure that is the sample turned on the plane. A mirrored figure is not the same: it can only be obtained by flipping it over.'},

  // Tower of Hanoi: move the tower to the right peg, a larger disc never on a smaller one.
  hanoi_wnd: {discs: '3 3 4 5', level_points_arr: '3 3500 7000 14000', extra_move_arr: '3 -150 -150 -150',
    points_wrong_move_arr: '3 -200 -300 -400', time_penalty_arr: '3 -10 -10 -10'},
  hanoi_show_results: results([['Level points', '@DIST', ''], ['Extra Moves', '@P1', '3 -150 -150 -150'], ['Wrong Moves', '@P2', '3 -200 -300 -400'], ['Time Penalty', '@TIME', '3 -10 -10 -10']]),
  hanoi_help: {'1_value': 'How to play Tower of Hanoi', '2_value': 'Move the whole tower to the right peg. Take the top disc of a peg and put it on another peg; a larger disc can never lie on a smaller one. Every move above the minimum costs points.'},
};

// The original config with the new games' sections added (the config object is shared and cached).
export function withNewGames(config) {
  for (const [key, value] of Object.entries(NEW_GAME_SECTIONS)) config.games[key] ??= value;
  return config;
}
