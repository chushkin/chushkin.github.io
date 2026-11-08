import { RestoredGame, tr, escapeHTML } from './restored-game.js';
import { arrayValue, createRandom } from '../original.js';
import { audio } from '../audio.js';
import { i18n } from '../i18n.js';
import { loadResources, drawFrame, drawBorderSection, rect, numbers, rgba } from './spb-canvas.js';
import * as M from './arithmetics-model.js';

// cc_game_wnd: 480x715 layout units. The chain is shown in the edit window with the cc_numbers sprite:
// frames 0-9 digits, 10 '?', 11 '-', 12 '+', 13 '/', 14 '*', 15 '='.
const WIDTH = 480, HEIGHT = 715, TICK_MS = 66;
const GLYPH = {'?': 10, '-': 11, '+': 12, '/': 13, '*': 14, '=': 15};
const clean = value => String(value ?? '').trim().split(/\s+/)[0];

export class ArithmeticsGame extends RestoredGame {
  id = 'arithmetics';
  get title() { return tr('Арифметика', 'Arithmetics'); }

  async init(difficulty = 'easy') {
    if (!await this.begin(difficulty)) return;
    const generation = this.generation, g = this.original;
    this.level = M.levelParams(g[`cc_lev_${this.diff + (this.mode === 'marking' ? 3 : 0)}`]);
    this.edit = g.cc_edit_wnd;
    this.buttons = Array.from({length: Number(g.cc_lev_buttons.buttons_count)}, (_, i) => g[`cc_answer_lev_btn${i + 1}`]);
    const ids = [this.edit.edit_img, this.edit.numbers_img, clean(g.cc_answer_lev_bckspc_btn.rel_ID), clean(g.cc_answer_lev_bckspc_btn.pres_ID),
      clean(this.buttons[0].rel_ID), clean(this.buttons[0].pres_ID)];
    this.res = await loadResources([...new Set(ids)]);
    this.background = await new Promise(resolve => {
      const image = new Image(); image.onload = () => resolve(image); image.onerror = () => resolve(null);
      image.src = 'assets/textures/Main_Back.png';
    });
    if (generation !== this.generation || this.destroyed) return;
    this.rand = createRandom(Date.now());
    this.right = 0; this.wrong = 0; this.input = ''; this.wrongFlash = 0;
    this.left = this.level.steps;
    const a = M.firstValue(this.level, this.rand);
    this.step = M.nextStep(a, undefined, this.level, this.diff, this.rand);
    this.render();
    this.tick(() => { this.elapsed++; this.updateTime(); });
    this.keyHandler = event => {
      if (!this.playable || event.ctrlKey || event.metaKey || event.altKey) return;
      if (/^\d$/.test(event.key)) this.press(event.key);
      else if (event.key === 'Backspace') { event.preventDefault(); this.backspace(); }
    };
    window.addEventListener('keydown', this.keyHandler);
    this.animate();
  }

  get currentProblem() { return {a: this.step.a, b: this.step.b, op: M.OPS[this.step.op], ans: this.step.result}; }

  render() {
    const g = this.original, pct = (v, t) => `${v / t * 100}%`;
    const rel = this.res[clean(this.buttons[0].rel_ID)], pr = this.res[clean(this.buttons[0].pres_ID)];
    const back = g.cc_answer_lev_bckspc_btn, backRel = this.res[clean(back.rel_ID)], backPr = this.res[clean(back.pres_ID)];
    const place = (r, w, h) => `left:${pct(r.x, WIDTH)};top:${pct(r.y, HEIGHT)};width:${pct(w, WIDTH)};height:${pct(h, HEIGHT)}`;
    const keys = this.buttons.map(cfg => {
      const r = rect(cfg.rect);
      return `<button class="cc-key" data-digit="${cfg.text}" style="${place(r, rel.width, rel.height)};--rel:url('${rel.image.src}');--pr:url('${pr.image.src}')">${escapeHTML(cfg.text)}</button>`;
    }).join('');
    const ops = rect(g.cc_operations_txt.text_rect);
    this.frame(this.title, `<div class="spb-stage cc-stage" style="aspect-ratio:${WIDTH}/${HEIGHT}">
        <canvas class="spb-stage-canvas" width="${WIDTH}" height="${HEIGHT}" data-cc-canvas role="img" aria-label="${tr('Цепочка вычислений', 'Calculation chain')}"></canvas>
        <div class="spb-stage-text" data-operations style="${place(ops, ops.w, ops.h)}" aria-live="polite"></div>
        <div class="visually-hidden" id="answerDisplay" aria-live="polite"></div>
        ${keys}
        <button class="cc-key cc-backspace" data-backspace aria-label="${tr('Стереть цифру', 'Backspace')}"
          style="${place(rect(back.rect), backRel.width, backRel.height)};--rel:url('${backRel.image.src}');--pr:url('${backPr.image.src}')">${escapeHTML(back.text)}</button>
      </div>`);
    this.container.querySelector('.spb-pause-bar').insertAdjacentHTML('beforeend', '<span class="spb-stage-time" data-time></span>');
    this.canvas = this.container.querySelector('[data-cc-canvas]');
    this.ctx = this.canvas.getContext('2d');
    this.container.querySelectorAll('[data-digit]').forEach(button => button.onclick = () => this.press(button.dataset.digit));
    this.container.querySelector('[data-backspace]').onclick = () => this.backspace();
    this.updateTexts(); this.updateTime(); this.draw();
  }

