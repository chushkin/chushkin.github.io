// Amaze Brain Evolution - Authentic Matches (Спички) Mini-Game
// Pixel-perfect restoration based on original binary and layout specs (_MATCHES_INO.ino & _MATCHES_LEVELS_INO.ino)

import { audio } from '../audio.js';
import { storage } from '../storage.js';
import { i18n } from '../i18n.js';
import { isSolved, pickLevel, score as matchesScore, slotMap, taskKind } from './matches-model.js';
import { loadOriginalConfig, arrayValue, createRandom, difficultyIndex } from '../original.js';
import { buildResults, resultsMarkup, showResultsLayer } from './results-window.js';

export class MatchesGame {
  constructor(container, onComplete, onOpenMenu, onOpenHelp) {
    this.container = container;
    this.defer = (callback, delay) => setTimeout(callback, delay);
    this.onComplete = onComplete;
    this.onOpenMenu = onOpenMenu;
    this.onOpenHelp = onOpenHelp;

    this.difficulty = 'easy';
    this.levelsData = null;
    this.levelList = [];
    this.levelIndex = 0;
    this.currentLevel = null;
    this.board = [];
    this.initialBoard = [];

    // Player hand & selected match
    this.heldMatches = 0;
    this.initialHeld = 0;
    this.selectedMatch = null; // { r, c }

    // Fluid drag and drop state
    this.dragState = null;

    // Game stats
    this.timer = 0;
    this.timerInterval = null;
    this.isPaused = false;
    this.isLocked = false;
    this.mistakesCount = 0;

    // Canvas & sprites
    this.canvas = null;
    this.ctx = null;
    this.matchesImg = null;
    this.matchesSelImg = null;
    this.fieldTileImg = null;
    this.spritesLoaded = false;
  }

  async init(difficulty = 'easy') {
    const generation = this._loadGeneration = (this._loadGeneration || 0) + 1;
    this.difficulty = difficulty;
    this.diff = difficultyIndex(difficulty);


    // Load authentic level database
    try {
      const resp = await fetch('data/matches_levels.json?v=20261107_2');
      this.levelsData = await resp.json();
    } catch (e) {
      console.warn('Failed to load matches levels:', e);
    }
    try { this.original = (await loadOriginalConfig()).games; } catch (e) { console.warn('Original config unavailable:', e); }

    if (this.destroyed || generation !== this._loadGeneration) return;
    this.levelList = this.levelsData ? (this.levelsData[difficulty] || this.levelsData.easy) : [];
    // One level per game, drawn from the levels not solved yet (FUN_4a14d318).
    const picked = pickLevel(storage.getProfile().matchesNotDone?.[this.diff], this.levelList.length, createRandom(Date.now()));
    this.notDone = picked.list;
    this.levelIndex = Math.max(0, this.levelList.findIndex(level => level.level === picked.level));

    // Fallback level if json fails
    const fallbackLevel = {
      id: 'd0_lev_4',
      level: 4,
      task: 'Move 4 matches to make 3 squares from this key.',
      task_ru: 'Передвиньте 4 спички так, чтобы превратить ключик в 3 квадрата.',
      add: 0,
      del: 0,
      board: [
        '.............',
        '.....-.......',
        '....|.|......',
        '.....-.......',
        '......|......',
        '.............',
        '......|......',
        '.............',
        '...../.\\.....',
        '.............',
        '.....\\./.....',
        '.............',
        '.............'
      ],
      solutions: [[
        '.............',
        '.....-.......',
        '....|.|......',
        '.....-.......',
        '....|.|......',
        '.....-.......',
        '....|.|......',
        '.....-.......',
        '.............',
        '.............',
        '.............',
        '.............',
        '.............'
      ]]
    };

    this.currentLevel = this.levelList.length > 0 ? this.levelList[this.levelIndex] : fallbackLevel;

    this.timer = 0;
    this.mistakesCount = 0;
    this.isPaused = false;
    this.isLocked = false;

    this.loadLevel(this.currentLevel);
    this.startTimer();
  }

