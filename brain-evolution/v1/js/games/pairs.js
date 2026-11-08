// SPB Brain Evolution - Authentic Pairs (Пары / Memorics) Mini-Game
// Pixel-perfect restoration based on original binary and layout specs (_PAIRS_INO.ino & _GEOMETRY_INO)

import { audio } from '../audio.js';
import { storage } from '../storage.js';
import { i18n } from '../i18n.js';
import { loadOriginalConfig } from '../original.js';
import { buildResults, resultsMarkup, revealResults } from './results-window.js';

// Authentic level shapes extracted from _GEOMETRY_INO (6 columns x 8 rows)
// '.' = empty/disabled tile (disabled_item.png), '*' = active card position (closed_item.png)
const AUTHENTIC_LEVELS = {
  easy: [
    {
      id: 'pairs_lev_l0_0',
      rows: [
        '......',
        '......',
        '.*..*.',
        '.****.',
        '.****.',
        '.*..*.',
        '......',
        '......'
      ]
    },
    {
      id: 'pairs_lev_l0_1',
      rows: [
        '......',
        '......',
        '..**..',
        '.****.',
        '.****.',
        '..**..',
        '......',
        '......'
      ]
    },
    {
      id: 'pairs_lev_l0_2',
      rows: [
        '......',
        '......',
        '.*.*.*',
        '*.*.*.',
        '.*.*.*',
        '*.*.*.',
        '......',
        '......'
      ]
    },
    {
      id: 'pairs_lev_l0_3',
      rows: [
        '......',
        '..**..',
        '..**..',
        '..**..',
        '.****.',
        '..**..',
        '......',
        '......'
      ]
    },
    {
      id: 'pairs_lev_l0_4',
      rows: [
        '......',
        '..*...',
        '..*...',
        '****..',
        '..****',
        '...*..',
        '...*..',
        '......'
      ]
    },
    {
      id: 'pairs_lev_l0_5',
      rows: [
        '......',
        '......',
        '.*.*.*',
        '******',
        '*.*.*.',
        '......',
        '......',
        '......'
      ]
    },
    {
      id: 'pairs_lev_l0_6',
      rows: [
        '......',
        '..**..',
        '..**..',
        '......',
        '......',
        '**..**',
        '**..**',
        '......'
      ]
    },
    {
      id: 'pairs_lev_l0_7',
      rows: [
        '*....*',
        '.*..*.',
        '..**..',
        '......',
        '......',
        '..**..',
        '.*..*.',
        '*....*'
      ]
    }
  ],
  medium: [
    {
      id: 'pairs_lev_l1_0',
      rows: [
        '..**..',
        '..**..',
        '.****.',
        '******',
        '..**..',
        '..**..',
        '..**..',
        '..**..'
      ]
    },
    {
      id: 'pairs_lev_l1_1',
      rows: [
        '..**..',
        '.****.',
        '******',
        '..**..',
        '..**..',
        '******',
        '.****.',
        '..**..'
      ]
    },
    {
      id: 'pairs_lev_l1_2',
      rows: [
        '******',
        '******',
        '.*..*.',
        '.*..*.',
        '.*..*.',
        '.*..*.',
        '******',
        '******'
      ]
    },
    {
      id: 'pairs_lev_l1_3',
      rows: [
        '******',
        '*....*',
        '*.**.*',
        '*.*..*',
        '*..*.*',
        '*.**.*',
        '*....*',
        '******'
      ]
    },
    {
      id: 'pairs_lev_l1_4',
      rows: [
        '..**..',
        '.****.',
        '******',
        '******',
        '..**..',
        '..**..',
        '..**..',
        '..**..'
      ]
    },
    {
      id: 'pairs_lev_l1_5',
      rows: [
        '******',
        '*....*',
        '*.**.*',
        '*....*',
        '*....*',
        '*.**.*',
        '*....*',
        '******'
      ]
    },
    {
      id: 'pairs_lev_l1_6',
      rows: [
        '***...',
        '***...',
        '***...',
        '***...',
        '...***',
        '...***',
        '...***',
        '...***'
      ]
    },
    {
      id: 'pairs_lev_l1_7',
      rows: [
        '*.*.*.',
        '.*.*.*',
        '*.*.*.',
        '.*.*.*',
        '*.*.*.',
        '.*.*.*',
        '*.*.*.',
        '.*.*.*'
      ]
    }
  ],
  hard: [
    {
      id: 'pairs_lev_l2_0',
      rows: [
        '*.**.*',
        '..**..',
        '******',
        '******',
        '******',
        '******',
        '*.**.*',
        '******'
      ]
    },
    {
      id: 'pairs_lev_l2_1',
      rows: [
        '******',
        '**..**',
        '******',
        '*.**.*',
        '*.**.*',
        '******',
        '**..**',
        '******'
      ]
    },
    {
      id: 'pairs_lev_l2_2',
      rows: [
        '******',
        '*...**',
        '*.*.**',
        '******',
        '*.*.**',
        '*...**',
        '******',
        '******'
      ]
    },
    {
      id: 'pairs_lev_l2_3',
      rows: [
        '******',
        '*.**.*',
        '**..**',
        '**..**',
        '*.**.*',
        '******',
        '******',
        '******'
      ]
    },
    {
      id: 'pairs_lev_l2_4',
      rows: [
        '******',
        '******',
        '**..**',
        '**..**',
        '**..**',
        '**..**',
        '******',
        '******'
      ]
    },
    {
      id: 'pairs_lev_l2_5',
      rows: [
        '**.***',
        '****.*',
        '*****.',
        '****.*',
        '***.**',
        '**.***',
        '*.****',
        '.*****'
      ]
    },
    {
      id: 'pairs_lev_l2_6',
      rows: [
        '.****.',
        '******',
        '******',
        '******',
        '******',
        '******',
        '******',
        '.****.'
      ]
    }
  ]
};

