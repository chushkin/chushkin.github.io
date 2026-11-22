// Tower of Hanoi, made for the web (PLAN 5): move the tower from the left peg to the right one,
// a larger disc never on a smaller one. Planning ahead.
import { NewGame } from './new-game.js';
import { tr, escapeHTML } from './restored-game.js';
import { i18n } from '../i18n.js';
import { audio } from '../audio.js';
import * as M from './new-games-model.js';

const DISC_COLORS = ['#e6b800', '#f57c00', '#e53935', '#8e3fc4', '#1e63d6', '#2e9d3a'];

export class HanoiGame extends NewGame {
  id = 'hanoi';
  async init(difficulty = 'easy') {
    if (!await this.begin(difficulty)) return;
    this.discs = this.param('discs');
    this.levelPoints = this.param('level_points_arr');
    this.pegs = M.hanoiStart(this.discs);
    this.moves = 0; this.wrong = 0; this.selected = null;
    this.render();
    this.tick(() => { this.elapsed++; this.refresh(); });
  }
  values() { return {DIST: this.levelPoints, P1: Math.max(0, this.moves - M.minMoves(this.discs)), P2: this.wrong, TIME: this.elapsed}; }
  refresh() {
    this.refreshScore(this.values());
    this.setStatus(`${this.moves} / ${M.minMoves(this.discs)} · ${this.elapsed} ${tr('с', 's')}`);
  }
  render() {
    this.frame(this.title, `<p class="restored-instruction">${escapeHTML(i18n.t('Move the tower to the right peg. A larger disc never goes on a smaller one.'))}</p>
      <div class="ng-stage"><div class="ng-hanoi">${this.pegs.map((_, p) => `<button class="ng-peg" data-peg="${p}" aria-label="${p + 1}"></button>`).join('')}</div></div>`);
    this.container.querySelectorAll('[data-peg]').forEach(btn => btn.onclick = () => this.tap(Number(btn.dataset.peg)));
    this.draw();
    this.refresh();
  }
  draw() {
    this.container.querySelectorAll('[data-peg]').forEach(btn => {
      const p = Number(btn.dataset.peg), discs = this.pegs[p];
      btn.classList.toggle('ng-selected', this.selected === p);
      btn.innerHTML = `<span class="ng-rod"></span>${discs.map((size, i) => `<span class="ng-disc${this.selected === p && i === discs.length - 1 ? ' ng-lifted' : ''}"
        style="--w:${30 + 70 * size / this.discs}%;--c:${DISC_COLORS[(size - 1) % DISC_COLORS.length]};--i:${i}"></span>`).join('')}`;
    });
  }
  tap(peg) {
    if (!this.playable) return;
    if (this.selected === null) {
      if (this.pegs[peg].length) { this.selected = peg; audio.play('click'); }
    } else if (this.selected === peg) {
      this.selected = null;
    } else {
      const next = M.moveDisc(this.pegs, this.selected, peg);
      if (next) {
        this.pegs = next; this.moves++; audio.play('click');
        if (M.hanoiSolved(this.pegs, this.discs)) { this.selected = null; this.draw(); audio.play('good'); this.complete(this.values()); return; }
      } else {
        this.wrong++; audio.play('wrong');
      }
      this.selected = null;
    }
    this.draw();
    this.refresh();
  }
}
