import { RestoredGame, tr, escapeHTML } from './restored-game.js';
import { createRandom } from '../original.js';
import { audio } from '../audio.js';
import { i18n } from '../i18n.js';
import { loadResources, drawFrame, drawBorderSection, rect, numbers, rgba, canvasPoint } from './amaze-canvas.js';
import * as M from './memorics-model.js';

// cr_game_wnd: 480x715 layout units below the top bar. Memorics is COLORRECTS (102).
const WIDTH = 480, HEIGHT = 715, TICK_MS = 66, DONE_TICK_MS = 100;
const clean = value => String(value ?? '').trim().split(/\s+/)[0];

export class MemoricsGame extends RestoredGame {
  id = 'memorics';
  get title() { return 'Memorics'; }

  async init(difficulty = 'easy') {
    if (!await this.begin(difficulty)) return;
    const generation = this.generation, g = this.original;
    this.level = g[`cr_lev_${this.diff + (this.mode === 'marking' ? 3 : 0)}`];
    this.show = g.cr_show_field; this.demo = g.cr_demo_field;
    this.fieldRect = rect(this.demo.field_rect);
    this.figureIds = {};
    for (let form = 1; form <= 4; form++) for (let state = 1; state <= 3; state++) for (let color = 1; color <= 4; color++)
      this.figureIds[`${form}.${state}.${color}`] = clean(g[`cr_figure_${form}`][`state_${state}_col${color}_img`]);
    const borders = [g.cr_demo_field_border, g.cr_bottom_border];
    const ids = [this.show.tile_img, g.cr_time_picture.image, clean(g.cr_skip_btn.rel_ID), clean(g.cr_skip_btn.pres_ID),
      clean(g.cr_next_btn.rel_ID), clean(g.cr_next_btn.pres_ID), ...Object.values(this.figureIds),
      ...borders.flatMap(b => [b.left_tile, b.top_tile, b.right_tile, b.bott_tile]).filter(id => id && id !== '0')];
    this.res = await loadResources([...new Set(ids)]);
    this.background = await new Promise(resolve => {
      const image = new Image(); image.onload = () => resolve(image); image.onerror = () => resolve(null);
      image.src = 'assets/textures/Main_Back.png';
    });
    if (generation !== this.generation || this.destroyed) return;
    this.rand = createRandom(Date.now());
    this.rounds = Number(clean(this.level.m_nShowCount)) + Number(clean(this.level.m_nHowmuchCount));
    this.roundIndex = 0; this.right = 0; this.wrong = 0; this.ticks = 0; this.wrongFlash = 0;
    this.render();
    this.startRound();
    this.tick(() => {
      this.elapsed++; this.updateTime();
      if (this.phase === 'remember' && --this.remaining <= 0) this.startAnswer(); else this.updateTexts();
    });
    this.animate();
  }

  figureFrames(form, state) { return this.res[this.figureIds[`${form}.${state}.1`]]?.frames || 1; }
  figureRes(f) { return this.res[this.figureIds[`${f.form}.${f.state}.${f.color}`]]; }

  startRound() {
    this.round = M.createRound(this.level, this.rand, (form, state) => this.figureFrames(form, state));
    this.answer = {tries: this.round.tries, found: new Set(), crossed: new Set(), right: 0, wrong: 0};
    this.phase = 'remember';
    this.remaining = Number(clean(this.level.m_nDemoTime));
    this.updateTexts(); this.draw();
  }

  startAnswer() {
    if (!this.playable || this.phase !== 'remember') return;
    this.phase = 'answer';
    this.updateTexts(); this.draw();
  }

  tapSlot(slot) {
    if (!this.playable || this.phase !== 'answer') return;
    const right = M.tap(this.round, this.answer, slot);
    if (right === null) return;
    if (right) { this.right++; audio.play('good'); }
    else { this.wrong++; this.wrongFlash = Number(this.show.wrong_move_time); audio.play('wrong'); }
    if (this.answer.tries <= 0) {
      this.phase = 'done';
      const generation = this.generation;
      // Original field appears after g_nDoneShowTimer ticks (CCR_ShowField::v19).
      this.doneTimer = setTimeout(() => {
        if (generation !== this.generation || this.destroyed) return;
        this.phase = 'review'; this.updateTexts(); this.draw();
      }, Number(this.original.cr_game_wnd.g_nDoneShowTimer) * DONE_TICK_MS);
    }
    this.updateTexts(); this.draw();
  }

