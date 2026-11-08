import { RestoredGame, tr, escapeHTML } from './restored-game.js';
import { arrayValue } from '../original.js';
import { audio } from '../audio.js';
import { i18n } from '../i18n.js';
import { loadResources, drawFrame, drawTiled, drawBorderSection, rect, numbers, rgba, canvasPoint } from './amaze-canvas.js';
import * as M from './numbers-model.js';

// Numbers window (numbers_wnd) is 480x715 layout units below the 85-unit top bar.
const WIDTH = 480, HEIGHT = 715;
const TICK_MS = 66; // animation step of the original field (number_disappear_speed per step)

export class NumbersGame extends RestoredGame {
  id = 'numbers';
  get title() { return tr('Числа', 'Numbers'); }

  async init(difficulty = 'easy') {
    if (!await this.begin(difficulty)) return;
    const generation = this.generation;
    const g = this.original;
    this.cfg = g.numbers_game_field;
    this.fieldRect = rect(this.cfg.rect);
    [this.cellW, this.cellH] = numbers(this.cfg.field_number_size);
    const borders = [g.numbers_field_border, g.numbers_bottom_border];
    const ids = [this.cfg.numbers_big, this.cfg.inc_scores_tile, this.cfg.dec_scores_tile,
      g.numbers_bottom_accept_move_btn.rel_ID, g.numbers_bottom_accept_move_btn.pres_ID,
      ...borders.flatMap(b => [b.left_tile, b.top_tile, b.right_tile, b.bott_tile]).filter(Boolean)];
    this.res = await loadResources([...new Set(ids)]);
    this.background = await new Promise(resolve => {
      const image = new Image(); image.onload = () => resolve(image); image.onerror = () => resolve(null);
      image.src = 'assets/textures/Main_Back.png';
    });
    if (generation !== this.generation || this.destroyed) return;

    this.rand = M.createRandom(Date.now());
    this.field = M.createField(this.diff, this.rand);
    this.points = 0; this.wrong = 0; this.moves = 0; this.removedTotal = 0;
    this.vanishing = []; this.wrongFlash = 0; this.popup = null;
    this.nextTask();
    this.render();
    this.tick(() => { this.elapsed++; this.updateTime(); });
    this.animate();
  }

  nextTask() {
    this.digit = M.chooseDigit(this.field, this.diff, this.rand);
    this.cursor = M.startCell(this.diff);
  }

  render() {
    const btn = this.original.numbers_bottom_accept_move_btn;
    const bottom = rect(this.original.numbers_bottom.rect);
    const btnRect = rect(btn.rect), text = rect(this.original.numbers_bottom_task_txt.text_rect);
    const pct = (value, total) => `${value / total * 100}%`;
    const accept = this.res[btn.rel_ID], pressed = this.res[btn.pres_ID];
    this.frame(this.title, `<div class="numbers-stage" style="aspect-ratio:${WIDTH}/${HEIGHT}">
        <canvas class="numbers-canvas" width="${WIDTH}" height="${HEIGHT}" data-numbers-canvas tabindex="0"
          aria-label="${tr('Игровое поле. Стрелки перемещают число, Enter принимает ход.', 'Game field. Arrows move the number, Enter accepts the move.')}"></canvas>
        <button class="numbers-accept" data-confirm aria-label="${tr('Принять ход', 'Accept move')}"
          style="left:${pct(btnRect.x, WIDTH)};top:${pct(bottom.y + btnRect.y, HEIGHT)};width:${pct(accept.width, WIDTH)};height:${pct(accept.height, HEIGHT)};
          --rel:url('${accept.image.src}');--pr:url('${pressed.image.src}')"></button>
        <div class="numbers-task" data-task aria-live="polite"
          style="left:${pct(text.x, WIDTH)};top:${pct(bottom.y + text.y, HEIGHT)};width:${pct(text.w, WIDTH)};height:${pct(text.h, HEIGHT)}"></div>
      </div>`);
    const pause = this.container.querySelector('.amaze-pause-bar');
    pause.insertAdjacentHTML('beforeend', '<span class="numbers-time" data-time></span>');
    this.canvas = this.container.querySelector('[data-numbers-canvas]');
    this.ctx = this.canvas.getContext('2d');
    this.canvas.addEventListener('pointerdown', event => { this.dragging = true; this.canvas.setPointerCapture?.(event.pointerId); this.pointTo(event); });
    this.canvas.addEventListener('pointermove', event => { if (this.dragging) this.pointTo(event); });
    this.canvas.addEventListener('pointerup', () => { this.dragging = false; });
    this.canvas.addEventListener('keydown', event => this.onKey(event));
    this.container.querySelector('[data-confirm]').onclick = () => this.acceptMove();
    this.updateTask(); this.updateTime(); this.draw();
  }

