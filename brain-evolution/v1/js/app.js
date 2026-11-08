// SPB Brain Evolution - Main Application Controller (Authentic Remaster)

import { audio } from './audio.js';
import { storage } from './storage.js';
import { loadOriginalConfig } from './original.js';
import { attachGameLifetime } from './games/lifetime.js';
import { startMarking, recordMarking, miniGameRoute, startTraining, recordTraining, trainingInfo, levelParams, gameSection, localDate } from './progression.js';
import { pointsText } from './games/results-window.js';
import { RestoredGame, escapeHTML, tr } from './games/restored-game.js';
import { i18n } from './i18n.js';

// Mini-games
import { SudokuGame } from './games/sudoku.js';
import { MatchesGame } from './games/matches.js';
import { PairsGame } from './games/pairs.js';
import { QuadronicaGame } from './games/quadronica.js';
import { NumbersGame } from './games/numbers.js';
import { ArithmeticsGame } from './games/arithmetics.js';
import { MinesweeperGame } from './games/minesweeper.js';
import { RoadblocksGame } from './games/roadblocks.js';
import { GuessWhoGame } from './games/guess_who.js';
import { MemoricsGame } from './games/memorics.js';
import { GeometryGame } from './games/geometry.js';
import { EncyclopediaGame } from './games/encyclopedia.js';

// [mini_games] game= order: the training list and the unlock order.
// Month and day names of the calendar (translated in every languages.erc table).
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const TRAINING_ORDER = ['arithmetics', 'quadronica', 'memorics', 'sudoku', 'pairs', 'numbers', 'roadblocks', 'guess_who', 'minesweeper', 'geometry', 'encyclopedia', 'matches'];

class App {
  constructor() {
    this.currentView = 'intro'; // Start on authentic Intro chalkboard splash
    this.activeGameInstance = null;
    this.gamesMeta = [];
    this.facts = [];
    this.activeModal = null;
    this.hsMode = '7day'; // '7day' or 'all'
  }

  async init() {
    await i18n.init();
    await this.loadMeta();
    this.original = await loadOriginalConfig();
    audio.preloadAll();

    window.addEventListener('hashchange', () => this.handleHashRoute());
    this.bindGlobalEvents();

    if (window.location.hash) {
      this.handleHashRoute();
    } else {
      this.showView('intro', {}, false);
    }
  }