  nextRound() {
    if (!this.playable || this.phase !== 'review') return;
    audio.play('click');
    if (++this.roundIndex >= this.rounds) { this.finishGame(); return; }
    this.startRound();
  }

  questionText() {
    const lib = this.original.cr_figures_lib, parts = M.questionParts(this.round.question);
    const words = [];
    if (parts.state) words.push(i18n.t(lib[`cr_state${parts.state}_show`]));
    if (parts.color) words.push(i18n.t(lib[`cr_col${parts.color}_show`]));
    if (parts.form) words.push(i18n.t(this.original[`cr_figure_${parts.form}`].show_quest));
    const end = parts.form ? lib.cr_quest_show_end : lib.cr_quest_color_show_end;
    return `${i18n.t(lib.cr_quest_show_begin)}\n${words.join(' ')} ${i18n.t(end)}`;
  }

  render() {
    const g = this.original, bottom = rect(g.cr_gmb_bottom.rect);
    const at = (r, dy = 0) => `left:${r.x / WIDTH * 100}%;top:${(r.y + dy) / HEIGHT * 100}%;width:${r.w / WIDTH * 100}%;height:${r.h / HEIGHT * 100}%`;
    const button = (cfg, name, dy) => {
      const rel = this.res[clean(cfg.rel_ID)], pr = this.res[clean(cfg.pres_ID)], r = rect(cfg.rect);
      return `<button class="cr-btn" data-${name} style="${at({x: r.x, y: r.y, w: rel.width, h: rel.height}, dy)};--rel:url('${rel.image.src}');--pr:url('${pr.image.src}')"
        aria-label="${name === 'skip' ? tr('Пропустить', 'Skip') : tr('Далее', 'Next')}"></button>`;
    };
    const timer = rect(g.cr_time_txt.text_rect);
    this.frame(this.title, `<div class="amaze-stage cr-stage" style="aspect-ratio:${WIDTH}/${HEIGHT}">
        <canvas class="amaze-stage-canvas" width="${WIDTH}" height="${HEIGHT}" data-cr-canvas
          aria-label="${tr('Поле Memorics: 6 столбцов, 5 строк', 'Memorics field: 6 columns, 5 rows')}"></canvas>
        <div class="amaze-stage-text cr-text" data-text aria-live="polite"></div>
        <div class="amaze-stage-text cr-tries" data-tries style="${at(rect(g.cr_tryesleft_txt.text_rect))}" aria-live="polite"></div>
        <div class="amaze-stage-text cr-timer" data-timer style="${at(timer, bottom.y)}"></div>
        ${button(g.cr_skip_btn, 'skip', bottom.y)}${button(g.cr_next_btn, 'next', 0)}
      </div>`);
    this.container.querySelector('.amaze-pause-bar').insertAdjacentHTML('beforeend', '<span class="amaze-stage-time" data-time></span>');
    this.canvas = this.container.querySelector('[data-cr-canvas]');
    this.ctx = this.canvas.getContext('2d');
    this.canvas.addEventListener('pointerdown', event => {
      const p = canvasPoint(this.canvas, event), f = this.fieldRect, size = this.res[this.show.tile_img].width;
      const col = Math.floor((p.x - f.x) / size), row = Math.floor((p.y - f.y) / size);
      if (col >= 0 && col < M.COLS && row >= 0 && row < M.ROWS) this.tapSlot(row * M.COLS + col);
    });
    this.container.querySelector('[data-skip]').onclick = () => { audio.play('click'); this.startAnswer(); };
    this.container.querySelector('[data-next]').onclick = () => this.nextRound();
    this.updateTime();
  }

