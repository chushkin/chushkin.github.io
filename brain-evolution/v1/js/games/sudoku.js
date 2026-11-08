// SPB Brain Evolution - Authentic Sudoku (Судоку) Mini-Game
// Restored from the original layout & config files:
//   _SUDOKU_INO.ino          — window/field/keypad rects, theme sprites, scoring coefficients
//   _SUDOKU_PUZZLES2_INO.ino — 300 original puzzle patterns (+ _SUDOKU_PUZZLES3_INO.ino)
// Sprites decoded from extracted_dz/res/R_480x800/sudoku_*.group.bin (52x52 cells, 74x69 keys).

import { audio } from '../audio.js';
import { storage } from '../storage.js';
import { i18n } from '../i18n.js';
import { loadOriginalConfig, createRandom } from '../original.js';
import * as SudokuModel from './sudoku-model.js';
import { buildResults, resultsMarkup, revealResults } from './results-window.js';

const TEX = 'assets/textures/sudoku/';
const ASSET_VER = '20261021_sud1';

// [sudoku_game_wnd] + [sudoku_show_results] from _SUDOKU_INO.ino
const SUDOKU_CONFIG = {
  easy:   { levelCost: 7400,  wrongAnswerCfx: -500,  timePenaltyCfx: -20, pmCheatCost: -1500 },
  medium: { levelCost: 30000, wrongAnswerCfx: -1000, timePenaltyCfx: -50, pmCheatCost: -3000 },
  hard:   { levelCost: 22500, wrongAnswerCfx: -1500, timePenaltyCfx: -5,  pmCheatCost: -9500 }
};

// ---------- Pure solver helpers ----------
function boxOf(r, c) { return Math.floor(r / 3) * 3 + Math.floor(c / 3); }

// Counts solutions up to `limit`; fills `out` with the first solution found.
function solveGrid(cells, limit = 2, out = null) {
  const g = cells.slice();
  const rows = new Array(9).fill(0), cols = new Array(9).fill(0), boxes = new Array(9).fill(0);
  for (let i = 0; i < 81; i++) {
    const v = g[i];
    if (v) {
      const r = (i / 9) | 0, c = i % 9, bit = 1 << v;
      if ((rows[r] | cols[c] | boxes[boxOf(r, c)]) & bit) return 0; // invalid givens
      rows[r] |= bit; cols[c] |= bit; boxes[boxOf(r, c)] |= bit;
    }
  }
  let count = 0;
  const rec = () => {
    // pick the empty cell with the fewest candidates
    let best = -1, bestMask = 0, bestCnt = 10;
    for (let i = 0; i < 81; i++) {
      if (g[i]) continue;
      const r = (i / 9) | 0, c = i % 9;
      const mask = ~(rows[r] | cols[c] | boxes[boxOf(r, c)]) & 0x3fe;
      let cnt = 0; for (let m = mask; m; m &= m - 1) cnt++;
      if (cnt < bestCnt) { best = i; bestMask = mask; bestCnt = cnt; if (cnt <= 1) break; }
    }
    if (best === -1) {
      count++;
      if (out && count === 1) for (let i = 0; i < 81; i++) out[i] = g[i];
      return count >= limit;
    }
    if (bestCnt === 0) return false;
    const r = (best / 9) | 0, c = best % 9, b = boxOf(r, c);
    for (let v = 1; v <= 9; v++) {
      const bit = 1 << v;
      if (!(bestMask & bit)) continue;
      g[best] = v; rows[r] |= bit; cols[c] |= bit; boxes[b] |= bit;
      if (rec()) return true;
      g[best] = 0; rows[r] &= ~bit; cols[c] &= ~bit; boxes[b] &= ~bit;
    }
    return false;
  };
  rec();
  return count;
}


export class SudokuGame {
  constructor(container, onComplete, onOpenMenu, onOpenHelp) {
    this.container = container;
    this.defer = (callback, delay) => setTimeout(callback, delay);
    this.onComplete = onComplete;
    this.onOpenMenu = onOpenMenu;
    this.onOpenHelp = onOpenHelp;

    this.difficulty = 'easy';
    this.config = SUDOKU_CONFIG.easy;
    this.puzzles = [];
    this.puzzleIndex = 0;

    this.initialGrid = [];   // 9x9, givens (0 = empty)
    this.currentGrid = [];   // 9x9, player state
    this.solutionGrid = [];  // 9x9, unique solution
    this.pencilGrid = [];    // 9x9 of Set<number>
    this.undoStack = [];

    this.selectedCell = null;
    this.isPencilMode = false;
    this.wrongMoves = 0;
    this.pmCheats = 0;
    this.score = 0;

    this.timer = 0;
    this.timerInterval = null;
    this.isPaused = false;
    this.isLocked = false;
  }

