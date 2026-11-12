// Amaze Brain Evolution - Authentic Quadronica (Квадроника / Znax) Mini-Game
// Pixel-perfect restoration based on original binary and layout specs (_ZNAX_INO.ino & original game binary)

import { audio } from '../audio.js';
import { storage } from '../storage.js';
import { i18n } from '../i18n.js';
import { loadOriginalConfig, createRandom } from '../original.js';
import { buildResults, resultsMarkup, revealResults } from './results-window.js';
import * as Q from './quadronica-model.js';

const TICK_MS = 66;

// Configuration parameters from _ZNAX_INO.ino
// field_width 8, field_height 11, field_number_size 58 58
const QUAD_CONFIG = {
  easy: {
    cols: 8,
    rows: 11,
    colorsCount: 4, // 4 colors (Green, Pink, Red, Blue)
    maxTime: 120, // 120 seconds
    costPerTile: 20, // points_good_move_arr
    penalty: 80 // points_wrong_move_arr
  },
  medium: {
    cols: 8,
    rows: 11,
    colorsCount: 5, // 5 colors (+ Sky Blue)
    maxTime: 150, // 150 seconds
    costPerTile: 25,
    penalty: 160
  },
  hard: {
    cols: 8,
    rows: 11,
    colorsCount: 6, // 6 colors (+ Dark Green)
    maxTime: 180, // 180 seconds
    costPerTile: 20,
    penalty: 320
  }
};

export class QuadronicaGame {
  constructor(container, onComplete, onOpenMenu, onOpenHelp) {
    this.container = container;
    this.onComplete = onComplete;
    this.onOpenMenu = onOpenMenu;
    this.onOpenHelp = onOpenHelp;

    this.difficulty = 'easy';
    this.config = QUAD_CONFIG.easy;
    this.cols = 8;
    this.rows = 11;

    // 2D board state: grid[row][col] = colorId (0..6)
    this.grid = [];
    this.selectedCorners = []; // [{r, c}, ...]
    this.score = 0;
    this.rectanglesFound = 0;
    this.mistakesCount = 0;

    // Time-attack countdown timer
    this.timeLeft = 120;
    this.totalTime = 120;
    this.timerInterval = null;
    this.isPaused = false;
    this.isLocked = false;

    // Drag-selection state (for smooth mouse/touch swipe selection)
    this.dragStart = null;
    this.isDragging = false;

    // D-Pad / Keyboard cursor
    this.cursorPos = { r: 0, c: 0 };
    this.handleKeyDown = this.handleKeyDown.bind(this);
  }

  // Alias for backward-compatible test assertions
  get selected() {
    return this.selectedCorners;
  }

  // Field size, colours, time and points come from [znax_game_field] (see quadronica-model.js);
  // QUAD_CONFIG is only the fallback when the original configuration cannot be loaded.
  async init(difficulty = 'easy') {
    const generation = this._initGeneration = (this._initGeneration || 0) + 1;
    this.difficulty = QUAD_CONFIG[difficulty] ? difficulty : 'easy';
    this.config = QUAD_CONFIG[this.difficulty];
    const diff = {easy: 0, medium: 1, hard: 2}[this.difficulty];
    let games = null;
    try { games = (await loadOriginalConfig()).games; } catch (e) { console.warn('Original config unavailable:', e); }
    if (generation !== this._initGeneration) return;
    this.original = games;
    const fallback = {cols: this.config.cols, rows: this.config.rows, minRects: 5, maxRects: 10, colors: this.config.colorsCount,
      time: this.mode === 'marking' ? 90 : this.config.maxTime, good: this.config.costPerTile, wrong: -this.config.penalty, disappearSpeed: 2};
    this.params = games?.znax_game_field ? Q.fieldParams(games.znax_game_field, diff, this.mode === 'marking') : fallback;
    this.diffIndex = diff;
    this.rand = createRandom(Date.now());
    this.cols = this.params.cols;
    this.rows = this.params.rows;
    this.totalTime = this.params.time;
    this.timeLeft = this.totalTime;
    this.ended = false;
    clearTimeout(this.vanishTimer);

    this.score = 0;
    this.rectanglesFound = 0;
    this.mistakesCount = 0;
    this.selectedCorners = [];
    this.isPaused = false;
    this.isLocked = false;
    this.cursorPos = { r: 5, c: 4 };

    this.generateBoard();
    this.render();
    this.startTimer();

    window.removeEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keydown', this.handleKeyDown);
  }