  // Controls of the web version (owner's request, 15 Nov 2026), like today's matchstick puzzle
  // apps: drag a match to a free place, or tap it and then the place; free places are outlined and
  // decide the orientation themselves. Remove tasks: tap a match to take it away. Add tasks: drag
  // a match from the supply under the field or tap a free place. Undo, Reset and Check below.
  // The puzzles, the solution check and the points stay the original ones.
  loadLevel(lev) {
    this.currentLevel = lev;
    this.board = (lev.board || []).map(r => r.split(''));
    this.initialBoard = (lev.board || []).map(r => r.split(''));
    this.slots = slotMap(lev);
    this.task = taskKind(lev);
    // The view is zoomed to the places (plus half a cell), so the matches are as large as possible.
    let r0 = 12, r1 = 0, c0 = 12, c1 = 0;
    for (const key of this.slots.keys()) {
      const [r, c] = key.split(',').map(Number);
      r0 = Math.min(r0, r); r1 = Math.max(r1, r); c0 = Math.min(c0, c); c1 = Math.max(c1, c);
    }
    if (r1 < r0) { r0 = 0; r1 = 12; c0 = 0; c1 = 12; }
    this.view = {r0, c0, span: Math.max(r1 - r0, c1 - c0) + 2, rows: r1 - r0 + 1, cols: c1 - c0 + 1};
    this.heldMatches = this.task.kind === 'add' ? this.task.count : 0;
    this.initialHeld = this.heldMatches;
    this.removed = 0;
    this.added = new Set();
    this.history = [];
    this.selectedMatch = null;
    this.trayArmed = false;
    this.dragState = null;
    this.render();
  }

