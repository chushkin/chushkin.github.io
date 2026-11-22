// Base of the five games made for the web (PLAN 5): the RestoredGame frame (header, pause, help,
// results window), parameters from <id>_wnd and the score from the <id>_show_results items, so the
// score shown while playing is the total of the results window, as in the original games.
import { RestoredGame } from './restored-game.js';
import { arrayValue } from '../original.js';
import { buildResults } from './results-window.js';

export class NewGame extends RestoredGame {
  // A per-difficulty parameter of [<id>_wnd].
  param(name) { return arrayValue(String(this.original[`${this.id}_wnd`][name]), this.diff); }
  get section() { return this.original[`${this.id}_show_results`]; }
  liveScore(values) { return buildResults(this.section, values, this.diff).total; }
  refreshScore(values) { this.score = this.liveScore(values); this.updateScore(); }
  setStatus(text) { const el = this.container.querySelector('[data-status]'); if (el) el.textContent = text; }
  complete(values) { this.finish(this.liveScore(values), {section: this.section, values}); }
  // A delayed step that waits while the game is paused and dies with the game (exit, restart).
  later(callback, ms) {
    const generation = this.generation;
    const id = setTimeout(() => {
      this.timers.delete(id);
      if (generation !== this.generation || this.destroyed || this.finished) return;
      if (this.isPaused) { this.later(callback, 200); return; } // going to background pauses the game
      callback();
    }, ms);
    this.timers.add(id);
  }
}
