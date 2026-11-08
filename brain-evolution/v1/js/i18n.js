// Amaze Brain Evolution - Internationalization (i18n)
// The original ships 13 languages (languages.erc: LANGUAGES.cfg + <CODE>_TXT.txt with lines
// "English text|translation"); scripts/extract_languages.py writes them to data/locales.

import { storage } from './storage.js';

// HTML lang attribute for the original codes (cz is Czech, nb Norwegian Bokmål).
const HTML_LANG = {cz: 'cs'};

class I18nManager {
  constructor() {
    this.locales = {ru: {}, en: {}};
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
    this.locales[code] = table;
    return table;
  }

  async init() {
    try {
      this.languages = await (await fetch('data/locales/languages.json')).json();
    } catch (e) {
      console.warn('Error loading language list:', e);
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
    return this.locales.en?.[key] || key || fallback;
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

export const i18n = new I18nManager();