// Original config parameters from _PAIRS_INO.ino
const DIFFICULTY_CONFIG = {
  easy: {
    levelCost: 2000,
    wrongPairCost: -500,
    freeLooksCount: 1,
    genPairsTypeCount: 4,
    fieldsInTraining: 3,
    pairsClosingDelay: 700
  },
  medium: {
    levelCost: 5000,
    wrongPairCost: -500,
    freeLooksCount: 2,
    genPairsTypeCount: 8,
    fieldsInTraining: 2,
    pairsClosingDelay: 700
  },
  hard: {
    levelCost: 18000,
    wrongPairCost: -500,
    freeLooksCount: 1,
    genPairsTypeCount: 12,
    fieldsInTraining: 1,
    pairsClosingDelay: 700
  }
};

export class PairsGame {
  constructor(container, onComplete, onOpenMenu, onOpenHelp) {
    this.container = container;
    this.defer = (callback, delay) => setTimeout(callback, delay);
    this.onComplete = onComplete;
    this.onOpenMenu = onOpenMenu;
    this.onOpenHelp = onOpenHelp;

    this.difficulty = 'easy';
    this.config = DIFFICULTY_CONFIG.easy;
    this.currentFieldIndex = 0;
    this.totalFields = 3;

    // Board state: 48 cells (6 columns x 8 rows)
    this.cellsData = [];
    this.firstCard = null;
    this.secondCard = null;
    this.closeTimer = null;
    this.matchedPairsCount = 0;
    this.totalPairsInField = 0;

    // Stats across entire session
    this.totalScore = 0;
    this.wrongPairsCount = 0;
    this.moves = 0;
    this.timer = 0;
    this.timerInterval = null;
    this.isPaused = false;
    this.isLocked = false;

    // D-Pad cursor navigation
    this.cursorIndex = 0;
    this.handleKeyDown = this.handleKeyDown.bind(this);
  }

  init(difficulty = 'easy') {
    this.difficulty = difficulty;
    this.config = DIFFICULTY_CONFIG[difficulty] || DIFFICULTY_CONFIG.easy;
    this.totalFields = this.config.fieldsInTraining;
    this.currentFieldIndex = 0;

    this.totalScore = 0;
    this.wrongPairsCount = 0;
    this.moves = 0;
    this.timer = 0;
    this.isPaused = false;
    this.isLocked = false;

    this.render();
    this.startTimer();
    this.loadField(0);

    window.removeEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keydown', this.handleKeyDown);
  }

