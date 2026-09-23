/**
 * 前端国际化与多语言模块 (i18n Module)
 * 支持 简体中文 (zh-CN)、繁體中文 (zh-TW) 与 英文 (en)
 */

import { LOCALES } from '../locales/index.js';

/**
 * 获取 i18n 客户端代码
 * @returns {string} i18n JavaScript 代码
 */
export function getI18nCode() {
	const localesJSON = JSON.stringify(LOCALES);

	return `    // ========== 国际化与多语言模块 (i18n) ==========
    const I18N_LOCALES = ${localesJSON};
    let currentLanguagePreference = 'auto';
    let currentResolvedLanguage = 'en';

    function resolveLanguage(pref) {
      if (pref && pref !== 'auto' && I18N_LOCALES[pref]) {
        return pref;
      }
      try {
        const langs = (typeof navigator !== 'undefined' && Array.isArray(navigator.languages) && navigator.languages.length > 0)
          ? navigator.languages
          : [(typeof navigator !== 'undefined' && (navigator.language || navigator.userLanguage)) || 'en'];
        for (const lang of langs) {
          if (!lang) continue;
          const lower = String(lang).toLowerCase();
          if (lower.startsWith('en')) {
            return 'en';
          }
          if (lower.startsWith('zh-tw') || lower.startsWith('zh-hk') || lower.startsWith('zh-mo') || lower.includes('hant') || lower === 'zh') {
            return 'zh-TW';
          }
          if (lower.startsWith('zh-cn') || lower.startsWith('zh-sg') || lower.includes('hans')) {
            return 'zh-CN';
          }
        }
      } catch (e) {}
      return 'en';
    }

    function initLanguage() {
      try {
        const saved = localStorage.getItem('language') || 'auto';
        currentLanguagePreference = saved;
      } catch (e) {
        currentLanguagePreference = 'auto';
      }
      currentResolvedLanguage = resolveLanguage(currentLanguagePreference);
      if (typeof document !== 'undefined' && document.documentElement) {
        document.documentElement.setAttribute('lang', currentResolvedLanguage);
      }
      applyTranslations();
      const langSelect = typeof document !== 'undefined' ? document.getElementById('settingsLanguage') : null;
      if (langSelect) {
        langSelect.value = currentLanguagePreference;
      }
      updateQuickLanguageControl();
    }

    function getLanguage() {
      return currentResolvedLanguage;
    }

    function getLanguagePreference() {
      return currentLanguagePreference;
    }

    function updateQuickLanguageControl() {
      if (typeof document === 'undefined') return;
      const current = document.getElementById('quickLanguageCurrent');
      if (current) {
        current.textContent = currentLanguagePreference === 'auto'
          ? 'A'
          : currentResolvedLanguage === 'en' ? 'EN' : currentResolvedLanguage === 'zh-CN' ? '简' : '繁';
      }
      document.querySelectorAll('#quickLanguageControl [data-language]').forEach(option => {
        option.setAttribute('aria-pressed', String(option.dataset.language === currentLanguagePreference));
      });
    }

    function t(key, params) {
      const activeDict = I18N_LOCALES[currentResolvedLanguage] || I18N_LOCALES['en'] || {};
      const fallbackDict = I18N_LOCALES['en'] || I18N_LOCALES['zh-TW'] || {};
      let val = activeDict[key] !== undefined ? activeDict[key] : fallbackDict[key];
      if (val === undefined) {
        return key;
      }
      if (params && typeof params === 'object') {
        return val.replace(/\\{(\\w+)\\}/g, (match, paramKey) => {
          return params[paramKey] !== undefined ? params[paramKey] : match;
        });
      }
      return val;
    }

    function applyTranslations(root) {
      const container = root || document;
      if (!container || typeof container.querySelectorAll !== 'function') return;

      // 1. Text elements
      container.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (key) {
          el.textContent = t(key);
        }
      });

      // 2. HTML elements
      container.querySelectorAll('[data-i18n-html]').forEach(el => {
        const key = el.getAttribute('data-i18n-html');
        if (key) {
          el.innerHTML = t(key);
        }
      });

      // 3. Placeholders
      container.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (key) {
          el.placeholder = t(key);
        }
      });

      // 4. Tooltips (title)
      container.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        if (key) {
          el.title = t(key);
        }
      });

      // 5. Accessibility labels
      container.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
        const key = el.getAttribute('data-i18n-aria-label');
        if (key) {
          el.setAttribute('aria-label', t(key));
        }
      });

      // Update Document Title if page title exists
      if (document.title && t('appTitle')) {
        document.title = t('appTitle');
      }
    }

    function setLanguage(lang) {
      currentLanguagePreference = lang || 'auto';
      try {
        localStorage.setItem('language', currentLanguagePreference);
      } catch (e) {}
      currentResolvedLanguage = resolveLanguage(currentLanguagePreference);
      if (typeof document !== 'undefined' && document.documentElement) {
        document.documentElement.setAttribute('lang', currentResolvedLanguage);
      }
      applyTranslations();

      const langSelect = document.getElementById('settingsLanguage');
      if (langSelect && langSelect.value !== currentLanguagePreference) {
        langSelect.value = currentLanguagePreference;
      }
      updateQuickLanguageControl();

      // 重新渲染当前可能处于活动状态的动态列表
      if (typeof renderSecrets === 'function' && Array.isArray(secrets) && secrets.length > 0) {
        renderSecrets();
      } else if (typeof updateSearchStats === 'function') {
        updateSearchStats();
      }
    }

    function formatI18nDate(date, options) {
      const locale = currentResolvedLanguage === 'zh-TW' ? 'zh-TW' : (currentResolvedLanguage === 'en' ? 'en-US' : 'zh-CN');
      return new Date(date).toLocaleString(locale, options);
    }

    function compareI18nStrings(a, b, options) {
      const locale = currentResolvedLanguage === 'zh-TW' ? 'zh-TW' : (currentResolvedLanguage === 'en' ? 'en-US' : 'zh-CN');
      return String(a || '').localeCompare(String(b || ''), locale, options);
    }

    // 初始化语言
    initLanguage();
    if (typeof document !== 'undefined') {
      const onReady = function() {
        applyTranslations();
        const langSelect = document.getElementById('settingsLanguage');
        if (langSelect) {
          langSelect.value = currentLanguagePreference;
        }
        updateQuickLanguageControl();
      };
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', onReady);
      } else {
        onReady();
      }
    }
`;
}
