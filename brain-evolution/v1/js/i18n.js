// Amaze Brain Evolution - Internationalization (i18n)
// The original ships 13 languages (languages.erc: LANGUAGES.cfg + <CODE>_TXT.txt with lines
// "English text|translation"); scripts/extract_languages.py writes them to data/locales.

import { storage } from './storage.js';

// HTML lang attribute for the original codes (cz is Czech, nb Norwegian Bokmål).
const HTML_LANG = {cz: 'cs'};

class I18nManager {
  constructor() {
    this.locales = {ru: {}, en: {}};
    // "lang<TAB>key" of every string shown in English because the language has no translation
    // (PLAN 4а.5: the language check in test_runner.html fails on any of them).
    this.missing = new Set();
    this.languages = [{code: 'ru', name: 'Russian'}, {code: 'en', name: 'English'}];
    this.loaded = false;
  }

  // Strings made only for the web are translated in web_extra.json (one array per string).
  async loadExtra() {
    if (!this.extra) {
      this.extra = fetch('data/locales/web_extra.json').then(resp => resp.json()).catch(e => {
        console.warn('Error loading web strings:', e);
        return {_order: []};
      });
    }
    return this.extra;
  }

  async load(code) {
    if (this.locales[code] && Object.keys(this.locales[code]).length) return this.locales[code];
    let table = {};
    try {
      table = await (await fetch(`data/locales/${code}.json`)).json();
    } catch (e) {
      console.warn(`Error loading locale ${code}:`, e);
    }
    const extra = await this.loadExtra(), index = extra._order.indexOf(code);
    if (index >= 0) for (const [key, values] of Object.entries(extra)) {
      if (!key.startsWith('_') && !table[key] && values[index]) table[key] = values[index];
    }
    // Russian of the strings made for the web after the Russian fallbacks in the code (PLAN 5).
    if (code === 'ru') for (const [key, value] of Object.entries(extra._ru || {})) if (!table[key]) table[key] = value;
    // A few fixes on top of the original texts (an untranslated or mistyped menu name).
    Object.assign(table, extra._override?.[code] || {});
    this.locales[code] = table;
    return table;
  }

  async init() {
    try {
      this.languages = await (await fetch('data/locales/languages.json')).json();
    } catch (e) {
      console.warn('Error loading language list:', e);
    }
    try {
      const games = await (await fetch('data/minigames.json')).json();
      this.gameTitles = Object.fromEntries(games.map(game => [game.id, game.title]));
    } catch (e) {
      console.warn('Error loading game names:', e);
    }
    const lang = this.getLang();
    await Promise.all(['ru', 'en', lang].map(code => this.load(code)));
    document.documentElement.lang = HTML_LANG[lang] || lang;
    this.loaded = true;
  }

  // key is the original English text; fallback is the Russian text of strings made for the web.
  t(key, fallback = '') {
    const lang = this.getLang();
    const value = this.locales[lang]?.[key];
    if (value) return value;
    if (lang === 'ru' && fallback) return fallback;
    if (lang !== 'en' && key) this.missing.add(`${lang}\t${key}`);
    return this.locales.en?.[key] || key || fallback;
  }

  // A game's name as in the catalog (data/minigames.json): the player's language, else English.
  gameName(id) {
    const title = this.gameTitles?.[id];
    return title ? title[this.getLang()] || title.en || id : id;
  }

  // After the numbers are put in: "2 игр(ы)" -> "2 игры", "5 раз(а)" -> "5 раз" (Russian only).
  counted(text) {
    if (this.getLang() !== 'ru') return text;
    return text.replace(/(\d+) (игр\(ы\)|раз\(а\))/g, (match, n, word) => `${n} ${ruPlural(Number(n), RU_FORMS[word])}`);
  }

  getLang() {
    const lang = storage.getSettings().locale || 'ru';
    return this.languages.some(item => item.code === lang) ? lang : 'ru';
  }

  async setLang(lang) {
    await this.load(lang);
    storage.updateSettings(s => s.locale = lang);
    document.documentElement.lang = HTML_LANG[lang] || lang;
  }
}

// Russian strings of the original write plurals as "игр(ы)" and "раз(а)".
const RU_FORMS = {'игр(ы)': ['игру', 'игры', 'игр'], 'раз(а)': ['раз', 'раза', 'раз']};
export function ruPlural(n, [one, few, many]) {
  const tens = Math.abs(n) % 100, units = tens % 10;
  if (tens > 10 && tens < 20) return many;
  if (units === 1) return one;
  return units >= 2 && units <= 4 ? few : many;
}

export const i18n = new I18nManager();