  async init(difficulty = 'easy') {
    const generation = this._loadGeneration = (this._loadGeneration || 0) + 1;
    this.difficulty = SUDOKU_CONFIG[difficulty] ? difficulty : 'easy';
    this.config = SUDOKU_CONFIG[this.difficulty];

    if (!this.puzzles.length) {
      try {
        const resp = await fetch(`data/sudoku_puzzles.json?v=${ASSET_VER}`);
        this.puzzles = await resp.json();
      } catch (e) {
        console.warn('Failed to load sudoku puzzles:', e);
      }
      if (!this.puzzles.length) {
        this.puzzles = ['000190000750002000916400000008000005240000910570000340000910863000006092000800000'];
      }
    }

    let original = null;
    try { original = (await loadOriginalConfig()).games; } catch (e) { console.warn('Original config unavailable:', e); }
    if (this.destroyed || generation !== this._loadGeneration) return;
    this.original = original;
    this.rand = createRandom(Date.now());
    this.diflev = original ? original[`diflev_${this.difficulty === 'medium' ? 1 : 0}`] : null;
    this.loadPuzzle(this.difficulty === 'hard' || !this.diflev
      ? SudokuModel.pickHard(this.puzzles, this.rand) : null);

    this.timer = 0;
    this.wrongMoves = 0;
    this.pmCheats = 0;
    this.isPaused = false;
    this.isLocked = false;
    this.isPencilMode = false;
    this.undoStack = [];

    this.render();
    this.startTimer();
  }

