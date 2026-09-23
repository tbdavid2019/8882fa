/**
 * UI页面生成模块 - 完整版本
 * 包含所有原版功能：搜索、导入导出、二维码、编辑删除等
 * 支持代码分割和懒加载优化
 */

import { getStyles } from './styles/index.js';
import { getScripts, getCoreScripts } from './scripts/index.js';
import { dialogIcon } from './dialogIcons.js';
import { APP_VERSION } from '../utils/version.js';

/**
 * 创建主页面（密钥管理界面）
 * @param {Object} options - 配置选项
 * @param {boolean} options.lazyLoad - 是否启用懒加载（默认true）
 * @returns {Response} HTML响应
 */
export async function createMainPage(options = {}) {
	const { lazyLoad = true } = options;

	// 构建完整的HTML内容
	const html = buildCompleteHTML(lazyLoad);

	return new Response(html, {
		headers: {
			'Content-Type': 'text/html',
			'Cache-Control': 'no-cache, no-store, must-revalidate',
			Pragma: 'no-cache',
			Expires: '0',
		},
	});
}

/**
 * 构建完整的HTML内容
 * @param {boolean} lazyLoad - 是否启用懒加载
 */
function buildCompleteHTML(lazyLoad = true) {
	return getHTMLStart() + getStyles() + getHTMLBody() + getHTMLScripts(lazyLoad) + getHTMLEnd();
}

/**
 * HTML文档开始部分
 */
function getHTMLStart() {
	return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>888 2FA - Two-Factor Authentication Manager</title>

  <!-- Canonical URL -->
  <link rel="canonical" href="https://2fa.david888.com">

  <!-- Primary SEO Meta Tags -->
  <meta name="title" content="888 2FA - Two-Factor Authentication Manager">
  <meta name="description" content="Secure, zero-knowledge two-factor authentication (2FA) manager supporting TOTP and HOTP code generation. Powered by Cloudflare Workers edge computing with offline PWA support.">
  <meta name="author" content="David">
  <meta name="robots" content="index, follow">

  <!-- Open Graph / Facebook / LinkedIn / Discord / Slack -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://2fa.david888.com">
  <meta property="og:site_name" content="888 2FA">
  <meta property="og:title" content="888 2FA - Two-Factor Authentication Manager">
  <meta property="og:description" content="Secure, zero-knowledge two-factor authentication (2FA) manager supporting TOTP and HOTP code generation. Powered by Cloudflare Workers edge computing with offline PWA support.">
  <meta property="og:image" content="https://2fa.david888.com/og-image.jpg">
  <meta property="og:image:secure_url" content="https://2fa.david888.com/og-image.jpg">
  <meta property="og:image:type" content="image/jpeg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="888 2FA - Two-Factor Authentication Manager">
  <meta property="og:locale" content="en_US">
  <meta property="og:locale:alternate" content="zh_TW">
  <meta property="og:locale:alternate" content="zh_CN">

  <!-- Twitter / X Cards -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="https://2fa.david888.com">
  <meta name="twitter:site" content="@tbdavid2019">
  <meta name="twitter:creator" content="@tbdavid2019">
  <meta name="twitter:title" content="888 2FA - Two-Factor Authentication Manager">
  <meta name="twitter:description" content="Secure, zero-knowledge two-factor authentication (2FA) manager supporting TOTP and HOTP code generation. Powered by Cloudflare Workers edge computing with offline PWA support.">
  <meta name="twitter:image" content="https://2fa.david888.com/og-image.jpg">
  <meta name="twitter:image:alt" content="888 2FA - Two-Factor Authentication Manager">

  <!-- Favicons & App Icons -->
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
  <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
  <link rel="shortcut icon" href="/favicon.ico">
  <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">

  <!-- PWA Manifest & Web App Settings -->
  <link rel="manifest" href="/manifest.json">
  <meta name="application-name" content="888 2FA">
  <meta name="theme-color" content="#2563EB">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="default">
  <meta name="apple-mobile-web-app-title" content="888 2FA">
  <meta name="msapplication-TileColor" content="#2563EB">
  <meta name="msapplication-TileImage" content="/icon-192.png">
  <meta name="msapplication-config" content="none">
  <meta name="display" content="standalone">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">

  <!-- Structured Data (JSON-LD) -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "888 2FA",
    "alternateName": "888 2FA Authenticator",
    "url": "https://2fa.david888.com",
    "description": "Secure, zero-knowledge two-factor authentication (2FA) manager supporting TOTP and HOTP code generation. Powered by Cloudflare Workers edge computing with offline PWA support.",
    "applicationCategory": "SecurityApplication",
    "operatingSystem": "All",
    "browserRequirements": "Requires HTML5 Web Crypto API support",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD"
    },
    "author": {
      "@type": "Person",
      "name": "David",
      "url": "https://github.com/tbdavid2019"
    }
  }
  </script>

  <!-- Theme & Language Initialization - Must run before CSS to prevent FOUC -->
  <script>
    (function() {
      try {
        const theme = localStorage.getItem('theme') || 'auto';
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

        // 设置主题：dark 强制深色，light 强制浅色，auto 跟随系统
        const dataTheme = (theme === 'dark' || (theme === 'auto' && prefersDark)) ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', dataTheme);

        let lang = localStorage.getItem('language') || 'auto';
        if (lang === 'auto') {
          const langs = (Array.isArray(navigator.languages) && navigator.languages.length > 0)
            ? navigator.languages
            : [navigator.language || navigator.userLanguage || 'en'];
          lang = 'en';
          for (const l of langs) {
            if (!l) continue;
            const lower = String(l).toLowerCase();
            if (lower.startsWith('en')) {
              lang = 'en';
              break;
            }
            if (lower.startsWith('zh-tw') || lower.startsWith('zh-hk') || lower.startsWith('zh-mo') || lower.includes('hant') || lower === 'zh') {
              lang = 'zh-TW';
              break;
            }
            if (lower.startsWith('zh-cn') || lower.startsWith('zh-sg') || lower.includes('hans')) {
              lang = 'zh-CN';
              break;
            }
          }
        }
        document.documentElement.setAttribute('lang', lang);
      } catch (e) {
        document.documentElement.setAttribute('data-theme', 'light');
        document.documentElement.setAttribute('lang', 'en');
      }
    })();
  </script>

  <!-- FAB 位置预注入 - Must run before paint to prevent FAB position flash -->
  <script>
    (function() {
      try {
        const raw = localStorage.getItem('2fa-fab-position');
        if (!raw) return;
        const pos = JSON.parse(raw);
        if (!pos || !Number.isFinite(pos.x) || !Number.isFinite(pos.y)) return;
        const vw = window.innerWidth || document.documentElement.clientWidth;
        const vh = window.innerHeight || document.documentElement.clientHeight;
        // 与 CSS 媒体查询保持一致：≤480px 时 FAB 为 40x40，其余 48x48
        const size = vw <= 480 ? 40 : 48;
        const margin = 8;
        const maxX = Math.max(margin, vw - size - margin);
        const maxY = Math.max(margin, vh - size - margin);
        const x = Math.min(Math.max(pos.x, margin), maxX);
        const y = Math.min(Math.max(pos.y, margin), maxY);
        const style = document.createElement('style');
        style.id = 'fab-init-position';
        style.textContent = '.action-menu-float{left:' + x + 'px !important;top:' + y + 'px !important;right:auto !important;bottom:auto !important;}';
        document.head.appendChild(style);
      } catch (e) {}
    })();
  </script>`;
}

/**
 * HTML样式部分 - 包含所有原版样式
 */
function getHTMLBody() {
	return `
<body class="fluent-app">
  <h1 class="sr-only" data-i18n="appHeading">888 2FA - Two-Factor Authentication Manager</h1>
  <div class="container">
    <div class="content">
      <div
        id="clockWarning"
        class="clock-warning"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        hidden
      >
        <div class="clock-warning-message">
          <span class="clock-warning-icon" aria-hidden="true">${dialogIcon('warning')}</span>
          <span id="clockWarningText" class="clock-warning-text" data-i18n="clockWarningText">Local clock may be inaccurate; OTP codes may be invalid.</span>
        </div>
        <button
          type="button"
          id="clockSyncRetryButton"
          class="clock-sync-retry-button"
          data-i18n="clockSyncRetryButton"
          onclick="retryClockSync()"
        >Sync Time</button>
      </div>

      <div class="search-section">
        <div class="search-container">
          <!-- 防止浏览器自动填充的隐藏输入框 -->
          <input type="text" name="prevent_autofill_username" style="display:none" tabindex="-1" autocomplete="new-password">
          <input type="password" name="prevent_autofill_password" style="display:none" tabindex="-1" autocomplete="new-password">

          <!-- 搜索框和操作按钮的水平布局 -->
          <div class="search-action-row">
          <div class="search-input-wrapper">
            <span class="search-icon" aria-hidden="true">${dialogIcon('search')}</span>
            <input type="search"
                   id="searchInput"
                   name="search-query"
                   class="search-input"
                   placeholder="Search service or account"
                   data-i18n-placeholder="searchInputPlaceholder"
                   oninput="scheduleSecretFilter(this.value)"
                   autocomplete="off"
                   autocorrect="off"
                   autocapitalize="off"
                   spellcheck="false"
                   role="searchbox"
                   aria-label="Search 2FA keys"
                   data-i18n-aria-label="searchInputAriaLabel"
                   data-form-type="other"
                   data-lpignore="true"
                   data-1p-ignore="true"
                   data-bwignore="true"
                   readonly
                   onfocus="this.removeAttribute('readonly')">
            <button class="search-clear" aria-label="Clear search" data-i18n-aria-label="searchClearAriaLabel" id="searchClear" onclick="clearSearch()" style="display: none;">${dialogIcon('close')}</button>
      </div>
          <div class="sort-controls">
            <details class="sort-dropdown" id="sortDropdown">
              <summary class="sort-trigger" aria-label="View & Sort" title="View & Sort" data-i18n-aria-label="sortTriggerLabel" data-i18n-title="sortTriggerLabel">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M3 6h18"></path>
                  <path d="M6 12h12"></path>
                  <path d="M10 18h4"></path>
                </svg>
                <span class="sort-trigger-label" data-i18n="sortTriggerLabel">View & Sort</span>
              </summary>
              <div class="sort-menu" aria-label="Display and sorting options" data-i18n-aria-label="sortMenuAriaLabel">
                <div class="sort-menu-section">
                  <div class="sort-menu-label" id="viewModeLabel" data-i18n="viewModeLabel">View Mode</div>
                  <div class="view-mode-segmented" role="group" aria-labelledby="viewModeLabel">
                    <button type="button" class="view-mode-option active" data-view-mode="grouped" aria-pressed="true" data-i18n="viewModeGrouped" onclick="selectViewMode('grouped')">Smart Grouping</button>
                    <button type="button" class="view-mode-option" data-view-mode="flat" aria-pressed="false" data-i18n="viewModeFlat" onclick="selectViewMode('flat')">Flat List</button>
                  </div>
                </div>
                <div class="sort-menu-divider"></div>
                <div class="sort-menu-section group-sort-only" id="groupSortSection">
                  <div class="sort-menu-label" id="groupSortLabel" data-i18n="groupSortLabel">Group Sorting</div>
                  <div class="view-mode-segmented" role="group" aria-labelledby="groupSortLabel">
                    <button type="button" class="group-sort-option active" data-group-sort="name-asc" aria-pressed="true" data-i18n="groupSortNameAsc" onclick="selectGroupSort('name-asc')">Name A-Z</button>
                    <button type="button" class="group-sort-option" data-group-sort="name-desc" aria-pressed="false" data-i18n="groupSortNameDesc" onclick="selectGroupSort('name-desc')">Name Z-A</button>
                  </div>
                </div>
                <div class="sort-menu-divider group-sort-only"></div>
                <div class="sort-menu-section">
                  <div class="sort-menu-label" data-i18n="sortModeLabel" id="sortModeLabel">Sort Within Group</div>
                  <div class="sort-options" role="group" aria-labelledby="sortModeLabel">
                    <button type="button" aria-pressed="true" class="sort-option active" data-sort="oldest-first" data-i18n="sortOldestFirst" onclick="selectSort('oldest-first')">Oldest First</button>
                    <button type="button" aria-pressed="false" class="sort-option" data-sort="newest-first" data-i18n="sortNewestFirst" onclick="selectSort('newest-first')">Newest First</button>
                    <button type="button" aria-pressed="false" class="sort-option flat-sort-only" data-sort="name-asc" data-i18n="sortServiceNameAsc" onclick="selectSort('name-asc')">Service Name A-Z</button>
                    <button type="button" aria-pressed="false" class="sort-option flat-sort-only" data-sort="name-desc" data-i18n="sortServiceNameDesc" onclick="selectSort('name-desc')">Service Name Z-A</button>
                    <button type="button" aria-pressed="false" class="sort-option" data-sort="account-asc" data-i18n="sortAccountNameAsc" onclick="selectSort('account-asc')">Account Name A-Z</button>
                    <button type="button" aria-pressed="false" class="sort-option" data-sort="account-desc" data-i18n="sortAccountNameDesc" onclick="selectSort('account-desc')">Account Name Z-A</button>
                  </div>
                </div>
              </div>
            </details>
            <select id="sortSelect" class="sort-select-hidden" onchange="applySorting()" aria-hidden="true" tabindex="-1">
              <option value="oldest-first" data-i18n="sortOldestFirst">Oldest First</option>
              <option value="newest-first" data-i18n="sortNewestFirst">Newest First</option>
              <option value="name-asc" data-i18n="sortServiceNameAsc">Service Name A-Z</option>
              <option value="name-desc" data-i18n="sortServiceNameDesc">Service Name Z-A</option>
              <option value="account-asc" data-i18n="sortAccountNameAsc">Account Name A-Z</option>
              <option value="account-desc" data-i18n="sortAccountNameDesc">Account Name Z-A</option>
            </select>
      </div>
          </div>
          <div class="search-stats" id="searchStats" role="status" aria-live="polite" aria-atomic="true"></div>
        </div>
      </div>

      <!-- 背景遮罩 -->
      <div class="menu-overlay" id="menuOverlay" onclick="closeActionMenu()"></div>
      
      <div id="loading" class="loading">
        <div data-i18n="loadingSecrets">Loading keys...</div>
      </div>
      
      <div id="secretsList" class="secrets-list" style="display: none;">
        <!-- 密钥列表将在这里动态生成 -->
      </div>
      
      <div id="emptyState" class="empty-state" style="display: none;">
        <div class="icon" aria-hidden="true">${dialogIcon('key')}</div>
        <h3 data-i18n="emptyTitle">No Keys Yet</h3>
        <p data-i18n="emptyDesc">Add your two-factor authentication keys to generate verification codes here</p>
