import { getDialogIconCode } from '../dialogIcons.js';

/**
 * Utils 工具函式模組
 * 包含各種通用實用函式
 */

/**
 * 獲取 Utils 相關程式碼
 * @returns {string} Utils JavaScript 程式碼
 */
export function getUtilsCode() {
	return `${getDialogIconCode()}
    // ========== 工具函式模組 ==========

    // ==================== 第三方指令碼按需載入 ====================
    // jsQR (~130KB) 和 qrcode-generator (~20KB) 改為按需載入，
    // 僅在使用者點開掃碼/生成二維碼相關功能時才下載，避免阻塞首屏。
    const __scriptLoadCache = new Map();
    function loadScriptOnce(url) {
      if (__scriptLoadCache.has(url)) return __scriptLoadCache.get(url);
      const promise = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = url;
        s.async = true;
        s.crossOrigin = 'anonymous';
        s.onload = () => resolve();
        s.onerror = () => {
          __scriptLoadCache.delete(url); // 失败后允许下次重试
          reject(new Error('Script load failed: ' + url));
        };
        document.head.appendChild(s);
      });
      __scriptLoadCache.set(url, promise);
      return promise;
    }
    async function ensureJsQR() {
      if (typeof jsQR !== 'undefined') return;
      await loadScriptOnce('https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js');
    }
    async function ensureQRCodeGen() {
      if (typeof qrcode !== 'undefined') return;
      await loadScriptOnce('https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js');
    }
    // 暴露到 window 供懶載入模組（lazy modules）共享
    window.ensureJsQR = ensureJsQR;
    window.ensureQRCodeGen = ensureQRCodeGen;

    // ==================== 模態框通用函式 ====================

    /**
     * 通用顯示模態框函式
     * @param {string} modalId - 模態框的DOM ID
     * @param {Function} onShow - 顯示後的回撥函式（可選）
     */
    function showModal(modalId, onShow) {
      const modal = document.getElementById(modalId);
      if (!modal) {
        console.error('模态框不存在:', modalId);
        return;
      }
      modal.style.display = 'flex';
      setTimeout(() => modal.classList.add('show'), 10);
      disableBodyScroll();
      if (typeof onShow === 'function') {
        onShow();
      }
    }

    /**
     * 通用隱藏模態框函式
     * @param {string} modalId - 模態框的DOM ID
     * @param {Function} onHide - 隱藏後的回撥函式（可選）
     */
    function hideModal(modalId, onHide) {
      const modal = document.getElementById(modalId);
      if (!modal) {
        console.error('模态框不存在:', modalId);
        return;
      }
      // 冪等守衛：未顯示的 modal 不做任何事，避免 body 鎖計數被錯誤減少
      if (!modal.classList.contains('show')) {
        return;
      }
      modal.classList.remove('show');
      setTimeout(() => {
        modal.style.display = 'none';
        if (typeof onHide === 'function') {
          onHide();
        }
      }, 300);
      enableBodyScroll();
    }

    // ==================== 自定義確認對話方塊 ====================

    /**
     * 自定義確認對話方塊（替換原生 confirm）。
     * @param {Object} options
     * @param {string} options.title - 標題
     * @param {string} options.message - 描述，支援 \\n 換行
     * @param {string} [options.confirmText='確認'] - 確認按鈕文字
     * @param {string} [options.cancelText='取消'] - 取消按鈕文字
     * @param {boolean} [options.danger=false] - 危險操作時確認按鈕顯示為紅色
     * @returns {Promise<boolean>} 使用者點選確認返回 true，取消/關閉返回 false
     */
    /**
     * 併發保護：確認框共用同一個 DOM 節點，必須禁止同時被多個呼叫開啟，
     * 否則會重複繫結監聽、一次點選觸發多個 resolve，呼叫側(刪除/還原)可能重複提交請求。
     */
    let __confirmDialogBusy = false;

    function showConfirmDialog(options) {
      const opts = options || {};
      const title = opts.title || ((typeof t === 'function' ? t('confirmActionTitle') : null) || 'Confirm Action');
      const message = opts.message || '';
      const confirmText = opts.confirmText || ((typeof t === 'function' ? t('confirm') : null) || 'Confirm');
      const cancelText = opts.cancelText || ((typeof t === 'function' ? t('cancel') : null) || 'Cancel');
      const danger = opts.danger === true;

      // 若已有確認框在等待使用者操作，直接以 "取消" 語義返回，避免監聽器疊加
      if (__confirmDialogBusy) {
        return Promise.resolve(false);
      }
      __confirmDialogBusy = true;

      return new Promise((resolve) => {
        // 懶建立 DOM，後續複用同一節點
        let modal = document.getElementById('confirmDialogModal');
        if (!modal) {
          modal = document.createElement('div');
          modal.id = 'confirmDialogModal';
          modal.className = 'modal fab-modal-sm confirm-dialog-modal';
          modal.setAttribute('role', 'dialog');
          modal.setAttribute('aria-modal', 'true');
          modal.setAttribute('aria-labelledby', 'confirmDialogTitle');
          modal.setAttribute('aria-describedby', 'confirmDialogMessage');
          modal.setAttribute('tabindex', '-1');
          modal.innerHTML =
            '<div class="modal-content confirm-dialog-content">' +
            '  <div class="confirm-dialog-header">' +
            '    <div class="confirm-dialog-icon" id="confirmDialogIcon" aria-hidden="true"></div>' +
            '    <h3 class="confirm-dialog-title" id="confirmDialogTitle"></h3>' +
            '  </div>' +
            '  <div class="confirm-dialog-message" id="confirmDialogMessage"></div>' +
            '  <div class="confirm-dialog-actions">' +
            '    <button type="button" class="btn btn-secondary confirm-dialog-cancel" id="confirmDialogCancel"></button>' +
            '    <button type="button" class="btn btn-primary confirm-dialog-confirm" id="confirmDialogConfirm"></button>' +
            '  </div>' +
            '</div>';
          document.body.appendChild(modal);
        }

        const titleEl = modal.querySelector('#confirmDialogTitle');
        const messageEl = modal.querySelector('#confirmDialogMessage');
        const iconEl = modal.querySelector('#confirmDialogIcon');
        const cancelBtn = modal.querySelector('#confirmDialogCancel');
        const confirmBtn = modal.querySelector('#confirmDialogConfirm');

        titleEl.textContent = title;
        // 支援多行：將 \\n 渲染為換行
        messageEl.innerHTML = '';
        String(message).split('\\n').forEach((line, idx) => {
          if (idx > 0) messageEl.appendChild(document.createElement('br'));
          messageEl.appendChild(document.createTextNode(line));
        });
        iconEl.innerHTML = dialogIcon(danger ? 'warning' : 'info');
        cancelBtn.textContent = cancelText;
        confirmBtn.textContent = confirmText;
        confirmBtn.classList.toggle('btn-danger', danger);
        modal.setAttribute('aria-labelledby', 'confirmDialogTitle');
        modal.setAttribute('aria-describedby', 'confirmDialogMessage');

        // 焦點策略：危險操作停在取消避免誤觸；非危險預設確認
        const focusTarget = danger ? cancelBtn : confirmBtn;
        // 儲存開啟前的焦點，關閉後恢復
        const previouslyFocused =
          document.activeElement instanceof HTMLElement ? document.activeElement : null;

        let settled = false;
        function cleanup(result) {
          if (settled) return;
          settled = true;
          modal.classList.remove('show');
          document.removeEventListener('keydown', onKey);
          cancelBtn.removeEventListener('click', onCancel);
          confirmBtn.removeEventListener('click', onConfirm);
          modal.removeEventListener('click', onOverlay);
          setTimeout(() => {
            modal.style.display = 'none';
            enableBodyScroll();
            // 恢復開啟前的焦點（若目標仍在 DOM 內）
            if (previouslyFocused && document.contains(previouslyFocused)) {
              try { previouslyFocused.focus(); } catch (_) { /* noop */ }
            }
            __confirmDialogBusy = false;
            resolve(result);
          }, 200);
        }
        function onCancel() { cleanup(false); }
        function onConfirm() { cleanup(true); }
        function onOverlay(e) { if (e.target === modal) cleanup(false); }
        function onKey(e) {
          if (e.key === 'Escape') {
            e.preventDefault();
            cleanup(false);
            return;
          }
          if (e.key === 'Enter' && !danger) {
            const tag = (e.target && e.target.tagName) || '';
            // Enter 在文本域/按鈕內的預設行為優先
            if (tag !== 'BUTTON') {
              e.preventDefault();
              cleanup(true);
              return;
            }
          }
          // 焦點陷阱：Tab 在確認/取消兩個按鈕之間迴圈
          if (e.key === 'Tab') {
            const focusable = [cancelBtn, confirmBtn];
            const idx = focusable.indexOf(document.activeElement);
            if (idx === -1) {
              e.preventDefault();
              focusTarget.focus();
              return;
            }
            const next = e.shiftKey
              ? (idx === 0 ? focusable.length - 1 : idx - 1)
              : (idx === focusable.length - 1 ? 0 : idx + 1);
            e.preventDefault();
            focusable[next].focus();
          }
        }

        cancelBtn.addEventListener('click', onCancel);
        confirmBtn.addEventListener('click', onConfirm);
        modal.addEventListener('click', onOverlay);
        document.addEventListener('keydown', onKey);

        disableBodyScroll();
        modal.style.display = 'flex';
        setTimeout(() => {
          modal.classList.add('show');
          try { focusTarget.focus(); } catch (_) { /* noop */ }
        }, 10);
      });
    }

    // ==================== 滾動控制函式 ====================

    /**
     * 模態框棧計數：支援多層彈窗疊加時只在最外層關閉時解鎖 body 滾動。
     * 避免巢狀場景（如在 restoreModal 上開啟 confirmDialog）提前解鎖父級背景。
     */
    let __modalLockCount = 0;

    /**
     * 停用頁面滾動（顯示模態框時使用）
     * 內部使用引用計數，可重入呼叫。
     */
    function disableBodyScroll() {
      if (__modalLockCount === 0) {
        document.body.style.overflow = 'hidden';
        document.body.style.position = 'fixed';
        document.body.style.width = '100%';
      }
      __modalLockCount++;
    }

    /**
     * 啟用頁面滾動（隱藏模態框時使用）
     * 內部使用引用計數，僅當所有疊加的模態都關閉後才真正解鎖。
     */
    function enableBodyScroll() {
      if (__modalLockCount <= 0) {
        __modalLockCount = 0;
        return;
      }
      __modalLockCount--;
      if (__modalLockCount === 0) {
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.width = '';
      }
    }

    // ==================== 資料處理函式 ====================

    /**
     * 轉義HTML內容，防止XSS攻擊
     * @param {string} str - 要轉義的字串
     * @returns {string} 轉義後的字串
     */
    function escapeHTML(str) {
      if (typeof str !== 'string') return str;
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    }

    /**
     * 轉義CSV內容
     * @param {string} str - 要轉義的字串
     * @returns {string} 轉義後的字串
     */
    function escapeCSV(str) {
      if (typeof str !== 'string') return str;
      // 如果包含逗號、引號或換行符，則需要轉義
      if (str.includes(',') || str.includes('"') || str.includes('\\n') || str.includes('\\r')) {
        return '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    }

    /**
     * 獲取日期字串 (YYYY-MM-DD)
     * @returns {string} 日期字串
     */
    function getDateString() {
      return new Date().toISOString().split('T')[0];
    }

    // ==================== Base64URL 輔助函式 (WebAuthn / Passkey) ====================
    function base64UrlToBytes(base64url) {
      const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
      const pad = base64.length % 4 === 0 ? '' : '='.repeat(4 - (base64.length % 4));
      const binary = atob(base64 + pad);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes;
    }

    function bytesToBase64Url(bytes) {
      let binary = '';
      const uint8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
      for (let i = 0; i < uint8.byteLength; i++) {
        binary += String.fromCharCode(uint8[i]);
      }
      return btoa(binary).replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/, '');
    }

    const DEFAULT_EXPORT_FORMAT_OPTIONS = ['txt', 'json', 'csv', 'html'];
    let defaultExportFormatRequest = null;

    function normalizeDefaultExportFormat(format) {
      const normalized = String(format || '').trim().toLowerCase();
      return DEFAULT_EXPORT_FORMAT_OPTIONS.includes(normalized) ? normalized : 'json';
    }

    function getCachedDefaultExportFormat() {
      try {
        return normalizeDefaultExportFormat(localStorage.getItem('defaultExportFormat') || 'json');
      } catch {
        return 'json';
      }
    }

    function cacheDefaultExportFormat(format) {
      const normalized = normalizeDefaultExportFormat(format);
      try {
        localStorage.setItem('defaultExportFormat', normalized);
      } catch {
        // ignore localStorage failures
      }
      return normalized;
    }

    async function getServerDefaultExportFormat(options = {}) {
      const forceRefresh = options.forceRefresh === true;
      if (!forceRefresh && defaultExportFormatRequest) {
        return defaultExportFormatRequest;
      }

      const requestPromise = (async () => {
        const fallbackFormat = getCachedDefaultExportFormat();
        if (typeof authenticatedFetch !== 'function') {
          return fallbackFormat;
        }

        try {
          const response = await authenticatedFetch('/api/settings');
          if (!response.ok) {
            return fallbackFormat;
          }

          const data = await response.json();
          return cacheDefaultExportFormat(data.defaultExportFormat);
        } catch {
          return fallbackFormat;
        }
      })();

      defaultExportFormatRequest = requestPromise;

      try {
        return await requestPromise;
      } finally {
        if (defaultExportFormatRequest === requestPromise) {
          defaultExportFormatRequest = null;
        }
      }
    }

    /**
     * 下載檔案到本地
     * @param {string} content - 檔案內容
     * @param {string} filename - 檔名
     * @param {string} mimeType - MIME型別
     * @returns {Promise<boolean>} 是否成功儲存（使用現代API時）
     */
    async function downloadFile(content, filename, mimeType) {
      // 嘗試使用 File System Access API（現代瀏覽器支援）
      if (window.showSaveFilePicker) {
        try {
          // 根據副檔名確定檔案型別
          const ext = filename.split('.').pop().toLowerCase();
          const types = [];

          if (ext === 'json' || ext === '2fas') {
            types.push({
              description: (typeof t === 'function' ? t('fileTypeJson') : null) || 'JSON File',
              accept: { 'application/json': ['.json', '.2fas'] }
            });
          } else if (ext === 'csv') {
            types.push({
              description: (typeof t === 'function' ? t('fileTypeCsv') : null) || 'CSV File',
              accept: { 'text/csv': ['.csv'] }
            });
          } else if (ext === 'html' || ext === 'htm') {
            types.push({
              description: (typeof t === 'function' ? t('fileTypeHtml') : null) || 'HTML File',
              accept: { 'text/html': ['.html', '.htm'] }
            });
          } else if (ext === 'txt') {
            types.push({
              description: (typeof t === 'function' ? t('fileTypeText') : null) || 'Text File',
              accept: { 'text/plain': ['.txt'] }
            });
          } else if (ext === 'xml') {
            types.push({
              description: (typeof t === 'function' ? t('fileTypeXml') : null) || 'XML File',
              accept: { 'application/xml': ['.xml'] }
            });
          }

          const handle = await window.showSaveFilePicker({
            suggestedName: filename,
            types: types.length > 0 ? types : undefined
          });

          const writable = await handle.createWritable();

          // 根據內容型別寫入
          if (content instanceof Uint8Array || content instanceof ArrayBuffer) {
            await writable.write(content);
          } else {
            await writable.write(new Blob([content], { type: mimeType }));
          }

          await writable.close();
          return true; // 成功保存
        } catch (err) {
          // 使用者取消選擇或其他錯誤
          if (err.name === 'AbortError') {
            return false; // 用户取消
          }
          console.warn('File System Access API 失败，使用传统方式:', err);
          // 降級到傳統方式
        }
      }

      // 傳統方式（無法確認是否真正儲存）
      const blob = content instanceof Blob
        ? content
        : new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return true; // 传统方式假定成功
    }

    // ==================== Base32驗證 ====================

    /**
     * 驗證Base32格式
     * @param {string} str - 要驗證的字串
     * @returns {boolean} 是否為有效的Base32
     */
    function validateBase32(str) {
      if (!str || typeof str !== 'string') return false;

      // 移除空格和轉換為大寫
      const cleaned = str.replace(/\s/g, '').toUpperCase();

      // Base32字元集：A-Z, 2-7
      const base32Regex = /^[A-Z2-7]+=*$/;

      // 檢查格式
      if (!base32Regex.test(cleaned)) return false;

      // 檢查長度（應該是8的倍數，或者加上適當的填充）
      const withoutPadding = cleaned.replace(/=+$/, '');
      return withoutPadding.length > 0;
    }

    // ==================== QR碼生成核心函式 ====================

    /**
     * 客戶端生成二維碼（隱私安全，不經過伺服器）
     * @param {string} text - 要編碼的文本
     * @param {Object} options - 生成選項
     * @returns {Promise<string>} 返回Data URL格式的QR碼圖片
     */
    async function generateQRCodeDataURL(text, options = {}) {
      const { width = 200, height = 200 } = options;

      try {
        // 按需載入 qrcode-generator
        if (typeof qrcode === 'undefined') {
          try {
            await ensureQRCodeGen();
          } catch (loadErr) {
            throw new Error('Failed to load QR code generation library');
          }
        }
        if (typeof qrcode === 'undefined') {
          throw new Error('QR code generation library not loaded');
        }

        // 使用qrcode-generator庫在客戶端生成QR碼
        // 引數：typeNumber(0=自動), errorCorrectionLevel('L','M','Q','H')
        // 預設轉換器只保留每個字元的低 8 位，中文和 emoji 必須使用 UTF-8。
        qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];
        const qr = qrcode(0, 'M');
        qr.addData(text);
        qr.make();

        // 獲取QR碼矩陣尺寸
        const moduleCount = qr.getModuleCount();
        const margin = 2; // 边距（模块数）
        const cellSize = Math.floor(width / (moduleCount + margin * 2));
        const actualSize = (moduleCount + margin * 2) * cellSize;

        // 建立Canvas並繪製QR碼
        const canvas = document.createElement('canvas');
        canvas.width = actualSize;
        canvas.height = actualSize;
        const ctx = canvas.getContext('2d');

        // 繪製白色背景
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, actualSize, actualSize);

        // 繪製QR碼
        ctx.fillStyle = '#000000';
        for (let row = 0; row < moduleCount; row++) {
          for (let col = 0; col < moduleCount; col++) {
            if (qr.isDark(row, col)) {
              const x = (col + margin) * cellSize;
              const y = (row + margin) * cellSize;
              ctx.fillRect(x, y, cellSize, cellSize);
            }
          }
        }

        // 轉換為Data URL
        const dataURL = canvas.toDataURL('image/png');
        console.log('✅ Client QR code generated successfully');
        return dataURL;

      } catch (error) {
        console.error('❌ Client QR code generation failed:', error);
        throw new Error('Failed to generate QR code: ' + error.message);
      }
    }

    /**
     * 等待QR碼庫載入完成
     * 懶載入改造後：先觸發 ensureQRCodeGen() 真正下載指令碼，再 resolve；
     * 已載入或下載成功立即返回，下載失敗/超時統一拋錯。
     * @param {number} maxWaitTime - 最大等待時間（毫秒）
     * @returns {Promise<boolean>} 庫載入成功返回true
     */
    async function waitForQRCodeLibrary(maxWaitTime = 5000) {
      if (typeof qrcode !== 'undefined') return true;
      try {
        // 主路徑：直接觸發懶載入（受 maxWaitTime 限制）
        await Promise.race([
          ensureQRCodeGen(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('QR code library load timeout')), maxWaitTime)),
        ]);
      } catch (err) {
        // 兜底：可能指令碼由其他途徑正在載入，再輪詢一次
        const start = Date.now();
        while (typeof qrcode === 'undefined' && Date.now() - start < 500) {
          await new Promise((r) => setTimeout(r, 50));
        }
        if (typeof qrcode === 'undefined') throw err;
      }
      return true;
    }

    async function ensureQRCodeGen() {
      if (typeof qrcode !== 'undefined') return true;
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js');
      console.log('✅ QR code generator library loaded');
      return true;
    }
  `;
}
