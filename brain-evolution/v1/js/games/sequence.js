// Repeat the Sequence, made for the web (PLAN 5): the tiles light up one after another and the
// player repeats them; every round the sequence is one step longer. Working memory.
import { NewGame } from './new-game.js';
import { tr, escapeHTML } from './restored-game.js';
import { i18n } from '../i18n.js';
import { audio } from '../audio.js';
import * as M from './new-games-model.js';
import { haptics } from '../haptics.js';

const TILE_COLORS = ['#e53935', '#2e9d3a', '#1e63d6', '#e6b800', '#8e3fc4', '#f57c00', '#00a3a3', '#d81b8c', '#6d4c41'];

export class SequenceGame extends NewGame {
  id = 'sequence';
  async init(difficulty = 'easy') {
    if (!await this.begin(difficulty)) return;
    this.tiles = this.param('tiles');
    this.rounds = this.param('rounds');
    this.lives = this.param('lives');
    this.showMs = this.param('show_ms');
    this.sequence = [];
    for (let i = 0; i < this.param('start_length'); i++) this.sequence = M.extendSequence(this.sequence, this.tiles);
    this.round = 0; this.right = 0; this.wrong = 0; this.position = 0; this.phase = 'watch';
    this.render();
    this.later(() => this.show(), 700);
  }
  values() { return {P1: this.right, P2: this.wrong}; }
  refresh() {
    this.refreshScore(this.values());
    const phase = this.phase === 'watch' ? i18n.t('Watch the sequence') : i18n.t('Repeat the sequence');
    this.setStatus(`${this.round + 1}/${this.rounds} · ${phase} · ${'♥'.repeat(Math.max(0, this.lives))}`);
  }
  render() {
    const cols = this.tiles === 4 ? 2 : 3;
    this.frame(this.title, `<div class="ng-stage"><div class="ng-seq" style="--cols:${cols}">
      ${Array.from({length: this.tiles}, (_, i) => `<button class="ng-seq-tile" data-tile="${i}" style="--c:${TILE_COLORS[i]}"
        aria-label="${i + 1}"></button>`).join('')}</div></div>`);
    this.container.querySelectorAll('[data-tile]').forEach(btn => btn.onclick = () => this.tap(Number(btn.dataset.tile)));
    this.refresh();
  }
  light(tile, ms) {
    const el = this.container.querySelector(`[data-tile="${tile}"]`);
    if (!el) return;
    el.classList.add('ng-lit');
    this.later(() => el.classList.remove('ng-lit'), ms);
  }
  // Shows the sequence; while it plays the tiles do not answer.
  show() {
    this.phase = 'watch'; this.position = 0; this.refresh();
    this.sequence.forEach((tile, i) => this.later(() => { this.light(tile, this.showMs * 0.7); audio.play('click'); }, i * this.showMs));
    this.later(() => { this.phase = 'input'; this.refresh(); }, this.sequence.length * this.showMs);
  }
  tap(tile) {
    if (!this.playable || this.phase !== 'input') return;
    this.light(tile, 180);
    if (tile === this.sequence[this.position]) {
      this.right++; this.position++; haptics.play('good');
      if (this.position >= this.sequence.length) {
        audio.play('good');
        if (++this.round >= this.rounds) { this.complete(this.values()); return; }
        this.sequence = M.extendSequence(this.sequence, this.tiles);
        this.phase = 'watch';
        this.later(() => this.show(), 800);
      }
    } else {
      this.wrong++; this.lives--; audio.play('wrong');
      this.container.querySelector('.ng-seq')?.classList.add('ng-wrong');
      this.later(() => this.container.querySelector('.ng-seq')?.classList.remove('ng-wrong'), 400);
      if (this.lives <= 0) { this.phase = 'over'; this.later(() => this.complete(this.values()), 500); return; }
      this.phase = 'watch';
      this.later(() => this.show(), 900); // the same sequence again
    }
    this.refresh();
  }
}