  // Original selection (FUN_4a0afc50): easy/medium are generated with the [diflev_0]/[diflev_1]
  // rules (solvable by naked/hidden singles within the rule ranges), hard is an unchanged
  // pattern from _SUDOKU_PUZZLES2. See sudoku-model.js.
  loadPuzzle(pattern) {
    let givens, solution;
    if (pattern) {
      givens = pattern.split('').map(ch => parseInt(ch, 10) || 0);
      solution = new Array(81).fill(0);
      if (solveGrid(givens, 2, solution) < 1) console.warn('Sudoku pattern has no solution:', pattern);
    } else {
      const generated = SudokuModel.generate(this.diflev, this.rand || createRandom(Date.now()));
      givens = generated.puzzle; solution = generated.solution;
    }

    this.initialGrid = [];
    this.currentGrid = [];
    this.solutionGrid = [];
    this.pencilGrid = [];
    for (let r = 0; r < 9; r++) {
      this.initialGrid[r] = [];
      this.currentGrid[r] = [];
      this.solutionGrid[r] = [];
      this.pencilGrid[r] = [];
      for (let c = 0; c < 9; c++) {
        const v = givens[r * 9 + c];
        this.initialGrid[r][c] = v;
        this.currentGrid[r][c] = v;
        this.solutionGrid[r][c] = solution[r * 9 + c];
        this.pencilGrid[r][c] = new Set();
      }
    }

    this.selectedCell = null;
    outer: for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (this.initialGrid[r][c] === 0) { this.selectedCell = { r, c }; break outer; }
      }
    }
  }

  startTimer() {
    clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      if (!this.isPaused && !this.isLocked) {
        this.timer++;
        this.updateTimer();
      }
    }, 1000);
  }

  stopTimer() {
    clearInterval(this.timerInterval);
  }

  updateTimer() {
    const el = this.container.querySelector('#sudTimeVal');
    if (!el) return;
    const m = String(Math.floor(this.timer / 60)).padStart(2, '0');
    const s = String(this.timer % 60).padStart(2, '0');
    el.textContent = `${m}:${s}`;
  }

  tex(name) {
    return `${TEX}${name}.png?v=${ASSET_VER}`;
  }

  render() {
    const keyBtn = (n) => `
      <button class="sud-key sud-num-key spb-key-btn num-key" data-val="${n}" title="${n}">
        <span class="sud-key-digit" style="background-position: 0 ${(n - 1) * 12.5}%"></span>
      </button>`;

    this.container.innerHTML = `
      <div class="spb-game-container sudoku-screen sud-screen">
        <div class="spb-header-bar">
          <button class="spb-header-btn spb-menu-btn" id="btnSudokuMenu" title="${i18n.t('Menu', 'Меню')}">
            <span class="bar-icon">☰</span>
          </button>
          <div class="spb-header-title">${i18n.t('Sudoku', 'Судоку')}</div>
          <button class="spb-header-btn spb-help-btn" id="btnSudokuHelp" title="${i18n.t('Help', 'Справка')}">
            <span class="help-q">?</span>
          </button>
        </div>

        <div class="spb-pause-bar sud-pause-bar">
          <button class="sud-undo-btn" id="btnSudokuUndo" title="${i18n.t('Undo', 'Отменить')}"></button>
          <button class="spb-pause-capsule" id="btnSudokuPause" title="${i18n.t('Paused')}">
            <span class="pause-bars">❚❚</span>
          </button>
          <div class="sud-time" id="sudTimeVal">00:00</div>
        </div>

        <div class="sud-field-wrap">
          <div class="sud-field-border">
            <div class="sud-grid spb-sudoku-grid" id="sudokuGrid"></div>
          </div>
        </div>

        <div class="sud-bottom">
          <div class="sud-keypad">
            ${[1, 2, 3, 4, 5, 6].map(keyBtn).join('')}
            ${[7, 8, 9].map(keyBtn).join('')}
            <button class="sud-key sud-icon-key spb-key-btn" id="btnKeyPencil" data-tex="Pencil" title="${i18n.t('Pencilmarks', 'Карандаш')}"></button>
            <button class="sud-key sud-icon-key spb-key-btn" id="btnKeyEraser" data-tex="Eraser" title="${i18n.t('Eraser', 'Ластик')}"></button>
            <button class="sud-key sud-icon-key spb-key-btn" id="btnKeyAutoPM" data-tex="AutoPM" title="${i18n.t('Autoset Pencilmarks', 'Расставить пометки')}"></button>
          </div>
        </div>
      </div>
    `;

    this.applyKeyTextures();
    this.renderGrid();
    this.bindEvents();
    this.updateTimer();
    this.updateUndoButton();
  }

  applyKeyTextures() {
    const bindPress = (btn, getRel, getPr) => {
      const setRel = () => { if (!btn.disabled) btn.style.backgroundImage = `url("${getRel()}")`; };
      const setPr = () => { if (!btn.disabled) btn.style.backgroundImage = `url("${getPr()}")`; };
      setRel();
      btn.addEventListener('pointerdown', setPr);
      btn.addEventListener('pointerup', setRel);
      btn.addEventListener('pointerleave', setRel);
      btn.addEventListener('pointercancel', setRel);
    };

    this.container.querySelectorAll('.sud-num-key').forEach(btn => {
      bindPress(btn, () => this.tex('sudoku_Btn_Free_Rel'), () => this.tex('sudoku_Btn_Free_Pr'));
      const digit = btn.querySelector('.sud-key-digit');
      if (digit) digit.style.backgroundImage = `url("${this.tex('sudoku_numbers_black')}")`;
    });

    this.container.querySelectorAll('.sud-icon-key').forEach(btn => {
      const t = btn.dataset.tex;
      bindPress(
        btn,
        () => (t === 'Pencil' && this.isPencilMode) ? this.tex('sudoku_Btn_Pencil_Pr') : this.tex(`sudoku_Btn_${t}_Rel`),
        () => this.tex(`sudoku_Btn_${t}_Pr`)
      );
    });

    const undo = this.container.querySelector('#btnSudokuUndo');
    if (undo) {
      bindPress(undo, () => this.tex('sudoku_Btn_Undo_Rel'), () => this.tex('sudoku_Btn_Undo_Pr'));
    }
    this.updatePencilButton();
    this.updateUndoButton();
  }

  renderGrid() {
    const gridEl = this.container.querySelector('#sudokuGrid');
    if (!gridEl) return;
    gridEl.innerHTML = '';

    const sq1 = `url("${this.tex('sudoku_square1')}")`;
    const sq2 = `url("${this.tex('sudoku_square2')}")`;
    const chosen = `url("${this.tex('sudoku_choosed_square')}")`;
    const numBlack = `url("${this.tex('sudoku_numbers_black')}")`;
    const numBlue = `url("${this.tex('sudoku_numbers_blue')}")`;
    const numRed = `url("${this.tex('sudoku_numbers_red')}")`;
    const pm = `url("${this.tex('sudoku_pencilmarcs')}")`;

    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const val = this.currentGrid[r][c];
        const isGiven = this.initialGrid[r][c] !== 0;
        const isSelected = !!this.selectedCell && this.selectedCell.r === r && this.selectedCell.c === c;
        const isWrong = !isGiven && val !== 0 && val !== this.solutionGrid[r][c];
        // Alternate the two theme tiles per 3x3 box (emptyCell1 / emptyCell2)
        const boxEven = (Math.floor(r / 3) + Math.floor(c / 3)) % 2 === 0;

        const cell = document.createElement('div');
        cell.className = `sud-cell spb-sudoku-cell ${isGiven ? 'given' : 'user'}${isSelected ? ' selected' : ''}${isWrong ? ' wrong' : ''}`;
        cell.dataset.r = r;
        cell.dataset.c = c;
        cell.dataset.val = val;

        if (isSelected) {
          // choosed_square: frame 0 = normal cursor, frame 1 = pencilmark-mode cursor
          cell.style.backgroundImage = chosen;
          cell.style.backgroundSize = '100% 200%';
          cell.style.backgroundPosition = this.isPencilMode ? '0 100%' : '0 0';
        } else {
          cell.style.backgroundImage = boxEven ? sq1 : sq2;
        }

        if (val !== 0) {
          const d = document.createElement('div');
          d.className = 'sud-digit';
          d.style.backgroundImage = isGiven ? numBlack : (isWrong ? numRed : numBlue);
          d.style.backgroundPosition = `0 ${(val - 1) * 12.5}%`;
          cell.appendChild(d);
        } else {
          for (const n of this.pencilGrid[r][c]) {
            const p = document.createElement('div');
            p.className = 'sud-pm';
            p.dataset.pm = n;
            p.style.backgroundImage = pm;
            p.style.backgroundPosition = `0 ${(n - 1) * 12.5}%`;
            cell.appendChild(p);
          }
        }

        cell.addEventListener('click', () => this.selectCell(r, c));
        gridEl.appendChild(cell);
      }
    }
  }

  selectCell(r, c) {
    if (this.isPaused || this.isLocked) return;
    this.selectedCell = { r, c };
    audio.play('click');
    this.renderGrid();
  }

  pushUndo(entry) {
    this.undoStack.push(entry);
    this.updateUndoButton();
  }

  snapshotCell(r, c) {
    return { r, c, val: this.currentGrid[r][c], pm: new Set(this.pencilGrid[r][c]) };
  }

  updateUndoButton() {
    const btn = this.container.querySelector('#btnSudokuUndo');
    if (!btn) return;
    const disabled = this.undoStack.length === 0;
    btn.classList.toggle('disabled', disabled);
    btn.disabled = disabled;
    btn.style.backgroundImage = `url("${this.tex(disabled ? 'sudoku_Btn_Undo_Dis' : 'sudoku_Btn_Undo_Rel')}")`;
  }

  updatePencilButton() {
    const btn = this.container.querySelector('#btnKeyPencil');
    if (!btn) return;
    btn.classList.toggle('active', this.isPencilMode);
    btn.style.backgroundImage = `url("${this.tex(this.isPencilMode ? 'sudoku_Btn_Pencil_Pr' : 'sudoku_Btn_Pencil_Rel')}")`;
  }

  togglePencilMode() {
    if (this.isPaused || this.isLocked) return;
    this.isPencilMode = !this.isPencilMode;
    audio.play('click');
    this.updatePencilButton();
    this.renderGrid();
  }

  inputNumber(val) {
    if (this.isPaused || this.isLocked || !this.selectedCell) return;
    const { r, c } = this.selectedCell;
    if (this.initialGrid[r][c] !== 0) return;

    if (this.isPencilMode) {
      if (this.currentGrid[r][c] !== 0) return; // pencilmarks only in empty cells
      this.pushUndo({ cells: [this.snapshotCell(r, c)] });
      const set = this.pencilGrid[r][c];
      if (set.has(val)) set.delete(val); else set.add(val);
      audio.play('pencil');
      this.renderGrid();
      return;
    }

    if (this.currentGrid[r][c] === val) return;
    this.pushUndo({ cells: [this.snapshotCell(r, c)] });
    this.currentGrid[r][c] = val;
    this.pencilGrid[r][c].clear();

    if (val === this.solutionGrid[r][c]) {
      audio.play('good');
      // Remove this digit from pencilmarks of the same row / column / box
      for (let i = 0; i < 9; i++) {
        this.pencilGrid[r][i].delete(val);
        this.pencilGrid[i][c].delete(val);
      }
      const br = Math.floor(r / 3) * 3, bc = Math.floor(c / 3) * 3;
      for (let rr = br; rr < br + 3; rr++) {
        for (let cc = bc; cc < bc + 3; cc++) this.pencilGrid[rr][cc].delete(val);
      }
    } else {
      this.wrongMoves++;
      audio.play('wrong');
    }

    this.renderGrid();
    if (this.isSolved()) this.finishLevel();
  }

  eraseSelected() {
    if (this.isPaused || this.isLocked || !this.selectedCell) return;
    const { r, c } = this.selectedCell;
    if (this.initialGrid[r][c] !== 0) return;
    if (this.currentGrid[r][c] === 0 && this.pencilGrid[r][c].size === 0) return;
    this.pushUndo({ cells: [this.snapshotCell(r, c)] });
    this.currentGrid[r][c] = 0;
    this.pencilGrid[r][c].clear();
    audio.play('click');
    this.renderGrid();
  }

  undo() {
    if (this.isPaused || this.isLocked) return;
    const entry = this.undoStack.pop();
    if (!entry) return;
    for (const s of entry.cells) {
      this.currentGrid[s.r][s.c] = s.val;
      this.pencilGrid[s.r][s.c] = new Set(s.pm);
    }
    audio.play('click');
    this.updateUndoButton();
    this.renderGrid();
  }

  candidatesFor(r, c) {
    const used = new Set();
    for (let i = 0; i < 9; i++) {
      used.add(this.currentGrid[r][i]);
      used.add(this.currentGrid[i][c]);
    }
    const br = Math.floor(r / 3) * 3, bc = Math.floor(c / 3) * 3;
    for (let rr = br; rr < br + 3; rr++) {
      for (let cc = bc; cc < bc + 3; cc++) used.add(this.currentGrid[rr][cc]);
    }
    const res = new Set();
    for (let n = 1; n <= 9; n++) if (!used.has(n)) res.add(n);
    return res;
  }

  // [sud_msgbox] "Autoset Pencilmarks" — costs g_nSud*PMCheatCost points
  requestAutoPencilmarks() {
    if (this.isPaused || this.isLocked) return;
    audio.play('click');
    const cost = Math.abs(this.config.pmCheatCost);
    this.showMessageBox({
      title: i18n.t('Autoset Pencilmarks', 'Автоматические пометки'),
      text: i18n.t(
        `By using this option you will lose ${cost} points.\n\nProceed?`,
        `Используя эту функцию, вы потеряете ${cost} очков.\n\nПродолжить?`
      ),
      onYes: () => this.applyAutoPencilmarks()
    });
  }

  applyAutoPencilmarks() {
    const cells = [];
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (this.currentGrid[r][c] === 0) {
          cells.push(this.snapshotCell(r, c));
          this.pencilGrid[r][c] = this.candidatesFor(r, c);
        }
      }
    }
    if (!cells.length) return;
    this.pushUndo({ cells });
    this.pmCheats++;
    audio.play('pencil');
    this.renderGrid();
  }

  showMessageBox({ title, text, onYes }) {
    const wasPaused = this.isPaused;
    this.isPaused = true;
    const modal = document.createElement('div');
    modal.className = 'spb-modal-overlay active';
    modal.innerHTML = `
      <div class="spb-modal-card sud-msgbox">
        <div class="spb-modal-title">${title}</div>
        <div class="sud-msgbox-text">${text.replace(/\n/g, '<br>')}</div>
        <div class="spb-modal-buttons">
          <button class="spb-modal-btn" id="sudMsgNo">${i18n.t('No', 'Нет')}</button>
          <button class="spb-modal-btn default-btn" id="sudMsgYes">${i18n.t('Yes', 'Да')}</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    const close = () => { modal.remove(); this.isPaused = wasPaused; };
    modal.querySelector('#sudMsgNo')?.addEventListener('click', () => { audio.play('click'); close(); });
    modal.querySelector('#sudMsgYes')?.addEventListener('click', () => { audio.play('click'); close(); onYes?.(); });
  }

  isSolved() {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (this.currentGrid[r][c] !== this.solutionGrid[r][c]) return false;
      }
    }
    return true;
  }

  computeScore() {
    const cfg = this.config;
    const wrong = this.wrongMoves * cfg.wrongAnswerCfx;
    const time = this.timer * cfg.timePenaltyCfx;
    const cheats = this.pmCheats * cfg.pmCheatCost;
    const total = cfg.levelCost + wrong + time + cheats;
    return { levelCost: cfg.levelCost, wrong, time, cheats, raw: total, total: Math.max(0, total), subzero: total <= 0 };
  }

  finishLevel() {
    this.isLocked = true;
    this.stopTimer();
    audio.play('levelUp');
    const res = this.computeScore();
    this.score = res.total;
    if (res.total > 0) storage.recordGameScore('sudoku', res.total);
    this.defer(() => this.showResultsModal(res), 350);
  }

  // [sudoku_show_results] in the original results window: Level Summary (@DIST), Wrong Moves (@P1),
  // Time Penalty (@TIME), Pencilmarks Cheats (@P2), then the total.
  showResultsModal(res) {
    const section = this.original?.sudoku_show_results;
    const diff = {easy: 0, medium: 1, hard: 2}[this.difficulty] ?? 0;
    const built = section ? buildResults(section, {DIST: res.levelCost, P1: this.wrongMoves, TIME: this.timer, P2: this.pmCheats, TOTAL: res.raw}, diff) : null;
    const modal = document.createElement('div');
    modal.className = 'spb-modal-overlay active';
    modal.innerHTML = `<div class="restored-results">${built
      ? resultsMarkup(section, built, i18n.t('Continue', 'Продолжить'))
      : `<p>${res.total}</p><button data-finish>${i18n.t('Continue', 'Продолжить')}</button>`}</div>`;
    modal.querySelector('[data-finish]').id = 'btnSudDone';
    document.body.appendChild(modal);
    revealResults(modal);
    modal.querySelector('#btnSudDone')?.addEventListener('click', () => {
      audio.play('click');
      modal.remove();
      this.destroy();
      this.onComplete(res.total > 0 ? res.total : null);
    });
  }

  bindEvents() {
    this.container.querySelector('#btnSudokuMenu')?.addEventListener('click', () => {
      audio.play('click');
      this.onOpenMenu?.({
        onRestart: () => this.init(this.difficulty),
        onExit: () => { this.destroy(); this.onComplete(null); }
      });
    });

    this.container.querySelector('#btnSudokuHelp')?.addEventListener('click', () => {
      audio.play('click');
      this.onOpenHelp?.('sudoku');
    });

    this.container.querySelector('#btnSudokuPause')?.addEventListener('click', () => {
      audio.play('click');
      this.togglePause();
    });

    this.container.querySelector('#btnSudokuUndo')?.addEventListener('click', () => this.undo());

    this.container.querySelectorAll('.sud-num-key').forEach(btn => {
      btn.addEventListener('click', () => this.inputNumber(parseInt(btn.dataset.val, 10)));
    });
    this.container.querySelector('#btnKeyPencil')?.addEventListener('click', () => this.togglePencilMode());
    this.container.querySelector('#btnKeyEraser')?.addEventListener('click', () => this.eraseSelected());
    this.container.querySelector('#btnKeyAutoPM')?.addEventListener('click', () => this.requestAutoPencilmarks());

    // Keyboard: digits, arrows, Backspace/Delete, P = pencil, Ctrl/Cmd+Z = undo
    if (this._keyHandler) window.removeEventListener('keydown', this._keyHandler);
    this._keyHandler = (e) => {
      if (!this.container.isConnected) return;
      if (e.key >= '1' && e.key <= '9') {
        this.inputNumber(parseInt(e.key, 10));
      } else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') {
        this.eraseSelected();
      } else if (e.key === 'p' || e.key === 'P') {
        this.togglePencilMode();
      } else if ((e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey)) {
        this.undo();
      } else if (e.key.startsWith('Arrow') && this.selectedCell) {
        const d = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key];
        const r = (this.selectedCell.r + d[0] + 9) % 9;
        const c = (this.selectedCell.c + d[1] + 9) % 9;
        e.preventDefault();
        this.selectCell(r, c);
      }
    };
    window.addEventListener('keydown', this._keyHandler);
  }

  togglePause() {
    this.isPaused = !this.isPaused;
    if (this.isPaused && this.onOpenMenu) {
      this.onOpenMenu({
        isPauseMenu: true,
        onResume: () => { this.isPaused = false; },
        onRestart: () => this.init(this.difficulty),
        onExit: () => { this.destroy(); this.onComplete(null); }
      });
    }
  }

  destroy() {
    this.stopTimer();
    if (this._keyHandler) {
      window.removeEventListener('keydown', this._keyHandler);
      this._keyHandler = null;
    }
  }
}
