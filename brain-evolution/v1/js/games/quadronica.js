// SPB Brain Evolution - Authentic Quadronica (Квадроника / Znax) Mini-Game
// Pixel-perfect restoration based on original binary and layout specs (_ZNAX_INO.ino & SpbBE.elf)

import { audio } from '../audio.js';
import { storage } from '../storage.js';
import { i18n } from '../i18n.js';

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

  init(difficulty = 'easy') {
    this.difficulty = difficulty;
    this.config = QUAD_CONFIG[difficulty] || QUAD_CONFIG.easy;
    this.cols = this.config.cols;
    this.rows = this.config.rows;
    this.totalTime = this.config.maxTime;
    this.timeLeft = this.totalTime;

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
    this.grid = [];
    for (let r = 0; r < this.rows; r++) {
      this.grid[r] = [];
      for (let c = 0; c < this.cols; c++) {
        this.grid[r][c] = Math.floor(Math.random() * this.config.colorsCount);
      }
    }
    // Ensure the generated field contains at least 3 valid rectangles
    this.ensureAvailableRectangles(3);
  }

  ensureAvailableRectangles(minCount = 2) {
    let available = this.findAllRectangles();
    let attempts = 0;
    while (available.length < minCount && attempts < 10) {
      // Pick a random rectangle and force its 4 corners to have the same color
      const r1 = Math.floor(Math.random() * (this.rows - 2));
      const r2 = r1 + 1 + Math.floor(Math.random() * (this.rows - r1 - 1));
      const c1 = Math.floor(Math.random() * (this.cols - 2));
      const c2 = c1 + 1 + Math.floor(Math.random() * (this.cols - c1 - 1));
      const color = Math.floor(Math.random() * this.config.colorsCount);

      this.grid[r1][c1] = color;
      this.grid[r1][c2] = color;
      this.grid[r2][c1] = color;
      this.grid[r2][c2] = color;

      available = this.findAllRectangles();
      attempts++;
    }
  }

  findAllRectangles() {
    const list = [];
    for (let r1 = 0; r1 < this.rows; r1++) {
      for (let r2 = r1 + 1; r2 < this.rows; r2++) {
        for (let c1 = 0; c1 < this.cols; c1++) {
          for (let c2 = c1 + 1; c2 < this.cols; c2++) {
            const color = this.grid[r1][c1];
            if (
              this.grid[r1][c2] === color &&
              this.grid[r2][c1] === color &&
              this.grid[r2][c2] === color
            ) {
              list.push({ r1, c1, r2, c2, color });
            }
          }
        }
      }
    }
    return list;
  }

  startTimer() {
    clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      if (!this.isPaused && !this.isLocked) {
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
      <div class="spb-game-container quadronica-screen">
        <!-- Authentic SPB Top Header Bar -->
        <div class="spb-header-bar">
          <button class="spb-header-btn spb-menu-btn" id="btnQuadMenu" title="${i18n.t('Menu', 'Меню')}">
            <span class="bar-icon">☰</span>
          </button>
          <div class="spb-header-title">${titleText}</div>
          <button class="spb-header-btn spb-help-btn" id="btnQuadHelp" title="${i18n.t('Help', 'Справка')}">
            <span class="help-q">?</span>
          </button>
        </div>

        <!-- Authentic Sub-header Pause Bar with Progress Fill -->
        <div class="spb-pause-bar quad-pause-bar">
          <div class="quad-info-left" id="quadRectCount">
            ${i18n.t('Score', 'Очки')}: <strong id="quadScoreVal">0</strong>
          </div>
          <button class="spb-pause-capsule" id="btnQuadPause" title="${i18n.t('Pause', 'Пауза')}">
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
        <div class="spb-board-wrapper quad-board-wrapper">
          <div class="spb-quad-frame" id="quadBoardFrame">
            <!-- SVG overlay for rendering dashed connection lines between corners -->
            <svg class="quad-selection-svg" id="quadSvgOverlay"></svg>
            <div class="spb-quad-grid" id="quadGrid"></div>
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
        cell.className = 'spb-quad-tile';
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

    // Authentic scoring formula from _ZNAX_INO.ino:
    // Area * costPerTile + size bonus
    const sizeBonus = (width + height > 4) ? (width + height - 4) * 20 : 0;
    const pointsAwarded = totalTilesCleared * this.config.costPerTile + sizeBonus;

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

    // Animate tiles popping / shrinking
    for (let r = rMin; r <= rMax; r++) {
      for (let c = cMin; c <= cMax; c++) {
        const idx = r * this.cols + c;
        const cellEl = gridEl?.children[idx];
        if (cellEl) {
          cellEl.classList.add('popping');
        }
      }
    }

    // After pop animation (220ms), apply gravity and refill
    setTimeout(() => {
      this.cascadeAndRefill(rMin, cMin, rMax, cMax);
      this.selectedCorners = [];
      this.updateSvgSelection();
      this.isLocked = false;
    }, 220);
  }

  handleWrongMove(errorPos = null) {
    audio.play('wrong');
    this.mistakesCount++;

    // Deduct penalty
    const penalty = this.config.penalty;
    this.score = Math.max(0, this.score - penalty);
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

  cascadeAndRefill(rMin, cMin, rMax, cMax) {
    // In each column from cMin to cMax:
    // Surviving tiles above rMin drop down by (rMax - rMin + 1) rows
    const height = rMax - rMin + 1;

    for (let c = cMin; c <= cMax; c++) {
      // Shift down existing tiles above rMin
      for (let r = rMax; r >= height; r--) {
        this.grid[r][c] = this.grid[r - height][c];
      }
      // Fill the top `height` rows with new random tiles
      for (let r = 0; r < height; r++) {
        this.grid[r][c] = Math.floor(Math.random() * this.config.colorsCount);
      }
    }

    // Ensure the board still has at least 2 valid rectangles
    this.ensureAvailableRectangles(2);

    // Re-render board with drop animation on refreshed columns
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
    this.isLocked = true;
    audio.play('levelUp');

    storage.recordGameScore('quadronica', this.score);

    setTimeout(() => {
      this.showResultsModal();
    }, 400);
  }

  showResultsModal() {
    const modal = document.createElement('div');
    modal.className = 'spb-modal-overlay active';

    const mins = Math.floor((this.totalTime - this.timeLeft) / 60);
    const secs = (this.totalTime - this.timeLeft) % 60;
    const timeFormatted = `${mins > 0 ? mins + ' ' + i18n.t('min.', 'мин.') + ' ' : ''}${secs} ${i18n.t('sec.', 'сек.')}`;

    modal.innerHTML = `
      <div class="spb-modal-card quad-results-card">
        <div class="spb-modal-title">🎉 ${i18n.t('Time Is Up!', 'Время вышло!')}</div>
        <div class="quad-results-body">
          <div class="quad-result-row">
            <span class="result-label">${i18n.t('Rectangles found:', 'Найдено прямоугольников:')}</span>
            <span class="result-val">${this.rectanglesFound}</span>
          </div>
          <div class="quad-result-row">
            <span class="result-label">${i18n.t('Mistakes:', 'Ошибок:')}</span>
            <span class="result-val">${this.mistakesCount}</span>
          </div>
          <div class="quad-result-row">
            <span class="result-label">${i18n.t('Time played:', 'Время игры:')}</span>
            <span class="result-val">${timeFormatted}</span>
          </div>
          <div class="quad-result-divider"></div>
          <div class="quad-result-score-row">
            <span class="result-score-label">${i18n.t('Total Scores:', 'Итого очков:')}</span>
            <span class="result-score-val">${this.score}</span>
          </div>
        </div>
        <div class="spb-modal-buttons">
          <button class="spb-modal-btn default-btn" id="btnQuadDone">
            ${i18n.t('Continue', 'Продолжить')}
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('#btnQuadDone')?.addEventListener('click', () => {
      audio.play('click');
      modal.remove();
      this.destroy();
      this.onComplete(this.score);
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
    window.removeEventListener('keydown', this.handleKeyDown);
  }
}
