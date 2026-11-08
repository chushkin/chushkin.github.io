// Amaze Brain Evolution - Authentic Matches (Спички) Mini-Game
// Pixel-perfect restoration based on original binary and layout specs (_MATCHES_INO.ino & _MATCHES_LEVELS_INO.ino)

import { audio } from '../audio.js';
import { storage } from '../storage.js';
import { i18n } from '../i18n.js';
import { isSolved, pickLevel, score as matchesScore } from './matches-model.js';
import { loadOriginalConfig, arrayValue, createRandom, difficultyIndex } from '../original.js';
import { buildResults, resultsMarkup, revealResults } from './results-window.js';

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

    // Preload authentic match textures with cache-buster
    await this.loadSprites();

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

  async loadSprites() {
    if (this.spritesLoaded) return;
    const v = '20261021_3';
    const loadImg = (src) => new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = `${src}?v=${v}`;
    });

    const [matchesImg, matchesSelImg, fieldTileImg] = await Promise.all([
      loadImg('assets/textures/Matches_Matches_rgba.png'),
      loadImg('assets/textures/Matches_Matches_Sel_rgba.png'),
      loadImg('assets/textures/Matches_Field_Tile_clean.png')
    ]);

    this.matchesImg = matchesImg;
    this.matchesSelImg = matchesSelImg;
    this.fieldTileImg = fieldTileImg;
    this.spritesLoaded = true;
  }

  loadLevel(lev) {
    this.currentLevel = lev;
    this.board = (lev.board || []).map(r => r.split(''));
    this.initialBoard = (lev.board || []).map(r => r.split(''));
    this.heldMatches = lev.add || 0;
    this.initialHeld = lev.add || 0;
    this.selectedMatch = null;
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

  render() {
    const lang = i18n.getLang();
    const taskText = lang === 'ru' && this.currentLevel?.task_ru
      ? this.currentLevel.task_ru
      : i18n.t(this.currentLevel?.task || 'Move matches to solve the puzzle');

    const titleText = i18n.t('Matches', 'Спички');

    this.container.innerHTML = `
      <div class="amaze-game-container matches-screen">
        <!-- Authentic Amaze Top Header Bar -->
        <div class="amaze-header-bar">
          <button class="amaze-header-btn amaze-menu-btn" id="btnMatchesMenu" title="${i18n.t('Menu', 'Меню')}">
            <span class="bar-icon">☰</span>
          </button>
          <div class="amaze-header-title">${titleText}</div>
          <button class="amaze-header-btn amaze-help-btn" id="btnMatchesHelp" title="${i18n.t('Help', 'Справка')}">
            <span class="help-q">?</span>
          </button>
        </div>

        <!-- Authentic Sub-header Pause Bar -->
        <div class="amaze-pause-bar matches-pause-bar">
          <div class="matches-info-left" id="matchesHandInfo">
            ${i18n.t('In hand', 'В руке')}: <strong id="matchesHandCount">${this.heldMatches}</strong>
          </div>
          <button class="amaze-pause-capsule" id="btnMatchesPause" title="${i18n.t('Paused')}">
            <span class="pause-bars">❚❚</span>
          </button>
          <div class="matches-info-right" id="matchesTimeVal">
            00:00
          </div>
        </div>

        <!-- Matches Task Card -->
        <div class="amaze-matches-task-card">
          <p class="amaze-task-text">${taskText}</p>
        </div>

        <!-- Matches Board Wrapper -->
        <div class="amaze-board-wrapper matches-board-wrap">
          <div class="amaze-matches-frame" id="matchesBoardFrame">
            <canvas id="matchesCanvas" width="442" height="442"></canvas>
          </div>
        </div>

        <!-- Authentic Amaze Bottom Control Toolbar -->
        <div class="amaze-matches-toolbar">
          <button class="matches-tool-btn" id="btnResetMatches" title="${i18n.t('Reset', 'Сброс')}">
            <img src="assets/textures/Matches_ResetBtn_Rel.png" alt="Reset" />
          </button>

          <button class="matches-tool-btn" id="btnRotLeftMatches" title="${i18n.t('Rotate Left', 'Поворот влево')}">
            <img src="assets/textures/Matches_RotLeftBtn_Rel.png" alt="Rotate Left" />
          </button>

          <button class="matches-tool-btn" id="btnRotRightMatches" title="${i18n.t('Rotate Right', 'Поворот вправо')}">
            <img src="assets/textures/Matches_RotRightBtn_Rel.png" alt="Rotate Right" />
          </button>

          <button class="matches-tool-btn" id="btnMinusMatches" title="${i18n.t('Remove Match', 'Убрать')}">
            <img src="assets/textures/Matches_MinusBtn_Rel.png" id="imgMinusBtn" alt="Minus" />
          </button>

          <button class="matches-tool-btn" id="btnPlusMatches" title="${i18n.t('Place Match', 'Поставить')}">
            <img src="assets/textures/Matches_PlusBtn_Rel.png" id="imgPlusBtn" alt="Plus" />
          </button>

          <button class="matches-tool-btn btn-ok" id="btnCheckMatches" title="${i18n.t('Check', 'Проверить')}">
            <img src="assets/textures/Matches_OkBtn_Rel.png" alt="OK" />
          </button>
        </div>
      </div>
    `;

    this.canvas = this.container.querySelector('#matchesCanvas');
    this.ctx = this.canvas.getContext('2d');

    this.drawCanvasBoard();
    this.bindEvents();
    this.bindPointerEvents();
    this.updateStatsBar();
    this.updateToolbarButtons();
  }

  drawCanvasBoard() {
    if (!this.ctx || !this.board.length) return;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const S = w / 13;

    // 1. Draw authentic seamless felt table background
    if (this.fieldTileImg) {
      const pat = this.ctx.createPattern(this.fieldTileImg, 'repeat');
      this.ctx.fillStyle = pat;
      this.ctx.fillRect(0, 0, w, h);
    } else {
      this.ctx.fillStyle = '#2b5278';
      this.ctx.fillRect(0, 0, w, h);
    }

    // 2. Draw subtle coordinate dots at grid vertices (intersections)
    this.ctx.fillStyle = 'rgba(15, 75, 118, 0.35)';
    for (let r = 1; r <= 11; r++) {
      for (let c = 1; c <= 11; c++) {
        const vx = c * S + S / 2;
        const vy = r * S + S / 2;
        this.ctx.beginPath();
        this.ctx.arc(vx, vy, 1.5, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }

    // 3. Highlight potential placement slots if hand has matches, a match is selected, or currently dragging
    if (this.heldMatches > 0 || this.selectedMatch || (this.dragState && this.dragState.isDragging)) {
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
      for (let r = 1; r <= 11; r++) {
        for (let c = 1; c <= 11; c++) {
          if (this.board[r][c] === '.') {
            const cx = c * S + S / 2;
            const cy = r * S + S / 2;
            this.ctx.fillRect(cx - S * 0.42, cy - S * 0.42, S * 0.84, S * 0.84);
          }
        }
      }
    }

    // 4. Draw static matches on the board
    for (let r = 0; r < 13; r++) {
      for (let c = 0; c < 13; c++) {
        const val = this.board[r][c];
        if (val !== '.') {
          const isBeingDragged = this.dragState && this.dragState.isDragging &&
                                 this.dragState.originR === r && this.dragState.originC === c;
          if (isBeingDragged) {
            // Draw faint ghost at origin slot
            this.ctx.save();
            this.ctx.globalAlpha = 0.22;
            this.drawMatch(r, c, val, false);
            this.ctx.restore();
          } else {
            const isSelected = (this.selectedMatch && this.selectedMatch.r === r && this.selectedMatch.c === c);
            this.drawMatch(r, c, val, isSelected);
          }
        }
      }
    }

    // 5. If currently dragging, draw ghost preview at hover slot + lifted match following cursor
    if (this.dragState && this.dragState.isDragging) {
      const { targetR, targetC, val, curX, curY } = this.dragState;

      // Ghost preview at target slot
      if (targetR !== null && targetC !== null) {
        this.ctx.save();
        this.ctx.globalAlpha = 0.45;
        this.drawMatch(targetR, targetC, this.inferOrientation(targetR, targetC, val), true);
        this.ctx.restore();
      }

      // Lifted match following finger/cursor with realistic tactile drop-shadow
      this.ctx.save();
      this.ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
      this.ctx.shadowBlur = 12;
      this.ctx.shadowOffsetY = 8;
      this.drawMatchAt(curX, curY, val, true, 1.08);
      this.ctx.restore();
    }

    // Update hand counter in sub-bar
    const countEl = this.container.querySelector('#matchesHandCount');
    if (countEl) countEl.textContent = this.heldMatches;
  }

  drawMatch(r, c, val, isSelected) {
    const S = this.canvas.width / 13;
    const cx = c * S + S / 2;
    const cy = r * S + S / 2;
    this.drawMatchAt(cx, cy, val, isSelected, 1.0);
  }

  drawMatchAt(cx, cy, val, isSelected, scale = 1.0) {
    const img = isSelected ? (this.matchesSelImg || this.matchesImg) : this.matchesImg;
    const S = this.canvas.width / 13;
    const targetSpan = 2.0 * S;

    let frameIdx = 0;
    let baseSpan = 82.0;

    if (val === '-') {
      frameIdx = 2; // Horizontal, head right
      baseSpan = 82.0;
    } else if (val === '|') {
      frameIdx = 0; // Vertical, head top
      baseSpan = 82.0;
    } else if (val === '/') {
      frameIdx = 1; // Diagonal /, head top-right
      baseSpan = 75.0;
    } else if (val === '\\') {
      frameIdx = 3; // Diagonal \, head bottom-right
      baseSpan = 75.0;
    }

    if (img) {
      const dw = (98.0 / baseSpan) * targetSpan * scale;
      const dh = dw;
      const sy = frameIdx * 98;
      this.ctx.drawImage(img, 0, sy, 98, 98, cx - dw / 2, cy - dh / 2, dw, dh);
    } else {
      this.drawFallbackMatch(cx, cy, val, S, S, isSelected);
    }
  }

  drawFallbackMatch(cx, cy, val, cellW, cellH, isSelected) {
    this.ctx.save();
    this.ctx.translate(cx, cy);

    let angle = 0;
    if (val === '-') angle = Math.PI / 2;
    else if (val === '/') angle = -Math.PI / 4;
    else if (val === '\\') angle = Math.PI / 4;
    this.ctx.rotate(angle);

    const matchLen = cellH * 2.0;
    const thickness = 6;

    // Wood body
    this.ctx.fillStyle = isSelected ? '#fffae0' : '#ecd5b3';
    this.ctx.fillRect(-thickness / 2, -matchLen / 2, thickness, matchLen);

    // Sulfur head
    this.ctx.fillStyle = isSelected ? '#e74c3c' : '#c0392b';
    this.ctx.beginPath();
    this.ctx.arc(0, -matchLen / 2 + 3, thickness * 0.9, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.restore();
  }

  inferOrientation(r, c, fallbackVal) {
    if (fallbackVal === '/' || fallbackVal === '\\') {
      // If target is in a diagonal region, preserve diagonal slope
      if ((r >= 8 && r <= 10) || (r % 2 === 1 && c % 2 === 1)) {
        return fallbackVal;
      }
    }
    // Standard orthogonal grid orientation rule
    if (r % 2 === 1 && c % 2 === 0) return '|';
    if (r % 2 === 0 && c % 2 === 1) return '-';
    if (r % 2 === 1) return '-';
    if (r % 2 === 0) return '|';
    return fallbackVal || '-';
  }

  bindPointerEvents() {
    const getCanvasPos = (clientX, clientY) => {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
      };
    };

    const getCellFromPos = (x, y) => {
      const S = this.canvas.width / 13;
      const c = Math.floor(x / S);
      const r = Math.floor(y / S);
      return { r, c };
    };

    this.canvas.addEventListener('pointerdown', (e) => {
      if (this.isPaused || this.isLocked) return;
      const pos = getCanvasPos(e.clientX, e.clientY);
      const { r, c } = getCellFromPos(pos.x, pos.y);

      if (r < 0 || r >= 13 || c < 0 || c >= 13) return;
      const val = this.board[r][c];

      if (val !== '.') {
        // Player touched a matchstick on the board
        this.dragState = {
          isPointerDown: true,
          isDragging: false,
          originR: r,
          originC: c,
          val: val,
          startX: e.clientX,
          startY: e.clientY,
          curX: pos.x,
          curY: pos.y,
          targetR: null,
          targetC: null,
          pointerId: e.pointerId
        };
        try { this.canvas.setPointerCapture(e.pointerId); } catch (_) {}
      } else {
        // Touched an empty slot directly
        this.handleEmptySlotTouch(r, c);
      }
    });

    this.canvas.addEventListener('pointermove', (e) => {
      if (!this.dragState || !this.dragState.isPointerDown) return;
      const dist = Math.hypot(e.clientX - this.dragState.startX, e.clientY - this.dragState.startY);

      if (dist > 6 || this.dragState.isDragging) {
        this.dragState.isDragging = true;
        const pos = getCanvasPos(e.clientX, e.clientY);
        this.dragState.curX = pos.x;
        this.dragState.curY = pos.y;

        const S = this.canvas.width / 13;
        const targetC = Math.floor(pos.x / S);
        const targetR = Math.floor(pos.y / S);

        if (targetR >= 1 && targetR <= 11 && targetC >= 1 && targetC <= 11) {
          if (this.board[targetR][targetC] === '.' || (targetR === this.dragState.originR && targetC === this.dragState.originC)) {
            this.dragState.targetR = targetR;
            this.dragState.targetC = targetC;
          } else {
            this.dragState.targetR = null;
            this.dragState.targetC = null;
          }
        } else {
          this.dragState.targetR = null;
          this.dragState.targetC = null;
        }

        this.drawCanvasBoard();
      }
    });

    const handlePointerEnd = (e) => {
      if (!this.dragState) return;
      const { isDragging, originR, originC, targetR, targetC, val, pointerId } = this.dragState;

      try { this.canvas.releasePointerCapture(pointerId); } catch (_) {}

      if (isDragging) {
        if (targetR !== null && targetC !== null && (targetR !== originR || targetC !== originC)) {
          // Successfully dragged to a new empty slot!
          const newOrientation = this.inferOrientation(targetR, targetC, val);
          this.board[originR][originC] = '.';
          this.board[targetR][targetC] = newOrientation;
          this.selectedMatch = { r: targetR, c: targetC };
          audio.play('rotate');
        } else {
          // Snap back to origin
          audio.play('click');
        }
      } else {
        // Simple tap on the match
        this.handleMatchTap(originR, originC);
      }

      this.dragState = null;
      this.updateToolbarButtons();
      this.drawCanvasBoard();
    };

    this.canvas.addEventListener('pointerup', handlePointerEnd);
    this.canvas.addEventListener('pointercancel', () => {
      if (this.dragState) {
        try { this.canvas.releasePointerCapture(this.dragState.pointerId); } catch (_) {}
        this.dragState = null;
        this.drawCanvasBoard();
      }
    });
  }

  handleMatchTap(r, c) {
    if (this.selectedMatch && this.selectedMatch.r === r && this.selectedMatch.c === c) {
      // Tap on already selected match rotates it!
      this.handleRotate('right');
    } else {
      // Select this match
      this.selectedMatch = { r, c };
      audio.play('click');
    }
  }

  handleEmptySlotTouch(r, c) {
    // If a match is selected, move it to this slot
    if (this.selectedMatch) {
      const oldR = this.selectedMatch.r;
      const oldC = this.selectedMatch.c;
      const oldVal = this.board[oldR][oldC];
      const targetType = this.inferOrientation(r, c, oldVal);

      this.board[oldR][oldC] = '.';
      this.board[r][c] = targetType;
      this.selectedMatch = { r, c };
      audio.play('rotate');
      this.updateToolbarButtons();
      this.drawCanvasBoard();
      return;
    }

    // If hand has matches, place one here
    if (this.heldMatches > 0) {
      const placeType = this.inferOrientation(r, c, '-');
      this.board[r][c] = placeType;
      this.heldMatches--;
      this.selectedMatch = { r, c };
      audio.play('plusMatch');
      this.updateToolbarButtons();
      this.drawCanvasBoard();
      return;
    }
  }

  handleCanvasClick(clientX, clientY) {
    // Programmatic click handler for test runner and click events
    if (this.isPaused || this.isLocked) return;
    const rect = this.canvas.getBoundingClientRect();
    const x = (clientX - rect.left) * (this.canvas.width / rect.width);
    const y = (clientY - rect.top) * (this.canvas.height / rect.height);

    const S = this.canvas.width / 13;
    const c = Math.floor(x / S);
    const r = Math.floor(y / S);

    if (r < 0 || r >= 13 || c < 0 || c >= 13) return;

    if (this.board[r][c] !== '.') {
      this.handleMatchTap(r, c);
    } else {
      this.handleEmptySlotTouch(r, c);
    }
    this.updateToolbarButtons();
    this.drawCanvasBoard();
  }

  handleRotate(direction = 'right') {
    if (!this.selectedMatch) return;
    const { r, c } = this.selectedMatch;
    const curVal = this.board[r][c];
    if (curVal === '.') return;

    // Rotation cycle: '-' <-> '|' or '/' <-> '\'
    audio.play('rotate');
    if (curVal === '-') this.board[r][c] = '|';
    else if (curVal === '|') this.board[r][c] = '-';
    else if (curVal === '/') this.board[r][c] = '\\';
    else if (curVal === '\\') this.board[r][c] = '/';

    this.drawCanvasBoard();
  }

  handleMinus() {
    if (!this.selectedMatch) return;
    const { r, c } = this.selectedMatch;
    if (this.board[r][c] !== '.') {
      this.board[r][c] = '.';
      this.heldMatches++;
      this.selectedMatch = null;
      audio.play('minusMatch');
      this.updateToolbarButtons();
      this.drawCanvasBoard();
    }
  }

  handlePlus() {
    if (this.heldMatches <= 0) return;
    // Find first available slot in central region
    for (let r = 5; r <= 7; r++) {
      for (let c = 5; c <= 7; c++) {
        if (this.board[r][c] === '.') {
          const isHorizSlot = (r % 2 === 0 && c % 2 === 1);
          const isVertSlot = (r % 2 === 1 && c % 2 === 0);
          if (isHorizSlot || isVertSlot) {
            this.board[r][c] = isHorizSlot ? '-' : '|';
            this.heldMatches--;
            this.selectedMatch = { r, c };
            audio.play('plusMatch');
            this.updateToolbarButtons();
            this.drawCanvasBoard();
            return;
          }
        }
      }
    }
  }

  updateToolbarButtons() {
    const hasSelection = !!this.selectedMatch;
    const hasHand = this.heldMatches > 0;

    const minusBtn = this.container.querySelector('#btnMinusMatches');
    const plusBtn = this.container.querySelector('#btnPlusMatches');
    const rotLeftBtn = this.container.querySelector('#btnRotLeftMatches');
    const rotRightBtn = this.container.querySelector('#btnRotRightMatches');

    if (minusBtn) minusBtn.style.opacity = hasSelection ? '1' : '0.45';
    if (plusBtn) plusBtn.style.opacity = hasHand ? '1' : '0.45';
    if (rotLeftBtn) rotLeftBtn.style.opacity = hasSelection ? '1' : '0.45';
    if (rotRightBtn) rotRightBtn.style.opacity = hasSelection ? '1' : '0.45';
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

    this.container.querySelector('#btnResetMatches')?.addEventListener('click', () => {
      audio.play('reset');
      this.loadLevel(this.currentLevel);
    });

    this.container.querySelector('#btnRotLeftMatches')?.addEventListener('click', () => {
      this.handleRotate('left');
    });

    this.container.querySelector('#btnRotRightMatches')?.addEventListener('click', () => {
      this.handleRotate('right');
    });

    this.container.querySelector('#btnMinusMatches')?.addEventListener('click', () => {
      this.handleMinus();
    });

    this.container.querySelector('#btnPlusMatches')?.addEventListener('click', () => {
      this.handlePlus();
    });

    this.container.querySelector('#btnCheckMatches')?.addEventListener('click', () => {
      this.checkSolution();
    });
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
    // Player must use all required matches
    if (this.heldMatches > 0) {
      audio.play('wrong');
      this.flashWrong();
      alert(i18n.t('You must use all matches from your hand!', 'Используйте все спички из руки!'));
      return;
    }

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
    const modal = document.createElement('div');
    modal.className = 'amaze-modal-overlay active matches-results';
    modal.innerHTML = `<div class="restored-results">${section
      ? resultsMarkup(section, buildResults(section, {DIST: prize, P1: this.mistakesCount, TOTAL: total}, this.diff), i18n.t('Continue', 'Продолжить'))
      : `<p>${finalScore}</p><button data-finish>${i18n.t('Continue', 'Продолжить')}</button>`}</div>`;
    document.body.appendChild(modal);
    this.resultsModal = modal;
    revealResults(modal);
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
    this.resultsModal?.remove();
    this.resultsModal = null;
  }
}