  get expected() { return String(this.step.result); }

  press(digit) {
    if (!this.playable) return;
    audio.play('click');
    this.input += digit;
    // The answer is checked as soon as it has as many digits as the right result.
    if (this.input.length >= this.expected.length) this.check(); else { this.updateTexts(); this.draw(); }
  }

  backspace() {
    if (!this.playable || !this.input) return;
    this.input = this.input.slice(0, -1); this.updateTexts(); this.draw();
  }

  check() {
    if (this.input !== this.expected) {
      this.wrong++; this.input = ''; this.wrongFlash = Number(clean(this.edit.wrong_move_time));
      audio.play('wrong');
      this.updateTexts(); this.draw();
      return;
    }
    this.right++; this.left--;
    audio.play('good');
    this.input = '';
    if (this.left <= 0) { this.finishGame(); return; }
    const previous = this.step.a;
    this.step = M.nextStep(this.step.result, previous, this.level, this.diff, this.rand);
    this.updateTexts(); this.draw();
  }

  submitAnswer() { if (this.input) this.check(); }
  set userInput(value) { this.input = String(value); }
  get userInput() { return this.input; }

  // FUN_4a11080c rebuilds the edit text for every step: "%d" of the current value, then the
  // operation ("+%d", "-%d", ...), so only the current example is shown, not the previous ones.
  chainText(withInput = true) {
    const s = this.step;
    return `${s.a}${M.OPS[s.op]}${s.b}=${withInput ? `${this.input}?` : s.result}`;
  }

  updateTexts() {
    const ops = this.container.querySelector('[data-operations]');
    if (ops) ops.textContent = i18n.t(this.original.cc_operations_txt.text).replace('%d', this.left);
    const display = this.container.querySelector('#answerDisplay');
    if (display) display.textContent = `${this.step.a} ${M.OPS[this.step.op]} ${this.step.b} = ${this.input || '?'}`;
  }

  updateTime() {
    const el = this.container.querySelector('[data-time]');
    if (el) el.textContent = `${String(Math.floor(this.elapsed / 60)).padStart(2, '0')}:${String(this.elapsed % 60).padStart(2, '0')}`;
  }

  animate() {
    const generation = this.generation;
    const step = () => {
      if (generation !== this.generation || this.destroyed) return;
      if (!this.isPaused && this.wrongFlash > 0) { this.wrongFlash--; this.draw(); }
      this.animationTimer = setTimeout(step, TICK_MS);
    };
    this.animationTimer = setTimeout(step, TICK_MS);
  }

  draw() {
    const ctx = this.ctx, g = this.original;
    if (!ctx) return;
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    if (this.background) ctx.drawImage(this.background, 0, 0, WIDTH, HEIGHT);
    drawBorderSection(ctx, g.cc_toolbar_lev_border, this.res);
    const panel = this.res[this.edit.edit_img], digits = this.res[this.edit.numbers_img];
    const x = Math.round((WIDTH - panel.width) / 2), y = Number(g.cc_field.m_nEditRectTop);
    drawFrame(ctx, panel, 0, x, y);
    const [side] = numbers([].concat(this.edit.leftright_border_thickness)[0]);
    const [top] = numbers([].concat(this.edit.updown_border_thickness)[0]);
    const inner = {x: x + side, y: y + top, w: panel.width - side * 2};
    const text = this.chainText(true);
    const glyphs = [...text].map(ch => GLYPH[ch] ?? Number(ch));
    const offset = Math.min(0, inner.w - glyphs.length * digits.width);
    ctx.save();
    ctx.beginPath(); ctx.rect(inner.x, y, inner.w, panel.height); ctx.clip();
    glyphs.forEach((frame, i) => drawFrame(ctx, digits, frame, inner.x + offset + i * digits.width, inner.y));
    ctx.restore();
    if (this.wrongFlash > 0) {
      const dx = Number(clean(this.edit.wrong_move_x_offset)), dy = Number(clean(this.edit.wrong_move_y_offset));
      ctx.strokeStyle = rgba(this.edit.wrong_move_color);
      const thick = Number(clean([].concat(this.edit.wrong_move_thick)[0]));
      for (let i = 0; i < thick; i++) ctx.strokeRect(x + dx + i + 0.5, y + dy + i + 0.5, panel.width - 2 * dx - 2 * i - 1, panel.height - 2 * dy - 2 * i - 1);
    }
  }

  finishGame() {
    const r = this.original.cc_show_results;
    const points = [r.i1_points_arr, r.i2_points_arr, r.i3_points_arr].map(v => arrayValue(v, this.diff));
    const seconds = Math.max(1, this.elapsed);
    const total = M.totalScore(this.right, this.wrong, seconds, ...points);
    this.finish(total, {section: r, values: {P1: this.right, P2: this.wrong, TIME: seconds, TOTAL: total}});
  }

  destroy() {
    clearTimeout(this.animationTimer);
    super.destroy();
    if (this.keyHandler) window.removeEventListener('keydown', this.keyHandler);
  }
}