<button type="button" class="workspace-action" data-i18n="emptyAddBtn" onclick="showAddModal()">Add Key</button>
      </div>
    </div>
  </div>
  
  
  <!-- 二维码扫描器模态框 -->
  <div id="qrScanModal" class="modal fab-modal" role="dialog" aria-modal="true" aria-labelledby="qrScanModalTitle">
    <div class="modal-content">
      <div class="modal-header">
        <h2 id="qrScanModalTitle" data-i18n="qrScanModalTitle">Scan QR Code to Add Key</h2>
        <button class="close-btn" type="button" aria-label="Close dialog" data-i18n-aria-label="closeModalAriaLabel" onclick="hideQRScanner()">${dialogIcon('close')}</button>
      </div>

      <div class="scanner-section">
        <div class="scanner-container">
          <div class="video-wrapper">
            <video id="scannerVideo" autoplay playsinline muted></video>
            <div id="scannerOverlay" class="scanner-overlay">
              <div class="scanner-frame"></div>
            </div>
          </div>
        </div>

        <!-- 连续扫描计数器 -->
        <div id="scanCounter" class="scan-counter" style="display: none;">
          <span data-i18n="scanCountPrefix">Added </span> <span id="scanCountNum">0</span> <span data-i18n="scanCountSuffix"> keys</span>
        </div>

        <div id="scannerStatus" class="scanner-status" data-i18n="scannerStarting">Starting camera...</div>

        <div id="scannerError" class="scanner-error" style="display: none;">
          <div id="errorMessage"></div>
          <button class="btn btn-primary" data-i18n="retryCamera" onclick="retryCamera()" style="margin-top: 10px;">Retry Camera</button>
        </div>

        <!-- 底部操作区：连续扫描 + 选择图片 + 粘贴截图 -->
        <div class="scanner-bottom-actions">
          <label class="continuous-scan-inline">
            <input type="checkbox" id="continuousScanToggle" onchange="toggleContinuousScan()">
            <span data-i18n="continuousScan">Continuous Scan</span>
          </label>
          <input type="file" id="qrImageInput" accept="image/*" style="display: none;" onchange="handleImageUpload(event)">
          <button class="btn btn-info btn-compact" data-i18n="chooseImage" onclick="document.getElementById('qrImageInput').click()">Choose Image</button>
          <button class="btn btn-info btn-compact" data-i18n="pasteScreenshot" onclick="pasteImageForScan()">Paste Screenshot</button>
        </div>
        <div class="scanner-hint" data-i18n="scannerHint">Support drag & drop, Ctrl+V paste, or Google Migration import</div>
      </div>
    </div>
  </div>
  
  <!-- 添加/编辑密钥模态框 -->
  <div id="secretModal" class="modal fab-modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
    <div class="modal-content">
      <div class="modal-header">
        <h2 id="modalTitle" data-i18n="addSecretTitle">Add New Key</h2>
        <button class="close-btn" type="button" aria-label="Close dialog" data-i18n-aria-label="closeModalAriaLabel" onclick="hideSecretModal()">${dialogIcon('close')}</button>
      </div>
      
      <form id="secretForm" onsubmit="handleSubmit(event)" autocomplete="off">
        <input type="hidden" id="secretId" value="">

        <div class="form-group">
          <label for="secretName" data-i18n="secretNameLabel">Service Name *</label>
          <input type="text" id="secretName" required placeholder="e.g. GitHub, Google, Microsoft" data-i18n-placeholder="secretNamePlaceholder" autocomplete="off">
        </div>

        <div class="form-group">
          <label for="secretService" data-i18n="secretServiceLabel">Account Name</label>
          <input type="text" id="secretService" placeholder="e.g. your@email.com or username" data-i18n-placeholder="secretServicePlaceholder" autocomplete="off">
        </div>

        <div class="form-group">
          <label for="secretKey" data-i18n="secretKeyLabel">Secret Key (Base32) *</label>
          <input type="text" id="secretKey" required placeholder="Enter 16+ character Base32 key" data-i18n-placeholder="secretKeyPlaceholder" autocomplete="off">
        </div>
        
        <!-- 高级参数区域 -->
        <div class="form-section">
          <div class="section-header">
            <label>
              <input type="checkbox" id="showAdvanced" onchange="toggleAdvancedOptions()"> 
              <span data-i18n="advancedOptionsLabel">Advanced Options (Optional)</span>
            </label>
          </div>
          
          <div id="advancedOptions" class="advanced-options" style="display: none;">
            <div class="form-row">
              <div class="form-group-small">
                <label for="secretType" data-i18n="secretTypeLabel">Type</label>
                <select id="secretType" onchange="updateAdvancedOptionsForType()">
                  <option value="TOTP" selected data-i18n="secretTypeTotp">TOTP (Time-based)</option>
                  <option value="HOTP" data-i18n="secretTypeHotp">HOTP (Counter-based)</option>
                </select>
              </div>
              
              <div class="form-group-small" id="digitsGroup">
                <label for="secretDigits" data-i18n="secretDigitsLabel">Digits</label>
                <select id="secretDigits">
                  <option value="6" selected data-i18n="digitsSix">6 digits (Default)</option>
                  <option value="8" data-i18n="digitsEight">8 digits</option>
                </select>
              </div>
            </div>
            
            <div class="form-row">
              <div class="form-group-small" id="periodGroup">
                <label for="secretPeriod" data-i18n="secretPeriodLabel">Period (Seconds)</label>
                <select id="secretPeriod">
                  <option value="30" selected data-i18n="periodThirty">30s (Default)</option>
                  <option value="60" data-i18n="periodSixty">60s</option>
                  <option value="120" data-i18n="periodOneTwenty">120s</option>
                </select>
              </div>
              
              <div class="form-group-small" id="algorithmGroup">
                <label for="secretAlgorithm" data-i18n="secretAlgorithmLabel">Algorithm</label>
                <select id="secretAlgorithm">
                  <option value="SHA1" selected>SHA1</option>
                  <option value="SHA256">SHA256</option>
                  <option value="SHA512">SHA512</option>
                </select>
              </div>
            </div>
            
            <div class="form-row" id="counterRow" style="display: none;">
              <div class="form-group-small" id="counterGroup">
                <label for="secretCounter" data-i18n="secretCounterLabel">Initial Counter</label>
                <input type="number" id="secretCounter" value="0" min="0" max="9007199254740991" step="1" placeholder="Starting from 0" data-i18n-placeholder="secretCounterPlaceholder" autocomplete="off">
              </div>
            </div>
            
            <div class="advanced-info" id="advancedInfo" data-i18n="secretAdvancedHelp">Most authenticator apps use default settings: TOTP, 6 digits, 30s, SHA1</div>
          </div>
        </div>
        
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" onclick="hideSecretModal()" data-i18n="cancel">Cancel</button>
          <button type="submit" class="btn btn-primary" id="submitBtn" data-i18n="save">Save</button>
        </div>
      </form>
    </div>
  </div>

  <!-- 批量导入模态框 -->
  <div id="importModal" class="modal fab-modal" role="dialog" aria-modal="true" aria-labelledby="importModalTitle">
    <div class="modal-content import-modal-compact">
      <div class="modal-header">
        <h2 id="importModalTitle" data-i18n="importModalTitle">Batch Import Keys</h2>
        <button class="close-btn" type="button" aria-label="Close dialog" data-i18n-aria-label="closeModalAriaLabel" onclick="hideImportModal()">${dialogIcon('close')}</button>
      </div>

      <!-- 隐藏的文件输入 -->
      <input type="file" id="importFileInput" accept=".txt,.csv,.json,.html,.htm,.2fas,.xml,.authpro,.encrypt" style="display: none;" onchange="handleImportFile(event)">

      <!-- 智能输入区：文本框支持粘贴和拖拽 -->
      <div class="smart-import-zone" id="smartImportZone">
        <textarea aria-label="Import content" data-i18n-aria-label="importTextAriaLabel" id="importText" class="import-textarea-smart" rows="6" data-i18n-placeholder="importTextPlaceholder"
                  placeholder="Paste content here, or drag and drop files here...

