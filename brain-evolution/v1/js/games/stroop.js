// Colour and Word (Stroop test), made for the web (PLAN 5): a colour name is written in another
// colour; the player taps the colour of the ink. Attention and the control of automatic reactions.
import { NewGame } from './new-game.js';
import { tr, escapeHTML } from './restored-game.js';
import { i18n } from '../i18n.js';
import { audio } from '../audio.js';
import * as M from './new-games-model.js';

export class StroopGame extends NewGame {
  id = 'stroop';
  async init(difficulty = 'easy') {
    if (!await this.begin(difficulty)) return;
    this.rounds = this.param('rounds');
    this.colorCount = this.param('colors');
    this.mismatch = this.param('mismatch_percent');
    this.shuffleButtons = this.param('shuffle_buttons') > 0;
    this.round = 0; this.right = 0; this.wrong = 0; this.current = null;
    this.order = Array.from({length: this.colorCount}, (_, i) => i);
    this.render();
    this.next();
    this.tick(() => { this.elapsed++; this.refresh(); });
  }
  values() { return {P1: this.right, P2: this.wrong, TIME: this.elapsed}; }
  refresh() {
    this.refreshScore(this.values());
    this.setStatus(`${Math.min(this.round + 1, this.rounds)}/${this.rounds} · ${this.elapsed} ${tr('с', 's')}`);
  }
  render() {
    this.frame(this.title, `<p class="restored-instruction">${escapeHTML(i18n.t('Tap the colour of the ink, not the word.'))}</p>
      <div class="ng-stage"><div class="ng-stroop-word" data-word aria-live="polite"></div>
      <div class="ng-stroop-buttons" data-buttons></div></div>`);
    this.refresh();
  }
  next() {
    this.current = M.stroopRound(this.colorCount, this.mismatch, Math.random, this.current);
    if (this.shuffleButtons) this.order = M.shuffled(this.order); // hard: the buttons move every round
    const word = M.STROOP_COLORS[this.current.word], ink = M.STROOP_COLORS[this.current.ink];
    const el = this.container.querySelector('[data-word]');
    el.textContent = i18n.t(word.key).toLocaleUpperCase(document.documentElement.lang || undefined);
    el.style.color = ink.rgb;
    const buttons = this.container.querySelector('[data-buttons]');
    buttons.innerHTML = this.order.map(i => `<button class="ng-color-btn" data-color="${i}" style="--c:${M.STROOP_COLORS[i].rgb}"
      aria-label="${escapeHTML(i18n.t(M.STROOP_COLORS[i].key))}"></button>`).join('');
    buttons.querySelectorAll('[data-color]').forEach(btn => btn.onclick = () => this.answer(Number(btn.dataset.color), btn));
    this.refresh();
  }
  answer(color, button) {
    if (!this.playable) return;
    if (color === this.current.ink) {
      this.right++; audio.play('good');
      if (++this.round >= this.rounds) { this.complete(this.values()); return; }
      this.next();
    } else {
      this.wrong++; audio.play('wrong');
      button?.classList.add('ng-wrong');
      this.refresh();
    }
  }
}