  updateTexts() {
    const g = this.original, text = this.container.querySelector('[data-text]');
    if (!text || !this.round) return;
    const place = r => Object.assign(text.style, {left: `${r.x / WIDTH * 100}%`, top: `${r.y / HEIGHT * 100}%`, width: `${r.w / WIDTH * 100}%`, height: `${r.h / HEIGHT * 100}%`});
    let message;
    if (this.phase === 'remember') { place(rect(g.cr_remember_txt.text_rect)); message = i18n.t(g.cr_remember_txt.text); }
    else if (this.phase === 'review') { place(rect(g.cr_original_txt.text_rect)); message = i18n.t(g.cr_original_txt.text); }
    else { place(rect(g.cr_show_txt.text_rect)); message = this.questionText(); }
    text.innerHTML = escapeHTML(message).replace(/\n|\\n/g, '<br>');
    const tries = this.container.querySelector('[data-tries]');
    tries.hidden = this.phase === 'remember' || this.phase === 'review';
    tries.textContent = i18n.t(g.cr_tryesleft_txt.text).replace('%d', this.answer.tries);
    this.container.querySelector('[data-timer]').hidden = this.phase !== 'remember';
    this.container.querySelector('[data-timer]').textContent = Math.max(0, this.remaining);
    this.container.querySelector('[data-skip]').hidden = this.phase !== 'remember';
    this.container.querySelector('[data-next]').hidden = this.phase !== 'review';
  }

  updateTime() {
    const el = this.container.querySelector('[data-time]');
    if (el) el.textContent = `${String(Math.floor(this.elapsed / 60)).padStart(2, '0')}:${String(this.elapsed % 60).padStart(2, '0')}`;
  }

  animate() {
    const generation = this.generation;
    const step = () => {
      if (generation !== this.generation || this.destroyed) return;
      if (!this.isPaused && !document.hidden) {
        this.ticks++;
        if (this.wrongFlash > 0) this.wrongFlash--;
        this.draw();
      }
      this.animationTimer = setTimeout(step, TICK_MS);
    };
    this.animationTimer = setTimeout(step, TICK_MS);
  }

  draw() {
    const ctx = this.ctx, g = this.original;
    if (!ctx || !this.round) return;
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    if (this.background) ctx.drawImage(this.background, 0, 0, WIDTH, HEIGHT);
    drawBorderSection(ctx, g.cr_demo_field_border, this.res);
    drawBorderSection(ctx, g.cr_bottom_border, this.res);
    const tile = this.res[this.show.tile_img], f = this.fieldRect, size = tile.width;
    const showAll = this.phase === 'remember' || this.phase === 'review';
    for (let slot = 0; slot < M.SLOTS; slot++) {
      const x = f.x + (slot % M.COLS) * size, y = f.y + Math.floor(slot / M.COLS) * size;
      const frame = showAll ? 0 : this.answer.found.has(slot) ? 1 : this.answer.crossed.has(slot) ? 2 : 0;
      drawFrame(ctx, tile, frame, x, y);
      const figure = this.round.figures.find(item => item.slot === slot);
      if (figure && (showAll || this.answer.found.has(slot))) {
        const res = this.figureRes(figure);
        const anim = numbers(g[`cr_figure_${figure.form}`][`state_${figure.state}_animparam`]);
        const speed = Math.max(1, anim[1] || 1);
        const frameIndex = anim[0] ? (figure.frame + Math.floor(this.ticks / speed)) % res.frames : 0;
        drawFrame(ctx, res, frameIndex, x, y);
      }
    }
    if (this.phase === 'remember') {
      const picture = rect(g.cr_time_picture.image_rect), bottom = rect(g.cr_gmb_bottom.rect);
      drawFrame(ctx, this.res[g.cr_time_picture.image], 0, picture.x, bottom.y + picture.y);
    }
    if (this.wrongFlash > 0) {
      const w = rect(this.show.wrong_move_rect);
      ctx.strokeStyle = rgba(this.show.wrong_move_color);
      for (let i = 0; i < Number(this.show.wrong_move_thick); i++) ctx.strokeRect(w.x + i + 0.5, w.y + i + 0.5, w.w - 2 * i - 1, w.h - 2 * i - 1);
    }
  }

  finishGame() {
    const cfg = this.original.cr_game_wnd, prefix = ['Easy', 'Med', 'Hard'][this.diff];
    const score = M.totalScore(this.right, this.wrong, Number(cfg[`g_nCR${prefix}LevelCost`]), Number(cfg[`g_nCR${prefix}WrongAnswerCfx`]));
    this.finish(score.total, {section: this.original.cr_show_results,
      values: {P1: this.right, P2: this.wrong, P7: score.perRight, P8: score.perWrong, TOTAL: score.total}});
  }

  destroy() {
    clearTimeout(this.animationTimer); clearTimeout(this.doneTimer);
    super.destroy();
  }
}
