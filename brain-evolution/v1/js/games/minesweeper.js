// Minesweeper Mini-game (Сапер) - Authentic Amaze Brain Evolution UI
import { audio } from '../audio.js';
import { storage } from '../storage.js';
import { i18n } from '../i18n.js';
import { loadOriginalConfig, difficultyIndex, arrayValue, createRandom } from '../original.js';
import { tr } from './restored-game.js';
import { buildResults, resultsMarkup, showResultsLayer } from './results-window.js';

// "60 сек.": the unit of the results window's "%d sec. x %ls" in the player's language.
const secondsText = seconds => i18n.t('%d sec. x %ls').split(' x ')[0].replace('%d', seconds);

export class MinesweeperGame {
  constructor(container, onComplete, onOpenMenu, onOpenHelp) {
    this.container = container;
    this.defer = (callback, delay) => setTimeout(callback, delay);
    this.onComplete = onComplete;
    this.onOpenMenu = onOpenMenu;
    this.onOpenHelp = onOpenHelp;
    this.rows = 8;
    this.cols = 8;
    this.minesCount = 10;
    this.grid = [];
    this.revealedCount = 0;
    this.flagMode = false;
    this.gameOver = false;
    this.firstClick = true;
    this.rightMoves = 0;
    this.timer = 0;
    this.timerInterval = null;
    this.isPaused = false;
    this.difficulty = 'easy';
  }

  async init(difficulty = 'easy') {
    const generation = this._loadGeneration = (this._loadGeneration || 0) + 1;
    this.difficulty = difficulty;
    this.original = (await loadOriginalConfig()).games;
    if (this.destroyed || generation !== this._loadGeneration) return;
    const cfg = this.original.ms_game_wnd;
    const prefix = ['Easy', 'Med', 'Hard'][difficultyIndex(difficulty)];
    this.rows = Number(cfg[`g_n${prefix}YFieldSize`]);
    this.cols = Number(cfg[`g_n${prefix}XFieldSize`]);
    this.minesCount = Number(cfg[`g_n${prefix}BombsOnField`]);
    this.exploded = 0;

    clearInterval(this.timerInterval);
    this.timerInterval = null;
    this.firstClick = true;
    this.rightMoves = 0;
    this.gameOver = false;
    this.revealedCount = 0;
    this.flagMode = false;
    this.timer = 0;
    this.isPaused = false;

    this.grid = [];
    for (let r = 0; r < this.rows; r++) {
      this.grid[r] = [];
      for (let c = 0; c < this.cols; c++) {
        this.grid[r][c] = {
          hasMine: false,
          exploded: false,
          revealed: false,
          flagged: false,
          neighborMines: 0
        };
      }
    }

    this.render();
    this.startTimer();
  }

  // Original placement (FUN_4a04a050): selection sampling cell by cell — a mine goes in when
  // rand % cellsLeft < minesLeft — skipping the 3x3 area around the first opened cell, with
  // repeated passes until every mine is placed.
  placeMines(avoidR, avoidC) {
    const rand = this.rand || (this.rand = createRandom(Date.now()));
    let left = this.minesCount;
    while (left > 0) {
      let cellsLeft = this.rows * this.cols;
      for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++, cellsLeft--) {
        if ((rand() % 0x7fff) % cellsLeft >= left) continue;
        if (Math.abs(r - avoidR) < 2 && Math.abs(c - avoidC) < 2) continue;
        if (this.grid[r][c].hasMine) continue;
        this.grid[r][c].hasMine = true;
        left--;
      }
    }

