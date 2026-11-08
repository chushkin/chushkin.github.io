import { audio } from '../audio.js';
import { storage } from '../storage.js';
import { i18n } from '../i18n.js';
import { loadOriginalConfig, difficultyIndex } from '../original.js';
import { buildResults, resultsMarkup, revealResults } from './results-window.js';

// Strings made for the web: Russian text, else the English key through the locale tables.
export const tr = (ru, en) => i18n.getLang() === 'ru' ? ru : i18n.t(en);
export const escapeHTML = value => String(value).replace(/[&<>"']/g, c =>
  ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));

// No timers survive exit or restart; clocks stop while paused or hidden.
export class RestoredGame {
  constructor(container, onComplete, onOpenMenu, onOpenHelp) {
    Object.assign(this, {container, onComplete, onOpenMenu, onOpenHelp});
    this.generation = 0;
    this.timers = new Set();
  }
  async begin(difficulty) {
    this.destroy();
    const generation = this.generation;
    Object.assign(this, {destroyed:false, finished:false, isPaused:false, difficulty,
      diff:difficultyIndex(difficulty), score:0, elapsed:0});
    try { this.original = (await loadOriginalConfig()).games; }
    catch (error) {
      if (generation === this.generation) this.container.innerHTML = `<p role="alert">${tr('Не удалось загрузить игровые данные.', 'Unable to load game data.')}</p>`;
      throw error;
    }
    return generation === this.generation && !this.destroyed;
  }
  get playable() { return !this.destroyed && !this.finished && !this.isPaused; }
  tick(callback) {
    const timer = setInterval(() => { if (this.playable && !document.hidden) callback(); }, 1000);
    this.timers.add(timer);
  }
  frame(title, body, footer = '') {
    this.container.innerHTML = `<div class="spb-game-container restored-screen ${this.id}-screen">
      <div class="spb-header-bar">
        <button class="spb-header-btn spb-menu-btn" data-game-menu aria-label="${tr('Меню','Menu')}"><span class="bar-icon">☰</span></button>
        <div class="spb-header-title">${title}</div>
        <button class="spb-header-btn spb-help-btn" data-game-help aria-label="${tr('Справка','Help')}"><span class="help-q">?</span></button>
      </div>
      <div class="spb-pause-bar"><button class="spb-pause-capsule" data-game-pause aria-label="${i18n.t('Paused')}">❚❚</button></div>
      <div class="restored-status"><span>${tr('Очки','Score')}: <strong data-score>${Math.max(0,this.score)}</strong></span><span data-status></span></div>
      ${body}<div class="restored-footer">${footer}</div></div>`;
    this.container.querySelector('[data-game-menu]').onclick = () => this.menu();
    this.container.querySelector('[data-game-pause]').onclick = () => this.menu();
    this.container.querySelector('[data-game-help]').onclick = () => this.help();
  }
  menu() {
    if (!this.playable) return;
    this.isPaused = true;
    audio.play('click');
    this.onOpenMenu?.({isPauseMenu:true, onResume:() => { this.isPaused=false; },
      onRestart:() => this.init(this.difficulty),
      onExit:() => { this.destroy(); this.onComplete(null); }});
  }
  help() {
    this.isPaused=true;
    this.onOpenHelp?.(this.id, () => { this.isPaused=false; });
  }
  updateScore() {
    const el=this.container.querySelector('[data-score]');
    if (el) el.textContent=Math.max(0,Math.round(this.score));
  }
  // results: {section: [*_show_results], values: {DIST, TIME, P1, ...}} renders the original
  // results window; the total of its items is the score.
  finish(score=this.score, results=null) {
    if (!this.playable) return;
    this.finished=true;
    const built=results ? buildResults(results.section, results.values, this.diff) : null;
    this.score=Math.max(0,Math.round(built ? built.total : score));
    this.timers.forEach(clearInterval); this.timers.clear();
    storage.recordGameScore(this.id,this.score);
    audio.play('levelUp');
    this.frame(this.title, built
      ? `<div class="restored-results">${resultsMarkup(results.section, built, tr('Продолжить','Continue'))}</div>`
      : `<div class="restored-results"><h2>${tr('Результат','Results')}</h2>
      <p>${tr('Очки','Score')}: <strong>${this.score}</strong></p>
      <button class="spb-action-btn" data-finish>${tr('Продолжить','Continue')}</button></div>`);
    revealResults(this.container);
    this.container.querySelector('[data-finish]').onclick=() => { this.destroy(); this.onComplete(this.score); };
  }
  destroy() {
    this.destroyed=true; this.generation++;
    this.timers.forEach(clearInterval); this.timers.clear();
  }
}