  startTimer() {
    clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      if (!this.isPaused && !this.isLocked) {
        this.timer++;
        this.updateStatsBar();
      }
    }, 1000);
  }

  updateStatsBar() {
    const timeVal = this.container.querySelector('#matchesTimeVal');
    if (timeVal) {
      const mins = String(Math.floor(this.timer / 60)).padStart(2, '0');
      const secs = String(this.timer % 60).padStart(2, '0');
      timeVal.textContent = `${mins}:${secs}`;
    }
  }

  // Matches moved away from their starting places (for "Moved X of N").
  movedCount() {
    let n = 0;
    this.initialBoard.forEach((row, r) => row.forEach((ch, c) => { if (ch !== '.' && this.board[r][c] === '.') n++; }));
    return n;
  }

  progressText() {
    const {kind, count} = this.task;
    if (kind === 'remove') return i18n.t('Removed: %d of %d', 'Убрано: %d из %d').replace('%d', this.removed).replace('%d', count);
    if (kind === 'add') return i18n.t('Matches to add: %d', 'Осталось добавить: %d').replace('%d', this.heldMatches);
    return i18n.t('Moved: %d of %d', 'Переложено: %d из %d').replace('%d', this.movedCount()).replace('%d', count);
  }

  hintText() {
    if (this.task.kind === 'remove') return i18n.t('Tap a match to take it away.', 'Коснитесь спички, чтобы убрать её.');
    if (this.task.kind === 'add') return i18n.t('Drag a match from the supply or tap a free place.', 'Перетащите спичку из запаса или коснитесь свободного места.');
    return i18n.t('Drag a match to a free place, or tap it and then the place.', 'Перетащите спичку на свободное место или коснитесь её, а потом места.');
  }

  render() {
    const lang = i18n.getLang();
    const taskText = lang === 'ru' && this.currentLevel?.task_ru
      ? this.currentLevel.task_ru
      : i18n.t(this.currentLevel?.task || 'Move matches to solve the puzzle');
    const titleText = i18n.gameName('matches');

    this.container.innerHTML = `
      <div class="amaze-game-container matches-screen">
        <div class="amaze-header-bar">
          <button class="amaze-header-btn amaze-menu-btn" id="btnMatchesMenu" title="${i18n.t('Menu', 'Меню')}">
            <span class="bar-icon">☰</span>
          </button>
          <div class="amaze-header-title">${titleText}</div>
          <button class="amaze-header-btn amaze-help-btn" id="btnMatchesHelp" title="${i18n.t('Help', 'Справка')}">
            <span class="help-q">?</span>
          </button>
        </div>

        <div class="amaze-pause-bar matches-pause-bar">
          <div class="matches-info-left" id="matchesProgress"></div>
          <button class="amaze-pause-capsule" id="btnMatchesPause" title="${i18n.t('Paused')}">
            <span class="pause-bars">❚❚</span>
          </button>
          <div class="matches-info-right" id="matchesTimeVal">00:00</div>
        </div>

        <div class="amaze-matches-task-card">
          <p class="amaze-task-text">${taskText}</p>
        </div>

        <div class="amaze-board-wrapper matches-board-wrap">
          <div class="amaze-matches-frame" id="matchesBoardFrame">
            <canvas id="matchesCanvas" width="442" height="442"></canvas>
            <div class="mx-toast" id="matchesToast" role="status"></div>
          </div>
        </div>

        <div class="mx-tray ${this.task.kind === 'add' ? '' : 'hidden'}" id="matchesTray" aria-label="${i18n.t('Matches to add: %d', 'Осталось добавить: %d').replace('%d', this.heldMatches)}"></div>
        <p class="mx-hint">${this.hintText()}</p>

        <div class="mx-toolbar">
          <button class="mx-btn" id="btnUndoMatches"><span class="mx-ico">↶</span><span>${i18n.t('Undo', 'Отменить')}</span></button>
          <button class="mx-btn" id="btnResetMatches"><span class="mx-ico">⟲</span><span>${i18n.t('Reset', 'Заново')}</span></button>
          <button class="mx-btn mx-check" id="btnCheckMatches"><span class="mx-ico">✓</span><span>${i18n.t('Check', 'Проверить')}</span></button>
        </div>
      </div>
    `;

    this.canvas = this.container.querySelector('#matchesCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.drawCanvasBoard();
    this.bindEvents();
    this.bindPointerEvents();
    this.updateStatsBar();
    this.updatePanel();
  }

  updatePanel() {
    const progress = this.container.querySelector('#matchesProgress');
    if (progress) progress.textContent = this.progressText();
    const tray = this.container.querySelector('#matchesTray');
    if (tray) {
      tray.innerHTML = Array.from({length: this.heldMatches}, () => '<span class="mx-tray-match"></span>').join('');
      tray.classList.toggle('armed', this.trayArmed);
    }
    const undo = this.container.querySelector('#btnUndoMatches');
    if (undo) undo.disabled = !this.history.length;
    const {kind, count} = this.task;
    const done = kind === 'remove' ? this.removed === count : kind === 'add' ? this.heldMatches === 0 : this.movedCount() >= count && count > 0;
    this.container.querySelector('#btnCheckMatches')?.classList.toggle('ready', done);
  }

  toast(text) {
    const el = this.container.querySelector('#matchesToast');
    if (!el) return;
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => el.classList.remove('show'), 1800);
  }

  // ---- drawing ----
  cellSize() { return this.canvas.width / (this.view?.span || 13); }

  center(r, c) {
    const S = this.cellSize(), v = this.view || {r0: 0, c0: 0, span: 13, rows: 13, cols: 13};
    const offX = (v.span - v.cols) / 2, offY = (v.span - v.rows) / 2;
    return {x: (c - v.c0 + offX + 0.5) * S, y: (r - v.r0 + offY + 0.5) * S};
  }

  drawCanvasBoard() {
    if (!this.ctx || !this.board.length) return;
    const ctx = this.ctx, w = this.canvas.width, h = this.canvas.height, S = this.cellSize();
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#16465a');
    bg.addColorStop(1, '#0b2a38');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Free places: faint outlines; brighter while a match can go there.
    const placing = this.selectedMatch || this.trayArmed || this.dragState?.isDragging || (this.task.kind === 'add' && this.heldMatches > 0);
    for (const [key, ch] of this.slots) {
      const [r, c] = key.split(',').map(Number);
      if (this.board[r][c] !== '.') continue;
      const target = this.dragState?.isDragging && this.dragState.targetR === r && this.dragState.targetC === c;
      this.drawSlot(r, c, ch, target ? 'target' : placing ? 'open' : 'idle');
    }

    for (let r = 0; r < 13; r++) for (let c = 0; c < 13; c++) {
      const val = this.board[r][c];
      if (val === '.') continue;
      const dragged = this.dragState?.isDragging && this.dragState.originR === r && this.dragState.originC === c;
      const selected = this.selectedMatch && this.selectedMatch.r === r && this.selectedMatch.c === c;
      const p = this.center(r, c);
      this.drawMatchAt(p.x, p.y, val, {alpha: dragged ? 0.25 : 1, selected, lifted: selected});
    }

    if (this.dragState?.isDragging) {
      const {curX, curY, targetR, targetC, val} = this.dragState;
      const shown = targetR !== null ? this.slots.get(`${targetR},${targetC}`) : val;
      this.drawMatchAt(curX, curY, shown || val, {lifted: true, selected: true, scale: 1.06});
    }
  }

  matchGeometry(ch) {
    const S = this.cellSize();
    const diag = ch === '/' || ch === '\\';
    const angle = ch === '-' ? 0 : ch === '|' ? -Math.PI / 2 : ch === '/' ? -Math.PI / 4 : Math.PI / 4;
    return {angle, len: (diag ? 2 * Math.SQRT2 : 2) * S * 0.9, thick: S * 0.24};
  }

  drawSlot(r, c, ch, state) {
    const ctx = this.ctx, S = this.cellSize();
    const {angle, len, thick} = this.matchGeometry(ch);
    const p = this.center(r, c);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.roundRect(-len / 2, -thick / 2, len, thick, thick / 2);
    if (state === 'target') {
      ctx.fillStyle = 'rgba(255, 214, 90, 0.45)';
      ctx.fill();
    } else {
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = state === 'open' ? 'rgba(255, 236, 170, 0.55)' : 'rgba(255, 255, 255, 0.14)';
      ctx.stroke();
    }
    ctx.restore();
  }

  // A wooden match with a red head, drawn along its place.
  drawMatchAt(cx, cy, ch, {alpha = 1, selected = false, lifted = false, scale = 1} = {}) {
    const ctx = this.ctx;
    const {angle, len: baseLen, thick: baseThick} = this.matchGeometry(ch);
    const len = baseLen * scale, thick = baseThick * scale;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    ctx.shadowBlur = lifted ? 10 : 3;
    ctx.shadowOffsetY = lifted ? 6 : 2;
    const body = ctx.createLinearGradient(0, -thick / 2, 0, thick / 2);
    body.addColorStop(0, '#fbe7bf');
    body.addColorStop(0.5, '#e8bf7a');
    body.addColorStop(1, '#b98443');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.roundRect(-len / 2, -thick / 2, len - thick * 0.6, thick, thick * 0.3);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    const hx = len / 2 - thick * 0.9, hr = thick * 0.82;
    const head = ctx.createRadialGradient(hx - hr * 0.35, -hr * 0.35, hr * 0.15, hx, 0, hr);
    head.addColorStop(0, '#ff9a7a');
    head.addColorStop(0.45, '#e2352a');
    head.addColorStop(1, '#8e130c');
    ctx.fillStyle = head;
    ctx.beginPath();
    ctx.ellipse(hx, 0, hr * 1.25, hr, 0, 0, Math.PI * 2);
    ctx.fill();
    if (selected) {
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = 'rgba(255, 221, 87, 0.95)';
      ctx.beginPath();
      ctx.roundRect(-len / 2 - 3, -thick / 2 - 3, len + 6, thick + 6, thick / 2 + 3);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ---- hit testing ----
  canvasPoint(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    return {x: (clientX - rect.left) * (this.canvas.width / rect.width), y: (clientY - rect.top) * (this.canvas.height / rect.height)};
  }

  // Distance from a point to the segment of a match placed at (r, c) with orientation ch.
  distanceToPlace(x, y, r, c, ch) {
    const {angle, len} = this.matchGeometry(ch), {x: cx, y: cy} = this.center(r, c);
    const dx = Math.cos(angle) * len / 2, dy = Math.sin(angle) * len / 2;
    const vx = 2 * dx, vy = 2 * dy, ax = cx - dx, ay = cy - dy;
    const t = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy)));
    return Math.hypot(x - (ax + t * vx), y - (ay + t * vy));
  }

  nearest(x, y, occupied) {
    const S = this.cellSize();
    let best = null, bestD = S * 0.62;
    for (const [key, ch] of this.slots) {
      const [r, c] = key.split(',').map(Number);
      const cell = this.board[r][c];
      if (occupied ? cell === '.' : cell !== '.') continue;
      const d = this.distanceToPlace(x, y, r, c, occupied ? cell : ch);
      if (d < bestD) { bestD = d; best = {r, c}; }
    }
    if (occupied) {
      // Matches off the computed places (should not happen) can still be picked.
      for (let r = 0; r < 13; r++) for (let c = 0; c < 13; c++) {
        if (this.board[r][c] === '.' || this.slots.has(`${r},${c}`)) continue;
        const d = this.distanceToPlace(x, y, r, c, this.board[r][c]);
        if (d < bestD) { bestD = d; best = {r, c}; }
      }
    }
    return best;
  }

  // ---- actions ----
  snapshot() {
    this.history.push({board: this.board.map(row => row.slice()), held: this.heldMatches, removed: this.removed, added: new Set(this.added)});
    if (this.history.length > 200) this.history.shift();
  }

  undo() {
    const last = this.history.pop();
    if (!last) return;
    this.board = last.board; this.heldMatches = last.held; this.removed = last.removed; this.added = last.added;
    this.selectedMatch = null; this.trayArmed = false;
    audio.play('click');
    this.refresh();
  }

  refresh() {
    this.drawCanvasBoard();
    this.updatePanel();
  }

  moveMatch(from, to) {
    const ch = this.slots.get(`${to.r},${to.c}`);
    if (!ch || this.board[to.r][to.c] !== '.') return false;
    this.snapshot();
    this.board[from.r][from.c] = '.';
    this.board[to.r][to.c] = ch;
    if (this.added.delete(`${from.r},${from.c}`)) this.added.add(`${to.r},${to.c}`);
    this.selectedMatch = null;
    audio.play('rotate');
    this.refresh();
    return true;
  }

  placeFromTray(to) {
    const ch = this.slots.get(`${to.r},${to.c}`);
    if (!ch || this.heldMatches <= 0 || this.board[to.r][to.c] !== '.') return false;
    this.snapshot();
    this.board[to.r][to.c] = ch;
    this.added.add(`${to.r},${to.c}`);
    this.heldMatches--;
    if (!this.heldMatches) this.trayArmed = false;
    audio.play('plusMatch');
    this.refresh();
    return true;
  }

  takeMatch(at) {
    const key = `${at.r},${at.c}`;
    if (this.task.kind === 'add') {
      if (!this.added.has(key)) { this.toast(i18n.t('Only the added matches can be taken back.', 'Убрать можно только добавленные спички.')); return; }
      this.snapshot();
      this.board[at.r][at.c] = '.';
      this.added.delete(key);
      this.heldMatches++;
    } else {
      if (this.removed >= this.task.count) { this.toast(i18n.t('Remove exactly %d matches.', 'Нужно убрать ровно %d.').replace('%d', this.task.count)); return; }
      this.snapshot();
      this.board[at.r][at.c] = '.';
      this.removed++;
    }
    audio.play('minusMatch');
    this.refresh();
  }

  // Tap on a match (r, c) or on a free place.
  tapAt(r, c) {
    if (this.isPaused || this.isLocked) return;
    const occupied = this.board[r]?.[c] && this.board[r][c] !== '.';
    if (occupied) {
      if (this.task.kind !== 'move') { this.takeMatch({r, c}); return; }
      if (this.selectedMatch && this.selectedMatch.r === r && this.selectedMatch.c === c) this.selectedMatch = null;
      else this.selectedMatch = {r, c};
      audio.play('click');
      this.refresh();
      return;
    }
    if (!this.slots.has(`${r},${c}`)) return;
    if (this.task.kind === 'move' && this.selectedMatch) this.moveMatch(this.selectedMatch, {r, c});
    else if (this.task.kind === 'add') this.placeFromTray({r, c});
  }

  // Programmatic click (tests): canvas client coordinates.
  bindPointerEvents() {
    const canvas = this.canvas;
    const startDrag = (e, origin, fromTray) => {
      const p = this.canvasPoint(e.clientX, e.clientY);
      this.dragState = {pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, isDragging: false, fromTray,
        originR: origin?.r ?? null, originC: origin?.c ?? null, val: origin ? this.board[origin.r][origin.c] : '-',
        curX: p.x, curY: p.y, targetR: null, targetC: null};
      window.addEventListener('pointermove', this.onDragMove);
      window.addEventListener('pointerup', this.onDragEnd);
      window.addEventListener('pointercancel', this.onDragCancel);
    };
    this.onDragMove = e => {
      const d = this.dragState;
      if (!d || e.pointerId !== d.pointerId) return;
      if (!d.isDragging && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < 7) return;
      d.isDragging = true;
      const p = this.canvasPoint(e.clientX, e.clientY);
      d.curX = p.x; d.curY = p.y;
      const target = this.nearest(p.x, p.y, false);
      d.targetR = target?.r ?? null; d.targetC = target?.c ?? null;
      this.drawCanvasBoard();
    };
    const finish = () => {
      window.removeEventListener('pointermove', this.onDragMove);
      window.removeEventListener('pointerup', this.onDragEnd);
      window.removeEventListener('pointercancel', this.onDragCancel);
    };
    this.onDragEnd = e => {
      const d = this.dragState;
      if (!d || e.pointerId !== d.pointerId) return;
      finish();
      this.dragState = null;
      if (d.isDragging) {
        const target = d.targetR !== null ? {r: d.targetR, c: d.targetC} : null;
        if (target && d.fromTray) this.placeFromTray(target);
        else if (target && this.task.kind === 'remove') this.refresh();
        else if (target) this.moveMatch({r: d.originR, c: d.originC}, target);
        else this.refresh();
      } else if (d.fromTray) {
        this.trayArmed = !this.trayArmed && this.heldMatches > 0;
        audio.play('click');
        this.refresh();
      } else if (d.originR !== null) {
        this.tapAt(d.originR, d.originC);
      }
    };
    this.onDragCancel = () => { finish(); this.dragState = null; this.refresh(); };

    canvas.addEventListener('pointerdown', e => {
      if (this.isPaused || this.isLocked) return;
      e.preventDefault();
      const p = this.canvasPoint(e.clientX, e.clientY);
      const match = this.nearest(p.x, p.y, true);
      if (match) {
        // Remove tasks take a match by tapping; move and add tasks can drag it.
        if (this.task.kind === 'remove' || (this.task.kind === 'add' && !this.added.has(`${match.r},${match.c}`))) this.tapAt(match.r, match.c);
        else startDrag(e, match, false);
        return;
      }
      const place = this.nearest(p.x, p.y, false);
      if (place) this.tapAt(place.r, place.c);
    });
    const tray = this.container.querySelector('#matchesTray');
    tray?.addEventListener('pointerdown', e => {
      if (this.isPaused || this.isLocked || this.heldMatches <= 0) return;
      e.preventDefault();
      startDrag(e, null, true);
    });
  }

  bindEvents() {
    this.container.querySelector('#btnMatchesMenu')?.addEventListener('click', () => {
      audio.play('click');
      this.onOpenMenu?.({
        onRestart: () => this.loadLevel(this.currentLevel),
        onExit: () => {
          this.destroy();
          this.onComplete(null);
        }
      });
    });
    this.container.querySelector('#btnMatchesHelp')?.addEventListener('click', () => {
      audio.play('click');
      this.onOpenHelp?.('matches');
    });
    this.container.querySelector('#btnMatchesPause')?.addEventListener('click', () => {
      audio.play('click');
      this.togglePause();
    });
    this.container.querySelector('#btnUndoMatches')?.addEventListener('click', () => this.undo());
    this.container.querySelector('#btnResetMatches')?.addEventListener('click', () => {
      audio.play('reset');
      this.loadLevel(this.currentLevel);
    });
    this.container.querySelector('#btnCheckMatches')?.addEventListener('click', () => this.checkSolution());
  }

  togglePause() {
    this.isPaused = !this.isPaused;
    if (this.isPaused && this.onOpenMenu) {
      this.onOpenMenu({
        isPauseMenu: true,
        onResume: () => this.isPaused = false,
        onRestart: () => this.loadLevel(this.currentLevel),
        onExit: () => {
          this.destroy();
          this.onComplete(null);
        }
      });
    }
  }

  checkSolution() {
    if (this.isLocked) return;
    // A task with matches still in the supply, or with the wrong number removed, is only a hint
    // (no wrong move) — the web version shows it instead of checking.
    if (this.task.kind === 'add' && this.heldMatches > 0) {
      audio.play('wrong');
      this.toast(i18n.t('You must use all matches from your hand!', 'Используйте все спички из запаса!'));
      return;
    }
    if (this.task.kind === 'remove' && this.removed !== this.task.count) {
      audio.play('wrong');
      this.toast(i18n.t('Remove exactly %d matches.', 'Нужно убрать ровно %d.').replace('%d', this.task.count));
      return;
    }
    this.selectedMatch = null;

    // Original check (FUN_4a0909a4): same cells as a solution, or as its rotations / mirrors
    // unless the level's no_mirror flags switch them off. See matches-model.js.
    const isMatched = Boolean(this.currentLevel) && isSolved(this.board.map(row => row.join('')), this.currentLevel);

    const field = this.original?.matches_game_field;
    if (isMatched) {
      this.isLocked = true;
      clearInterval(this.timerInterval);
      audio.play('good');
      this.defer(() => audio.play('levelUp'), 250);
      // The solved level leaves the not-done list of this difficulty.
      const left = this.notDone.filter(n => n !== this.currentLevel.level);
      storage.updateProfile(profile => { profile.matchesNotDone = {...profile.matchesNotDone, [this.diff]: left}; });
      this.defer(() => this.showResults(), 400);
    } else {
      // FUN_4a08e52c: a wrong check is a wrong move; diff_max_moves of them end the game.
      this.mistakesCount++;
      audio.play('wrong');
      this.flashWrong();
      if (field && this.mistakesCount >= arrayValue(field.diff_max_moves, this.diff)) {
        this.isLocked = true;
        clearInterval(this.timerInterval);
        this.defer(() => this.showResults(), 400);
      }
    }
  }

  // [matches_show_results]: Prize fund (@DIST) and Wrong Moves (@P1), then the total.
  showResults() {
    const wnd = this.original?.matches_wnd, section = this.original?.matches_show_results;
    const {prize, total} = matchesScore(Number(this.currentLevel?.mips || 0), this.mistakesCount,
      wnd ? arrayValue(wnd.points_good_move_arr, this.diff) : 0, wnd ? arrayValue(wnd.points_wrong_move_arr, this.diff) : 0);
    const finalScore = Math.max(0, total);
    if (finalScore > 0) storage.recordGameScore('matches', finalScore);
    this.score = finalScore;
    const modal = showResultsLayer(this.container, section
      ? resultsMarkup(section, buildResults(section, {DIST: prize, P1: this.mistakesCount, TOTAL: total}, this.diff), i18n.t('Continue', 'Продолжить'))
      : `<p>${finalScore}</p><button data-finish>${i18n.t('Continue', 'Продолжить')}</button>`, 'matches-results');
    this.resultsModal = modal;
    modal.querySelector('[data-finish]').addEventListener('click', () => {
      audio.play('click');
      this.destroy();
      this.onComplete(finalScore > 0 ? finalScore : null);
    });
  }

  flashWrong() {
    const frameEl = this.container.querySelector('#matchesBoardFrame');
    if (frameEl) {
      frameEl.classList.add('wrong-move');
      this.defer(() => frameEl.classList.remove('wrong-move'), 350);
    }
  }

  destroy() {
    clearInterval(this.timerInterval);
    clearTimeout(this.toastTimer);
    if (this.onDragMove) {
      window.removeEventListener('pointermove', this.onDragMove);
      window.removeEventListener('pointerup', this.onDragEnd);
      window.removeEventListener('pointercancel', this.onDragCancel);
    }
    this.resultsModal?.remove();
    this.resultsModal = null;
  }
}
