// Schulte table, made for the web (PLAN 5): the numbers 1..N² are mixed in an N×N table; the
// player taps them in order. Speed of attention and peripheral vision.
import { NewGame } from './new-game.js';
import { tr, escapeHTML } from './restored-game.js';
import { i18n } from '../i18n.js';
import { audio } from '../audio.js';
import * as M from './new-games-model.js';
import { haptics } from '../haptics.js';

export class SchulteGame extends NewGame {
  id = 'schulte';
  async init(difficulty = 'easy') {
    if (!await this.begin(difficulty)) return;
    this.size = this.param('size');
    this.grid = M.schulteGrid(this.size);
    this.nextNumber = 1; this.right = 0; this.wrong = 0;
    this.render();
    this.tick(() => { this.elapsed++; this.refresh(); });
  }
  get count() { return this.size * this.size; }
  values() { return {P1: this.right, P2: this.wrong, TIME: this.elapsed}; }
  refresh() {
    this.refreshScore(this.values());
    this.setStatus(`→ ${Math.min(this.nextNumber, this.count)} · ${this.elapsed} ${tr('с', 's')}`);
  }
  render() {
    const instruction = i18n.t('Tap the numbers in order from 1 to @N.').replace('@N', this.count);
    this.frame(this.title, `<p class="restored-instruction">${escapeHTML(instruction)}</p>
      <div class="ng-stage"><div class="ng-schulte" style="--n:${this.size}">
      ${this.grid.map(n => `<button class="ng-schulte-cell" data-n="${n}">${n}</button>`).join('')}</div></div>`);
    this.container.querySelectorAll('[data-n]').forEach(btn => btn.onclick = () => this.tap(Number(btn.dataset.n), btn));
    this.refresh();
  }
  tap(n, button) {
    if (!this.playable || n < this.nextNumber) return;
    if (n === this.nextNumber) {
      this.right++; this.nextNumber++; audio.play('click'); haptics.play('good');
      button.classList.add('ng-done');
      if (this.nextNumber > this.count) { audio.play('good'); this.complete(this.values()); return; }
    } else {
      this.wrong++; audio.play('wrong');
      button.classList.remove('ng-wrong'); void button.offsetWidth; button.classList.add('ng-wrong');
    }
    this.refresh();
  }
}