Supports OTPAuth, JSON, CSV, HTML and other formats"
                  autocomplete="off"
                  oninput="autoPreviewImport()"
                  ondragover="handleDragOver(event)"
                  ondragleave="handleDragLeave(event)"
                  ondrop="handleFileDrop(event)"></textarea>
      </div>

      <!-- 选择文件按钮 -->
      <div class="import-file-btn-wrapper">
        <button type="button" class="btn btn-info import-file-btn" data-i18n="importSelectFileBtn" onclick="document.getElementById('importFileInput').click()">Choose File</button>
        <span class="import-file-hint" data-i18n="importFileHint">Supports TXT, JSON, CSV, HTML, 2FAS, XML, AuthPro, Encrypt</span>
      </div>

      <!-- 已选文件信息徽章 -->
      <div class="file-info-badge" id="fileInfoBadge" style="display: none;">
        <span class="file-icon">${dialogIcon('file')}</span>
        <span class="file-name" id="selectedFileName"></span>
        <span class="file-size" id="selectedFileSize"></span>
        <button type="button" class="file-clear-btn" aria-label="Clear selected file" data-i18n-aria-label="importClearFileAriaLabel" onclick="clearSelectedFile(event)">${dialogIcon('close')}</button>
      </div>

      <!-- 小提示 -->
      <div class="import-tips">
        <span class="import-tip"><span data-i18n="importGoogleMigrationTip">Importing from Google Authenticator?</span><a href="javascript:void(0)" data-i18n="importGoogleMigrationLink" onclick="hideImportModal(); showQRScanner();">Scan migration QR</a></span>
      </div>

      <!-- 格式说明（可折叠） -->
      <details class="import-format-details">
        <summary data-i18n="importSupportedFormatsSummary">View supported formats</summary>
        <div class="import-format-help">
          <p><strong>TXT</strong> Aegis、Ente Auth、WinAuth</p>
          <p><strong>2FAS</strong> 2FAS</p>
          <p><strong>JSON</strong> Aegis、Bitwarden Auth、andOTP、FreeOTP+、LastPass、Proton</p>
          <p><strong>CSV</strong> Bitwarden Authenticator</p>
          <p><strong>HTML</strong> Aegis/Ente Auth（.html.txt）、Authenticator Pro</p>
          <p><strong>XML</strong> <span data-i18n="importFormatXml">FreeOTP (Encrypted backup)</span></p>
          <p><strong>AuthPro</strong> Authenticator Pro (Stratum)</p>
          <p><strong>Encrypt</strong> <span data-i18n="importFormatEncrypt">TOTP Authenticator (Encrypted backup)</span></p>
        </div>
      </details>

      <!-- 预览区域 -->
      <div id="importPreview" class="import-preview-compact" style="display: none;">
        <div class="import-preview-header">
          <span class="preview-title" data-i18n="importPreviewTitle">Preview</span>
          <div class="import-stats-inline">
            <span class="stat-valid" id="statValid" data-i18n="importStatValid">{count} Valid</span>
            <span class="stat-invalid" id="statInvalid" data-i18n="importStatInvalid">{count} Invalid</span>
            <span class="stat-total" id="statTotal" data-i18n="importStatTotal">Total {count}</span>
          </div>
        </div>
        <div id="importPreviewList" class="import-preview-list"></div>
      </div>

      <div id="importProgress" class="import-progress-panel" style="display: none;">
        <div class="import-progress-header">
          <span class="import-progress-title" id="importProgressTitle" data-i18n="importProgressTitle">Import Progress</span>
          <span class="import-progress-percent" id="importProgressPercent">0%</span>
        </div>
        <div class="import-progress-bar">
          <div id="importProgressFill" class="import-progress-fill" style="width: 0%;"></div>
        </div>
        <div class="import-progress-meta">
          <span id="importProgressStatus" data-i18n="importProgressReady">Ready to start...</span>
          <span id="importProgressDetail">0 / 0</span>
        </div>
        <div class="import-progress-stats">
          <span id="importProgressChunk" data-i18n="importProgressChunk">Chunk {current} / {total}</span>
          <span id="importProgressSuccess" data-i18n="importProgressSuccess">Success {count}</span>
          <span id="importProgressFail" data-i18n="importProgressFail">Failed {count}</span>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="form-actions import-form-actions">
        <button type="button" class="btn btn-secondary" data-i18n="importCancelBtn" onclick="hideImportModal()">Cancel</button>
        <button type="button" class="btn btn-primary" data-i18n="importExecuteBtn" onclick="executeImport()" id="executeImportBtn" disabled>Import</button>
      </div>
    </div>
  </div>

  <!-- 还原配置模态框 -->
  <div id="restoreModal" class="modal fab-modal" role="dialog" aria-modal="true" aria-labelledby="restoreModalTitle">
    <div class="modal-content">
      <div class="modal-header">
        <h2 id="restoreModalTitle" data-i18n="restoreModalTitle">Restore Configuration</h2>
        <button class="close-btn" type="button" aria-label="Close dialog" data-i18n-aria-label="closeModalAriaLabel" onclick="hideRestoreModal()">${dialogIcon('close')}</button>
      </div>
      
      <div class="restore-instructions">
        <p data-i18n="restoreDesc">Select a backup from the list to restore:</p>
        <p data-i18n="restoreWarning">Warning: Restore will overwrite all current keys. Please proceed with caution!</p>
      </div>
      
      <div class="restore-content">
        <div class="backup-list-container">
          <label class="backup-list-header" for="backupSelect" data-i18n="restoreSelectLabel">Select Backup File</label>
          <div class="backup-select-wrapper">
            <select id="backupSelect" class="backup-select" onchange="selectBackupFromDropdown()">
              <option value="" data-i18n="restoreSelectPlaceholder">Please select a backup file...</option>
            </select>
          </div>
          <div class="backup-actions">
            <button type="button" class="btn btn-outline" data-i18n="restoreRefreshBtn" onclick="loadBackupList()">Refresh</button>
            <button type="button" class="btn btn-outline" data-i18n="restoreExportBtn" onclick="exportSelectedBackup()" id="exportBackupBtn" disabled>Export Backup</button>
            <input type="file" id="restoreBackupFileInput" accept=".txt,.csv,.json,.html" style="display: none;" onchange="handleRestoreBackupFile(event)">
            <button type="button" class="btn btn-outline" data-i18n="restoreUploadBtn" onclick="document.getElementById('restoreBackupFileInput').click()">Upload Backup File</button>
          </div>
          <div id="restoreUploadStatus" style="display: none; margin-top: 8px; font-size: var(--dialog-caption-size); color: var(--text-secondary);"></div>
          <div class="backup-pagination" style="display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-top: 10px;">
            <span id="backupListStatus" style="font-size: var(--dialog-caption-size); color: var(--text-secondary);"></span>
            <button type="button" class="btn btn-outline" id="backupLoadMoreBtn" data-i18n="restoreLoadMoreBtn" onclick="loadMoreBackupList()" style="display: none;">Load More</button>
          </div>
        </div>
        
        <div class="restore-preview" id="restorePreview" style="display: none;">
          <div class="preview-header">
            <span data-i18n="restorePreviewTitle">Backup Preview</span>
          </div>
          <div id="backupPreviewContent" class="backup-preview-content">
            <!-- 备份内容预览将在这里显示 -->
          </div>
        </div>
      </div>
      
      <div class="modal-actions">
        <button type="button" class="btn btn-outline" data-i18n="restoreCancelBtn" onclick="hideRestoreModal()">Cancel</button>
        <button type="button" class="btn btn-danger" data-i18n="restoreConfirmBtn" onclick="confirmRestore()" id="confirmRestoreBtn" disabled>Confirm Restore</button>
      </div>
    </div>
  </div>
  
  <!-- 实用工具模态框 -->
  <div id="toolsModal" class="modal fab-modal" role="dialog" aria-modal="true" aria-labelledby="toolsModalTitle">
    <div class="modal-content">
      <div class="modal-header">
        <h2 id="toolsModalTitle" data-i18n="toolsModalTitle">Utilities & Tools</h2>
        <button class="close-btn" type="button" aria-label="Close dialog" data-i18n-aria-label="closeModalAriaLabel" onclick="hideToolsModal()">${dialogIcon('close')}</button>
      </div>
      
      <div class="tools-list">
        <button type="button" class="tool-item" onclick="showQRScanAndDecode()">
          <div class="tool-icon">${dialogIcon('qr')}</div>
          <div class="tool-content">
            <div class="tool-title" data-i18n="toolQrDecodeTitle">QR Code Decoder</div>
            <div class="tool-desc" data-i18n="toolQrDecodeDesc">Scan and decode QR code contents</div>
          </div>
        </button>
        
        <button type="button" class="tool-item" onclick="showQRGenerateTool()">
          <div class="tool-icon">${dialogIcon('qr')}</div>
          <div class="tool-content">
            <div class="tool-title" data-i18n="toolQrGenTitle">QR Code Generator</div>
            <div class="tool-desc" data-i18n="toolQrGenDesc">Convert arbitrary text into a QR code</div>
          </div>
        </button>

        <button type="button" class="tool-item" onclick="showBase32Tool()">
          <div class="tool-icon">${dialogIcon('code')}</div>
          <div class="tool-content">
            <div class="tool-title" data-i18n="toolBase32Title">Base32 Converter</div>
            <div class="tool-desc" data-i18n="toolBase32Desc">Encode and decode Base32 strings</div>
          </div>
        </button>

        <button type="button" class="tool-item" onclick="showTimestampTool()">
          <div class="tool-icon">${dialogIcon('clock')}</div>
          <div class="tool-content">
            <div class="tool-title" data-i18n="toolTimeTitle">Time Calibration</div>
            <div class="tool-desc" data-i18n="toolTimeDesc">View and inspect TOTP time periods</div>
          </div>
        </button>

        <button type="button" class="tool-item" onclick="showKeyCheckTool()">
          <div class="tool-icon">${dialogIcon('check')}</div>
          <div class="tool-content">
            <div class="tool-title" data-i18n="toolKeyCheckerTitle">Key Inspector</div>
            <div class="tool-desc" data-i18n="toolKeyCheckerDesc">Validate secret key format and standard compliance</div>
          </div>
        </button>

        <button type="button" class="tool-item" onclick="showKeyGeneratorTool()">
          <div class="tool-icon">${dialogIcon('key')}</div>
          <div class="tool-content">
            <div class="tool-title" data-i18n="toolKeyGenTitle">Key Generator</div>
            <div class="tool-desc" data-i18n="toolKeyGenDesc">Generate secure random TOTP secrets</div>
          </div>
        </button>
      </div>
    </div>
  </div>

  <!-- 二维码生成工具模态框 -->
  <div id="qrGenerateModal" class="modal fab-modal" role="dialog" aria-modal="true" aria-labelledby="qrGenerateModalTitle">
    <div class="modal-content">
      <div class="modal-header">
        <h2 id="qrGenerateModalTitle" data-i18n="toolQrGenTitle">QR Code Generator</h2>
        <button class="close-btn" type="button" aria-label="Close dialog" data-i18n-aria-label="closeModalAriaLabel" onclick="hideQRGenerateModal()">${dialogIcon('close')}</button>
      </div>
      
      <div class="tool-section">
        <div class="section-title" data-i18n="qrGenInputSection">Input Content</div>
        <div class="input-area">
          <textarea
            id="qrContentInput"
            class="content-input"
            placeholder="Enter content to generate QR code" data-i18n-placeholder="qrGenInputPlaceholder"
            rows="6" style="width: 100%; font-family: monospace; resize: vertical;"
            autocomplete="off"
          ></textarea>
        </div>
      </div>
      
      <div class="tool-section" id="qrResultSection" style="display: none;">
        <div class="section-title" data-i18n="qrGenResultSection">Generated QR Code</div>
        <div class="qr-display">
          <img id="generatedQRCode" class="qr-image" style="max-width: 300px; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" />
          <div class="qr-tip" data-i18n="qrGenSaveTip" style="margin-top: 10px; font-size: var(--dialog-caption-size); color: var(--text-tertiary);">Long press or right-click to save image</div>
        </div>
      </div>
      
      <div class="form-actions">
        <button type="button" class="btn btn-primary" data-i18n="qrGenSubmitBtn" onclick="generateQRCode()">Generate QR Code</button>
      </div>
    </div>
  </div>
  
  <!-- Base32编解码工具模态框 -->
  <div id="base32Modal" class="modal fab-modal" role="dialog" aria-modal="true" aria-labelledby="base32ModalTitle">
    <div class="modal-content">
      <div class="modal-header">
        <h2 id="base32ModalTitle" data-i18n="toolBase32Title">Base32 Converter</h2>
        <button class="close-btn" type="button" aria-label="Close dialog" data-i18n-aria-label="closeModalAriaLabel" onclick="hideBase32Modal()">${dialogIcon('close')}</button>
      </div>
      
      <div class="tool-section">
        <div class="section-title" data-i18n="base32EncodeSection">Base32 Encode</div>
        <div class="input-area">
          <textarea
            id="plainTextInput"
            placeholder="Enter plain text" data-i18n-placeholder="base32InputPlaceholder"
            rows="4" style="width: 100%; font-family: monospace; resize: vertical;"
            autocomplete="off"
          ></textarea>
          <div class="button-area" style="margin-top: 10px; display: flex; gap: 10px;">
            <button class="btn btn-primary" data-i18n="base32EncodeBtn" onclick="encodeBase32()">Encode</button>
            <button class="btn btn-info" data-i18n="base32CopyBtn" onclick="copyEncodedText()">Copy</button>
          </div>
          <div id="encodedResult" class="result-text" style="margin-top: 10px; padding: 10px; background: var(--bg-secondary); border-radius: 6px; font-family: monospace; font-size: var(--dialog-caption-size); min-height: 0; word-break: break-all; display: none; color: var(--text-primary);"></div>
        </div>
      </div>
      
      <div class="divider" style="height: 1px; background: var(--border-primary); margin: 20px 0;"></div>
      
      <div class="tool-section">
        <div class="section-title" data-i18n="base32DecodeSection">Base32 Decode</div>
        <div class="input-area">
          <textarea
            id="base32TextInput"
            placeholder="Enter Base32 text" data-i18n-placeholder="base32InputEncodedPlaceholder"
            rows="4" style="width: 100%; font-family: monospace; resize: vertical;"
            autocomplete="off"
          ></textarea>
          <div class="button-area" style="margin-top: 10px; display: flex; gap: 10px;">
            <button class="btn btn-primary" data-i18n="base32DecodeBtn" onclick="decodeBase32()">Decode</button>
            <button class="btn btn-info" data-i18n="base32CopyBtn" onclick="copyDecodedText()">Copy</button>
          </div>
          <div id="decodedResult" class="result-text" style="margin-top: 10px; padding: 10px; background: var(--bg-secondary); border-radius: 6px; font-family: monospace; font-size: var(--dialog-caption-size); min-height: 0; word-break: break-all; display: none; color: var(--text-primary);"></div>
        </div>
      </div>
      

    </div>
  </div>
  
  <!-- 时间戳工具模态框 -->
  <div id="timestampModal" class="modal fab-modal" role="dialog" aria-modal="true" aria-labelledby="timestampModalTitle">
    <div class="modal-content">
      <div class="modal-header">
        <h2 id="timestampModalTitle" data-i18n="timestampModalTitle">Timestamp Tool</h2>
        <button class="close-btn" type="button" aria-label="Close dialog" data-i18n-aria-label="closeModalAriaLabel" onclick="hideTimestampModal()">${dialogIcon('close')}</button>
      </div>
      
      <div class="tool-section">
        <div class="section-title" data-i18n="timestampInfoSection">TOTP Time Info</div>
        <div class="time-info" style="background: var(--bg-secondary); padding: 15px; border-radius: 4px; margin-bottom: 15px;">
          <div class="info-item" style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span class="label" data-i18n="timestampCurrentLabel" style="font-weight: 600; color: var(--text-primary);">Current Timestamp:</span>
            <span class="value" id="currentTimestamp" style="font-family: monospace; color: var(--text-primary);"></span>
          </div>
          <div class="info-item" style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span class="label" data-i18n="timestampPeriodLabel" style="font-weight: 600; color: var(--text-primary);">TOTP Period:</span>
            <span class="value" id="totpPeriod" style="font-family: monospace; color: var(--text-primary);"></span>
          </div>
          <div class="info-item" style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span class="label" data-i18n="timestampCounterLabel" style="font-weight: 600; color: var(--text-primary);">Current Counter:</span>
            <span class="value" id="totpCounter" style="font-family: monospace; color: var(--text-primary);"></span>
          </div>
          <div class="info-item" style="display: flex; justify-content: space-between;">
            <span class="label" data-i18n="timestampRemainingLabel" style="font-weight: 600; color: var(--text-primary);">Remaining Time:</span>
            <span class="value" id="remainingTime" style="font-family: monospace; color: var(--text-primary);"></span>
          </div>
        </div>
        <div class="progress-bar timestamp-progress-track">
          <div id="progressBar" class="progress" role="progressbar" aria-label="Remaining time in current period" data-i18n-aria-label="progressBarAriaLabel" aria-valuemin="0" aria-valuemax="100"></div>
        </div>
      </div>
      
      <div class="tool-section">
        <div class="section-title" data-i18n="timestampPeriodSettings">Period Setting</div>
        <div class="period-selector" style="display: flex; justify-content: space-between; gap: 10px;">
          <button class="btn btn-outline" id="period30Btn" data-i18n="periodThirty" onclick="setPeriod(30)">30s (Default)</button>
          <button class="btn btn-outline" id="period60Btn" data-i18n="periodSixty" onclick="setPeriod(60)">60s</button>
          <button class="btn btn-outline" id="period120Btn" data-i18n="periodOneTwenty" onclick="setPeriod(120)">120s</button>
        </div>
      </div>
      

    </div>
  </div>
  
  <!-- 密钥检查器模态框 -->
  <div id="keyCheckModal" class="modal fab-modal" role="dialog" aria-modal="true" aria-labelledby="keyCheckModalTitle">
    <div class="modal-content">
      <div class="modal-header">
        <h2 id="keyCheckModalTitle" data-i18n="toolKeyCheckerTitle">Key Inspector</h2>
        <button class="close-btn" type="button" aria-label="Close dialog" data-i18n-aria-label="closeModalAriaLabel" onclick="hideKeyCheckModal()">${dialogIcon('close')}</button>
      </div>
      
      <div class="tool-section">
        <div class="section-title" data-i18n="toolKeyCheckerTitle">Key Inspector</div>
        <div class="input-area">
          <textarea
            id="keyCheckInput"
            placeholder="Enter secret key to inspect" data-i18n-placeholder="keyCheckInputPlaceholder"
            rows="4" style="width: 100%; font-family: monospace; resize: vertical;"
            autocomplete="off"
          ></textarea>
          <button class="btn btn-primary" data-i18n="keyCheckSubmitBtn" onclick="checkSecret()" style="margin-top: 10px;">Inspect Key</button>
        </div>
      </div>
      
      <div class="tool-section" id="keyCheckResult" style="display: none;">
        <div class="section-title" data-i18n="keyCheckResultSection">Inspection Result</div>
        <div id="checkResultContent" class="check-result" style="padding: 15px; border-radius: 4px; margin-bottom: 15px;">
          <!-- 结果内容将在这里动态生成 -->
        </div>
      </div>
      

    </div>
  </div>
  
  <!-- 二维码解析工具模态框 -->
  <div id="qrDecodeModal" class="modal fab-modal" role="dialog" aria-modal="true" aria-labelledby="qrDecodeModalTitle">
    <div class="modal-content">
      <div class="modal-header">
        <h2 id="qrDecodeModalTitle" data-i18n="toolQrDecodeTitle">QR Code Decoder</h2>
        <button class="close-btn" type="button" aria-label="Close dialog" data-i18n-aria-label="closeModalAriaLabel" onclick="hideQRDecodeModal()">${dialogIcon('close')}</button>
      </div>
      
      <div class="tool-section">
        <div class="section-title" data-i18n="qrDecodeScanSection">Scan QR Code</div>
        <div class="scan-options" style="display: flex; gap: 10px; margin-bottom: 10px;">
          <button class="btn btn-primary" data-i18n="qrDecodeCameraBtn" onclick="startQRDecodeScanner()" style="flex: 1;">Scan with Camera</button>
          <button class="btn btn-info" data-i18n="qrDecodeImageBtn" onclick="uploadImageForDecode()" style="flex: 1;">Choose Image</button>
          <button class="btn btn-info" data-i18n="qrDecodePasteBtn" onclick="pasteImageForDecode()" style="flex: 1;">Paste Screenshot</button>
        </div>
        <div class="scanner-hint" data-i18n="qrDecodeHint" style="margin-bottom: 15px;">Drag & drop image here or Ctrl+V paste screenshot</div>
        
        <div id="decodeScannerContainer" style="display: none;">
          <div class="scanner-container" style="position: relative; margin: 15px 0;">
            <div class="video-wrapper">
              <video id="decodeScannerVideo" autoplay playsinline muted></video>
              <div class="scanner-overlay" style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; pointer-events: none;">
                <div class="scanner-frame" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 60%; height: 60%; border: 2px solid #fff; border-radius: 4px;"></div>
              </div>
            </div>
          </div>
          <div id="decodeScannerStatus" class="scanner-status" data-i18n="scannerStarting" style="text-align: center; margin: 10px 0; font-size: var(--dialog-body-size); color: var(--text-secondary);">Starting camera...</div>
          <div id="decodeScannerError" class="scanner-error" style="display: none; text-align: center; margin: 10px 0; padding: 10px; background: var(--danger-light); border: 1px solid var(--border-error); border-radius: 6px; color: var(--danger-dark);">
            <div id="decodeErrorMessage"></div>
            <button class="btn btn-primary" data-i18n="qrDecodeRetryBtn" onclick="retryDecodeCamera()" style="margin-top: 10px;">Retry</button>
          </div>
        </div>
      </div>
      
      <div class="tool-section" id="decodeResultSection" style="display: none;">
        <div class="section-title" data-i18n="qrDecodeResultSection">Decoded Result</div>
        <div class="decode-result" style="background: var(--bg-secondary); padding: 15px; border-radius: 4px; margin-bottom: 15px;">
          <div class="result-content" id="decodeResultContent" style="font-family: monospace; font-size: var(--dialog-body-size); word-break: break-all; line-height: 1.5; max-height: 200px; overflow-y: auto; color: var(--text-primary);"></div>
          <div class="result-actions" style="display: flex; gap: 10px; margin-top: 15px;">
            <button class="btn btn-info" data-i18n="qrDecodeCopyBtn" onclick="copyDecodeResult()" style="flex: 1;">Copy Content</button>
            <button class="btn btn-primary" data-i18n="qrDecodeRegenBtn" onclick="generateDecodeQRCode()" style="flex: 1;">Generate QR Code</button>
          </div>
        </div>
        <div class="qr-section" id="decodeQRSection" style="display: none; text-align: center;">
          <div class="qr-title" data-i18n="qrDecodeRegenTitle" style="font-weight: 600; margin-bottom: 10px; color: var(--text-primary);">Regenerated QR Code</div>
          <img id="decodeQRCode" class="qr-code" style="max-width: 200px; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" />
          <div class="qr-tip" data-i18n="qrDecodePreviewTip" style="margin-top: 8px; font-size: var(--dialog-caption-size); color: var(--text-tertiary);">Click QR code to preview</div>
        </div>
      </div>
      

    </div>
  </div>
  
  <!-- 密钥生成器模态框 -->
  <div id="keyGeneratorModal" class="modal fab-modal" role="dialog" aria-modal="true" aria-labelledby="keyGeneratorModalTitle">
    <div class="modal-content">
      <div class="modal-header">
        <h2 id="keyGeneratorModalTitle" data-i18n="toolKeyGenTitle">Key Generator</h2>
        <button class="close-btn" type="button" aria-label="Close dialog" data-i18n-aria-label="closeModalAriaLabel" onclick="hideKeyGeneratorModal()">${dialogIcon('close')}</button>
      </div>
      
      <div class="tool-section">
        <div class="options" style="margin-bottom: 15px;">
          <div class="option-item" style="margin-bottom: 10px;">
            <div class="option-label" data-i18n="keyGenLengthLabel" style="font-weight: 600; margin-bottom: 8px; color: var(--text-primary);">Key Length:</div>
            <div class="radio-group" style="display: flex; justify-content: space-between; gap: 10px;">
              <button class="btn btn-outline" id="length16Btn" data-i18n="digitsSixteen" onclick="setKeyLength(16)">16 digits</button>
              <button class="btn btn-outline" id="length26Btn" data-i18n="digitsTwentySix" onclick="setKeyLength(26)">26 digits</button>
              <button class="btn btn-outline" id="length32Btn" data-i18n="digitsThirtyTwo" onclick="setKeyLength(32)">32 digits</button>
            </div>
          </div>
        </div>
        <button class="btn btn-primary" data-i18n="keyGenSubmitBtn" onclick="generateKey()" style="width: 100%;">Generate Secret</button>
      </div>
      
      <div class="tool-section" id="keyResultSection" style="display: none;">
        <div class="section-title" data-i18n="keyGenResultSection">Generated Secret</div>
        <div class="key-result" style="padding: 15px; border-radius: 4px; margin-bottom: 15px; background: var(--bg-secondary);">
          <div class="key-text" id="generatedKeyText" style="font-family: monospace; font-size: var(--dialog-body-size); font-weight: 600; text-align: center; margin-bottom: 15px; word-break: break-all; color: var(--text-primary);"></div>
          <div class="key-actions" style="display: flex; justify-content: center;">
            <button class="btn btn-info" data-i18n="keyGenCopyBtn" onclick="copyGeneratedKey()">Copy Secret</button>
          </div>
        </div>
      </div>
      

    </div>
  </div>

  <!-- WebDAV 同步配置模态框 -->
  <div id="webdavModal" class="modal fab-modal" role="dialog" aria-modal="true" aria-labelledby="webdavModalTitle">
    <div class="modal-content">
      <div class="modal-header">
        <h2 id="webdavModalTitle" data-i18n="syncWebdavTitle">WebDAV Sync</h2>
        <button class="close-btn" type="button" aria-label="Close dialog" data-i18n-aria-label="closeModalAriaLabel" onclick="hideWebdavModal()">${dialogIcon('close')}</button>
      </div>

      <div class="tool-section">
        <!-- 目标列表 -->
        <div id="webdavDestinationList" style="margin-bottom: 15px;"></div>

        <!-- 添加按钮 -->
        <button class="btn btn-primary" id="webdavAddBtn" data-i18n="webdavAddBtn" onclick="showWebdavForm()" style="width: 100%; margin-bottom: 15px;">+ Add WebDAV Target</button>

        <!-- 配置表单（默认隐藏） -->
        <div id="webdavFormArea" style="display: none;">
          <div class="dialog-sync-form">
            <input type="hidden" id="webdavEditId" value="" />

            <div style="margin-bottom: 12px;">
              <label for="webdavName" data-i18n="webdavNameLabel" style="display: block; font-weight: 600; margin-bottom: 6px; color: var(--text-primary); font-size: var(--dialog-body-size);">Target Name</label>
              <input type="text" id="webdavName" class="secret-input" data-i18n-placeholder="webdavNamePlaceholder" placeholder="e.g. Home NAS, Cloud" maxlength="30" style="width: 100%; box-sizing: border-box;" />
            </div>

            <div style="margin-bottom: 12px;">
              <label for="webdavUrl" data-i18n="webdavUrlLabel" style="display: block; font-weight: 600; margin-bottom: 6px; color: var(--text-primary); font-size: var(--dialog-body-size);">Server URL</label>
              <input type="url" id="webdavUrl" class="secret-input" placeholder="https://your-server.com/dav/" style="width: 100%; box-sizing: border-box;" />
            </div>

            <div style="margin-bottom: 12px;">
              <label for="webdavUsername" data-i18n="webdavUsernameLabel" style="display: block; font-weight: 600; margin-bottom: 6px; color: var(--text-primary); font-size: var(--dialog-body-size);">Username</label>
              <input type="text" id="webdavUsername" class="secret-input" data-i18n-placeholder="webdavUsernamePlaceholder" placeholder="Enter username" style="width: 100%; box-sizing: border-box;" />
            </div>

            <div style="margin-bottom: 12px;">
              <label for="webdavPassword" data-i18n="webdavPasswordLabel" style="display: block; font-weight: 600; margin-bottom: 6px; color: var(--text-primary); font-size: var(--dialog-body-size);">Password</label>
              <input type="password" id="webdavPassword" class="secret-input" data-i18n-placeholder="webdavPasswordPlaceholder" placeholder="Enter password" style="width: 100%; box-sizing: border-box;" />
            </div>

            <div style="margin-bottom: 15px;">
              <label for="webdavPath" data-i18n="webdavPathLabel" style="display: block; font-weight: 600; margin-bottom: 6px; color: var(--text-primary); font-size: var(--dialog-body-size);">Remote Path</label>
              <input type="text" id="webdavPath" class="secret-input" value="/" placeholder="/" style="width: 100%; box-sizing: border-box;" />
            </div>

            <div style="display: flex; gap: 10px; margin-bottom: 8px;">
              <button class="btn btn-info" id="webdavTestBtn" data-i18n="webdavTestBtn" onclick="testWebdavConnection()" style="flex: 1;">Test Connection</button>
              <button class="btn btn-primary" id="webdavSaveBtn" data-i18n="webdavSaveBtn" onclick="saveWebdavConfig()" style="flex: 1;">Save</button>
            </div>
            <button class="btn" data-i18n="webdavCancelBtn" onclick="hideWebdavForm()" style="width: 100%;">Cancel</button>
          </div>
        </div>

        <div class="advanced-info" data-i18n="webdavHelpText">Once configured, every backup (event-driven, scheduled, manual) will automatically push to all enabled WebDAV targets. Supports NextCloud, Alist, etc.</div>
      </div>

    </div>
  </div>

  <!-- S3 同步配置模态框 -->
  <div id="s3Modal" class="modal fab-modal" role="dialog" aria-modal="true" aria-labelledby="s3ModalTitle">
    <div class="modal-content">
      <div class="modal-header">
        <h2 id="s3ModalTitle" data-i18n="syncS3Title">S3 Sync</h2>
        <button class="close-btn" type="button" aria-label="Close dialog" data-i18n-aria-label="closeModalAriaLabel" onclick="hideS3Modal()">${dialogIcon('close')}</button>
      </div>

      <div class="tool-section">
        <!-- 目标列表 -->
        <div id="s3DestinationList" style="margin-bottom: 15px;"></div>

        <!-- 添加按钮 -->
        <button class="btn btn-primary" id="s3AddBtn" data-i18n="s3AddBtn" onclick="showS3Form()" style="width: 100%; margin-bottom: 15px;">+ Add S3 Target</button>

        <!-- 配置表单（默认隐藏） -->
        <div id="s3FormArea" style="display: none;">
          <div class="dialog-sync-form">
            <input type="hidden" id="s3EditId" value="" />

            <div style="margin-bottom: 12px;">
              <label for="s3Name" data-i18n="s3NameLabel" style="display: block; font-weight: 600; margin-bottom: 6px; color: var(--text-primary); font-size: var(--dialog-body-size);">Target Name</label>
              <input type="text" id="s3Name" class="secret-input" data-i18n-placeholder="s3NamePlaceholder" placeholder="e.g. R2 Backup, MinIO" maxlength="30" style="width: 100%; box-sizing: border-box;" />
            </div>

            <div style="margin-bottom: 12px;">
              <label for="s3Endpoint" style="display: block; font-weight: 600; margin-bottom: 6px; color: var(--text-primary); font-size: var(--dialog-body-size);">Endpoint</label>
              <input type="url" id="s3Endpoint" class="secret-input" placeholder="https://s3.amazonaws.com" style="width: 100%; box-sizing: border-box;" />
            </div>

            <div style="margin-bottom: 12px;">
              <label for="s3Bucket" style="display: block; font-weight: 600; margin-bottom: 6px; color: var(--text-primary); font-size: var(--dialog-body-size);">Bucket</label>
              <input type="text" id="s3Bucket" class="secret-input" placeholder="my-backup-bucket" style="width: 100%; box-sizing: border-box;" />
            </div>

            <div style="margin-bottom: 12px;">
              <label for="s3Region" style="display: block; font-weight: 600; margin-bottom: 6px; color: var(--text-primary); font-size: var(--dialog-body-size);">Region</label>
              <input type="text" id="s3Region" class="secret-input" value="auto" placeholder="auto" style="width: 100%; box-sizing: border-box;" />
            </div>

            <div style="margin-bottom: 12px;">
              <label for="s3AccessKeyId" style="display: block; font-weight: 600; margin-bottom: 6px; color: var(--text-primary); font-size: var(--dialog-body-size);">Access Key ID</label>
              <input type="text" id="s3AccessKeyId" class="secret-input" data-i18n-placeholder="s3AccessKeyIdPlaceholder" placeholder="Enter Access Key ID" style="width: 100%; box-sizing: border-box;" />
            </div>

            <div style="margin-bottom: 12px;">
              <label for="s3SecretAccessKey" style="display: block; font-weight: 600; margin-bottom: 6px; color: var(--text-primary); font-size: var(--dialog-body-size);">Secret Access Key</label>
              <input type="password" id="s3SecretAccessKey" class="secret-input" data-i18n-placeholder="s3SecretAccessKeyPlaceholder" placeholder="Enter Secret Access Key" style="width: 100%; box-sizing: border-box;" />
            </div>

            <div style="margin-bottom: 15px;">
              <label for="s3Prefix" data-i18n="s3PrefixLabel" style="display: block; font-weight: 600; margin-bottom: 6px; color: var(--text-primary); font-size: var(--dialog-body-size);">Storage Path Prefix</label>
              <input type="text" id="s3Prefix" class="secret-input" data-i18n-placeholder="s3PrefixPlaceholder" value="" placeholder="2fa-backup/ (optional)" style="width: 100%; box-sizing: border-box;" />
            </div>

            <div style="display: flex; gap: 10px; margin-bottom: 8px;">
              <button class="btn btn-info" id="s3TestBtn" data-i18n="s3TestBtn" onclick="testS3Connection()" style="flex: 1;">Test Connection</button>
              <button class="btn btn-primary" id="s3SaveBtn" data-i18n="s3SaveBtn" onclick="saveS3Config()" style="flex: 1;">Save</button>
            </div>
            <button class="btn" data-i18n="s3CancelBtn" onclick="hideS3Form()" style="width: 100%;">Cancel</button>
          </div>
        </div>

        <div class="advanced-info" data-i18n="s3HelpText">Once configured, every backup will automatically push to all enabled S3-compatible targets. Supports AWS S3, Cloudflare R2, MinIO, Alibaba Cloud OSS, etc.</div>
      </div>

    </div>
  </div>

  <!-- OneDrive 同步配置模态框 -->
  <div id="oneDriveModal" class="modal fab-modal" role="dialog" aria-modal="true" aria-labelledby="oneDriveModalTitle">
    <div class="modal-content">
      <div class="modal-header">
        <h2 id="oneDriveModalTitle" data-i18n="syncOneDriveTitle">OneDrive Sync</h2>
        <button class="close-btn" type="button" aria-label="Close dialog" data-i18n-aria-label="closeModalAriaLabel" onclick="hideOneDriveModal()">${dialogIcon('close')}</button>
      </div>

      <div class="tool-section">
        <div id="oneDriveOauthWarning" class="advanced-info" style="display:none; margin-bottom: 12px; padding: 12px; border-radius: 6px; font-size: var(--dialog-caption-size); color: var(--warning-color, #b45309); background: var(--bg-secondary); line-height: 1.6;"></div>

        <div id="oneDriveDestinationList" style="margin-bottom: 15px;"></div>

        <button class="btn btn-primary" id="oneDriveAddBtn" data-i18n="oneDriveAddBtn" onclick="showOneDriveForm()" style="width: 100%; margin-bottom: 15px;">+ Add OneDrive Target</button>

        <div id="oneDriveFormArea" style="display: none;">
          <div class="dialog-sync-form">
            <input type="hidden" id="oneDriveEditId" value="" />

            <div style="margin-bottom: 12px;">
              <label for="oneDriveName" data-i18n="oneDriveNameLabel" style="display: block; font-weight: 600; margin-bottom: 6px; color: var(--text-primary); font-size: var(--dialog-body-size);">Target Name</label>
              <input type="text" id="oneDriveName" class="secret-input" data-i18n-placeholder="oneDriveNamePlaceholder" placeholder="e.g. Work Account, Personal" maxlength="30" style="width: 100%; box-sizing: border-box;" />
            </div>

            <div style="margin-bottom: 15px;">
              <label for="oneDriveFolderPath" data-i18n="oneDriveFolderPathLabel" style="display: block; font-weight: 600; margin-bottom: 6px; color: var(--text-primary); font-size: var(--dialog-body-size);">App Folder Subpath</label>
              <input type="text" id="oneDriveFolderPath" class="secret-input" value="/2FA-Backups" placeholder="/2FA-Backups" style="width: 100%; box-sizing: border-box;" />
            </div>

            <div style="display: flex; gap: 10px; margin-bottom: 8px;">
              <button class="btn btn-info" id="oneDriveAuthorizeBtn" data-i18n="oneDriveAuthorizeBtn" onclick="authorizeOneDriveDest(document.getElementById('oneDriveEditId').value)" style="flex: 1;">Save & Authorize</button>
              <button class="btn btn-primary" id="oneDriveSaveBtn" data-i18n="oneDriveSaveBtn" onclick="saveOneDriveConfig()" style="flex: 1;">Save</button>
            </div>
            <button class="btn" data-i18n="oneDriveCancelBtn" onclick="hideOneDriveForm()" style="width: 100%;">Cancel</button>
          </div>
        </div>

        <div class="advanced-info" data-i18n="oneDriveHelpText">OneDrive uses Microsoft Graph app folder for backups. After authorization, every backup automatically pushes to the specified subfolder.</div>
      </div>

    </div>
  </div>

  <!-- Google Drive 同步配置模态框 -->
  <div id="googleDriveModal" class="modal fab-modal" role="dialog" aria-modal="true" aria-labelledby="googleDriveModalTitle">
    <div class="modal-content">
      <div class="modal-header">
        <h2 id="googleDriveModalTitle" data-i18n="syncGoogleDriveTitle">Google Drive Sync</h2>
        <button class="close-btn" type="button" aria-label="Close dialog" data-i18n-aria-label="closeModalAriaLabel" onclick="hideGoogleDriveModal()">${dialogIcon('close')}</button>
      </div>

      <div class="tool-section">
        <div id="googleDriveOauthWarning" class="advanced-info" style="display:none; margin-bottom: 12px; padding: 12px; border-radius: 6px; font-size: var(--dialog-caption-size); color: var(--warning-color, #b45309); background: var(--bg-secondary); line-height: 1.6;"></div>

        <div id="googleDriveDestinationList" style="margin-bottom: 15px;"></div>

        <button class="btn btn-primary" id="googleDriveAddBtn" data-i18n="googleDriveAddBtn" onclick="showGoogleDriveForm()" style="width: 100%; margin-bottom: 15px;">+ Add Google Drive Target</button>

        <div id="googleDriveFormArea" style="display: none;">
          <div class="dialog-sync-form">
            <input type="hidden" id="googleDriveEditId" value="" />

            <div style="margin-bottom: 12px;">
              <label for="googleDriveName" data-i18n="googleDriveNameLabel" style="display: block; font-weight: 600; margin-bottom: 6px; color: var(--text-primary); font-size: var(--dialog-body-size);">Target Name</label>
              <input type="text" id="googleDriveName" class="secret-input" data-i18n-placeholder="googleDriveNamePlaceholder" placeholder="e.g. Primary Drive, Personal" maxlength="30" style="width: 100%; box-sizing: border-box;" />
            </div>

            <div style="margin-bottom: 15px;">
              <label for="googleDriveFolderPath" data-i18n="googleDriveFolderPathLabel" style="display: block; font-weight: 600; margin-bottom: 6px; color: var(--text-primary); font-size: var(--dialog-body-size);">Backup Folder</label>
              <input type="text" id="googleDriveFolderPath" class="secret-input" value="/2FA-Backups" placeholder="/2FA-Backups" style="width: 100%; box-sizing: border-box;" />
            </div>

            <div style="display: flex; gap: 10px; margin-bottom: 8px;">
              <button class="btn btn-info" id="googleDriveAuthorizeBtn" data-i18n="googleDriveAuthorizeBtn" onclick="authorizeGoogleDriveDest(document.getElementById('googleDriveEditId').value)" style="flex: 1;">Save & Authorize</button>
              <button class="btn btn-primary" id="googleDriveSaveBtn" data-i18n="googleDriveSaveBtn" onclick="saveGoogleDriveConfig()" style="flex: 1;">Save</button>
            </div>
            <button class="btn" data-i18n="googleDriveCancelBtn" onclick="hideGoogleDriveForm()" style="width: 100%;">Cancel</button>
          </div>
        </div>

        <div class="advanced-info" data-i18n="googleDriveHelpText">After Google Drive authorization, backup files will be automatically created and updated in your drive. Push failures do not affect local backups.</div>
      </div>

    </div>
  </div>

  <!-- 设置模态框 -->
  <div id="settingsModal" class="modal fab-modal-lg" role="dialog" aria-modal="true" aria-labelledby="settingsModalTitle">
    <div class="modal-content settings-modal-content">
      <div class="modal-header">
        <h2 id="settingsModalTitle" data-i18n="settingsTitle">Settings</h2>
        <button class="close-btn" type="button" aria-label="Close dialog" data-i18n-aria-label="closeModalAriaLabel" onclick="hideSettingsModal()">${dialogIcon('close')}</button>
      </div>
      <div class="settings-layout">
        <div class="settings-tabs">
          <button type="button" class="settings-tab active" data-tab="security" onclick="switchSettingsTab('security')">
            <span class="settings-tab-icon">${dialogIcon('lock')}</span>
            <span class="settings-tab-text" data-i18n="settingsTabSecurity">Security</span>
          </button>
          <button type="button" class="settings-tab" data-tab="sync" onclick="switchSettingsTab('sync')">
            <span class="settings-tab-icon">${dialogIcon('cloud')}</span>
            <span class="settings-tab-text" data-i18n="settingsTabSync">Sync</span>
          </button>
          <button type="button" class="settings-tab" data-tab="preferences" onclick="switchSettingsTab('preferences')">
            <span class="settings-tab-icon">${dialogIcon('sliders')}</span>
            <span class="settings-tab-text" data-i18n="settingsTabPreferences">Preferences</span>
          </button>
        </div>
        <div class="settings-content">
          <!-- 账户安全面板 -->
          <div class="settings-panel active" data-panel="security">
            <div class="settings-section">
              <h3 class="settings-section-title" data-i18n="changePasswordTitle">Change Password</h3>
              <div class="settings-form">
                <div class="settings-field">
                  <label for="settingsCurrentPassword" data-i18n="currentPasswordLabel">Current Password</label>
                  <input type="password" id="settingsCurrentPassword" placeholder="Enter current password" data-i18n-placeholder="currentPasswordPlaceholder" autocomplete="current-password" />
                </div>
                <div class="settings-field">
                  <label for="settingsNewPassword" data-i18n="newPasswordLabel">New Password</label>
                  <input type="password" id="settingsNewPassword" placeholder="Enter new password" data-i18n-placeholder="newPasswordPlaceholder" autocomplete="new-password" />
                </div>
                <div class="settings-field">
                  <label for="settingsConfirmPassword" data-i18n="confirmPasswordLabel">Confirm New Password</label>
                  <input type="password" id="settingsConfirmPassword" placeholder="Re-enter new password" data-i18n-placeholder="confirmPasswordPlaceholder" autocomplete="new-password" />
                </div>
                <div id="changePasswordResult" class="change-password-result" style="display: none;"></div>
                <button class="btn btn-primary" id="changePasswordBtn" onclick="changePassword()" style="width: 100%;" data-i18n="changePasswordBtn">Change Password</button>
              </div>
            </div>
            <div class="settings-divider"></div>
            <div class="settings-section">
              <div class="settings-section-header-flex">
                <h3 class="settings-section-title" data-i18n="passkeyTitle">Passkeys & Touch ID</h3>
                <button type="button" class="btn btn-secondary btn-sm" id="addPasskeyBtn" onclick="registerCurrentDevicePasskey()">
                  <span>+</span> <span data-i18n="addPasskeyBtn">Add Passkey</span>
                </button>
              </div>
              <p class="settings-desc" data-i18n="passkeyDesc">Log in quickly and securely with Touch ID, Face ID, or your device security key without typing your master password.</p>
              <div id="passkeyList" class="passkey-list">
                <div class="passkey-loading" data-i18n="passkeyLoading">Loading passkeys...</div>
              </div>
            </div>
            <div class="settings-divider"></div>
            <div class="settings-section">
              <h3 class="settings-section-title" data-i18n="logoutTitle">Log Out</h3>
              <p class="settings-desc" data-i18n="logoutDesc">Sign out of the current account; password required to log in again.</p>
              <button class="btn btn-danger" onclick="logout()" style="width: 100%;" data-i18n="logoutBtn">Log Out</button>
            </div>
          </div>

          <!-- 同步设置面板 -->
          <div class="settings-panel" data-panel="sync">
            <div class="settings-section">
              <button type="button" class="sync-card" onclick="openWebdavFromSettings()">
                <div class="sync-card-header">
                  <div class="sync-card-info">
                    <span class="sync-card-icon">${dialogIcon('cloud')}</span>
                    <div>
                      <div class="sync-card-title" data-i18n="syncWebdavTitle">WebDAV Sync</div>
                      <div class="sync-card-desc" data-i18n="syncWebdavDesc">Automatically push backups to WebDAV server</div>
                    </div>
                  </div>
                  <span id="settingsWebdavStatus" class="sync-status not-configured" data-i18n="syncStatusNotConfigured">Not configured</span>
                </div>
              </button>
            </div>
            <div class="settings-section">
              <button type="button" class="sync-card" onclick="openS3FromSettings()">
                <div class="sync-card-header">
                  <div class="sync-card-info">
                    <span class="sync-card-icon">${dialogIcon('box')}</span>
                    <div>
                      <div class="sync-card-title" data-i18n="syncS3Title">S3 Sync</div>
                      <div class="sync-card-desc" data-i18n="syncS3Desc">Automatically push backups to S3-compatible storage</div>
                    </div>
                  </div>
                  <span id="settingsS3Status" class="sync-status not-configured" data-i18n="syncStatusNotConfigured">Not configured</span>
                </div>
              </button>
            </div>
            <div class="settings-section">
              <button type="button" class="sync-card" onclick="openOneDriveFromSettings()">
                <div class="sync-card-header">
                  <div class="sync-card-info">
                    <span class="sync-card-icon">${dialogIcon('cloud')}</span>
                    <div>
                      <div class="sync-card-title" data-i18n="syncOneDriveTitle">OneDrive Sync</div>
                      <div class="sync-card-desc" data-i18n="syncOneDriveDesc">Automatically push backups to Microsoft OneDrive</div>
                    </div>
                  </div>
                  <span id="settingsOneDriveStatus" class="sync-status not-configured" data-i18n="syncStatusNotConfigured">Not configured</span>
                </div>
              </button>
            </div>
            <div class="settings-section">
              <button type="button" class="sync-card" onclick="openGoogleDriveFromSettings()">
                <div class="sync-card-header">
                  <div class="sync-card-info">
                    <span class="sync-card-icon">${dialogIcon('folder')}</span>
                    <div>
                      <div class="sync-card-title" data-i18n="syncGoogleDriveTitle">Google Drive Sync</div>
                      <div class="sync-card-desc" data-i18n="syncGoogleDriveDesc">Automatically push backups to Google Drive</div>
                    </div>
                  </div>
                  <span id="settingsGoogleDriveStatus" class="sync-status not-configured" data-i18n="syncStatusNotConfigured">Not configured</span>
                </div>
              </button>
            </div>
            <div class="settings-info-box" data-i18n="syncInfoBox">Once configured, every backup (event-driven, scheduled, manual) will automatically push to remote storage. Push failures do not affect local backups.</div>
          </div>

          <!-- 偏好设置面板 -->
          <div class="settings-panel" data-panel="preferences">
            <div class="settings-section">
              <h3 class="settings-section-title" data-i18n="themeTitle">Theme</h3>
              <div class="theme-options">
                <label class="theme-option">
                  <input type="radio" name="settingsTheme" value="light" onchange="applyThemeFromSettings('light')" />
                  <span class="theme-option-label" data-i18n="themeLight">Light Mode</span>
                </label>
                <label class="theme-option">
                  <input type="radio" name="settingsTheme" value="dark" onchange="applyThemeFromSettings('dark')" />
                  <span class="theme-option-label" data-i18n="themeDark">Dark Mode</span>
                </label>
                <label class="theme-option">
                  <input type="radio" name="settingsTheme" value="auto" onchange="applyThemeFromSettings('auto')" />
                  <span class="theme-option-label" data-i18n="themeAuto">System</span>
                </label>
              </div>
            </div>
            <div class="settings-divider"></div>
            <div class="settings-section">
              <h3 class="settings-section-title" id="settingsLanguageTitle" data-i18n="languageTitle">Interface Language</h3>
              <select id="settingsLanguage" class="settings-select" aria-labelledby="settingsLanguageTitle" onchange="saveLanguagePreference(this.value)">
                <option value="en" data-i18n="langEn" selected>English</option>
                <option value="zh-TW" data-i18n="langZhTW">繁體中文</option>
                <option value="zh-CN" data-i18n="langZhCN">简体中文</option>
                <option value="auto" data-i18n="langAuto">System (Auto)</option>
              </select>
            </div>
            <div class="settings-divider"></div>
            <div class="settings-section">
              <h3 class="settings-section-title" id="settingsOTPAnimationTitle" data-i18n="otpAnimationTitle">OTP Transition Animation</h3>
              <select id="settingsOTPAnimationMode" class="settings-select" aria-labelledby="settingsOTPAnimationTitle" onchange="applyOTPAnimationFromSettings(this.value)">
                <option value="none" data-i18n="animNone">Disabled</option>
                <option value="flow" data-i18n="animFlow">Flow Transition</option>
                <option value="flip" data-i18n="animFlip">Flip Transition</option>
                <option value="spotlight" data-i18n="animSpotlight">Spotlight</option>
              </select>
            </div>
            <div class="settings-divider"></div>
            <div class="settings-section">
              <h3 class="settings-section-title" data-i18n="defaultExportFormatTitle">Default Export & Backup Format</h3>
              <p class="settings-desc" data-i18n="defaultExportFormatDesc">Default format shared by Batch Export and Backup Export. Used for export dialogs and newly created manual/automatic backup files.</p>
              <select aria-label="Default export format" data-i18n-aria-label="defaultExportFormatAriaLabel" id="settingsDefaultExportFormat" class="settings-select" onchange="saveDefaultExportFormat()">
                <option value="json" data-i18n="formatJson">JSON</option>
                <option value="txt" data-i18n="formatTxt">TXT Plaintext</option>
                <option value="csv" data-i18n="formatCsv">CSV Spreadsheet</option>
                <option value="html" data-i18n="formatHtml">HTML Webpage</option>
              </select>
            </div>
            <div class="settings-divider"></div>
            <div class="settings-section">
              <h3 class="settings-section-title" data-i18n="jwtExpiryTitle">Session Expiry</h3>
              <p class="settings-desc" data-i18n="jwtExpiryDesc">Number of days login session is preserved. Changes auto-save and apply on next login.</p>
              <div class="settings-inline-group">
                <input type="number" aria-label="Session validity period in days" data-i18n-aria-label="jwtExpiryAriaLabel" aria-describedby="settingsJwtExpiryResult" id="settingsJwtExpiryDays" class="settings-input" min="1" max="365" step="1" value="30" oninput="scheduleNumericPreferenceSave('jwtExpiryDays')" onblur="saveJwtExpiryDays()" onkeydown="if (event.key === 'Enter') { event.preventDefault(); saveJwtExpiryDays(); }" />
                <span class="settings-unit" data-i18n="jwtExpiryUnit">days</span>
              </div>
              <p id="settingsJwtExpiryResult" class="settings-result" role="status" aria-live="polite" style="display:none;"></p>
            </div>
            <div class="settings-divider"></div>
            <div class="settings-section">
              <h3 class="settings-section-title" data-i18n="maxBackupsTitle">Max Backup Retention</h3>
              <p class="settings-desc" data-i18n="maxBackupsDesc">Maximum backups kept during auto cleanup. Auto-saves on change. 0 means unlimited.</p>
              <div class="settings-inline-group">
                <input type="number" aria-label="Max backup retention count" data-i18n-aria-label="maxBackupsAriaLabel" aria-describedby="settingsMaxBackupsResult" id="settingsMaxBackups" class="settings-input" min="0" max="1000" step="1" value="100" oninput="scheduleNumericPreferenceSave('maxBackups')" onblur="saveMaxBackups()" onkeydown="if (event.key === 'Enter') { event.preventDefault(); saveMaxBackups(); }" />
                <span class="settings-unit" data-i18n="maxBackupsUnit">backups</span>
              </div>
              <p id="settingsMaxBackupsResult" class="settings-result" role="status" aria-live="polite" style="display:none;"></p>
            </div>
            <div class="settings-divider"></div>
            <div class="settings-section" id="settingsPwaSection">
              <h3 class="settings-section-title" data-i18n="pwaSectionTitle">Install to Desktop</h3>
              <p class="settings-desc" data-i18n="pwaSectionDesc">Add 2FA Manager to home screen or desktop as a standalone app with offline support.</p>
              <button class="btn btn-primary btn-sm" id="settingsPwaInstallBtn" data-i18n="pwaInstallBtn" data-i18n-title="pwaUnavailable" onclick="triggerPwaInstallFromSettings()" title="Not available (browser install prompt not triggered)" disabled>Install to Desktop</button>
            </div>
          </div>
        </div>
      </div>
      <div class="settings-modal-actions"><button type="button" class="btn btn-primary" data-i18n="completed" onclick="hideSettingsModal()">Done</button></div>
    </div>
  </div>

  <!-- 二维码模态框 -->
  <div id="qrModal" class="modal" role="dialog" aria-modal="true" style="display: none;" aria-labelledby="qrTitle">
    <div class="modal-content">
      <div class="modal-header">
        <h2 id="qrTitle" data-i18n="qrModalTitle">QR Code</h2>
        <button class="close-btn" type="button" aria-label="Close dialog" data-i18n-aria-label="closeModalAriaLabel" onclick="hideQRModal()">${dialogIcon('close')}</button>
      </div>

      <div class="qr-subtitle-section">
        <p id="qrSubtitle" data-i18n="qrModalSubtitle">Scan this QR code to import into other 2FA apps</p>
      </div>

      <div class="qr-code-container">
        <!-- 二维码将在这里动态生成 -->
      </div>

      <div class="qr-info" data-i18n-html="qrModalNotice">Scan this QR code with any 2FA app to add this account<br>Supported: Google Authenticator, Microsoft Authenticator, Authy, etc.</div>
    </div>
  </div>

      <!-- 中间提示组件 -->
  <div id="centerToast" class="center-toast">
    <div class="toast-content">
      <div class="toast-icon"></div>
      <div class="toast-message" data-i18n="copiedToast">Code copied to clipboard</div>
    </div>
  </div>

  <!-- 导出格式选择模态框 -->
  <div id="exportFormatModal" class="modal fab-modal" role="dialog" aria-modal="true" aria-labelledby="exportFormatModalTitle">
    <div class="modal-content export-modal-compact">
      <div class="modal-header">
        <h2 id="exportFormatModalTitle" data-i18n="exportFormatModalTitle">Select Export Format</h2>
        <button class="close-btn" type="button" aria-label="Close dialog" data-i18n-aria-label="closeModalAriaLabel" onclick="hideExportFormatModal()">${dialogIcon('close')}</button>
      </div>

      <div class="export-summary">
        <span class="export-count" data-i18n-html="exportCountSummary">Total <strong id="exportCount">{count}</strong> key(s)</span>
        <div class="export-sort-wrapper">
          <label class="export-sort-label" for="exportSortOrder" data-i18n="exportSortOrderLabel">Export Order</label>
          <select id="exportSortOrder" class="export-sort-select">
            <option value="index-asc" data-i18n="exportSortOrderOldestFirst">Oldest Added</option>
            <option value="index-desc" data-i18n="exportSortOrderNewestFirst">Newest Added</option>
            <option value="name-asc" data-i18n="exportSortOrderServiceNameAsc">Service Name A-Z</option>
            <option value="name-desc" data-i18n="exportSortOrderServiceNameDesc">Service Name Z-A</option>
            <option value="account-asc" data-i18n="exportSortOrderAccountNameAsc">Account Name A-Z</option>
            <option value="account-desc" data-i18n="exportSortOrderAccountNameDesc">Account Name Z-A</option>
          </select>
        </div>
        <button id="exportUseDefaultBtn" class="btn btn-sm" data-i18n="exportUseDefaultBtn" onclick="exportUsingDefaultFormat()">Export in Default Format</button>
      </div>

      <!-- 通用格式 -->
      <div class="format-section">
        <div class="format-section-title" data-i18n="formatSectionGeneral">General Formats</div>
        <div class="format-grid">
          <button type="button" class="format-card" onclick="selectExportFormat('txt')">
            <span class="format-icon">${dialogIcon('file')}</span>
            <span class="format-name">OTPAuth</span>
            <span class="format-ext">.txt</span>
            <span class="format-compat" data-i18n="formatCompatUniversal">Universal</span>
          </button>
          <button type="button" class="format-card" onclick="selectExportFormat('json')">
            <span class="format-icon">${dialogIcon('file')}</span>
            <span class="format-name">JSON</span>
            <span class="format-ext">.json</span>
            <span class="format-compat" data-i18n="formatCompatUniversal">Universal</span>
          </button>
          <button type="button" class="format-card" onclick="selectExportFormat('csv')">
            <span class="format-icon">${dialogIcon('file')}</span>
            <span class="format-name">CSV</span>
            <span class="format-ext">.csv</span>
            <span class="format-compat">Excel</span>
          </button>
          <button type="button" class="format-card" onclick="selectExportFormat('html')">
            <span class="format-icon">${dialogIcon('file')}</span>
            <span class="format-name">HTML</span>
            <span class="format-ext">.html</span>
            <span class="format-compat" data-i18n="formatCompatPrintScan">Print / Scan</span>
          </button>
        </div>
      </div>

      <!-- 验证器应用 -->
      <div class="format-section">
        <div class="format-section-title" data-i18n="formatSectionApps">Authenticator Apps</div>
        <div class="format-grid">
          <button type="button" class="format-card" onclick="selectExportFormat('google')">
            <span class="format-icon">${dialogIcon('file')}</span>
            <span class="format-name">Google</span>
            <span class="format-ext" data-i18n="formatExtMigration">Migration</span>
            <span class="format-compat">iOS/Android</span>
          </button>
          <button type="button" class="format-card" onclick="selectExportFormat('2fas')">
            <span class="format-icon">${dialogIcon('file')}</span>
            <span class="format-name">2FAS</span>
            <span class="format-ext">.2fas</span>
            <span class="format-compat">iOS/Android</span>
          </button>
          <button type="button" class="format-card" onclick="selectExportFormat('aegis-multi')">
            <span class="format-icon">${dialogIcon('lock')}</span>
            <span class="format-name">Aegis</span>
            <span class="format-ext" data-i18n="formatExtMulti">Multi-Format</span>
            <span class="format-compat">Android</span>
          </button>
          <button type="button" class="format-card" onclick="selectExportFormat('andotp')">
            <span class="format-icon">${dialogIcon('file')}</span>
            <span class="format-name">andOTP</span>
            <span class="format-ext">.json</span>
            <span class="format-compat">Android</span>
          </button>
          <button type="button" class="format-card" onclick="selectExportFormat('authpro-multi')">
            <span class="format-icon">${dialogIcon('lock')}</span>
            <span class="format-name">Auth Pro</span>
            <span class="format-ext" data-i18n="formatExtMulti">Multi-Format</span>
            <span class="format-compat" data-i18n="formatCompatAllPlatforms">All Platforms</span>
          </button>
          <button type="button" class="format-card" onclick="selectExportFormat('bitwarden-auth-multi')">
            <span class="format-icon">${dialogIcon('lock')}</span>
            <span class="format-name">Bitwarden Auth</span>
            <span class="format-ext" data-i18n="formatExtMulti">Multi-Format</span>
            <span class="format-compat" data-i18n="formatCompatAllPlatforms">All Platforms</span>
          </button>
          <button type="button" class="format-card" onclick="selectExportFormat('ente-auth')">
            <span class="format-icon">${dialogIcon('file')}</span>
            <span class="format-name">Ente Auth</span>
            <span class="format-ext">.txt</span>
            <span class="format-compat">iOS/Android</span>
          </button>
          <button type="button" class="format-card" onclick="selectExportFormat('freeotp')">
            <span class="format-icon">${dialogIcon('code')}</span>
            <span class="format-name">FreeOTP</span>
            <span class="format-ext">.xml</span>
            <span class="format-compat">Android</span>
          </button>
          <button type="button" class="format-card" onclick="selectExportFormat('freeotp-plus-multi')">
            <span class="format-icon">${dialogIcon('lock')}</span>
            <span class="format-name">FreeOTP+</span>
            <span class="format-ext" data-i18n="formatExtMulti">Multi-Format</span>
            <span class="format-compat">Android</span>
          </button>
          <button type="button" class="format-card" onclick="selectExportFormat('lastpass')">
            <span class="format-icon">${dialogIcon('file')}</span>
            <span class="format-name">LastPass</span>
            <span class="format-ext">.json</span>
            <span class="format-compat">iOS/Android</span>
          </button>
          <button type="button" class="format-card" onclick="selectExportFormat('proton')">
            <span class="format-icon">${dialogIcon('file')}</span>
            <span class="format-name">Proton</span>
            <span class="format-ext">.json</span>
            <span class="format-compat">iOS/Android</span>
          </button>
          <button type="button" class="format-card" onclick="selectExportFormat('totp-auth')">
            <span class="format-icon">${dialogIcon('code')}</span>
            <span class="format-name">TOTP Auth</span>
            <span class="format-ext">.encrypt</span>
            <span class="format-compat">Android</span>
          </button>
          <button type="button" class="format-card" onclick="selectExportFormat('winauth')">
            <span class="format-icon">${dialogIcon('file')}</span>
            <span class="format-name">WinAuth</span>
            <span class="format-ext">.txt</span>
            <span class="format-compat">Windows</span>
          </button>
        </div>
      </div>

      <!-- 格式说明（可折叠） -->
      <details class="format-details">
        <summary data-i18n="formatDetailsSummary">View format details and compatibility</summary>
        <div class="format-help-content">
          <p data-i18n-html="exportDetailsOtpauth"><strong>OTPAuth</strong> Standard URI format → Google/Microsoft/Authy/Aegis/2FAS/andOTP/FreeOTP/Ente Auth/WinAuth, etc.</p>
          <p data-i18n-html="exportDetailsJson"><strong>JSON</strong> Structured data → This app, programmatic processing</p>
          <p data-i18n-html="exportDetailsCsv"><strong>CSV</strong> Spreadsheet format → Excel/Numbers/Google Sheets, this app</p>
          <p data-i18n-html="exportDetailsHtml"><strong>HTML</strong> Embedded QR code webpage → Browser view, print archive, scan to import</p>
          <p data-i18n-html="exportDetailsGoogle"><strong>Google</strong> Migration QR → Google Authenticator, supported QR scanners</p>
          <p><strong>Aegis</strong> → Aegis Authenticator (Android)</p>
          <p><strong>2FAS</strong> → 2FAS (iOS/Android)</p>
          <p><strong>andOTP</strong> → andOTP (Android)、Aegis</p>
          <p data-i18n-html="exportDetailsFreeotp"><strong>FreeOTP</strong> Encrypted backup → FreeOTP (Android)</p>
          <p><strong>FreeOTP+</strong> → FreeOTP+ (Android)</p>
          <p data-i18n-html="exportDetailsTotpAuth"><strong>TOTP Auth</strong> Encrypted backup → TOTP Authenticator (Android)</p>
          <p><strong>LastPass</strong> → LastPass Authenticator</p>
          <p><strong>Proton</strong> → Proton Authenticator</p>
          <p><strong>Auth Pro</strong> → Authenticator Pro (Stratum)</p>
          <p><strong>Bitwarden Auth</strong> → Bitwarden Authenticator</p>
          <p data-i18n-html="exportDetailsEnte"><strong>Ente Auth</strong> Standard OTPAuth format → Ente Auth (iOS/Android)</p>
          <p data-i18n-html="exportDetailsWinauth"><strong>WinAuth</strong> Standard OTPAuth format → WinAuth (Windows)</p>
          <p data-i18n-html="exportDetailsAegisTxt"><strong>Aegis TXT</strong> Standard OTPAuth format → Aegis Authenticator (Android)</p>
          <p data-i18n-html="exportDetailsAuthproTxt"><strong>Auth Pro TXT</strong> Standard OTPAuth format → Authenticator Pro (All platforms)</p>
          <p data-i18n-html="exportDetailsFreeotpTxt"><strong>FreeOTP TXT</strong> Standard OTPAuth format → FreeOTP/FreeOTP+ (Android)</p>
        </div>
      </details>
    </div>
  </div>

  <!-- 二级格式选择模态框 -->
  <div id="subFormatModal" class="modal fab-modal-sm" role="dialog" aria-modal="true" aria-labelledby="subFormatTitle">
    <div class="modal-content sub-format-modal">
      <div class="modal-header">
        <h2 id="subFormatTitle" data-i18n="subFormatTitle">Select Export Format</h2>
        <button class="close-btn" type="button" aria-label="Close dialog" data-i18n-aria-label="closeModalAriaLabel" onclick="hideSubFormatModal()">${dialogIcon('close')}</button>
      </div>
      <div class="sub-format-list" id="subFormatList">
        <!-- 动态生成格式选项 -->
      </div>
    </div>
  </div>

  <!-- FreeOTP 原版导出密码模态框 -->
  <div id="freeotpExportModal" class="modal fab-modal-sm" role="dialog" aria-modal="true" aria-labelledby="freeotpExportModalTitle">
    <div class="modal-content">
      <div class="modal-header">
        <h2 id="freeotpExportModalTitle" data-i18n="freeotpExportModalTitle">FreeOTP Encrypted Export</h2>
        <button class="close-btn" type="button" aria-label="Close dialog" data-i18n-aria-label="closeModalAriaLabel" onclick="hideFreeOTPExportModal()">${dialogIcon('close')}</button>
      </div>

      <div style="margin-bottom: 20px; padding: 15px; background: var(--bg-secondary); border-radius: 4px; font-size: var(--dialog-body-size);">
        <p style="margin: 0 0 10px 0; color: var(--text-primary);">
          <strong data-i18n-html="freeotpExportCountPrefix">Export <span id="freeotpExportCount">0</span> key(s) to FreeOTP</strong>
        </p>
        <p style="margin: 0; font-size: var(--dialog-caption-size); color: var(--text-secondary);" data-i18n-html="freeotpExportDesc">Set an encryption password to protect your backup file.<br>The same password is required when importing into FreeOTP.</p>
      </div>

      <div class="form-group">
        <label for="freeotpExportPassword" data-i18n="freeotpExportPasswordLabel">Encryption Password</label>
        <input type="password" id="freeotpExportPassword" class="form-control" data-i18n-placeholder="freeotpExportPasswordPlaceholder" placeholder="Enter encryption password" autocomplete="new-password">
      </div>

      <div class="form-actions">
        <button type="button" class="btn btn-secondary" data-i18n="freeotpExportCancelBtn" onclick="hideFreeOTPExportModal()">Cancel</button>
        <button type="button" class="btn btn-primary" data-i18n="freeotpExportSubmitBtn" onclick="executeFreeOTPExport()">Encrypted Export</button>
      </div>
    </div>
  </div>

  <!-- TOTP Authenticator 导出密码模态框 -->
  <div id="totpAuthExportModal" class="modal fab-modal-sm" role="dialog" aria-modal="true" aria-labelledby="totpAuthExportModalTitle">
    <div class="modal-content">
      <div class="modal-header">
        <h2 id="totpAuthExportModalTitle" data-i18n="totpAuthExportModalTitle">TOTP Authenticator Encrypted Export</h2>
        <button class="close-btn" type="button" aria-label="Close dialog" data-i18n-aria-label="closeModalAriaLabel" onclick="hideTOTPAuthExportModal()">${dialogIcon('close')}</button>
      </div>

      <div style="margin-bottom: 20px; padding: 15px; background: var(--bg-secondary); border-radius: 4px; font-size: var(--dialog-body-size);">
        <p style="margin: 0 0 10px 0; color: var(--text-primary);">
          <strong data-i18n-html="totpAuthExportCountPrefix">Export <span id="totpAuthExportCount">0</span> key(s) to TOTP Authenticator</strong>
        </p>
        <p style="margin: 0; font-size: var(--dialog-caption-size); color: var(--text-secondary);" data-i18n-html="totpAuthExportDesc">Set an encryption password to protect your backup file.<br>You will need this password when restoring into TOTP Authenticator.</p>
      </div>

      <div class="form-group">
        <label for="totpAuthExportPassword" data-i18n="totpAuthExportPasswordLabel">Encryption Password</label>
        <input type="password" id="totpAuthExportPassword" class="form-control" data-i18n-placeholder="totpAuthExportPasswordPlaceholder" placeholder="Enter encryption password" autocomplete="new-password">
      </div>

      <div class="form-actions">
        <button type="button" class="btn btn-secondary" data-i18n="totpAuthExportCancelBtn" onclick="hideTOTPAuthExportModal()">Cancel</button>
        <button type="button" class="btn btn-primary" data-i18n="totpAuthExportSubmitBtn" onclick="executeTOTPAuthExport()">Export Encrypted</button>
      </div>
    </div>
  </div>

  <!-- 备份导出格式选择模态框 -->
  <div id="backupExportFormatModal" class="modal fab-modal" role="dialog" aria-modal="true" aria-labelledby="backupExportFormatModalTitle">
    <div class="modal-content">
      <div class="modal-header">
        <h2 id="backupExportFormatModalTitle" data-i18n="backupExportFormatModalTitle">Select Backup Export Format</h2>
        <button class="close-btn" type="button" aria-label="Close dialog" data-i18n-aria-label="closeModalAriaLabel" onclick="hideBackupExportFormatModal()">${dialogIcon('close')}</button>
      </div>

      <div class="export-instructions">
        <p style="margin: 0; color: var(--text-primary);">
          <strong data-i18n="backupExportTitle">Export Selected Backup File</strong><br>
          <small style="color: var(--text-secondary);" data-i18n="backupExportDesc">Please choose your preferred format. Different formats suit different scenarios. The default format in settings will also apply to new backups.</small>
        </p>
        <div style="display: flex; justify-content: flex-end; margin-top: 12px;">
          <button id="backupUseDefaultBtn" class="btn btn-sm" data-i18n="backupUseDefaultBtn" onclick="exportSelectedBackupUsingDefaultFormat()">Export in Default Format</button>
        </div>
      </div>

      <div class="dialog-backup-formats">
        <button type="button" class="dialog-backup-format" onclick="selectBackupExportFormat('txt')">
          ${dialogIcon('file')}
          <span><strong data-i18n="backupFormatOtpauthTitle">OTPAuth Text Format</strong><small data-i18n="backupFormatOtpauthDesc">Standard otpauth:// links, compatible with most authenticators</small></span>
        </button>
        <button type="button" class="dialog-backup-format" onclick="selectBackupExportFormat('json')">
          ${dialogIcon('code')}
          <span><strong data-i18n="backupFormatJsonTitle">JSON Data Format</strong><small data-i18n="backupFormatJsonDesc">Full structured data, ideal for backup and recovery</small></span>
        </button>
        <button type="button" class="dialog-backup-format" onclick="selectBackupExportFormat('csv')">
          ${dialogIcon('grid')}
          <span><strong data-i18n="backupFormatCsvTitle">CSV Spreadsheet Format</strong><small data-i18n="backupFormatCsvDesc">View with Excel, Numbers, and other spreadsheets</small></span>
        </button>
        <button type="button" class="dialog-backup-format" onclick="selectBackupExportFormat('html')">
          ${dialogIcon('qr')}
          <span><strong data-i18n="backupFormatHtmlTitle">HTML Webpage Format</strong><small data-i18n="backupFormatHtmlDesc">Printable QR code webpage; preserves table and recovery data</small></span>
        </button>
      </div>

      <div class="form-actions">
        <button type="button" class="btn btn-secondary" data-i18n="backupExportCancelBtn" onclick="hideBackupExportFormatModal()">Cancel</button>
      </div>
    </div>
  </div>

  <!-- 登录模态框 -->
  <div id="loginModal" class="modal login-modal" role="dialog" aria-modal="true" aria-labelledby="loginModalTitle">
    <div class="modal-content login-modal-content">
      <h2 class="login-modal-title" id="loginModalTitle" data-i18n="loginModalTitle">Authentication</h2>
      <p class="login-modal-description">
        <span data-i18n="loginModalDesc">Please enter your password to manage keys</span><br>
        <small class="login-modal-hint" data-i18n="loginModalCancelHint">Or click "Cancel" to use the OTP generator</small>
      </p>
      <div id="loginInsecureWarning" class="login-insecure-warning" style="display: none;">
        <strong data-i18n="loginInsecureTitle">Currently Accessing via HTTP</strong>
        <span data-i18n="loginInsecureDesc">Browsers cannot persist login sessions over HTTP. You will be asked for your password repeatedly after login. Please change http:// to https:// in your address bar and reload.</span>
      </div>
      <form id="loginForm" onsubmit="event.preventDefault(); handleLoginSubmit(); return false;" autocomplete="on">
      <div class="form-group">
        <label for="loginToken" data-i18n="loginPasswordLabel">Password</label>
        <div class="login-password-wrapper">
          <input type="password" id="loginToken" placeholder="Please enter your password" data-i18n-placeholder="loginPasswordPlaceholder" autocomplete="current-password" name="password">
          <button
            type="button"
            id="loginPasswordToggle"
            class="login-password-toggle"
            onclick="toggleLoginPasswordVisibility()"
            aria-label="Show password"
            data-i18n-aria-label="setupShowPassword"
            title="Show password"
            data-i18n-title="setupShowPassword"
          >
            <svg
              class="login-password-icon login-password-icon-show"
              viewBox="0 0 24 24"
              aria-hidden="true"
              focusable="false"
            >
              <path
                d="M12 5C7 5 2.7 8.1 1 12c1.7 3.9 6 7 11 7s9.3-3.1 11-7c-1.7-3.9-6-7-11-7Zm0 11.5A4.5 4.5 0 1 1 12 7a4.5 4.5 0 0 1 0 9.5Z"
                fill="currentColor"
              />
              <circle cx="12" cy="12" r="2.5" fill="currentColor" />
            </svg>
            <svg
              class="login-password-icon login-password-icon-hide"
              viewBox="0 0 24 24"
              aria-hidden="true"
              focusable="false"
            >
              <path
                d="M3.3 4.7 2 6l3.1 3.1A13.7 13.7 0 0 0 1 12c1.7 3.9 6 7 11 7 2 0 3.9-.5 5.5-1.3L20.7 21l1.3-1.3L3.3 4.7Zm8.7 12.3c-2.8 0-5-2.2-5-5 0-.8.2-1.6.5-2.3l6.8 6.8c-.7.3-1.5.5-2.3.5Zm0-10c5 0 9.3 3.1 11 7a12 12 0 0 1-3.9 4.7l-2-2a5 5 0 0 0-6.8-6.8l-2-2C9.5 7.3 10.7 7 12 7Z"
                fill="currentColor"
              />
            </svg>
          </button>
        </div>
        <div class="login-modal-hint" data-i18n="loginHint">Tip: Enter your configured password</div>
      </div>
      <div id="loginError" class="login-modal-error" role="alert" aria-live="polite"></div>
      <div class="button-group login-modal-actions">
        <button type="button" onclick="window.location.href='/otp'" class="btn btn-secondary login-modal-cancel-btn" data-i18n="cancel">Cancel</button>
        <button type="submit" class="btn btn-primary login-modal-submit-btn" data-i18n="loginSubmitBtn">Log In</button>
      </div>
      </form>
      <div id="passkeyLoginContainer" class="passkey-login-container" style="display: none;">
        <div class="login-modal-divider">
          <span data-i18n="orDivider">OR</span>
        </div>
        <button type="button" id="passkeyLoginBtn" class="passkey-login-btn" onclick="handlePasskeyLogin()">
          <svg class="passkey-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M12 11c0 1.66-1.34 3-3 3s-3-1.34-3-3 1.34-3 3-3 3 1.34 3 3z"/>
            <path d="m11 13 4.5 4.5"/>
            <path d="m13.5 15.5 2 2"/>
            <path d="m15.5 13.5 2 2"/>
            <circle cx="12" cy="12" r="10"/>
          </svg>
          <span data-i18n="loginWithPasskey">Sign in with Touch ID / Passkey</span>
        </button>
      </div>
    </div>
  </div>

  <!-- 页面底部链接 -->
  <footer class="page-footer">
    <div class="footer-content">
      <div class="footer-links">
        <a href="https://github.com/tbdavid2019/8882fa" target="_blank" rel="noopener noreferrer" class="footer-link">
          <svg class="github-icon" viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path>
          </svg>
          GitHub
        </a>
        <span class="footer-separator">•</span>
        <a href="https://github.com/tbdavid2019/8882fa/issues" target="_blank" rel="noopener noreferrer" class="footer-link" data-i18n="footerFeedback">Report Issue</a>
        <span class="footer-separator">•</span>
        <a href="https://github.com/tbdavid2019/8882fa/blob/main/README.md" target="_blank" rel="noopener noreferrer" class="footer-link" data-i18n="footerDocs">Documentation</a>
      </div>
      <div class="footer-info">
        Made with ❤️ by <a href="https://github.com/tbdavid2019" target="_blank" rel="noopener noreferrer" class="footer-link">tbdavid2019</a>
        <span class="footer-separator">•</span>
        <span class="footer-version">v${APP_VERSION}</span>
        <a id="footerUpdateBadge" class="footer-update-badge" href="https://github.com/tbdavid2019/8882fa" target="_blank" rel="noopener noreferrer" style="display: none;"></a>
      </div>
    </div>
  </footer>

  <!-- 固定悬浮按钮组 -->
  <!-- 操作菜单按钮 -->
  <div class="action-menu-float">
    <button class="main-action-button" id="mainActionBtn" aria-label="Open action menu" data-i18n-aria-label="openActionMenuAriaLabel" aria-expanded="false" aria-controls="actionSubmenu" onclick="toggleActionMenu()" title="Action menu" data-i18n-title="actionMenuTitle">
      ${dialogIcon('plus')}
    </button>

    <div class="action-submenu" id="actionSubmenu">
      <button type="button" class="submenu-item" onclick="showQRScanner(); closeActionMenu();">
        <span class="item-icon">${dialogIcon('qr')}</span>
        <span class="item-text" data-i18n="fabScanQR">Scan QR Code</span>
      </button>
      <button type="button" class="submenu-item" onclick="showAddModal(); closeActionMenu();">
        <span class="item-icon">${dialogIcon('plus')}</span>
        <span class="item-text" data-i18n="fabAddSecret">Add Manually</span>
      </button>
      <button type="button" class="submenu-item" onclick="showImportModal(); closeActionMenu();">
        <span class="item-icon">${dialogIcon('import')}</span>
        <span class="item-text" data-i18n="fabImport">Batch Import</span>
      </button>
      <button type="button" class="submenu-item" onclick="exportAllSecrets(); closeActionMenu();">
        <span class="item-icon">${dialogIcon('export')}</span>
        <span class="item-text" data-i18n="fabExport">Batch Export</span>
      </button>
      <button type="button" class="submenu-item" onclick="showRestoreModal(); closeActionMenu();">
        <span class="item-icon">${dialogIcon('restore')}</span>
        <span class="item-text" data-i18n="fabBackup">Backup & Restore</span>
      </button>
      <button type="button" class="submenu-item" onclick="showToolsModal(); closeActionMenu();">
        <span class="item-icon">${dialogIcon('toolbox')}</span>
        <span class="item-text" data-i18n="fabTools">Utilities & Tools</span>
      </button>
      <button type="button" class="submenu-item" onclick="showSettingsModal(); closeActionMenu();">
        <span class="item-icon">${dialogIcon('settings')}</span>
        <span class="item-text" data-i18n="fabSettings">Settings</span>
      </button>
    </div>
  </div>

  <!-- PWA 浮动安装横幅 -->
  <aside id="pwaInstallBanner" class="pwa-install-banner" role="banner" aria-label="Install App" style="display: none;">
    <div class="pwa-banner-icon">
      <img src="/apple-touch-icon.png" alt="888 2FA Icon" width="44" height="44">
    </div>
    <div class="pwa-banner-content">
      <div class="pwa-banner-title" data-i18n="pwaBannerTitle">Install 888 2FA</div>
      <div class="pwa-banner-desc" id="pwaBannerDesc" data-i18n="pwaBannerDesc">Install as an app for fast access, offline codes, and native experience.</div>
    </div>
    <div class="pwa-banner-actions">
      <button type="button" id="pwaBannerActionBtn" class="btn btn-primary pwa-banner-install-btn" onclick="handlePwaBannerInstall()" data-i18n="pwaBannerInstallBtn">Install</button>
      <button type="button" class="pwa-banner-close-btn" onclick="dismissPwaBanner()" aria-label="Dismiss banner" title="Dismiss" data-i18n-title="pwaBannerDismiss">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
  </aside>
`;
}

/**
 * JavaScript脚本部分 - 引用外部脚本文件
 * @param {boolean} lazyLoad - 是否启用懒加载模式
 */
function getHTMLScripts(lazyLoad = true) {
	const scriptContent = getInlineScripts(lazyLoad);
	// jsQR / qrcode-generator 改为按需加载（见 utils.js 中的 ensureJsQR / ensureQRCodeGen），
	// 避免 ~150KB CDN 库阻塞首屏渲染。Service Worker 会在首次请求时按需缓存这两个 URL。
	return '<script>\n' + scriptContent + '\n</script>';
}

/**
 * HTML结束部分
 */
function getHTMLEnd() {
	return `</body>
</html>`;
}

/**
 * 获取内联JavaScript代码
 * @param {boolean} lazyLoad - 是否启用懒加载（true=核心模块，false=完整模块）
 */
function getInlineScripts(lazyLoad = true) {
	if (lazyLoad) {
		console.log('📦 Code splitting mode: core modules only');
		return getCoreScripts();
	} else {
		console.log('📦 Classic mode: all modules');
		return getScripts();
	}
}