  startTimer() {
    clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      if (!this.isPaused) {
        this.timer++;
        this.updateStatsBar();
      }
    }, 1000);
  }

  loadField(fieldIdx) {
    this.currentFieldIndex = fieldIdx;
    this.firstCard = null;
    this.secondCard = null;
    clearTimeout(this.closeTimer);
    this.closeTimer = null;
    this.isLocked = false;

    const levelPool = AUTHENTIC_LEVELS[this.difficulty] || AUTHENTIC_LEVELS.easy;
    // Pick level template (cycle through or pick random if multiple)
    const levelTemplate = levelPool[fieldIdx % levelPool.length];
    const rows = levelTemplate.rows;

    // Find all active card positions
    const activePositions = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 6; c++) {
        const char = rows[r][c];
        if (char === '*') {
          activePositions.push(r * 6 + c);
        }
      }
    }

    const totalActiveCards = activePositions.length;
    this.totalPairsInField = totalActiveCards / 2;
    this.matchedPairsCount = 0;

    // Generate pairs according to m_nGenPairsTypeCount
    // Select K distinct item IDs from [1..12]
    const availableTypes = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    availableTypes.sort(() => Math.random() - 0.5);
    const typeCount = Math.min(this.config.genPairsTypeCount, this.totalPairsInField);
    const chosenTypes = availableTypes.slice(0, typeCount);

    // Distribute chosenTypes across the pairs
    const deckItemIds = [];
    for (let p = 0; p < this.totalPairsInField; p++) {
      const type = chosenTypes[p % chosenTypes.length];
      deckItemIds.push(type, type);
    }
    // Shuffle deck
    for (let i = deckItemIds.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deckItemIds[i], deckItemIds[j]] = [deckItemIds[j], deckItemIds[i]];
    }

    // Initialize 48 cells (6 columns x 8 rows)
    this.cellsData = [];
    let cardPointer = 0;
    for (let idx = 0; idx < 48; idx++) {
      const r = Math.floor(idx / 6);
      const c = idx % 6;
      const isActive = rows[r][c] === '*';

      if (isActive) {
        const itemId = deckItemIds[cardPointer++];
        this.cellsData.push({
          index: idx,
          r,
          c,
          isActive: true,
          itemId,
          flipped: false,
          matched: false
        });
      } else {
        this.cellsData.push({
          index: idx,
          r,
          c,
          isActive: false,
          itemId: 0,
          flipped: false,
          matched: false
        });
      }
    }

    // Default cursor to the first active card
    if (activePositions.length > 0) {
      this.cursorIndex = activePositions[0];
    }

    this.renderBoard();
    this.updateStatsBar();
  }

  render() {
    const titleText = i18n.t('Pairs', 'Пары');
    this.container.innerHTML = `
      <div class="spb-game-container pairs-screen">
        <!-- Authentic SPB Top Header Bar -->
        <div class="spb-header-bar">
          <button class="spb-header-btn spb-menu-btn" id="btnPairsMenu" title="${i18n.t('Menu', 'Меню')}">
            <span class="bar-icon">☰</span>
          </button>
          <div class="spb-header-title">${titleText}</div>
          <button class="spb-header-btn spb-help-btn" id="btnPairsHelp" title="${i18n.t('Help', 'Справка')}">
            <span class="help-q">?</span>
          </button>
        </div>

        <!-- Authentic Sub-header Pause / Progress Bar -->
        <div class="spb-pause-bar pairs-pause-bar">
          <div class="pairs-info-left" id="pairsFieldIndicator">
            ${i18n.t('Field', 'Поле')} 1/${this.totalFields}
          </div>
          <button class="spb-pause-capsule" id="btnPairsPause" title="${i18n.t('Paused')}">
            <span class="pause-bars">❚❚</span>
          </button>
          <div class="pairs-info-right" id="pairsTimeIndicator">
            00:00
          </div>
        </div>

        <!-- Authentic 6x8 Board Frame -->
        <div class="spb-board-wrapper pairs-board-wrapper">
          <div class="spb-pairs-frame" id="pairsBoardFrame">
            <div class="spb-pairs-grid" id="pairsGrid"></div>
          </div>
        </div>
      </div>
    `;

    this.bindHeaderEvents();
  }

  renderBoard() {
    const gridEl = this.container.querySelector('#pairsGrid');
    if (!gridEl) return;
    gridEl.innerHTML = '';

    this.cellsData.forEach((cellData, idx) => {
      const cell = document.createElement('div');
      cell.dataset.index = idx;

      if (!cellData.isActive) {
        // Disabled / empty board space
        cell.className = 'spb-pairs-cell cell-empty';
      } else {
        // Active interactive card
        cell.className = 'spb-pairs-cell cell-card';
        if (idx === this.cursorIndex) {
          cell.classList.add('has-cursor');
        }

        cell.innerHTML = `
          <div class="card-inner">
            <div class="card-front"></div>
            <div class="card-back" style="background-image: url('assets/textures/item_${cellData.itemId}_opened.png');"></div>
          </div>
        `;

        cell.addEventListener('click', (e) => {
          e.preventDefault();
          this.handleCardClick(idx);
        });
      }

      gridEl.appendChild(cell);
    });
  }

  updateStatsBar() {
    const fieldInd = this.container.querySelector('#pairsFieldIndicator');
    if (fieldInd) {
      fieldInd.textContent = `${i18n.t('Field', 'Поле')} ${this.currentFieldIndex + 1}/${this.totalFields}`;
    }

    const timeInd = this.container.querySelector('#pairsTimeIndicator');
    if (timeInd) {
      const mins = String(Math.floor(this.timer / 60)).padStart(2, '0');
      const secs = String(this.timer % 60).padStart(2, '0');
      timeInd.textContent = `${mins}:${secs}`;
    }
  }

  handleCardClick(idx) {
    if (this.isPaused) return;

    const cellData = this.cellsData[idx];
    if (!cellData || !cellData.isActive || cellData.matched || cellData.flipped) {
      return;
    }

    const gridEl = this.container.querySelector('#pairsGrid');
    const cellEl = gridEl?.children[idx];
    if (!cellEl) return;

    // Update cursor position
    this.setCursor(idx);

    // If two cards were already open and mismatched, immediately resolve them
    // so user clicking a 3rd card feels snappy without waiting for timer
    if (this.firstCard && this.secondCard) {
      clearTimeout(this.closeTimer);
      this.closeMismatchedPair();
    }

    // Flip this card
    cellData.flipped = true;
    cellData.looks = (cellData.looks || 0) + 1;
    cellEl.classList.add('flipped');
    audio.play('click');

    if (!this.firstCard) {
      // First card opened
      this.firstCard = { index: idx, cellData, cellEl };
    } else {
      // Second card opened
      this.secondCard = { index: idx, cellData, cellEl };
      this.moves++;
      this.checkPairMatch();
    }
  }

  checkPairMatch() {
    const first = this.firstCard;
    const second = this.secondCard;

    if (first.cellData.itemId === second.cellData.itemId) {
      // MATCH!
      audio.play('good');
      first.cellData.matched = true;
      second.cellData.matched = true;

      // Update appearance to solved state (item_X_solved.png)
      first.cellEl.classList.add('matched');
      second.cellEl.classList.add('matched');

      const firstBack = first.cellEl.querySelector('.card-back');
      if (firstBack) {
        firstBack.style.backgroundImage = `url('assets/textures/item_${first.cellData.itemId}_solved.png')`;
      }
      const secondBack = second.cellEl.querySelector('.card-back');
      if (secondBack) {
        secondBack.style.backgroundImage = `url('assets/textures/item_${second.cellData.itemId}_solved.png')`;
      }

      this.firstCard = null;
      this.secondCard = null;
      this.matchedPairsCount++;

      // Check if all pairs on this field are matched
      if (this.matchedPairsCount >= this.totalPairsInField) {
        this.handleFieldCompletion();
      }
    } else {
      // MISMATCH! The original (FUN_4a0c3a14) counts a wrong pair only when both tiles have
      // been looked at more than m_nFreeLooksCount times; then both counters restart at 1.
      const free = this.config.freeLooksCount ?? 1;
      if (first.cellData.looks > free && second.cellData.looks > free) {
        audio.play('wrong');
        this.wrongPairsCount++;
        first.cellData.looks = 1;
        second.cellData.looks = 1;
        // Flash authentic red border around the board frame
        const frameEl = this.container.querySelector('#pairsBoardFrame');
        if (frameEl) {
          frameEl.classList.add('wrong-move');
          this.defer(() => frameEl.classList.remove('wrong-move'), 350);
        }
      }

      // Schedule closing after closing delay
      this.closeTimer = this.defer(() => {
        this.closeMismatchedPair();
      }, this.config.pairsClosingDelay);
    }
  }

  closeMismatchedPair() {
    if (this.firstCard && this.secondCard) {
      this.firstCard.cellData.flipped = false;
      this.secondCard.cellData.flipped = false;

      this.firstCard.cellEl.classList.remove('flipped');
      this.secondCard.cellEl.classList.remove('flipped');

      this.firstCard = null;
      this.secondCard = null;
    }
  }

  handleFieldCompletion() {
    const nextFieldIdx = this.currentFieldIndex + 1;

    if (nextFieldIdx < this.totalFields) {
      // More fields remain in this training session
      audio.play('good');
      this.defer(() => {
        this.loadField(nextFieldIdx);
      }, 600);
    } else {
      // All fields in session completed!
      clearInterval(this.timerInterval);
      audio.play('levelUp');

      // CPairs_GameWnd v19: total = level costs of the solved fields + wrong pairs * m_nWrongPairCost
      // (no time penalty).
      const levelSum = this.config.levelCost * this.totalFields;
      const total = levelSum + this.wrongPairsCount * this.config.wrongPairCost;
      const finalScore = Math.max(0, total);
      if (finalScore > 0) storage.recordGameScore('pairs', finalScore);

      this.defer(() => {
        this.showResultsModal(finalScore, levelSum, total);
      }, 500);
    }
  }

  // [pairs_show_results]: Level Scores (@DIST) and Wrong Answers (@P2 x @P7), then the total.
  async showResultsModal(finalScore, levelSum = finalScore, total = finalScore) {
    let section = null;
    try { section = (await loadOriginalConfig()).games.pairs_show_results; } catch (e) { console.warn('Original config unavailable:', e); }
    if (this.destroyed) return;
    const modal = document.createElement('div');
    modal.className = 'spb-modal-overlay active pairs-results';
    const diff = {easy: 0, medium: 1, hard: 2}[this.difficulty] ?? 0;
    modal.innerHTML = `<div class="restored-results">${section
      ? resultsMarkup(section, buildResults(section, {DIST: levelSum, P1: levelSum, P2: this.wrongPairsCount, P7: this.config.wrongPairCost, TIME: 1, TOTAL: total}, diff), i18n.t('Continue', 'Продолжить'))
      : `<p>${finalScore}</p><button data-finish>${i18n.t('Continue', 'Продолжить')}</button>`}</div>`;
    modal.querySelector('[data-finish]').id = 'btnPairsDone';
    document.body.appendChild(modal);
    this.resultsModal = modal;
    revealResults(modal);
    modal.querySelector('#btnPairsDone')?.addEventListener('click', () => {
      audio.play('click');
      modal.remove();
      this.destroy();
      this.onComplete(finalScore > 0 ? finalScore : null);
    });
  }

  setCursor(newIdx) {
    const gridEl = this.container.querySelector('#pairsGrid');
    if (!gridEl) return;

    if (this.cursorIndex >= 0 && this.cursorIndex < gridEl.children.length) {
      gridEl.children[this.cursorIndex]?.classList.remove('has-cursor');
    }
    this.cursorIndex = Math.max(0, Math.min(47, newIdx));
    gridEl.children[this.cursorIndex]?.classList.add('has-cursor');
  }

  handleKeyDown(e) {
    if (this.isPaused) return;

    const r = Math.floor(this.cursorIndex / 6);
    const c = this.cursorIndex % 6;

    if (e.key === 'ArrowUp' && r > 0) {
      e.preventDefault();
      this.setCursor((r - 1) * 6 + c);
    } else if (e.key === 'ArrowDown' && r < 7) {
      e.preventDefault();
      this.setCursor((r + 1) * 6 + c);
    } else if (e.key === 'ArrowLeft' && c > 0) {
      e.preventDefault();
      this.setCursor(r * 6 + (c - 1));
    } else if (e.key === 'ArrowRight' && c < 5) {
      e.preventDefault();
      this.setCursor(r * 6 + (c + 1));
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.handleCardClick(this.cursorIndex);
    }
  }

  bindHeaderEvents() {
    this.container.querySelector('#btnPairsMenu')?.addEventListener('click', () => {
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

    this.container.querySelector('#btnPairsHelp')?.addEventListener('click', () => {
      audio.play('click');
      if (this.onOpenHelp) {
        this.onOpenHelp('pairs');
      }
    });

    this.container.querySelector('#btnPairsPause')?.addEventListener('click', () => {
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
    clearTimeout(this.closeTimer);
    window.removeEventListener('keydown', this.handleKeyDown);
    this.resultsModal?.remove();
    this.resultsModal = null;
  }
}
