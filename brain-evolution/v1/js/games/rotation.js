// Turn the Figure, made for the web (PLAN 5): which of the figures is the sample turned on the
// plane? Mirrored copies look alike but are not the same. Spatial thinking (mental rotation).
import { NewGame } from './new-game.js';
import { tr, escapeHTML } from './restored-game.js';
import { i18n } from '../i18n.js';
import { audio } from '../audio.js';
import * as M from './new-games-model.js';

// A figure as an SVG: cells in a square box, scaled to the larger side.
function figureSVG(cells, color) {
  const w = Math.max(...cells.map(c => c[0])) + 1, h = Math.max(...cells.map(c => c[1])) + 1, side = Math.max(w, h);
  const ox = (side - w) / 2, oy = (side - h) / 2;
  return `<svg viewBox="-0.15 -0.15 ${side + 0.3} ${side + 0.3}" aria-hidden="true">${cells.map(([x, y]) =>
    `<rect x="${x + ox}" y="${y + oy}" width="1" height="1" rx="0.12" fill="${color}" stroke="#0b3b76" stroke-width="0.07"/>`).join('')}</svg>`;
}

export class RotationGame extends NewGame {
  id = 'rotation';
  async init(difficulty = 'easy') {
    if (!await this.begin(difficulty)) return;
    this.rounds = this.param('rounds');
    this.optionCount = this.param('options');
    this.cells = this.param('cells');
    this.onlyMirrors = this.param('only_mirrors') > 0;
    this.round = 0; this.right = 0; this.wrong = 0;
    this.next();
    this.tick(() => { this.elapsed++; this.refresh(); });
  }
  values() { return {P1: this.right, P2: this.wrong, TIME: this.elapsed}; }
  refresh() {
    this.refreshScore(this.values());
    this.setStatus(`${Math.min(this.round + 1, this.rounds)}/${this.rounds} · ${this.elapsed} ${tr('с', 's')}`);
  }
  next() {
    this.current = M.rotationRound(this.cells, this.optionCount, this.onlyMirrors);
    this.frame(this.title, `<p class="restored-instruction">${escapeHTML(i18n.t('Which figure is the sample turned?'))}</p>
      <div class="ng-stage"><div class="ng-rot-sample">${figureSVG(this.current.sample, '#f57c00')}</div>
      <div class="ng-rot-options" style="--n:${this.current.options.length}">${this.current.options.map((cells, i) =>
        `<button class="ng-rot-option" data-option="${i}" aria-label="${i + 1}">${figureSVG(cells, '#4f8fdc')}</button>`).join('')}</div></div>`);
    this.container.querySelectorAll('[data-option]').forEach(btn => btn.onclick = () => this.answer(Number(btn.dataset.option), btn));
    this.refresh();
  }
  answer(index, button) {
    if (!this.playable || button?.disabled) return;
    if (index === this.current.answer) {
      this.right++; audio.play('good');
      if (++this.round >= this.rounds) { this.complete(this.values()); return; }
      this.next();
    } else {
      this.wrong++; audio.play('wrong');
      if (button) { button.classList.add('ng-wrong'); button.disabled = true; }
      this.refresh();
    }
  }
}