    // Compute neighbors
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (!this.grid[r][c].hasMine) {
          let count = 0;
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              const nr = r + dr;
              const nc = c + dc;
              if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols) {
                if (this.grid[nr][nc].hasMine) count++;
              }
            }
          }
          this.grid[r][c].neighborMines = count;
        }
      }
    }
  }

  startTimer() {
    clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      if (!this.isPaused && !this.gameOver && !document.hidden) {
        this.timer++;
        const time = this.container.querySelector('#minesTime');
        if (time) time.textContent = secondsText(this.timer);
      }
    }, 1000);
  }

  render() {
    this.container.innerHTML = `
      <div class="amaze-game-container minesweeper-screen">
        <!-- Authentic Amaze Top Header Bar -->
        <div class="amaze-header-bar">
          <button class="amaze-header-btn amaze-menu-btn" id="btnMinesMenu" title="${i18n.t('Menu', 'Меню')}">
            <span class="bar-icon">☰</span>
          </button>
          <div class="amaze-header-title">${i18n.gameName('minesweeper')}</div>
          <button class="amaze-header-btn amaze-help-btn" id="btnMinesHelp" title="${i18n.t('Help', 'Справка')}">
            <span class="help-q">?</span>
          </button>
        </div>

        <!-- Authentic Sub-header Pause Bar -->
        <div class="amaze-pause-bar">
          <button class="amaze-pause-capsule" id="btnMinesPause" title="${i18n.t('Paused')}">
            <span class="pause-bars">❚❚</span>
          </button>
        </div>

        <!-- Info Strip -->
        <div class="amaze-game-info-strip">
          <span>${i18n.t('Mines', 'Мины')}: <strong id="minesRemaining">${this.getRemainingFlags()}</strong></span>
          <span>${i18n.t('Time', 'Время')}: <strong id="minesTime">${secondsText(this.timer)}</strong></span>
        </div>

        <!-- Mines Board Wrap -->
        <div class="amaze-board-wrapper">
          <div class="amaze-mines-frame" style="aspect-ratio:${this.cols}/${this.rows}">
            <div class="amaze-mines-grid" id="minesGrid"></div>
          </div>
        </div>

        <!-- Mode Toggle Bar -->
        <div class="amaze-flag-toggle-bar">
          <button class="mode-toggle-btn ${this.flagMode ? 'flag-active' : ''}" id="btnToggleFlag" aria-pressed="${this.flagMode}">${this.flagButtonContent()}</button>
        </div>
      </div>
    `;

    this.renderGrid();
    this.bindEvents();
  }

  // The original flag button (ms_Btn_Pencil: light when digging, blue while flags are placed) with
  // the current mode written next to it.
  flagButtonContent() {
    const icon = this.flagMode ? 'ms_Btn_Pencil_Pr' : 'ms_Btn_Pencil_Rel';
    return `<img class="mode-toggle-ico" src="assets/textures/${icon}.png" alt=""><span>${this.flagMode ? i18n.t('Mode: Flagging', 'Режим: Флажки') : i18n.t('Mode: Digging', 'Режим: Раскопки')}</span>`;
  }

  getRemainingFlags() {
    // Flags and blown bombs both account for a mine.
    let marked = 0;
    for (const row of this.grid) for (const cell of row) if (cell.flagged || cell.exploded) marked++;
    return Math.max(0, this.minesCount - marked);
  }


  renderGrid() {
    const gridEl = this.container.querySelector('#minesGrid');
    if (!gridEl) return;
    gridEl.innerHTML = '';

    gridEl.style.gridTemplateColumns = `repeat(${this.cols}, 1fr)`;
    gridEl.style.gridTemplateRows = `repeat(${this.rows}, 1fr)`;

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cell = this.grid[r][c];
        const cellEl = document.createElement('div');
        cellEl.className = `mine-cell ${cell.revealed ? 'revealed' : ''} ${cell.revealed && cell.hasMine ? 'has-mine' : ''}`;

        const frame = cell.revealed ? (cell.hasMine ? (cell.exploded ? 11 : 10) : cell.neighborMines ? cell.neighborMines + 1 : 0) : cell.flagged ? 12 : 1;
        cellEl.style.backgroundImage = "url('assets/textures/restored/ms_sprite_big.png')";
        cellEl.style.backgroundSize = '100% 1300%';
        cellEl.style.backgroundPosition = `center ${frame / 12 * 100}%`;
        cellEl.setAttribute('role', 'button');
        cellEl.tabIndex = this.gameOver ? -1 : 0;
        cellEl.setAttribute('aria-disabled', String(this.gameOver));
        cellEl.setAttribute('aria-label', `${r+1}, ${c+1}: ${cell.revealed ? cell.hasMine ? 'mine' : cell.neighborMines : cell.flagged ? 'flag' : 'closed'}`);
        cellEl.addEventListener('keydown', event => {
          if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); this.handleCellClick(r,c); }
        });
        cellEl.addEventListener('contextmenu', event => {
          event.preventDefault();
          if (this.gameOver || this.isPaused || cell.revealed) return;
          cell.flagged = !cell.flagged;
          this.renderGrid();
        });

        cellEl.addEventListener('click', () => {
          this.handleCellClick(r, c);
        });

        gridEl.appendChild(cellEl);
      }
    }

    const remEl = this.container.querySelector('#minesRemaining');
    if (remEl) remEl.textContent = this.getRemainingFlags();
    const timeEl = this.container.querySelector('#minesTime');
    if (timeEl) timeEl.textContent = secondsText(this.timer);
  }

  handleCellClick(r, c) {
    if (this.gameOver || this.isPaused) return;
    const cell = this.grid[r][c];

    if (this.flagMode) {
      if (!cell.revealed) {
        audio.play('click');
        cell.flagged = !cell.flagged;
        this.renderGrid();
      }
      return;
    }

    if (cell.flagged) return;
    if (cell.revealed) { this.chord(r, c); return; }

    if (this.firstClick) {
      this.firstClick = false;
      this.placeMines(r, c);
    }

    if (cell.hasMine) {
      // Original (FUN_4a0db9c4 / FUN_4a04aae0): the bomb is shown blown, it counts as a wrong
      // move (ms_show_results.i2 penalty) and play continues until every safe cell is open.
      audio.play('wrong');
      cell.revealed = true;
      cell.exploded = true;
      this.exploded++;
      this.renderGrid();
      return;
    }

    audio.play('click');
    // Every opened cell is one right move ("EmptyCellCxf" points): the click handler counts the
    // clicked cell and the cascade (FUN_4a04a3f4) calls the counter FUN_4a0d9908 for each cell it
    // opens. Counting only the clicks made the easy level-up goal (3000) unreachable.
    const opened = this.revealedCount;
    this.revealCell(r, c);
    this.rightMoves = (this.rightMoves || 0) + (this.revealedCount - opened);
    this.renderGrid();
    this.checkWinCondition();
  }

  revealCell(r, c) {
    if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) return;
    const cell = this.grid[r][c];
    if (cell.revealed || cell.flagged || cell.hasMine) return;

    cell.revealed = true;
    this.revealedCount++;

    if (cell.neighborMines === 0) {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr !== 0 || dc !== 0) {
            this.revealCell(r + dr, c + dc);
          }
        }
      }
    }
  }

  chord(r, c) {
    if (this.gameOver || this.isPaused) return;
    const cell = this.grid[r][c];
    if (!cell.revealed || cell.hasMine || !cell.neighborMines) return;
    const around = [];
    for (let dr=-1;dr<=1;dr++) for (let dc=-1;dc<=1;dc++) {
      if (!(dr || dc)) continue;
      const row=r+dr,col=c+dc;
      if (row>=0 && row<this.rows && col>=0 && col<this.cols) around.push({r:row,c:col,cell:this.grid[row][col]});
    }
    if (around.filter(item=>item.cell.flagged || item.cell.revealed && item.cell.hasMine).length !== cell.neighborMines) return;
    for (const item of around) if (!item.cell.flagged && !item.cell.revealed) this.handleCellClick(item.r,item.c);
  }

  checkWinCondition() {
    if (this.gameOver) return;
    const totalSafe = (this.rows * this.cols) - this.minesCount;
    if (this.revealedCount >= totalSafe) {
      this.gameOver = true;
      clearInterval(this.timerInterval);
      this.timerInterval = null;
      audio.play('levelUp');
      const cfg = this.original.ms_show_results, diff = difficultyIndex(this.difficulty);
      this.total = (this.rightMoves || 0) * arrayValue(cfg.i1_points_arr,diff) + this.exploded * arrayValue(cfg.i2_points_arr,diff) + this.timer * arrayValue(cfg.i3_points_arr,diff);
      const score = Math.max(0, this.total);
      storage.recordGameScore('minesweeper', score);
      this.renderGrid();
      this.showGameResult(score);
    }
  }

  // [ms_show_results] in the original results window: Right Moves (@P1), Wrong Moves (@P2, blown
  // bombs), Time Penalty (@TIME), then the total.
  resultsWindow(total) {
    const section = this.original.ms_show_results;
    const built = buildResults(section, {P1: this.rightMoves || 0, P2: this.exploded, TIME: this.timer, TOTAL: total}, difficultyIndex(this.difficulty));
    return resultsMarkup(section, built, tr('Продолжить', 'Continue'));
  }

  // The game only ends with a win (a blown bomb is a penalty, not the end). The results window
  // stands over the field like in the other games (inside the field it did not fit on phones).
  showGameResult(score = 0) {
    const layer = showResultsLayer(this.container, this.resultsWindow(this.total ?? score));
    const done = layer.querySelector('[data-finish]');
    done.setAttribute('data-mines-done', '');
    done.onclick = () => {
      this.destroy();
      this.onComplete(score);
    };
  }

  bindEvents() {
    this.container.querySelector('#btnMinesMenu')?.addEventListener('click', () => {
      if (this.gameOver) return;
      audio.play('click');
      this.onOpenMenu?.({
        onRestart: () => this.init(this.difficulty),
        onExit: () => {
          this.destroy();
          this.onComplete(null);
        }
      });
    });

    this.container.querySelector('#btnMinesHelp')?.addEventListener('click', () => {
      audio.play('click');
      this.onOpenHelp?.('minesweeper');
    });

    this.container.querySelector('#btnMinesPause')?.addEventListener('click', () => {
      audio.play('click');
      this.togglePause();
    });

    this.container.querySelector('#btnToggleFlag')?.addEventListener('click', () => {
      if (this.isPaused || this.gameOver) return;
      audio.play('click');
      this.flagMode = !this.flagMode;
      const btn = this.container.querySelector('#btnToggleFlag');
      if (btn) {
        btn.className = `mode-toggle-btn ${this.flagMode ? 'flag-active' : ''}`;
        btn.setAttribute('aria-pressed', String(this.flagMode));
        btn.innerHTML = this.flagButtonContent();
      }
    });
  }

  togglePause() {
    if (this.gameOver) return; // the results window is up: only "Continue" leaves it, as in the other games
    this.isPaused = !this.isPaused;
    if (this.isPaused && this.onOpenMenu) {
      this.onOpenMenu({
        isPauseMenu: true,
        onResume: () => this.isPaused = false,
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
    this.timerInterval = null;
  }
}