  generateBoard() {
    this.grid = Q.newField(this.params, this.rand);
  }

  findAllRectangles() {
    return Q.findRectangles(this.grid);
  }

  startTimer() {
    clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      if (!this.isPaused && !this.ended) {
        this.timeLeft--;
        this.updateStatsBar();

        if (this.timeLeft <= 0) {
          this.handleGameOver();
        }
      }
    }, 1000);
  }

  render() {
    const titleText = i18n.t('Quadronica', 'Квадроника');
    this.container.innerHTML = `
      <div class="amaze-game-container quadronica-screen">
        <!-- Authentic Amaze Top Header Bar -->
        <div class="amaze-header-bar">
          <button class="amaze-header-btn amaze-menu-btn" id="btnQuadMenu" title="${i18n.t('Menu', 'Меню')}">
            <span class="bar-icon">☰</span>
          </button>
          <div class="amaze-header-title">${titleText}</div>
          <button class="amaze-header-btn amaze-help-btn" id="btnQuadHelp" title="${i18n.t('Help', 'Справка')}">
            <span class="help-q">?</span>
          </button>
        </div>

        <!-- Authentic Sub-header Pause Bar with Progress Fill -->
        <div class="amaze-pause-bar quad-pause-bar">
          <div class="quad-info-left" id="quadRectCount">
            ${i18n.t('Score', 'Очки')}: <strong id="quadScoreVal">0</strong>
          </div>
          <button class="amaze-pause-capsule" id="btnQuadPause" title="${i18n.t('Pause', 'Пауза')}">
            <span class="pause-bars">❚❚</span>
          </button>
          <div class="quad-info-right" id="quadTimeVal">
            02:00
          </div>
          <div class="quad-timer-track">
            <div class="quad-timer-fill" id="quadTimerFill" style="width: 100%;"></div>
          </div>
        </div>

        <!-- Quadronica 8x11 Board Wrapper -->
        <div class="amaze-board-wrapper quad-board-wrapper">
          <div class="amaze-quad-frame" id="quadBoardFrame">
            <!-- SVG overlay for rendering dashed connection lines between corners -->
            <svg class="quad-selection-svg" id="quadSvgOverlay"></svg>
            <div class="amaze-quad-grid" id="quadGrid"></div>
          </div>
        </div>

        <!-- Authentic Bottom Instruction Hint -->
        <div class="quad-instruction-footer">
          ${i18n.t(
            'Find rectangles with like-colored corners',
            'Ищите прямоугольники с вершинами одного цвета'
          )}
        </div>
      </div>
    `;

    this.renderGrid();
    this.bindHeaderEvents();
    this.updateStatsBar();
  }

  renderGrid() {
    const gridEl = this.container.querySelector('#quadGrid');
    if (!gridEl) return;
    gridEl.innerHTML = '';

    gridEl.style.gridTemplateColumns = `repeat(${this.cols}, 1fr)`;
    gridEl.style.gridTemplateRows = `repeat(${this.rows}, 1fr)`;

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const color = this.grid[r][c];
        const cell = document.createElement('div');
        cell.className = 'amaze-quad-tile';
        cell.dataset.r = r;
        cell.dataset.c = c;
        cell.dataset.color = color;

        // Apply authentic beveled texture slice
        cell.style.backgroundImage = `url('assets/textures/quad_tile_${color}.png')`;

        // Check cursor
        if (r === this.cursorPos.r && c === this.cursorPos.c) {
          cell.classList.add('has-cursor');
        }

        // Check if selected corner
        const isSelected = this.selectedCorners.some(pt => pt.r === r && pt.c === c);
        if (isSelected) {
          cell.classList.add('corner-selected');
        }

        // Tap/click event
        cell.addEventListener('click', (e) => {
          e.preventDefault();
          this.handleTileClick(r, c);
        });

        gridEl.appendChild(cell);
      }
    }

    this.updateSvgSelection();
  }

  handleTileClick(r, c) {
    if (this.isPaused || this.isLocked) return;

    this.setCursor(r, c);
    this.handleCornerClick(r, c);
  }

  handleTilePointerDown(r, c) {
    this.handleTileClick(r, c);
  }

  updateStatsBar() {
    const scoreVal = this.container.querySelector('#quadScoreVal');
    if (scoreVal) {
      scoreVal.textContent = this.score;
    }

    const timeVal = this.container.querySelector('#quadTimeVal');
    if (timeVal) {
      const mins = String(Math.floor(this.timeLeft / 60)).padStart(2, '0');
      const secs = String(this.timeLeft % 60).padStart(2, '0');
      timeVal.textContent = `${mins}:${secs}`;
    }

    const timerFill = this.container.querySelector('#quadTimerFill');
    if (timerFill) {
      const pct = Math.max(0, Math.min(100, (this.timeLeft / this.totalTime) * 100));
      timerFill.style.width = `${pct}%`;
      if (pct < 20) {
        timerFill.style.background = '#e74c3c';
      } else {
        timerFill.style.background = '#3498db';
      }
    }
  }

  handleTilePointerDown(r, c) {
    if (this.isPaused || this.isLocked) return;

    this.setCursor(r, c);
    this.handleCornerClick(r, c);
  }

  handleCornerClick(r, c) {
    // 1. Check if clicked tile is already selected -> toggle deselect
    const existingIdx = this.selectedCorners.findIndex(pt => pt.r === r && pt.c === c);
    if (existingIdx !== -1) {
      this.selectedCorners.splice(existingIdx, 1);
      audio.play('click');
      this.updateSelectionVisuals();
      return;
    }

    const clickedColor = this.grid[r][c];

    // 2. Color verification: if at least 1 corner is already selected,
    // any subsequent corner MUST have the exact same color!
    if (this.selectedCorners.length > 0) {
      const firstCorner = this.selectedCorners[0];
      const baseColor = this.grid[firstCorner.r][firstCorner.c];
      if (clickedColor !== baseColor) {
        // Immediate error if clicked tile has a different color than the first dot
        this.handleWrongMove({ r, c });
        return;
      }
    }

    // 3. Play mark sound and record new corner
    audio.play('znaxMark');
    this.selectedCorners.push({ r, c });

    // 4. If 2 corners are selected: check if they define opposite diagonal vertices
    if (this.selectedCorners.length === 2) {
      const p1 = this.selectedCorners[0];
      const p2 = this.selectedCorners[1];

      // If they are on different rows AND different columns, they define a full rectangle!
      if (p1.r !== p2.r && p1.c !== p2.c) {
        this.evaluateRectangleCandidate(p1, p2);
        return;
      }
    }

    // 5. If 3 corners are selected: check geometry compatibility
    if (this.selectedCorners.length === 3) {
      const rows = [...new Set(this.selectedCorners.map(p => p.r))];
      const cols = [...new Set(this.selectedCorners.map(p => p.c))];

      // If they span more than 2 rows or more than 2 columns, they cannot form an axis-aligned rectangle
      if (rows.length > 2 || cols.length > 2) {
        this.handleWrongMove({ r, c });
        return;
      }
    }

    // 6. If 4 corners are selected (user clicked all 4 corners):
    if (this.selectedCorners.length === 4) {
      const rows = [...new Set(this.selectedCorners.map(p => p.r))].sort((a, b) => a - b);
      const cols = [...new Set(this.selectedCorners.map(p => p.c))].sort((a, b) => a - b);

      if (rows.length === 2 && cols.length === 2) {
        const p1 = { r: rows[0], c: cols[0] };
        const p2 = { r: rows[1], c: cols[1] };
        this.evaluateRectangleCandidate(p1, p2);
        return;
      } else {
        // Not a rectangle
        this.handleWrongMove({ r, c });
        return;
      }
    }

    this.updateSelectionVisuals();
  }

  evaluateRectangleCandidate(p1, p2) {
    const rMin = Math.min(p1.r, p2.r);
    const rMax = Math.max(p1.r, p2.r);
    const cMin = Math.min(p1.c, p2.c);
    const cMax = Math.max(p1.c, p2.c);

    const cTL = this.grid[rMin][cMin];
    const cTR = this.grid[rMin][cMax];
    const cBL = this.grid[rMax][cMin];
    const cBR = this.grid[rMax][cMax];

    // All 4 vertices must share the same color!
    if (cTL === cTR && cTR === cBL && cBL === cBR) {
      // MATCH!
      this.handleValidRectangle(rMin, cMin, rMax, cMax, cTL);
    } else {
      // MISMATCH!
      this.handleWrongMove({ r: p2.r, c: p2.c });
    }
  }

  handleValidRectangle(rMin, cMin, rMax, cMax, color) {
    this.isLocked = true;
    audio.play('good');

    const width = cMax - cMin + 1;
    const height = rMax - rMin + 1;
    const totalTilesCleared = width * height;

    // FUN_4a142b4c: points per cell x removed cells (cells beyond half of the field count half).
    const pointsAwarded = Q.rectanglePoints(totalTilesCleared, this.rows * this.cols, this.params.good);

    this.score += pointsAwarded;
    this.rectanglesFound++;
    this.updateStatsBar();

    // Immediately clear selectedCorners and remove all visual selection dots (.corner-selected)
    // so no dots persist after tiles clear/pop/drop!
    this.selectedCorners = [];
    const gridEl = this.container.querySelector('#quadGrid');
    if (gridEl) {
      gridEl.querySelectorAll('.corner-selected').forEach(el => el.classList.remove('corner-selected'));
    }

    // Show floating score badge at rectangle center
    this.showFloatingBadge(rMin, cMin, rMax, cMax, `+${pointsAwarded}`, true);

    // Draw dashed success box on SVG overlay
    this.drawSuccessBox(rMin, cMin, rMax, cMax);

    // Every cell of the rectangle shrinks and fades where it is: the inset grows by
    // number_disappear_speed per tick until it reaches half of a 58-unit cell.
    const vanishMs = Math.ceil(29 / this.params.disappearSpeed) * TICK_MS;
    for (let r = rMin; r <= rMax; r++) {
      for (let c = cMin; c <= cMax; c++) {
        const cellEl = gridEl?.children[r * this.cols + c];
        if (cellEl) {
          cellEl.style.setProperty('--vanish-ms', `${vanishMs}ms`);
          cellEl.classList.add('popping');
        }
      }
    }

    // FUN_4a140784: the emptied cells get new colours in place; nothing falls.
    clearTimeout(this.vanishTimer);
    this.vanishTimer = setTimeout(() => {
      if (this.ended) return;
      this.refillInPlace(rMin, cMin, rMax, cMax);
      this.selectedCorners = [];
      this.updateSvgSelection();
      this.isLocked = false;
    }, vanishMs);
  }

  handleWrongMove(errorPos = null) {
    audio.play('wrong');
    this.mistakesCount++;

    // points_wrong_move_arr is added as it is: the total may go below zero.
    const penalty = -this.params.wrong;
    this.score += this.params.wrong;
    this.updateStatsBar();

    // Flash red frame border (matching wrong_move_color 255 0 0 from _ZNAX_INO.ino)
    const frameEl = this.container.querySelector('#quadBoardFrame');
    if (frameEl) {
      frameEl.classList.add('wrong-move');
      setTimeout(() => frameEl.classList.remove('wrong-move'), 350);
    }

    // Show negative floating badge directly at the error location if available
    const pos = errorPos || (this.selectedCorners.length > 0 ? this.selectedCorners[0] : null);
    if (pos) {
      this.showFloatingBadge(pos.r, pos.c, pos.r, pos.c, `-${penalty}`, false);
    }

    // Clear selection
    this.selectedCorners = [];
    this.updateSelectionVisuals();
  }

  refillInPlace(rMin, cMin, rMax, cMax) {
    for (let r = rMin; r <= rMax; r++) {
      for (let c = cMin; c <= cMax; c++) this.grid[r][c] = -1;
    }
    Q.fillEmpty(this.grid, this.params.colors, this.rand);
    Q.ensureRectangles(this.grid, this.params, this.rand);
    this.renderGrid();
  }

  showFloatingBadge(rMin, cMin, rMax, cMax, text, isPositive) {
    const frameEl = this.container.querySelector('#quadBoardFrame');
    if (!frameEl) return;

    const badge = document.createElement('div');
    badge.className = `quad-floating-score ${isPositive ? 'positive' : 'negative'}`;
    badge.textContent = text;

    // Center in rectangle coordinates
    const centerR = (rMin + rMax) / 2;
    const centerC = (cMin + cMax) / 2;
    const topPct = (centerR + 0.5) / this.rows * 100;
    const leftPct = (centerC + 0.5) / this.cols * 100;

    badge.style.top = `${topPct}%`;
    badge.style.left = `${leftPct}%`;

    frameEl.appendChild(badge);
    setTimeout(() => badge.remove(), 850);
  }

  updateSelectionVisuals() {
    const gridEl = this.container.querySelector('#quadGrid');
    if (!gridEl) return;

    // Update corner-selected classes
    for (let i = 0; i < gridEl.children.length; i++) {
      const cellEl = gridEl.children[i];
      const r = parseInt(cellEl.dataset.r, 10);
      const c = parseInt(cellEl.dataset.c, 10);
      const isCorner = this.selectedCorners.some(pt => pt.r === r && pt.c === c);
      cellEl.classList.toggle('corner-selected', isCorner);
    }

    this.updateSvgSelection();
  }

  updateSvgSelection() {
    const svgEl = this.container.querySelector('#quadSvgOverlay');
    if (!svgEl) return;

    if (this.selectedCorners.length === 2) {
      const p1 = this.selectedCorners[0];
      const p2 = this.selectedCorners[1];
      if (p1.r !== p2.r && p1.c !== p2.c) {
        this.drawDashedBox(p1.r, p1.c, p2.r, p2.c, '#ffffff');
        return;
      }
    }

    svgEl.innerHTML = '';
  }

  drawDashedBox(r1, c1, r2, c2, strokeColor = '#ffffff') {
    const svgEl = this.container.querySelector('#quadSvgOverlay');
    if (!svgEl) return;

    const rMin = Math.min(r1, r2);
    const rMax = Math.max(r1, r2);
    const cMin = Math.min(c1, c2);
    const cMax = Math.max(c1, c2);

    const x = (cMin / this.cols) * 100;
    const y = (rMin / this.rows) * 100;
    const w = ((cMax - cMin + 1) / this.cols) * 100;
    const h = ((rMax - rMin + 1) / this.rows) * 100;

    svgEl.innerHTML = `
      <rect x="${x}%" y="${y}%" width="${w}%" height="${h}%"
            fill="rgba(255, 255, 255, 0.15)"
            stroke="${strokeColor}"
            stroke-width="2.5"
            stroke-dasharray="6, 4"
            rx="4" />
    `;
  }

  drawSuccessBox(rMin, cMin, rMax, cMax) {
    const svgEl = this.container.querySelector('#quadSvgOverlay');
    if (!svgEl) return;

    const x = (cMin / this.cols) * 100;
    const y = (rMin / this.rows) * 100;
    const w = ((cMax - cMin + 1) / this.cols) * 100;
    const h = ((rMax - rMin + 1) / this.rows) * 100;

    svgEl.innerHTML = `
      <rect x="${x}%" y="${y}%" width="${w}%" height="${h}%"
            fill="rgba(46, 204, 113, 0.25)"
            stroke="#2ecc71"
            stroke-width="3"
            rx="4" />
    `;
  }

  setCursor(r, c) {
    const gridEl = this.container.querySelector('#quadGrid');
    if (!gridEl) return;

    const oldIdx = this.cursorPos.r * this.cols + this.cursorPos.c;
    gridEl.children[oldIdx]?.classList.remove('has-cursor');

    this.cursorPos = {
      r: Math.max(0, Math.min(this.rows - 1, r)),
      c: Math.max(0, Math.min(this.cols - 1, c))
    };

    const newIdx = this.cursorPos.r * this.cols + this.cursorPos.c;
    gridEl.children[newIdx]?.classList.add('has-cursor');
  }

  handleKeyDown(e) {
    if (this.isPaused || this.isLocked) return;

    const { r, c } = this.cursorPos;

    if (e.key === 'ArrowUp' && r > 0) {
      e.preventDefault();
      this.setCursor(r - 1, c);
    } else if (e.key === 'ArrowDown' && r < this.rows - 1) {
      e.preventDefault();
      this.setCursor(r + 1, c);
    } else if (e.key === 'ArrowLeft' && c > 0) {
      e.preventDefault();
      this.setCursor(r, c - 1);
    } else if (e.key === 'ArrowRight' && c < this.cols - 1) {
      e.preventDefault();
      this.setCursor(r, c + 1);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.handleCornerClick(r, c);
    }
  }

  handleGameOver() {
    clearInterval(this.timerInterval);
    clearTimeout(this.vanishTimer);
    this.ended = true;
    this.isLocked = true;
    audio.play('levelUp');

    storage.recordGameScore('quadronica', Math.max(0, this.score));

    setTimeout(() => {
      this.showResultsModal();
    }, 400);
  }

  // [znax_show_results] has no items: the original results window shows only the total
  // ("Too bad!" below 1).
  showResultsModal() {
    const section = this.original?.znax_show_results;
    const total = this.score;
    const modal = document.createElement('div');
    modal.className = 'amaze-modal-overlay active';
    modal.innerHTML = section
      ? `<div class="restored-results">${resultsMarkup(section, buildResults(section, {TOTAL: total}, this.diffIndex), i18n.t('Continue', 'Продолжить'))}</div>`
      : `<div class="amaze-modal-card quad-results-card"><div class="amaze-modal-title">${total}</div><button class="amaze-modal-btn default-btn" data-finish>${i18n.t('Continue', 'Продолжить')}</button></div>`;
    modal.querySelector('[data-finish]').id = 'btnQuadDone';
    document.body.appendChild(modal);
    revealResults(modal);
    this.resultsModal = modal;

    modal.querySelector('#btnQuadDone')?.addEventListener('click', () => {
      audio.play('click');
      modal.remove();
      this.destroy();
      this.onComplete(Math.max(0, total));
    });
  }

  bindHeaderEvents() {
    this.container.querySelector('#btnQuadMenu')?.addEventListener('click', () => {
      audio.play('click');
      if (this.onOpenMenu) {
        this.onOpenMenu({
          onRestart: () => this.init(this.difficulty),
          onExit: () => {
            this.destroy();
            this.onComplete(null);
          }
        });
      }
    });

    this.container.querySelector('#btnQuadHelp')?.addEventListener('click', () => {
      audio.play('click');
      if (this.onOpenHelp) {
        this.onOpenHelp('quadronica');
      }
    });

    this.container.querySelector('#btnQuadPause')?.addEventListener('click', () => {
      audio.play('click');
      this.togglePause();
    });
  }

  togglePause() {
    this.isPaused = !this.isPaused;
    if (this.isPaused && this.onOpenMenu) {
      this.onOpenMenu({
        isPauseMenu: true,
        onResume: () => {
          this.isPaused = false;
        },
        onRestart: () => this.init(this.difficulty),
        onExit: () => {
          this.destroy();
          this.onComplete(null);
        }
      });
    }
  }

  destroy() {
    clearInterval(this.timerInterval);
    clearTimeout(this.vanishTimer);
    this.ended = true;
    window.removeEventListener('keydown', this.handleKeyDown);
  }
}