  updateTask() {
    const el = this.container.querySelector('[data-task]');
    if (!el) return;
    const format = i18n.t('Find Sum:\\n%d or %d or %d, ...');
    let n = 0; const values = [this.digit, this.digit + 10, this.digit + 20];
    el.innerHTML = escapeHTML(format.replace(/%d/g, () => values[n++])).replace(/\\n/g, '<br>');
  }

  updateTime() {
    const el = this.container.querySelector('[data-time]');
    if (el) el.textContent = `${String(Math.floor(this.elapsed / 60)).padStart(2, '0')}:${String(this.elapsed % 60).padStart(2, '0')}`;
  }

  pointTo(event) {
    if (!this.playable) return;
    const p = canvasPoint(this.canvas, event);
    const cell = M.cellAtPoint(this.field, p.x - this.fieldRect.x, p.y - this.fieldRect.y, this.cellW, this.cellH);
    if (cell) { this.cursor = cell; this.draw(); }
  }

  onKey(event) {
    if (!this.playable) return;
    const steps = {ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]};
    if (steps[event.key]) {
      this.cursor = M.stepCursor(this.field, this.cursor.x, this.cursor.y, ...steps[event.key]);
      event.preventDefault(); this.draw();
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault(); this.acceptMove();
    }
  }

  acceptMove() {
    if (!this.playable) return;
    const {x, y} = this.cursor;
    const before = this.field.slice();
    const result = M.acceptMove(this.field, x, y, this.digit);
    if (!result.valid) return;
    const center = {x: x * this.cellW + this.cellW / 2, y: y * this.cellH + this.cellH / 2};
    if (!result.correct) {
      const penalty = arrayValue(this.cfg.points_wrong_move_arr, this.diff);
      this.points += penalty; this.wrong++;
      this.wrongFlash = Number(this.cfg.wrong_move_time);
      this.showPopup(penalty, center);
      audio.play('wrong');
      this.draw();
      return;
    }
    // Neighbours and the placed number shrink away together.
    result.removed.forEach(index => this.vanishing.push({index, value: before[index], inset: 0}));
    this.vanishing.push({index: M.index(x, y), value: this.digit, inset: 0});
    const gain = result.count * arrayValue(this.cfg.points_good_move_arr, this.diff);
    this.points += gain; this.moves++; this.removedTotal += result.count;
    this.showPopup(gain, center);
    audio.play('good');
    if (M.isCleared(this.field)) { this.finishGame(); return; }
    this.nextTask(); this.updateTask(); this.draw();
  }

  showPopup(value, at) { this.popup = {text: value >= 0 ? `+${value}` : `${value}`, positive: value >= 0, ...at, alpha: numbers(this.cfg.scores_show_param)[0], age: 0}; }

  animate() {
    const generation = this.generation;
    const step = () => {
      if (generation !== this.generation || this.destroyed) return;
      if (!this.isPaused && !document.hidden) this.advance();
      this.animationTimer = setTimeout(step, TICK_MS);
    };
    this.animationTimer = setTimeout(step, TICK_MS);
  }

  advance() {
    const speed = Math.abs(Number(this.cfg.number_disappear_speed) || 2);
    let changed = false;
    this.vanishing.forEach(item => { item.inset += speed; changed = true; });
    this.vanishing = this.vanishing.filter(item => item.inset < this.cellW / 2);
    if (this.wrongFlash > 0) { this.wrongFlash--; changed = true; }
    if (this.popup) {
      const [, maxAlpha, hold, fade] = numbers(this.cfg.scores_show_param);
      this.popup.age++;
      if (this.popup.age * TICK_MS > hold * 10) this.popup.alpha -= fade; else this.popup.alpha = Math.min(maxAlpha, this.popup.alpha + fade);
      if (this.popup.alpha <= 0) this.popup = null;
      changed = true;
    }
    if (changed) this.draw();
  }

  draw() {
    const ctx = this.ctx;
    if (!ctx || !this.field) return;
    const g = this.original, f = this.fieldRect, big = this.res[this.cfg.numbers_big];
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    if (this.background) ctx.drawImage(this.background, 0, 0, WIDTH, HEIGHT);
    drawBorderSection(ctx, g.numbers_field_border, this.res);
    drawBorderSection(ctx, g.numbers_bottom_border, this.res);
    ctx.save();
    const clip = rect(this.cfg.draw_clip_rect);
    ctx.beginPath(); ctx.rect(f.x + clip.x, f.y + clip.y, clip.w, clip.h); ctx.clip();
    for (let x = 0; x < M.SIZE; x++) for (let y = 0; y < M.SIZE; y++) {
      const value = this.field[M.index(x, y)];
      if (value === M.NONE) continue;
      drawFrame(ctx, big, value === M.EMPTY ? M.EMPTY : value, f.x + x * this.cellW, f.y + y * this.cellH);
    }
    // A removed number shrinks towards its centre and fades out (FUN_4a035288).
    for (const item of this.vanishing) {
      const x = Math.floor(item.index / M.SIZE), y = item.index % M.SIZE, inset = item.inset;
      const size = Math.max(0, this.cellW - inset * 2), h = Math.max(0, this.cellH - inset * 2);
      ctx.save();
      ctx.globalAlpha = Math.max(0, 255 - Math.floor(inset * 255 / (this.cellW / 2))) / 255;
      ctx.drawImage(big.image, 0, item.value * big.frame_height, big.width, big.frame_height,
        f.x + x * this.cellW + inset, f.y + y * this.cellH + inset, size, h);
      ctx.restore();
    }
    if (this.playable || this.isPaused) this.drawCursor(ctx, big);
    ctx.restore();
    if (this.wrongFlash > 0) {
      const w = rect(this.cfg.wrong_move_rect);
      ctx.strokeStyle = rgba(this.cfg.wrong_move_color);
      for (let i = 0; i < Number(this.cfg.wrong_move_thick); i++)
        ctx.strokeRect(f.x + w.x + i + 0.5, f.y + w.y + i + 0.5, w.w - 2 * i - 1, w.h - 2 * i - 1);
    }
    if (this.popup) this.drawPopup(ctx);
  }

  drawCursor(ctx, big) {
    const f = this.fieldRect, {x, y} = this.cursor;
    drawFrame(ctx, big, this.digit, f.x + x * this.cellW, f.y + y * this.cellH);
    // The 3x3 neighbourhood frame: white / red / white lines, inset one pixel per line.
    const [ol, ot, or, ob] = numbers(this.cfg.border_offset);
    let l = f.x + (x - 1) * this.cellW - ol, t = f.y + (y - 1) * this.cellH - ot;
    let r = f.x + (x + 2) * this.cellW + or, b = f.y + (y + 2) * this.cellH + ob;
    const lines = (count, color) => {
      for (let i = 0; i < count; i++) {
        l++; t++; r--; b--;
        ctx.strokeStyle = color; ctx.lineWidth = 1;
        ctx.strokeRect(l + 0.5, t + 0.5, r - l - 1, b - t - 1);
      }
    };
    const white = rgba(this.cfg.border1_color, Number(this.cfg.border1_transparent));
    lines(Number(this.cfg.border1_thick), white);
    lines(Number(this.cfg.border_thick), rgba(this.cfg.border_color, Number(this.cfg.border_transparent)));
    lines(Number(this.cfg.border1_thick), white);
  }

  drawPopup(ctx) {
    const p = this.popup, tile = this.res[p.positive ? this.cfg.inc_scores_tile : this.cfg.dec_scores_tile];
    const [padding] = numbers(this.cfg.scores_text_param);
    ctx.save();
    ctx.font = 'bold 24px Arial, sans-serif';
    const width = Math.ceil(ctx.measureText(p.text).width) + padding;
    const h = tile.frame_height || tile.height;
    let x = Math.round(this.fieldRect.x + p.x - width / 2), y = Math.round(this.fieldRect.y + p.y - h / 2);
    x = Math.max(this.fieldRect.x, Math.min(this.fieldRect.r - width, x));
    ctx.globalAlpha = Math.max(0, Math.min(255, p.alpha)) / 255;
    const drawn = drawTiled(ctx, tile, x, y, width);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(p.text, x + drawn / 2, y + h / 2 + 1);
    ctx.restore();
  }

  finishGame() {
    const penalty = arrayValue(this.cfg.time_penalty_arr, this.diff);
    const seconds = Math.max(1, this.elapsed);
    const total = M.totalScore(this.points, seconds, penalty);
    this.draw();
    const section = this.original[this.mode === 'marking' ? 'numbers_sp_show_results' : 'numbers_show_results'];
    this.finish(total, {section, values: {DIST: this.points, TIME: seconds, TOTAL: total}});
  }

  destroy() {
    clearTimeout(this.animationTimer);
    super.destroy();
  }
}