  handleHashRoute() {
    const hash = window.location.hash.replace(/^#\/?/, '');
    if (!hash || hash === 'intro') {
      this.showView('intro', {}, false);
    } else if (hash.startsWith('play/')) {
      const parts = hash.split('/');
      const gameId = parts[1];
      const diff = parts[2] || 'easy';
      this.showView('play', { gameId, difficulty: diff, mode: parts[3] }, false);
    } else {
      this.showView(hash, {}, false);
    }
  }

  async loadMeta() {
    try {
      const [gamesResp, factsResp] = await Promise.all([
        fetch('data/minigames.json'),
        fetch('data/facts.json')
      ]);
      this.gamesMeta = await gamesResp.json();
      this.facts = await factsResp.json();
    } catch (e) {
      console.warn('Failed to load metadata:', e);
    }
  }

  showView(viewName, params = {}, updateHash = true) {
    this.currentView = viewName;
    if (updateHash) {
      if (viewName === 'play') {
        history.pushState(null, '', `#play/${params.gameId}/${params.difficulty || 'easy'}${params.mode ? '/' + params.mode : ''}`);
      } else {
        history.pushState(null, '', `#${viewName}`);
      }
    }

    if (this.activeModal) {
      this.activeModal.remove();
      this.activeModal = null;
    }

    const headerEl = document.getElementById('appHeader');
    const mainEl = document.getElementById('appMain');
    if (!mainEl) return;

    if (this.activeGameInstance) {
      this.activeGameInstance.destroy?.();
      this.activeGameInstance = null;
    }

    // Intro chalkboard splash
    if (viewName === 'intro') {
      if (headerEl) headerEl.style.display = 'none';
      this.renderIntroScreen(mainEl);
      return;
    }

    if (viewName === 'play') {
      // Mini-game has its own in-game SPB header
      if (headerEl) headerEl.style.display = 'none';
      this.launchGame(mainEl, params.gameId, params.difficulty, params.mode);
      return;
    }

    // Standard shell screens display the authentic Trainer Top Header
    if (headerEl) headerEl.style.display = 'block';
    this.renderHeader();

    switch (viewName) {
      case 'main':
        this.renderMainMenu(mainEl);
        break;
      case 'training':
        this.renderTrainingView(mainEl);
        break;
      case 'marking':
        this.renderMarkingView(mainEl);
        break;
      case 'facts':
        this.renderFactsView(mainEl);
        break;
      case 'awards':
        this.renderAwardsView(mainEl);
        break;
      case 'profiles':
        this.renderProfilesView(mainEl);
        break;
      case 'highscores':
        this.renderHighscoresView(mainEl);
        break;
      case 'games':
        this.renderGamesList(mainEl);
        break;
      case 'about':
        this.renderAboutView(mainEl);
        break;
      case 'calendar':
        this.renderCalendarView(mainEl, params.month);
        break;
      default:
        this.renderMainMenu(mainEl);
    }
  }

  renderIntroScreen(container) {
    container.innerHTML = `
      <div class="spb-intro-view" id="introView">
        <img src="assets/textures/intro.png" class="spb-intro-img" alt="SPB Brain Evolution 2" />
        <div class="intro-touch-hint">
          <span class="pulsing-tap">${i18n.t('Tap anywhere to start', 'Нажмите в любом месте для старта')}</span>
        </div>
      </div>
    `;

    container.querySelector('#introView')?.addEventListener('click', () => {
      audio.play('click');
      this.showView('main');
    });
  }

  // Authentic CTrainerTopWnd Header
  renderHeader() {
    const headerEl = document.getElementById('appHeader');
    if (!headerEl) return;

    const isMain = this.currentView === 'main';
    let title = 'SPB Brain Evolution';
    if (!isMain) {
      switch (this.currentView) {
        case 'training': title = i18n.t('Brain Training', 'Тренировка'); break;
        case 'marking': title = i18n.t('Brain Marking', 'Тестирование'); break;
        case 'facts': title = i18n.t('Interesting Facts', 'Интересные факты'); break;
        case 'awards': title = i18n.t('My Awards', 'Награды'); break;
        case 'profiles': title = i18n.t('Manage Profiles', 'Профили'); break;
        case 'highscores': title = i18n.t('High Scores', 'Таблица рекордов'); break;
        case 'games': title = i18n.t('12 Development Games', '12 развивающих игр'); break;
        case 'about': title = i18n.t('About', 'О программе'); break;
        case 'calendar': title = i18n.t('Calendar', 'Календарь'); break;
      }
    }

    headerEl.innerHTML = `
      <div class="trainer-header-inner">
        <button class="trainer-menu-btn" id="btnTrainerMenu" title="${i18n.t('Menu', 'Меню')}" aria-label="Menu"></button>
        <div class="trainer-title-box">
          <span class="trainer-title">${title}</span>
        </div>
        <button class="${isMain ? 'trainer-help-btn' : 'trainer-exit-btn'}" id="btnTrainerRight" title="${isMain ? i18n.t('Help', 'Помощь') : i18n.t('Back', 'Назад')}" aria-label="${isMain ? 'Help' : 'Back'}"></button>
        <div class="trainer-notch" id="btnTrainerNotch" title="${i18n.t('Quick Menu', 'Быстрое меню')}"></div>
      </div>
    `;

    document.getElementById('btnTrainerMenu')?.addEventListener('click', () => {
      audio.play('openTrainer');
      this.showOptionsMenu();
    });

    document.getElementById('btnTrainerNotch')?.addEventListener('click', () => {
      audio.play('openTrainer');
      this.showOptionsMenu();
    });

    document.getElementById('btnTrainerRight')?.addEventListener('click', () => {
      if (isMain) {
        audio.play('click');
        this.showScreenHelp('main');
      } else {
        audio.play('click');
        this.showView('main');
      }
    });
  }

  // Authentic CExMenuWnd Main Menu from _SHELL_M_MENU_EX_INO
  renderMainMenu(container) {
    const prof = storage.getProfile();
    const rankTitle = this.getRankTitle(prof.brainRank);

    container.innerHTML = `
      <div class="spb-main-menu">
        <div class="menu-grid">
          <button class="ex-menu-btn" id="btnTrain" title="${i18n.t('Brain Training', 'Тренировка')}">
            <span class="btn-num">1.</span>
            <span class="btn-label">${i18n.t('Brain Training', 'Тренировка')}</span>
          </button>

          <button class="ex-menu-btn" id="btnMark" title="${i18n.t('Brain Marking', 'Тестирование')}">
            <span class="btn-num">2.</span>
            <span class="btn-label">${i18n.t('Brain Marking', 'Тестирование')}</span>
          </button>

          <button class="ex-menu-btn" id="btnFacts" title="${i18n.t('Interesting Facts', 'Интересные факты')}">
            <span class="btn-num">3.</span>
            <span class="btn-label">${i18n.t('Interesting Facts', 'Интересные факты')}</span>
          </button>

          <button class="ex-menu-btn" id="btnAwards" title="${i18n.t('My Awards', 'Награды')}">
            <span class="btn-num">4.</span>
            <span class="btn-label">${i18n.t('My Awards', 'Награды')}</span>
          </button>

          <button class="ex-menu-btn" id="btnProfiles" title="${i18n.t('Manage Profiles', 'Профили')}">
            <span class="btn-num">5.</span>
            <span class="btn-label">${i18n.t('Manage Profiles', 'Профили')}</span>
          </button>

          <button class="ex-menu-btn" id="btnHighscores" title="${i18n.t('High Scores', 'Рекорды')}">
            <span class="btn-num">6.</span>
            <span class="btn-label">${i18n.t('High Scores', 'Рекорды')}</span>
          </button>
        </div>

        <div class="trainer-status-bar">
          <img src="assets/textures/Br_Mark_Rank_${prof.brainRank}.png" class="status-rank-img" alt="Rank" />
          <div class="status-info">
            <div class="status-player-name">${escapeHTML(prof.name)}</div>
            <div class="status-rank-title">${rankTitle}</div>
            <div class="status-metrics">
              <span>⚡ ${prof.brainScore} pts</span>
              <span>📅 ${i18n.t('Day', 'День')} ${prof.trainingDays}</span>
            </div>
          </div>
          <button class="btn-free-play" id="btnFreePlay">${i18n.t('12 Games ➔', '12 Игр ➔')}</button>
        </div>
      </div>
    `;

    container.querySelector('#btnTrain')?.addEventListener('click', () => {
      audio.play('click');
      this.showView('training');
    });

    container.querySelector('#btnMark')?.addEventListener('click', () => {
      audio.play('click');
      this.showView('marking');
    });

    container.querySelector('#btnFacts')?.addEventListener('click', () => {
      audio.play('click');
      this.showView('facts');
    });

    container.querySelector('#btnAwards')?.addEventListener('click', () => {
      audio.play('click');
      this.showView('awards');
    });

    container.querySelector('#btnProfiles')?.addEventListener('click', () => {
      audio.play('click');
      this.showView('profiles');
    });

    container.querySelector('#btnHighscores')?.addEventListener('click', () => {
      audio.play('click');
      this.showView('highscores');
    });

    container.querySelector('#btnFreePlay')?.addEventListener('click', () => {
      audio.play('click');
      this.showView('games');
    });
  }

  // Official Evolutionary Rank Titles from decompiled APK
  getRankTitle(rank) {
    const titles = {
      1: { ru: 'Ребенок (1 этап)', en: 'Child (Stage 1)' },
      2: { ru: 'Школьник (2 этап)', en: 'Schoolboy (Stage 2)' },
      3: { ru: 'Студент (3 этап)', en: 'Student (Stage 3)' },
      4: { ru: 'Аспирант (4 этап)', en: 'Intern (Stage 4)' },
      5: { ru: 'Кандидат наук (5 этап)', en: 'PhD (Stage 5)' },
      6: { ru: 'Профессор (6 этап)', en: 'Professor (Stage 6)' },
      7: { ru: 'Нобелевский лауреат (7 этап)', en: 'Nobel Prize-winner (Stage 7)' }
    };
    const lang = i18n.getLang();
    if (titles[rank]?.[lang]) return titles[rank][lang];
    return i18n.t(this.original?.shell?.b_mark_wnd?.[`status${rank}_name`] || titles[rank]?.en || titles[1].en);
  }

  getRankDescription(rank) {
    const descs = {
      1: {
        ru: 'Это первый из семи этапов в игре. Продолжайте тренироваться, и вы достигнете уровня школьника!',
        en: "This is the first of seven stages in the game. Keep working and you'll reach the Schoolboy level!"
      },
      2: {
        ru: 'Продолжайте работать, и вы достигнете уровня Студента!',
        en: "This is the second of seven stages in the game. Keep going and you'll reach the Student level!"
      },
      3: {
        ru: 'Вам нужно еще немного потренироваться, чтобы получить уровень Аспиранта!',
        en: 'This is the third of seven stages in this game. You need more training to reach the Intern Level!'
      },
      4: {
        ru: 'Продолжайте так же активно тренироваться, и вы достигнете уровня кандидата наук!',
        en: "This is the fourth of seven stages in the game. Keep practicing and you'll earn your PhD!"
      },
      5: {
        ru: 'Продолжайте тренироваться, и вы достигнете уровня профессора!',
        en: 'This is the fifth of seven stages in the game. Incredible! Keep working hard and you\'ll earn Professor Status.'
      },
      6: {
        ru: 'Вы почти достигли лучшего результата! Еще немного, и вы достигнете уровня нобелевского лауреата!',
        en: 'This is the sixth of seven stages in the game. You are almost on the top! Keep working to become a Nobel Prize-Winner!'
      },
      7: {
        ru: 'Это финальный этап в игре. Поздравляем!! Теперь вы среди умнейших людей на планете!',
        en: 'This is the final stage in the game. Congratulations!! Now you are among the smartest around!'
      }
    };
    const lang = i18n.getLang();
    if (descs[rank]?.[lang]) return descs[rank][lang];
    return i18n.t(this.original?.shell?.b_mark_wnd?.[`status${rank}_text`] || descs[rank]?.en || descs[1].en);
  }

  // Authentic COptionsWnd Quick Menu from _SHELL_M_OPTIONS_INO
  showOptionsMenu() {
    if (this.activeModal) {
      this.activeModal.remove();
      this.activeModal = null;
    }

    const settings = storage.getSettings();
    const modal = document.createElement('div');
    modal.className = 'spb-dialog-overlay';

    const renderModalContent = () => {
      modal.innerHTML = `
        <div class="spb-dialog-card">
          <div class="spb-dialog-header">
            <span>${i18n.t('Options', 'Настройки')}</span>
            <button class="spb-dialog-close-x" id="btnOptClose">✕</button>
          </div>
          <div class="spb-dialog-body">
            <div class="option-row">
              <span class="option-label">${i18n.t('Sound Volume', 'Громкость звука')}</span>
              <div class="vol-control-wrap">
                <button class="btn-vol-adj" id="btnVolMinus" title="-"></button>
                <div class="vol-gauge-bar">
                  <div class="vol-gauge-fill" style="width: ${Math.round((settings.volume ?? 0.8) * 100)}%"></div>
                </div>
                <button class="btn-vol-adj" id="btnVolPlus" title="+"></button>
              </div>
            </div>

            <div class="option-row">
              <span class="option-label">${i18n.t('Sound On/Off', 'Звук')}</span>
              <div class="checkbox-toggle-wrap" id="btnToggleSoundOpt">
                <img src="assets/textures/${settings.sound ? 'Options_CheckBox_On.png' : 'Options_CheckBox_Off.png'}" class="options-checkbox-img" alt="" />
                <span style="font-size: 13px; font-weight: 700; color: #1a3854;">${settings.sound ? i18n.t('Sound ON', 'Включен') : i18n.t('Sound OFF', 'Выключен')}</span>
              </div>
            </div>

            <div class="option-row">
              <span class="option-label">${i18n.t('Language', 'Язык')}</span>
              <select class="options-lang-select" id="selLangOpt" aria-label="${i18n.t('Language', 'Язык')}">
                ${i18n.languages.map(item => `<option value="${item.code}" ${item.code === i18n.getLang() ? 'selected' : ''}>${escapeHTML(i18n.t(item.name))}</option>`).join('')}
              </select>
            </div>

            <div class="dialog-splitter"></div>

            <button class="options-nav-btn" id="btnOptFreePlay">
              <span>🎮 ${i18n.t('Free Play & 12 Games', 'Все 12 мини-игр')}</span>
              <span>➔</span>
            </button>

            <button class="options-nav-btn" id="btnOptHelp">
              <span>❔ ${i18n.t('Help', 'Помощь')}</span>
              <span>➔</span>
            </button>

            <button class="options-nav-btn" id="btnOptAbout">
              <span>ℹ️ ${i18n.t('About', 'О программе')}</span>
              <span>➔</span>
            </button>

            <div class="dialog-splitter"></div>

            <button class="btn-dialog-primary" id="btnOptDone">${i18n.t('OK', 'Готово')}</button>
          </div>
        </div>
      `;

      modal.querySelector('#btnOptClose')?.addEventListener('click', () => {
        audio.play('closeTrainer');
        modal.remove();
        this.activeModal = null;
      });

      modal.querySelector('#btnOptDone')?.addEventListener('click', () => {
        audio.play('closeTrainer');
        modal.remove();
        this.activeModal = null;
      });

      modal.querySelector('#btnVolMinus')?.addEventListener('click', () => {
        let v = (settings.volume ?? 0.8) - 0.1;
        if (v < 0) v = 0;
        storage.updateSettings(st => st.volume = Math.round(v * 10) / 10);
        audio.play('click');
        renderModalContent();
      });

      modal.querySelector('#btnVolPlus')?.addEventListener('click', () => {
        let v = (settings.volume ?? 0.8) + 0.1;
        if (v > 1) v = 1;
        storage.updateSettings(st => st.volume = Math.round(v * 10) / 10);
        audio.play('click');
        renderModalContent();
      });

      modal.querySelector('#btnToggleSoundOpt')?.addEventListener('click', () => {
        storage.updateSettings(st => st.sound = !st.sound);
        audio.play('click');
        renderModalContent();
      });

      modal.querySelector('#selLangOpt')?.addEventListener('change', async event => {
        await i18n.setLang(event.target.value);
        audio.play('click');
        this.renderHeader();
        this.showView(this.currentView, {}, false);
        renderModalContent();
      });

      modal.querySelector('#btnOptFreePlay')?.addEventListener('click', () => {
        audio.play('click');
        modal.remove();
        this.activeModal = null;
        this.showView('games');
      });

      modal.querySelector('#btnOptHelp')?.addEventListener('click', () => {
        audio.play('click');
        modal.remove();
        this.activeModal = null;
        this.showScreenHelp(this.currentView);
      });

      modal.querySelector('#btnOptAbout')?.addEventListener('click', () => {
        audio.play('click');
        modal.remove();
        this.activeModal = null;
        this.showView('about');
      });
    };

    renderModalContent();
    document.getElementById('appWrapper').appendChild(modal);
    this.activeModal = modal;
  }

  // Authentic Help Modals with official APK texts
  showScreenHelp(screenKey) {
    if (this.activeModal) {
      this.activeModal.remove();
      this.activeModal = null;
    }

    const helpTexts = {
      main: {
        title: i18n.t('SPB Brain Evolution Help', 'Помощь: SPB Brain Evolution'),
        body: i18n.t(
          'SPB Brain Evolution is an intellectual software suite designed to train and evaluate brain fitness.\n\n• Brain Training: Complete daily workouts to evolve your mind.\n• Brain Marking: 5 comprehensive tests to measure your Evolutionary Rank.\n• Interesting Facts: Over 200 amazing facts unlocked through training.\n• My Awards: Diplomas and trophies for your achievements.\n• Manage Profiles: Track progress across family and friends.\n• High Scores: Hall of fame with top records.',
          'SPB Brain Evolution — это интеллектуальный комплекс для тренировки и тестирования способностей мозга.\n\n• Тренировка: Выполняйте ежедневные упражнения для развития способностей.\n• Тестирование: 5 комплексных тестов для определения ранга эволюции.\n• Интересные факты: Более 200 поразительных фактов, открываемых в процессе игры.\n• Награды: Дипломы и кубки за ваши успехи.\n• Профили: Ведение раздельной статистики для друзей и семьи.\n• Рекорды: Таблицы лучших результатов.'
        )
      },
      training: {
        title: i18n.t('Brain Training Help', 'Помощь: Тренировка'),
        body: i18n.t(
          'In this mode you can improve your mental awareness by playing mini-games.\n\nBy achieving better results in these games, you will get new ones in the list, with new difficulty levels added in opened games.\n\nYou can always check your Brain Status in the Brain Marking mode.',
          'В этом режиме вы можете улучшить свои способности путем игры в мини-игры.\n\nУлучшая свои результаты, вы будете открывать новые игры в списке, а также новые уровни сложности в уже открытых играх.\n\nВы всегда можете проверить свой статус в режиме Тестирования.'
        )
      },
      marking: {
        title: i18n.t('Brain Marking Help', 'Помощь: Тестирование'),
        body: i18n.t(
          'Here you can check your current Brain Status.\n\nYou will pass five test mini-games: Guess Who, Memorics, Arithmetics, Numbers, and Quadronica. Your combined score determines your evolutionary rank, from Child all the way to Nobel Prize-winner!',
          'В этом режиме вы можете узнать ваш текущий эволюционный статус.\n\nВам предстоит пройти пять контрольных тестов: Кто это?, Меморика, Арифметика, Числа и Квадроника. Общий результат определит ваш ранг развития — от Ребенка до Нобелевского лауреата!'
        )
      },
      facts: {
        title: i18n.t('Interesting Facts Help', 'Помощь: Интересные факты'),
        body: i18n.t(
          'Here you will find all the interesting facts you got. To get new ones, complete more daily training programs.',
          'В этом окне вы можете посмотреть все полученные вами интересные факты. Чтобы открывать новые факты, проходите больше ежедневных тренировок.'
        )
      },
      awards: {
        title: i18n.t('My Awards Help', 'Помощь: Награды'),
        body: i18n.t(
          'Here you will see all awards and certificates you got. Complete daily training programs to earn your diplomas!',
          'В этом окне вы можете посмотреть все ваши награды и дипломы. Проходите ежедневные тренировки, чтобы заслужить почетные дипломы!'
        )
      },
      profiles: {
        title: i18n.t('Game Profiles Help', 'Помощь: Профили'),
        body: i18n.t(
          'In this window you can manage game profiles and review evolutionary statistics for each player.',
          'В этом окне вы можете управлять профилями пользователей и отслеживать персональный прогресс каждого игрока.'
        )
      },
      highscores: {
        title: i18n.t('High Scores Help', 'Помощь: Таблица рекордов'),
        body: i18n.t(
          'In this window you can see the highest scores for all games across 7-Day and Overall periods.',
          'В этом окне вы можете видеть таблицы рекордов для всех игр за последние 7 дней и за все время.'
        )
      }
    };

    // The shell help sections of the original are translated in every language.
    const sections = {training: 'b_train_help', marking: 'b_mark_help', facts: 'int_fact_help', awards: 'awards_list_help', profiles: 'profile_help', highscores: 'highscores_help'};
    const section = this.original?.shell?.[sections[screenKey]];
    const content = section?.['2_value']
      ? {title: escapeHTML(i18n.t(section['1_value'])), body: escapeHTML(i18n.t(section['2_value'])).replace(/\\n/g, '\n').trim()}
      : helpTexts[screenKey] || helpTexts.main;
    const modal = document.createElement('div');
    modal.className = 'spb-dialog-overlay';
    modal.innerHTML = `
      <div class="spb-dialog-card">
        <div class="spb-dialog-header">
          <span>${content.title}</span>
          <button class="spb-dialog-close-x" id="btnHelpClose">✕</button>
        </div>
        <div class="spb-dialog-body">
          <p style="font-size: 13px; line-height: 1.5; color: #173854; white-space: pre-line;">${content.body}</p>
          <button class="btn-dialog-primary" id="btnHelpOk">${i18n.t('OK')}</button>
        </div>
      </div>
    `;

    modal.querySelector('#btnHelpClose')?.addEventListener('click', () => {
      audio.play('click');
      modal.remove();
      this.activeModal = null;
    });

    modal.querySelector('#btnHelpOk')?.addEventListener('click', () => {
      audio.play('click');
      modal.remove();
      this.activeModal = null;
    });

    document.getElementById('appWrapper').appendChild(modal);
    this.activeModal = modal;
  }

  // Authentic Brain Training Screen (CBrainTrain2MenuWnd)
  // Brain Training list (CBrainTrain2MenuWnd, [b_train2_wnd]): every game in the [mini_games]
  // order with its difficulty, progress to the next level (10 items) and today's marks; locked
  // games explain how many level-ups they need.
  async renderTrainingView(container) {
    const config = await loadOriginalConfig();
    const session = await startTraining();
    if (this.currentView !== 'training') return;
    const prof = storage.getProfile();
    const w = config.shell.b_train2_wnd || {};
    const power = prof.history.length ? i18n.t('Your Brain Power: @VALUE').replace('@VALUE', prof.brainScore) : i18n.t('Your Brain Power: ---');
    const done = Object.keys(session.results).length;
    const status = session.complete ? i18n.t('TRAINING COMPLETE')
      : i18n.t('Training in progress.\\n%d of %d tasks done').replace('%d', done).replace('%d', session.required);
    const rows = TRAINING_ORDER.map(id => {
      const game = this.gamesMeta.find(item => item.id === id);
      if (!game) return '';
      const info = trainingInfo(prof, config, id);
      const filled = info.params.required > 0 ? Math.min(10, Math.floor(info.progress * 10 / info.params.required)) : 0;
      const middle = info.open
        ? `<div class="train-dif-text">${escapeHTML(i18n.t(w[`dif_${info.diff}`] || 'Easy'))}</div>
           <div class="train-dif-level" aria-label="${filled}/10">${'<i class="on"></i>'.repeat(filled)}${'<i></i>'.repeat(10 - filled)}</div>`
        : `<div class="train-dif-text">${escapeHTML(i18n.t(w.lev_lock_text || 'LOCKED'))}</div>`;
      const mark = !info.open ? 'Br_Train_Mark_L' : Object.hasOwn(session.results, id) ? 'Br_Train_Mark_V' : '';
      return `
        <div class="train-game-row ${info.open ? '' : 'locked'}" data-id="${id}">
          <div class="train-game-left">
            <span class="train-icon-wrap">
              <img class="catalog-game-icon" src="assets/textures/restored/${this.gameIcon(id)}.png" alt="" />
              ${info.champion ? '<img class="train-medal" src="assets/textures/Br_Train_Mark_Medal.png" alt="" />' : ''}
            </span>
            <div class="train-game-info">
              <h4>${escapeHTML(this.gameTitle(game))}</h4>
              ${middle}
            </div>
          </div>
          <div class="train-game-right">${mark ? `<img src="assets/textures/${mark}.png" class="train-badge-img" alt="" />` : ''}</div>
        </div>`;
    }).join('');

    container.innerHTML = `
      <div class="sub-view-container">
        <div class="train-chart-box">
          <div class="train-chart-title">${escapeHTML(power)}</div>
          <div class="train-chart-canvas-wrap">${this.renderHistoryGraph(prof.history, '#00a408')}</div>
        </div>
        <div class="train-games-scroll">${rows}</div>
        <p class="train-progress-text ${session.complete ? 'complete' : ''}">${escapeHTML(status).replace(/\\n/g, '<br>')}</p>
        <button class="options-nav-btn train-calendar-btn" id="btnTrainCalendar"><span>${escapeHTML(i18n.t('Calendar', 'Календарь'))}</span><span>➔</span></button>
        <button class="btn-spb-action" id="btnStartNewTrain">${escapeHTML(i18n.t('Start New Training'))}</button>
      </div>`;

    container.querySelectorAll('.train-game-row').forEach(row => {
      row.addEventListener('click', () => {
        audio.play('click');
        this.openTrainingGame(row.dataset.id, config);
      });
    });
    container.querySelector('#btnTrainCalendar')?.addEventListener('click', () => {
      audio.play('click');
      this.showView('calendar');
    });
    container.querySelector('#btnStartNewTrain')?.addEventListener('click', () => {
      audio.play('click');
      const current = storage.getProfile().training;
      const restart = async () => {
        const fresh = await startTraining(true);
        this.renderTrainingView(container);
        this.showTrainingStart(fresh, config);
      };
      if (current && !current.complete && Object.keys(current.results).length)
        this.showTrainerMessage(i18n.t('You have an unfinished training session. Do you want to abort it and start a new one ? \\n'),
          [{label: i18n.t('Yes'), onClick: restart}, {label: i18n.t('No')}]);
      else restart();
    });

    if (this.pendingTrainerMessages?.length) this.showNextTrainerMessage();
    else if (!session.startShown) this.showTrainingStart(session, config);
  }

  gameTitle(game) {
    return game.title[i18n.getLang()] || game.title.en || game.title.ru;
  }

  // [b_train_start_new_train]: how many games finish today's training.
  showTrainingStart(session, config) {
    storage.updateProfile(profile => { if (profile.training) profile.training.startShown = true; });
    this.showTrainerMessage(i18n.t('Play any @GM_COUNT games to complete training for today.\\nThe better you play, the more games you get! \\n').replace('@GM_COUNT', session.required));
  }

  openTrainingGame(id, config) {
    const prof = storage.getProfile(), info = trainingInfo(prof, config, id), session = prof.training;
    const game = this.gamesMeta.find(item => item.id === id);
    if (!info.open) {
      const unlock = levelParams(gameSection(config, id, 0)).unlock;
      this.showTrainerMessage(`<b>${escapeHTML(i18n.t('@GAME Locked').replace('@GAME', this.gameTitle(game)))}</b><br><br>${escapeHTML(i18n.t('To unlock this game you should raise difficulty @TIMES time(s) in any of the available games.').replace('@TIMES', Math.max(1, unlock - (prof.promotions || 0))))}`, null, true);
      return;
    }
    const play = () => this.showView('play', {gameId: id, difficulty: ['easy', 'medium', 'hard', 'ultra'][info.diff] || 'easy', mode: 'training'});
    if (session?.complete) this.showTrainerMessage(i18n.t('Training program is complete! \\nThis attempt will have NO effect \\non the training progress!\\n'), [{label: i18n.t('Next'), onClick: play}]);
    else if (session && Object.hasOwn(session.results, id)) this.showTrainerMessage(i18n.t("Today you've already played this game, so a new result\\nwill have NO affect\\non the training progress!\\n"), [{label: i18n.t('Next'), onClick: play}]);
    else play();
  }

  // Trainer messages after a training game: dif_up/dif_down/level_up/all_done_trainer, then
  // b_train_all_done with the Brain Power.
  queueTrainingEvents(events) {
    if (!events || events.noEffect) return;
    const names = ids => ids.map(id => this.gameTitle(this.gamesMeta.find(item => item.id === id) || {title: {en: id}})).join('\n');
    const list = [];
    if (events.levelUp.length) list.push(['Br_Train_Ico_LevelUp', 'Your skill in the following games is enough to get to the next stage:', names(events.levelUp)]);
    if (events.levelDown.length) list.push(['Br_Train_Ico_LevelDown', 'You skill in the following games is not enough to play at the current level of difficulty:', names(events.levelDown)]);
    if (events.opened.length) list.push(['Br_Train_Ico_Open_Game', 'Now your level is enough to play these new games:', names(events.opened)]);
    if (events.champion.length) list.push(['Br_Train_Ico_All_Done', 'Your are a real champion in the following games:', names(events.champion), 'All your awards may be found in the "My Awards" window.']);
    const messages = list.map(([icon, text, games, note]) => `<div class="trainer-event"><img src="assets/textures/${icon}.png" alt="" /><div><p>${escapeHTML(i18n.t(text))}</p><p class="trainer-event-games">${escapeHTML(games).replace(/\n/g, '<br>')}</p></div></div>${note ? `<p>${escapeHTML(i18n.t(note))}</p>` : ''}`);
    if (events.complete !== undefined)
      messages.push(`<p>${escapeHTML(i18n.t("You've successfully completed the daily training program.\\nGood job!")).replace(/\\n/g, '<br>')}</p><p class="mg-results-total">${escapeHTML(i18n.t('Your Brain Power is\\n@SCORE').replace('@SCORE', events.complete)).replace(/\\n/g, '<br>')}</p>`);
    this.pendingTrainerMessages = [...(this.pendingTrainerMessages || []), ...messages];
    // The old training window opened the calendar after a finished training (menu 0x4ecd).
    if (events.complete !== undefined) this.calendarAfterMessages = true;
  }

  showNextTrainerMessage() {
    const html = this.pendingTrainerMessages?.shift();
    if (html) this.showTrainerMessage(html, [{label: i18n.t('Next'), onClick: () => this.showNextTrainerMessage()}], true);
    else if (this.calendarAfterMessages) {
      this.calendarAfterMessages = false;
      this.showView('calendar');
    }
  }

  // Calendar (CCalendarMenuWnd, FUN_4a05c7b0 / FUN_4a05dff0). Its layout INO is empty in this
  // build, so the window follows the code: "%ls %04d" month header with the Calendar_Left/Right
  // arrows, day names, a Sunday-first grid (the 1st sits at its tm_wday), today marked, and days
  // with trainings (bt_hdate) ticked with their count; a ticked day shows its trainings.
  renderCalendarView(container, month) {
    const prof = storage.getProfile();
    const now = new Date();
    const view = month || {year: now.getFullYear(), month: now.getMonth()};
    const first = new Date(view.year, view.month, 1).getDay();
    const days = new Date(view.year, view.month + 1, 0).getDate();
    const key = day => `${view.year}-${String(view.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const today = localDate();
    const trainings = {};
    for (const item of prof.history || []) trainings[item.date] = (trainings[item.date] || 0) + 1;
    const cells = [];
    for (let i = 0; i < first; i++) cells.push('<div class="cal-cell empty"></div>');
    for (let day = 1; day <= days; day++) {
      const date = key(day), count = trainings[date] || 0;
      const attrs = count ? `data-date="${date}"` : 'disabled';
      cells.push(`<button class="cal-cell${date === today ? ' today' : ''}${count ? ' trained' : ''}" ${attrs}>
          <span class="cal-day">${day}</span>
          ${count ? `<img class="cal-tick" src="assets/textures/Br_Train_Mark_V.png" alt="" />${count > 1 ? `<span class="cal-count">${count}</span>` : ''}` : ''}
        </button>`);
    }
    container.innerHTML = `
      <div class="sub-view-container calendar-view">
        <div class="cal-header">
          <button class="cal-arrow left" data-shift="-1" aria-label="${escapeHTML(i18n.t('Back'))}"></button>
          <div class="cal-title">${escapeHTML(i18n.t(MONTHS[view.month]))} ${String(view.year).padStart(4, '0')}</div>
          <button class="cal-arrow right" data-shift="1" aria-label="${escapeHTML(i18n.t('Next'))}"></button>
        </div>
        <div class="cal-grid">
          ${WEEKDAYS.map(name => `<div class="cal-weekday">${escapeHTML(i18n.t(name))}</div>`).join('')}
          ${cells.join('')}
        </div>
      </div>`;
    container.querySelectorAll('[data-shift]').forEach(btn => btn.addEventListener('click', () => {
      audio.play('click');
      const next = new Date(view.year, view.month + Number(btn.dataset.shift), 1);
      this.renderCalendarView(container, {year: next.getFullYear(), month: next.getMonth()});
    }));
    container.querySelectorAll('.cal-cell.trained').forEach(cell => cell.addEventListener('click', () => {
      audio.play('click');
      this.showCalendarDay(cell.dataset.date);
    }));
  }

  // cal_trainer_info: every training of the day with its Brain Power and game results.
  showCalendarDay(date) {
    const prof = storage.getProfile();
    const [year, month, day] = date.split('-').map(Number);
    const list = (prof.history || []).filter(item => item.date === date);
    const body = list.map((item, index) => {
      const games = Object.entries(item.results || {}).map(([id, score]) => {
        const game = this.gamesMeta.find(g => g.id === id);
        return `<li>${escapeHTML(game ? this.gameTitle(game) : id)}: ${escapeHTML(pointsText(score))}</li>`;
      }).join('');
      const title = `${i18n.t('Brain Training')}${list.length > 1 ? ` ${index + 1}` : ''}`;
      return `<p><b>${escapeHTML(title)}</b><br>${escapeHTML(i18n.t('Your Brain Power: @VALUE').replace('@VALUE', item.score))}</p>${games ? `<ul class="cal-games">${games}</ul>` : ''}`;
    }).join('');
    this.showTrainerMessage(`<p class="mg-results-total">${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.${year}</p>${body}`, null, true);
  }

  // The trainer message box (trainer_msgbox: tile 911, bottom 901, NEXT button 913/912).
  showTrainerMessage(text, buttons = null, isHTML = false) {
    this.trainerModal?.remove();
    const modal = document.createElement('div');
    modal.className = 'spb-modal-overlay trainer-message';
    const body = isHTML ? text : escapeHTML(text).replace(/\\n/g, '<br>');
    const list = buttons || [{label: i18n.t('Next')}];
    modal.innerHTML = `<div class="restored-results"><div class="mg-results"><div class="mg-results-body">
        <div class="trainer-message-text">${body}</div>
        <div class="trainer-message-buttons">${list.map((b, i) => `<button class="mg-results-btn" data-btn="${i}">${escapeHTML(b.label)}</button>`).join('')}</div>
      </div></div></div>`;
    modal.querySelectorAll('[data-btn]').forEach(btn => btn.addEventListener('click', () => {
      audio.play('click');
      modal.remove();
      if (this.trainerModal === modal) this.trainerModal = null;
      list[Number(btn.dataset.btn)].onClick?.();
    }));
    document.getElementById('appWrapper').appendChild(modal);
    this.trainerModal = modal;
  }

  // Authentic Brain Marking Screen (CBrainMarkMenuWnd)
  renderMarkingView(container) {
    const prof = storage.getProfile();
    const rankTitle = this.getRankTitle(prof.brainRank);
    const rankDesc = this.getRankDescription(prof.brainRank);
    const progressPercent = Math.round((prof.brainMark || 0) / 100);

    container.innerHTML = `
      <div class="sub-view-container">
        <!-- Progress Bar -->
        <div class="marking-progress-card">
          <div class="marking-progress-label">
            <span>${i18n.t('Overall progress', 'Общий прогресс')}</span>
            <span>${progressPercent} %</span>
          </div>
          <div class="marking-progress-track">
            <div class="marking-progress-fill" style="width: ${progressPercent}%"></div>
          </div>
        </div>

        <!-- Marking History Graphic -->
        <div class="marking-chart-card">
          ${this.renderHistoryGraph(prof.markingHistory, '#107088')}
        </div>

        <!-- Evolutionary Rank Card -->
        <div class="marking-status-card">
          <img src="assets/textures/Br_Mark_Rank_${prof.brainRank}.png" class="marking-status-avatar" alt="" />
          <div class="marking-status-desc-box">
            <h3>${rankTitle}</h3>
            <p>${rankDesc}</p>
          </div>
        </div>

        <button class="btn-spb-action" id="btnStartBrainMark">${prof.marking ? tr('Продолжить тестирование','Resume test') : i18n.t('Start New Brain Mark')}</button>
      </div>
    `;

    container.querySelector('#btnStartBrainMark')?.addEventListener('click', async () => {
      audio.play('click');
      const pending = storage.getProfile().marking;
      const route = pending ? miniGameRoute(pending.sequence[pending.index]) : await startMarking();
      this.showView('play', {...route, mode: 'marking'});
    });
  }

  // Authentic Interesting Facts Screen (CInterestingFactsMenuWnd)
  renderFactsView(container) {
    const lang = i18n.getLang();

    container.innerHTML = `
      <div class="sub-view-container">
        <div class="facts-scroll-list">
          ${this.facts.map((f, i) => {
            const txt = lang === 'ru' ? f.ru : lang === 'en' ? f.en : i18n.t(f.en);
            return `
              <div class="fact-item-card">
                <div class="fact-item-num">#${i + 1}</div>
                <div class="fact-item-text">${txt}</div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  // Authentic My Awards Screen (CAwardsListMenuWnd)
  renderAwardsView(container) {
    const prof = storage.getProfile();
    const lang = i18n.getLang();

    container.innerHTML = `
      <div class="sub-view-container">
        <!-- Diplomas Row -->
        <div class="awards-diplomas-row">
          <div class="diploma-card ${prof.awards.includes('training_complete') ? '' : 'unearned'}" id="btnDiplomaTrain">
            <img src="assets/textures/Diploma_Br_Train.png" alt="Diploma" />
            <h4>${i18n.t('Training Program Complete Certificate')}</h4>
          </div>
          <div class="diploma-card ${prof.awards.includes('nobel') ? '' : 'unearned'}" id="btnDiplomaMark">
            <img src="assets/textures/Diploma_Br_Mark.png" alt="Diploma" />
            <h4>${i18n.t('Nobel Prize Winner Certificate')}</h4>
          </div>
        </div>

        <!-- 12 Game Awards -->
        <div class="awards-games-list">
          ${TRAINING_ORDER.map(id => this.gamesMeta.find(game => game.id === id)).filter(Boolean).map(game => {
            // [awards_list_game_btn] "%ls Best Play Award": earned at the top difficulty in training.
            const earned = prof.awards.includes(`best_${game.id}`);
            return `
              <div class="award-game-row ${earned ? '' : 'unearned'}" data-award="${game.id}">
                <div class="award-game-left">
                  <img src="assets/textures/Award_Game.png" class="award-trophy-img" alt="" />
                  <span class="award-game-title">${escapeHTML(i18n.t('%ls Best Play Award').replace('%ls', this.gameTitle(game)))}</span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    container.querySelectorAll('[data-award]').forEach(row => row.addEventListener('click', () => {
      audio.play('click');
      const name = this.gameTitle(this.gamesMeta.find(game => game.id === row.dataset.award));
      const help = this.original?.shell?.awards_games_trainer_help || {};
      this.showTrainerMessage(`<b>${escapeHTML(i18n.t(help['1_value'] || '').replace('@MGAME_NAME', name))}</b><br><br>${escapeHTML(i18n.t(help['2_value'] || '').replace(/@MGAME_NAME/g, name)).replace(/\\n/g, '<br>')}`, null, true);
    }));

    container.querySelector('#btnDiplomaTrain')?.addEventListener('click', () => {
      if (!prof.awards.includes('training_complete')) return;
      audio.play('diploma');
      this.showDiplomaModal('assets/textures/Diploma_Br_Train.png');
    });

    container.querySelector('#btnDiplomaMark')?.addEventListener('click', () => {
      if (!prof.awards.includes('nobel')) return;
      audio.play('diploma');
      this.showDiplomaModal('assets/textures/Diploma_Br_Mark.png');
    });
  }

  showDiplomaModal(imgUrl) {
    const modal = document.createElement('div');
    modal.className = 'spb-dialog-overlay';
    modal.innerHTML = `
      <div class="spb-dialog-card" style="text-align: center;">
        <div class="spb-dialog-header">
          <span>${i18n.t('Official Diploma', 'Почетный диплом')}</span>
          <button class="spb-dialog-close-x" id="btnCloseDip">✕</button>
        </div>
        <div class="spb-dialog-body" style="align-items: center;">
          <img src="${imgUrl}" style="width: 100%; max-height: 380px; object-fit: contain; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.3);" />
          <button class="btn-dialog-primary" id="btnOkDip">${i18n.t('Close', 'Закрыть')}</button>
        </div>
      </div>
    `;

    modal.querySelector('#btnCloseDip')?.addEventListener('click', () => modal.remove());
    modal.querySelector('#btnOkDip')?.addEventListener('click', () => modal.remove());
    document.getElementById('appWrapper').appendChild(modal);
  }

  // Authentic Manage Profiles Screen (CProfileMenuWnd)
  renderProfilesView(container) {
    const prof = storage.getProfile();

    container.innerHTML = `
      <div class="sub-view-container">
        <div class="profiles-list-card">
          <label>${tr('Профиль','Profile')} <select id="profileSelect">${Object.entries(storage.data.profiles).map(([id, profile]) => `<option value="${escapeHTML(id)}" ${id === storage.data.activeProfile ? 'selected' : ''}>${escapeHTML(profile.name)}</option>`).join('')}</select></label>
          <div class="profile-item-row active">
            <div class="prof-item-left">
              <img src="assets/textures/Profile_Marker_Cur.png" class="prof-marker-img" alt="" />
              <input type="text" id="inputProfName" value="${escapeHTML(prof.name)}" style="font-size: 15px; font-weight: 800; color: #174872; border: 1px solid #7eaed6; border-radius: 6px; padding: 4px 8px; background: #fff;" />
            </div>
            <button class="btn-dialog-primary" id="btnSaveProf" style="width: auto; padding: 6px 12px; font-size: 13px;">${i18n.t('Save', 'Ок')}</button>
          </div>
        </div>

        <div class="profile-stats-panel">
          <div class="prof-stat-row">
            <span>${i18n.t('Evolution Score', 'Индекс развития')}:</span>
            <span class="prof-stat-val">⚡ ${prof.brainScore} pts</span>
          </div>
          <div class="prof-stat-row">
            <span>${i18n.t('Evolutionary Rank', 'Ранг эволюции')}:</span>
            <span class="prof-stat-val">${this.getRankTitle(prof.brainRank)}</span>
          </div>
          <div class="prof-stat-row">
            <span>${i18n.t('Training Days', 'Дней тренировок')}:</span>
            <span class="prof-stat-val">📅 ${prof.trainingDays}</span>
          </div>
        </div>

        <button class="btn-spb-action" id="btnCreateProf">${i18n.t('Create New Profile', 'Создать новый профиль')}</button>
      </div>
    `;

    container.querySelector('#profileSelect')?.addEventListener('change', (event) => { storage.selectProfile(event.target.value); this.renderProfilesView(container); });

    container.querySelector('#btnSaveProf')?.addEventListener('click', () => {
      const val = container.querySelector('#inputProfName')?.value?.trim();
      if (val) {
        storage.updateProfile(p => p.name = val);
        audio.play('click');
        this.renderHeader();
        alert(i18n.t('Profile name saved!', 'Имя профиля сохранено!'));
      }
    });

    container.querySelector('#btnCreateProf')?.addEventListener('click', () => {
      audio.play('click');
      const name = prompt(i18n.t('Enter new profile name:', 'Введите имя нового профиля:'));
      if (name && name.trim()) {
        storage.createProfile(name.trim());
        this.renderProfilesView(container);
      }
    });
  }

  // Authentic High Scores Screen (CHighscoresMenuWnd)
  renderHighscoresView(container) {
    const prof = storage.getProfile();
    const lang = i18n.getLang();
    const topHistory = entries => Math.max(0, ...(entries || []).filter(item => this.hsMode === 'all' || Date.parse(item.date) >= Date.now() - 7 * 86400000).map(item => item.score));

    container.innerHTML = `
      <div class="sub-view-container">
        <!-- Tabs -->
        <div class="hs-tabs-wrap">
          <button class="btn-hs-tab ${this.hsMode === '7day' ? 'active' : ''}" id="btnHs7Day">${i18n.t('Last 7 Days Top', 'Топ за 7 дней')}</button>
          <button class="btn-hs-tab ${this.hsMode === 'all' ? 'active' : ''}" id="btnHsAll">${i18n.t('Overall Top', 'Общий топ')}</button>
        </div>

        <!-- Scores List -->
        <div class="hs-table-scroll">
          <div class="hs-item-row" style="background: #eef7fc; border-color: #3b7bb2;">
            <div class="hs-left">
              <img src="assets/textures/Highscores_BT_Icon.png" class="hs-icon-img" alt="" />
              <span class="hs-title">${i18n.t('Brain Power Top', 'Сила мозга')}</span>
            </div>
            <span class="hs-score-val">${topHistory(prof.history)} pts</span>
          </div>

          <div class="hs-item-row" style="background: #eef7fc; border-color: #3b7bb2;">
            <div class="hs-left">
              <img src="assets/textures/Highscores_BM_Icon.png" class="hs-icon-img" alt="" />
              <span class="hs-title">${i18n.t('Brain Mark Top', 'Индекс эволюции')}</span>
            </div>
            <span class="hs-score-val">${topHistory(prof.markingHistory)} pts</span>
          </div>

          ${this.gamesMeta.map((game, idx) => {
            const title = this.gameTitle(game);
            const score = storage.getHighScore(game.id, this.hsMode === '7day' ? 7 : null);
            return `
              <div class="hs-item-row">
                <div class="hs-left">
                  <img src="assets/textures/Highscores_Game_Icon.png" class="hs-icon-img" alt="" />
                  <span class="hs-title">${title}</span>
                </div>
                <span class="hs-score-val">⭐ ${score}</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    container.querySelector('#btnHs7Day')?.addEventListener('click', () => {
      this.hsMode = '7day';
      audio.play('click');
      this.renderHighscoresView(container);
    });

    container.querySelector('#btnHsAll')?.addEventListener('click', () => {
      this.hsMode = 'all';
      audio.play('click');
      this.renderHighscoresView(container);
    });
  }

  // Authentic About Screen (CAboutWnd from _SHELL_M_ABOUT_INO)
  renderAboutView(container) {
    container.innerHTML = `
      <div class="sub-view-container">
        <div class="about-scroll-card">
          <img src="assets/textures/Br_Mark_Rank_7.png" class="about-header-logo" alt="Logo" />
          <h2 class="about-title">SPB Brain Evolution</h2>
          <span class="about-copy">Version 2.3.0 Modern Remaster (2026)<br>Copyright © 2007-2011 SPB Software</span>

          <div class="dialog-splitter"></div>

          <div class="about-credits-box">
            <span class="credits-sec-title">Programming Team:</span>
            <span class="credits-sec-names">Vitaliy Alekseev<br>Denis Byzov</span>

            <span class="credits-sec-title">Graphics and Design:</span>
            <span class="credits-sec-names">Pavel Galkin<br>Alexey Chorny</span>

            <span class="credits-sec-title">Audio and Sound:</span>
            <span class="credits-sec-names">Evgeniy Galkin</span>

            <span class="credits-sec-title">Product Manager:</span>
            <span class="credits-sec-names">Denis Byzov</span>

            <span class="credits-sec-title">Special Thanks to:</span>
            <span class="credits-sec-names">Vassili Philippov<br>Alexander Dovgaluk<br>Evgeny Golotvin<br>Nadine Alisawi<br>Serg Podtynnyi<br>Vladimir Nestorovich<br>Eugene Nikulin</span>
          </div>
        </div>
      </div>
    `;
  }

  // 12 Mini-Games Catalog (Free Play)
  renderGamesList(container) {
    const lang = i18n.getLang();
    const prof = storage.getProfile();

    container.innerHTML = `
      <div class="sub-view-container">
        <div class="facts-scroll-list">
          ${this.gamesMeta.map(game => {
            const title = this.gameTitle(game);
            const cat = game.category[lang] || game.category.en;
            const desc = game.desc[lang] || game.desc.en;
            const highScore = prof.highScores[game.id] || 0;

            return `
              <div class="train-game-row" style="flex-direction: column; align-items: stretch; gap: 8px;">
                <div style="display: flex; align-items: center; justify-content: space-between;">
                  <div style="display: flex; align-items: center; gap: 10px;">
                    <img class="catalog-game-icon" src="assets/textures/restored/${this.gameIcon(game.id)}.png" alt="" />
                    <div>
                      <h4 style="font-size: 15px; font-weight: 800; color: #174872;">${title}</h4>
                      <span style="font-size: 11px; font-weight: 600; color: #4075a3;">${cat}</span>
                    </div>
                  </div>
                  <span style="font-size: 12px; font-weight: 800; color: #d35400;">⭐ ${highScore} pts</span>
                </div>
                <p style="font-size: 12px; color: #2e4d6a; line-height: 1.3;">${desc}</p>
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px; margin-top: 2px;">
                  <button class="btn-diff-play" data-id="${game.id}" data-diff="easy" style="padding: 6px; background: #e2f0fa; border: 1px solid #8ab8dc; border-radius: 6px; font-size: 12px; font-weight: 700; color: #174872; cursor: pointer;">${i18n.t('Easy', 'Легко')}</button>
                  <button class="btn-diff-play" data-id="${game.id}" data-diff="medium" style="padding: 6px; background: #e2f0fa; border: 1px solid #8ab8dc; border-radius: 6px; font-size: 12px; font-weight: 700; color: #174872; cursor: pointer;">${i18n.t('Med', 'Средне')}</button>
                  <button class="btn-diff-play" data-id="${game.id}" data-diff="hard" style="padding: 6px; background: #e2f0fa; border: 1px solid #8ab8dc; border-radius: 6px; font-size: 12px; font-weight: 700; color: #174872; cursor: pointer;">${i18n.t('Hard', 'Сложно')}</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    container.querySelectorAll('.btn-diff-play').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const diff = btn.dataset.diff;
        audio.play('click');
        this.showView('play', { gameId: id, difficulty: diff });
      });
    });
  }

  gameIcon(id) {
    return {sudoku:'Icon_Sudoku',matches:'Icon_Matches',pairs:'Icon_Pairs',memorics:'Icon_ColorRects',quadronica:'Icon_Znax',numbers:'Icon_Numbers',arithmetics:'Icon_Connected_Calc',minesweeper:'Icon_Minesweeper',roadblocks:'Icon_RoadBlocks',guess_who:'Icon_Antenna_Head',geometry:'Icon_Geometry',encyclopedia:'Icon_Interesting_Values'}[id];
  }

  renderHistoryGraph(history, color) {
    const values = (history || []).slice(-10);
    if (!values.length) return `<p class="restored-instruction">${tr('Результатов пока нет','No results yet')}</p>`;
    const max = Math.max(1, ...values.map(item => item.score));
    const points = values.map((item, index) => `${20 + index * 360 / Math.max(1, values.length - 1)},${80 - item.score / max * 65}`);
    return `<svg viewBox="0 0 400 90" width="100%" height="100%" aria-label="${tr('История результатов','Score history')}"><polyline fill="none" stroke="${color}" stroke-width="3" points="${points.join(' ')}"/>${points.map(point => { const [x,y]=point.split(','); return `<circle cx="${x}" cy="${y}" r="4" fill="${color}"/>`; }).join('')}</svg>`;
  }

  getGameEmoji(id) {
    const emojis = {
      sudoku: '🔢',
      matches: '🥢',
      pairs: '🃏',
      quadronica: '🔷',
      numbers: '🎯',
      arithmetics: '🧮',
      minesweeper: '💣',
      roadblocks: '⚪',
      guess_who: '🐜',
      znax: '🔷',
      memorics: '💡',
      geometry: '▲',
      encyclopedia: '📖'
    };
    return emojis[id] || '🎮';
  }

  launchGame(container, gameId, difficulty = 'easy', mode = null) {
    let game;
    const onComplete = async (score) => {
      if (this.activeGameInstance !== game) return;
      if (mode === 'marking' && score !== null) {
        const result = await recordMarking(score);
        if (result?.next) { this.showView('play', {...result.next, mode}); return; }
      }
      if (mode === 'training' && score !== null) this.queueTrainingEvents(await recordTraining(gameId, score));
      this.showView(mode === 'marking' ? 'marking' : mode === 'training' ? 'training' : 'games');
    };

    const onOpenMenu = (opts = {}) => {
      if (!game || game.destroyed) return;
      if (game instanceof QuadronicaGame) { this.showInGameMenu(opts, gameId, difficulty); return; }
      game.isPaused = true;
      const resume = opts.onResume;
      this.showInGameMenu({...opts, isPauseMenu: true, onResume: () => { game.isPaused = false; resume?.(); }}, gameId, difficulty);
    };

    const onOpenHelp = (gId, onClose) => {
      if (game instanceof QuadronicaGame) { this.showGameHelpModal(gId); return; }
      game.isPaused = true;
      this.showGameHelpModal(gId, () => { game.isPaused = false; onClose?.(); });
    };

    switch (gameId) {
      case 'sudoku': game = new SudokuGame(container, onComplete, onOpenMenu, onOpenHelp); break;
      case 'matches': game = new MatchesGame(container, onComplete, onOpenMenu, onOpenHelp); break;
      case 'pairs': game = new PairsGame(container, onComplete, onOpenMenu, onOpenHelp); break;
      case 'memorics': game = new MemoricsGame(container, onComplete, onOpenMenu, onOpenHelp); break;
      case 'numbers': game = new NumbersGame(container, onComplete, onOpenMenu, onOpenHelp); break;
      case 'arithmetics': game = new ArithmeticsGame(container, onComplete, onOpenMenu, onOpenHelp); break;
      case 'minesweeper': game = new MinesweeperGame(container, onComplete, onOpenMenu, onOpenHelp); break;
      case 'roadblocks': game = new RoadblocksGame(container, onComplete, onOpenMenu, onOpenHelp); break;
      case 'guess_who': game = new GuessWhoGame(container, onComplete, onOpenMenu, onOpenHelp); break;
      case 'quadronica':
      case 'znax':
        game = new QuadronicaGame(container, onComplete, onOpenMenu, onOpenHelp);
        break;
      case 'geometry': game = new GeometryGame(container, onComplete, onOpenMenu, onOpenHelp); break;
      case 'encyclopedia': game = new EncyclopediaGame(container, onComplete, onOpenMenu, onOpenHelp); break;
      default:
        this.showView('games');
        return;
    }

    game.mode = mode;
    if (!(game instanceof RestoredGame) && !(game instanceof QuadronicaGame)) attachGameLifetime(game);
    this.activeGameInstance = game;
    Promise.resolve(game.init(difficulty)).catch(error => {
      console.error('Game initialization failed:', error);
    });
  }

  showInGameMenu(opts = {}, gameId, difficulty) {
    this.activeModal?.remove();
    const modal = document.createElement('div');
    modal.className = 'spb-dialog-overlay';
    modal.innerHTML = `
      <div class="spb-dialog-card">
        <div class="spb-dialog-header">
          <span>${opts.isPauseMenu ? i18n.t('Paused') : i18n.t('Menu')}</span>
          <button class="spb-dialog-close-x" id="modalBtnClosePause">✕</button>
        </div>
        <div class="spb-dialog-body">
          ${opts.isPauseMenu ? `
            <button class="btn-dialog-primary" id="modalBtnResume">${i18n.t('Resume', 'Продолжить')}</button>
          ` : ''}
          <button class="options-nav-btn" id="modalBtnRestart">${i18n.t('New Game')}</button>
          <button class="options-nav-btn" id="modalBtnHelp">${i18n.t('Help')}</button>
          <button class="options-nav-btn" id="modalBtnExit" style="color: #c0392b;">${i18n.t('Back')}</button>
        </div>
      </div>
    `;

    document.getElementById('appWrapper').appendChild(modal);
    this.activeModal = modal;

    modal.querySelector('#modalBtnClosePause')?.addEventListener('click', () => {
      audio.play('click');
      opts.onResume?.();
      modal.remove();
    });

    modal.querySelector('#modalBtnResume')?.addEventListener('click', () => {
      audio.play('click');
      opts.onResume?.();
      modal.remove();
    });

    modal.querySelector('#modalBtnRestart')?.addEventListener('click', () => {
      audio.play('click');
      modal.remove();
      opts.onRestart?.();
    });

    modal.querySelector('#modalBtnHelp')?.addEventListener('click', () => {
      modal.remove();
      this.showGameHelpModal(gameId, opts.onResume);
    });

    modal.querySelector('#modalBtnExit')?.addEventListener('click', () => {
      audio.play('click');
      modal.remove();
      opts.onExit?.();
    });
  }

  showGameHelpModal(gameId, onClose) {
    this.activeModal?.remove();
    const meta = this.gamesMeta.find(g => g.id === gameId);
    const lang = i18n.getLang();
    const title = meta ? this.gameTitle(meta) : 'Help';
    const helpKeys = {memorics:'cr_help',numbers:'numbers_help',geometry:'geometry_help',encyclopedia:'iv_help',guess_who:'ant_head_help',arithmetics:'cc_help',roadblocks:'rb_help',minesweeper:'ms_help',pairs:'pairs_help',quadronica:'znax_help',sudoku:'sudoku_help',matches:'matches_help'};
    const help = this.original?.games[helpKeys[gameId]];
    const desc = help?.['2_value'] ? i18n.t(help['2_value']).replace(/\\n/g, ' ') : (meta ? (meta.desc[lang] || meta.desc.en) : '');

    const modal = document.createElement('div');
    modal.className = 'spb-dialog-overlay';
    modal.innerHTML = `
      <div class="spb-dialog-card">
        <div class="spb-dialog-header">
          <span>📖 ${title}</span>
          <button class="spb-dialog-close-x" id="modalBtnCloseHelpX">✕</button>
        </div>
        <div class="spb-dialog-body">
          <p style="font-size: 13px; line-height: 1.5; color: #173854;">${desc}</p>
          <button class="btn-dialog-primary" id="modalBtnCloseHelp">${i18n.t('OK', 'Понятно')}</button>
        </div>
      </div>
    `;

    document.getElementById('appWrapper').appendChild(modal);
    this.activeModal = modal;
    modal.querySelector('#modalBtnCloseHelpX')?.addEventListener('click', () => {
      audio.play('click');
      modal.remove();
      onClose?.();
    });
    modal.querySelector('#modalBtnCloseHelp')?.addEventListener('click', () => {
      audio.play('click');
      modal.remove();
      onClose?.();
    });
  }

  bindGlobalEvents() {
    const unlockAudio = () => {
      audio.init();
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
    };
    window.addEventListener('click', unlockAudio);
    window.addEventListener('touchstart', unlockAudio);

    // Keyboard shortcuts (1-6 for main menu, ESC for options)
    window.addEventListener('keydown', (e) => {
      if (this.currentView === 'main' && !this.activeModal) {
        switch (e.key) {
          case '1': audio.play('click'); this.showView('training'); break;
          case '2': audio.play('click'); this.showView('marking'); break;
          case '3': audio.play('click'); this.showView('facts'); break;
          case '4': audio.play('click'); this.showView('awards'); break;
          case '5': audio.play('click'); this.showView('profiles'); break;
          case '6': audio.play('click'); this.showView('highscores'); break;
          case 'm':
          case 'M':
          case 'Escape':
            audio.play('openTrainer');
            this.showOptionsMenu();
            break;
        }
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
  window.app.init();
});
