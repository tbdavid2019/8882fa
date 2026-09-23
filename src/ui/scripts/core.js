import { dialogIcon } from '../dialogIcons.js'; /**
 * Core 核心業務邏輯模組
 * 包含金鑰管理、OTP生成、二維碼、備份等所有核心功能
 */

import { SERVICE_LOGOS } from '../config/serviceLogos.js';

/**
 * 獲取 Core 相關程式碼
 * @returns {string} Core JavaScript 程式碼
 */
export function getCoreCode() {
	const serviceLogosJSON = JSON.stringify(SERVICE_LOGOS, null, 2);

	return `    // ========== Service Logos 配置 ==========
    // 服務名稱到域名的對映資料（從 serviceLogos.js 匯入）
    const SERVICE_LOGOS = ${serviceLogosJSON};

    // ========== Service Logo 處理邏輯（唯一實現） ==========
    // 注意：邏輯只在客戶端實現，伺服器端的 serviceLogos.js 只是純資料配置
    const hotpCopyLocks = new Map();
    const SECRETS_CACHE_KEY = '2fa-secrets-cache';

    function cacheSecretsLocally() {
      try {
        localStorage.setItem(SECRETS_CACHE_KEY, JSON.stringify({
          data: secrets,
          timestamp: Date.now()
        }));
        return true;
      } catch (error) {
        console.warn('缓存数据失败:', error);
        return false;
      }
    }

    function getHOTPGenerationSnapshot(secret) {
      const counter = secret && secret.counter !== undefined ? secret.counter : 0;
      const nextCounter = counter + 1;
      if (
        !secret ||
        String(secret.type || '').toUpperCase() !== 'HOTP' ||
        !Number.isSafeInteger(counter) ||
        counter < 0 ||
        !Number.isSafeInteger(nextCounter)
      ) {
        return null;
      }

      return {
        id: String(secret.id),
        counter,
        nextCounter,
        secret: secret.secret,
        digits: Number(secret.digits) || 6,
        algorithm: String(secret.algorithm || 'SHA1').toUpperCase(),
        hotpCounterNamespace: secret.hotpCounterNamespace || null
      };
    }

    function matchesHOTPGenerationSnapshot(secret, snapshot) {
      return !!(
        secret &&
        snapshot &&
        String(secret.id) === snapshot.id &&
        String(secret.type || '').toUpperCase() === 'HOTP' &&
        secret.secret === snapshot.secret &&
        (Number(secret.digits) || 6) === snapshot.digits &&
        String(secret.algorithm || 'SHA1').toUpperCase() === snapshot.algorithm &&
        (secret.hotpCounterNamespace || null) === snapshot.hotpCounterNamespace
      );
    }

    /**
     * 將服務名拆分為單詞陣列（處理空格、連字元、點號等分隔符）
     * @param {string} text - 文本
     * @returns {string[]} 單詞陣列
     */
    function splitWords(text) {
      // 將連字元放在字元類最後，避免被解析為範圍運算子
      return text.toLowerCase().trim().split(/[\\s._-]+/).filter(Boolean);
    }

    /**
     * 檢查 keyWords 是否是 serviceWords 的連續子序列
     * 例如：['google', 'drive'] 匹配 ['google', 'drive', 'backup']
     * @param {string[]} serviceWords - 服務名單詞陣列
     * @param {string[]} keyWords - 鍵名單詞陣列
     * @returns {boolean} 是否匹配
     */
    function isWordSequenceMatch(serviceWords, keyWords) {
      if (keyWords.length > serviceWords.length) return false;

      for (let i = 0; i <= serviceWords.length - keyWords.length; i++) {
        let match = true;
        for (let j = 0; j < keyWords.length; j++) {
          if (serviceWords[i + j] !== keyWords[j]) {
            match = false;
            break;
          }
        }
        if (match) return true;
      }
      return false;
    }

    /**
     * 根據服務名稱獲取對應的 logo URL
     * @param {string} serviceName - 服務名稱
     * @returns {string|null} Logo URL 或 null
     */
    function getServiceLogo(serviceName) {
      if (!serviceName) return null;

      // Keep card icons aligned with smart aggregation. The aggregation module
      // is emitted into the same browser script and owns the canonical resolver.
      if (typeof resolveServiceDomain === 'function') {
        const resolvedDomain = resolveServiceDomain(serviceName);
        return resolvedDomain ? \`/api/favicon/\${resolvedDomain}\` : null;
      }

      const normalizedName = serviceName.toLowerCase().trim();

      // 1. 精確匹配（最快）
      if (Object.prototype.hasOwnProperty.call(SERVICE_LOGOS, normalizedName)) {
        return \`/api/favicon/\${SERVICE_LOGOS[normalizedName]}\`;
      }

      // 2. 單詞序列匹配（處理 "Google Drive Backup" 匹配 "google drive" 等場景）
      const serviceWords = splitWords(serviceName);

      for (const [key, domain] of Object.entries(SERVICE_LOGOS)) {
        const keyWords = splitWords(key);

        // 檢查 key 的單詞是否作為連續子序列出現在服務名中
        if (isWordSequenceMatch(serviceWords, keyWords)) {
          return \`/api/favicon/\${domain}\`;
        }
      }

      // 3. 未找到匹配，返回 null（將顯示首字母圖示）
      return null;
    }

    // ========== 原有函式 ==========

    // 客戶端驗證Base32金鑰格式
    function validateBase32(secret) {
      const base32Regex = /^[A-Z2-7]+=*$/;
      return base32Regex.test(secret.toUpperCase()) && secret.length >= 8;
    }

    // 頁面載入時獲取金鑰列表
    document.addEventListener('DOMContentLoaded', function() {
        if (typeof initLanguage === 'function') {
          initLanguage();
        }
        if (typeof applyTranslations === 'function') {
          applyTranslations();
        }
        initializeTrustedClock();
        // 先檢查認證狀態
        if (checkAuth()) {
          loadSecrets();
          // Cookie 過期由瀏覽器自動管理，無需定時檢查
        }
        initTheme();

        // 恢復使用者的排序選擇
        restoreSortPreference();
        restoreGroupSortPreference();
        restoreViewModePreference();

        // 排序 popover 外部點選 / Escape 關閉
        if (typeof initSortDropdownOutsideClose === 'function') {
          initSortDropdownOutsideClose();
        }

        // 初始化 FAB 拖拽並還原上次儲存的位置
        if (typeof initFABDrag === 'function') {
          initFABDrag();
        }

        // 頁面載入後立即重新整理所有OTP，確保時間同步
        setTimeout(() => {
          if (secrets && secrets.length > 0) {
            console.log('页面加载完成，立即刷新所有OTP');
            if (typeof updateOTPSecretsInBatch === 'function') {
              updateOTPSecretsInBatch(secrets, { includeHOTP: true });
            } else {
              secrets.forEach(secret => {
                updateOTP(secret.id, null, secret);
              });
            }
          }
        }, 500);
      });

    // 載入金鑰列表
    async function loadSecrets() {
      const loadGeneration = ++secretLoadGeneration;
      try {
        await ensureServerTimeSynchronized();
        const response = await authenticatedFetch('/api/secrets');

        if (response.status === 401) {
          handleUnauthorized();
          return;
        }

        if (!response.ok) {
          throw new Error('Failed to load: ' + response.statusText);
        }

        const loadedSecrets = await response.json();
        if (loadGeneration !== secretLoadGeneration) return;
        secrets = loadedSecrets;

        // 成功獲取資料後，儲存到 localStorage 作為快取
        cacheSecretsLocally();

        await renderSecrets();
      } catch (error) {
        if (loadGeneration !== secretLoadGeneration) return;
        console.error('加载密钥失败:', error);

        // 嘗試從快取中讀取資料
        try {
          const cached = localStorage.getItem(SECRETS_CACHE_KEY);
          if (cached) {
            const { data, timestamp } = JSON.parse(cached);
            secrets = data;

            // 顯示快取資料
            await renderSecrets();

            // 提示使用者正在使用快取資料
            const cacheTime = typeof formatI18nDate === 'function' ? formatI18nDate(timestamp) : new Date(timestamp).toLocaleString();
            showCenterToast('💾', (typeof t === 'function' ? t('cachedDataNotice', { time: cacheTime }) : null) || 'Network error, displaying cached data (' + cacheTime + ')');

            console.log('使用缓存数据，缓存时间:', cacheTime);
            return;
          }
        } catch (e) {
          console.warn('读取缓存失败:', e);
        }

        // 既沒有網路資料也沒有快取資料，顯示空狀態
        document.getElementById('loading').style.display = 'none';
        document.getElementById('emptyState').style.display = 'block';
      }
    }

    // 渲染金鑰列表
    async function renderSecrets() {
      filteredSecrets = [...secrets];
      const searchInput = document.getElementById('searchInput');
      if (searchInput && searchInput.value.trim()) {
        filterSecrets(searchInput.value);
      } else {
        await renderFilteredSecrets();
      }
    }

    // 獲取服務商顏色
    function getServiceColor(serviceName) {
      const colors = [
        '#007bff', '#28a745', '#dc3545', '#ffc107', '#17a2b8',
        '#6f42c1', '#e83e8c', '#fd7e14', '#20c997', '#6c757d',
        '#343a40', '#007bff', '#28a745', '#dc3545', '#ffc107'
      ];
      
      let hash = 0;
      for (let i = 0; i < serviceName.length; i++) {
        hash = serviceName.charCodeAt(i) + ((hash << 5) - hash);
      }
      
      return colors[Math.abs(hash) % colors.length];
    }

    // 建立金鑰卡片
    function createSecretCard(secret) {
      const logoUrl = getServiceLogo(secret.name);
      const isHOTP = secret.type && secret.type.toUpperCase() === 'HOTP';
      // These values are used in both text content and quoted tooltip attributes.
      const nameHTML = escapeHTML(secret.name).replace(/"/g, '&quot;');
      const accountHTML = escapeHTML(secret.account || '').replace(/"/g, '&quot;');

      const cardCopyTooltip = (typeof t === 'function' ? t('cardCopyTooltip') : null) || 'Click card to copy code';
      const cardMenuTriggerTitle = (typeof t === 'function' ? t('cardMenuTriggerTitle') : null) || 'Account actions';
      const cardMenuQRCode = (typeof t === 'function' ? t('cardMenuQRCode') : null) || 'QR Code';
      const cardMenuQRCodeTitle = (typeof t === 'function' ? t('cardMenuQRCodeTitle') : null) || 'Show authenticator QR code';
      const cardMenuCopyURI = (typeof t === 'function' ? t('cardMenuCopyURI') : null) || 'Copy URI';
      const cardMenuCopyURITitle = (typeof t === 'function' ? t('cardMenuCopyURITitle') : null) || 'otpauth:// configuration for import';
      const cardMenuCopyLink = (typeof t === 'function' ? t('cardMenuCopyLink') : null) || 'Copy Link';
      const cardMenuCopyLinkTitle = (typeof t === 'function' ? t('cardMenuCopyLinkTitle') : null) || 'Open in browser to view code';
      const cardMenuEdit = (typeof t === 'function' ? t('cardMenuEdit') : null) || 'Edit';
      const cardMenuEditTitle = (typeof t === 'function' ? t('cardMenuEditTitle') : null) || 'Edit key';
      const cardMenuDelete = (typeof t === 'function' ? t('cardMenuDelete') : null) || 'Delete';
      const cardMenuDeleteTitle = (typeof t === 'function' ? t('cardMenuDeleteTitle') : null) || 'Delete key';
      const copyOtpBtnTitle = (typeof t === 'function' ? t('copyOtpBtnTitle') : null) || 'Click to copy code';
      const copyOtpBtnAriaLabel = (typeof t === 'function' ? t('copyOtpBtnAriaLabel') : null) || 'Copy current code';
      const otpNextLabel = (typeof t === 'function' ? t('otpNextLabel') : null) || 'Next';
      const copyNextOtpBtnTitle = (typeof t === 'function' ? t('copyNextOtpBtnTitle') : null) || 'Click to copy next code';
      const counterLabel = (typeof t === 'function' ? t('counterLabel') : null) || 'Counter: ';

      return '<div class="secret-card" onclick="copyOTPFromCard(event, &quot;' + secret.id + '&quot;)" title="' + cardCopyTooltip + '">' +
        // TOTP 顯示進度條，HOTP 不顯示
        (isHOTP ? '' :
          '<div class="progress-top">' +
            '<div class="progress-top-fill" id="progress-' + secret.id + '"></div>' +
          '</div>'
        ) +
        '<div class="card-header">' +
          '<div class="secret-info">' +
            '<div class="service-icon">' +
              (logoUrl ?
                '<img src="' + logoUrl + '" alt="' + nameHTML + '" style="width: 30px; height: 30px; object-fit: contain; border-radius: 6px;" onerror="this.style.display=&quot;none&quot;; this.nextElementSibling.style.display=&quot;block&quot;;">' +
                '<span style="display: none;">' + escapeHTML(secret.name.charAt(0).toUpperCase()) + '</span>' :
                '<span>' + escapeHTML(secret.name.charAt(0).toUpperCase()) + '</span>'
              ) +
            '</div>' +
            '<div class="secret-text">' +
            '<h3><span class="secret-name" title="' + nameHTML + '">' + nameHTML + '</span>' + (isHOTP ? '<span class="secret-type">[HOTP]</span>' : '') + '</h3>' +
            (secret.account ? '<p title="' + accountHTML + '">' + accountHTML + '</p>' : '') +
            (isHOTP ? '<p id="counter-' + secret.id + '" style="font-size: 11px; color: var(--text-tertiary); margin-top: 2px;">' + counterLabel + (secret.counter ?? 0) + '</p>' : '') +
            '</div>' +
          '</div>' +
          '<div class="card-menu" title="">' +
            '<button type="button" class="card-menu-trigger" title="' + cardMenuTriggerTitle + '" aria-label="' + cardMenuTriggerTitle + '" aria-expanded="false" aria-controls="menu-' + secret.id + '" onclick="event.stopPropagation(); toggleCardMenu(&quot;' + secret.id + '&quot;)"><span class="menu-dots" aria-hidden="true">⋮</span></button>' +
            '<div class="card-menu-dropdown" id="menu-' + secret.id + '">' +
              '<button type="button" class="menu-item" title="' + cardMenuQRCodeTitle + '" onclick="event.stopPropagation(); showQRCode(&quot;' + secret.id + '&quot;); closeAllCardMenus();">' + cardMenuQRCode + '</button>' +
              '<button type="button" class="menu-item" title="' + cardMenuCopyURITitle + '" onclick="event.stopPropagation(); copyOTPAuthURL(&quot;' + secret.id + '&quot;); closeAllCardMenus();">' + cardMenuCopyURI + '</button>' +
              '<button type="button" class="menu-item" title="' + cardMenuCopyLinkTitle + '" onclick="event.stopPropagation(); copyOTPPageURL(&quot;' + secret.id + '&quot;); closeAllCardMenus();">' + cardMenuCopyLink + '</button>' +
              '<button type="button" class="menu-item" title="' + cardMenuEditTitle + '" onclick="event.stopPropagation(); editSecret(&quot;' + secret.id + '&quot;); closeAllCardMenus();">' + cardMenuEdit + '</button>' +
              '<button type="button" class="menu-item menu-item-danger" title="' + cardMenuDeleteTitle + '" onclick="event.stopPropagation(); deleteSecret(&quot;' + secret.id + '&quot;); closeAllCardMenus();">' + cardMenuDelete + '</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="otp-preview">' +
          '<div class="otp-main">' +
            '<div class="otp-code-container">' +
              '<button type="button" class="otp-code" id="otp-' + secret.id + '" onclick="event.stopPropagation(); copyOTP(&quot;' + secret.id + '&quot;)" title="' + copyOtpBtnTitle + '" aria-label="' + copyOtpBtnAriaLabel + '">------</button>' +
            '</div>' +
            // HOTP 不顯示"下一個"驗證碼（因為不是時間基準）
            (isHOTP ? '' :
              '<button type="button" class="otp-next-container" onclick="event.stopPropagation(); copyNextOTP(&quot;' + secret.id + '&quot;)" title="' + copyNextOtpBtnTitle + '">' +
                '<span class="otp-next-label">' + otpNextLabel + '</span>' +
                '<span class="otp-next-code" id="next-otp-' + secret.id + '">------</span>' +
              '</button>'
            ) +
          '</div>' +
        '</div>' +
      '</div>';
    }

    function createServiceGroupSection(group, index) {
      const headingId = 'service-group-heading-' + index;
      const hasFilteredCount = Boolean(currentSearchQuery) && group.matchedCount !== group.totalCount;
      const countText = hasFilteredCount
        ? group.matchedCount + ' / ' + group.totalCount
        : (typeof t === 'function' ? t('groupCountText', { count: group.totalCount }) : String(group.totalCount));
      const countLabel = hasFilteredCount
        ? (typeof t === 'function' ? t('groupMatchedCountLabel', { matched: group.matchedCount, total: group.totalCount }) : 'Matched ' + group.matchedCount + ' of ' + group.totalCount)
        : (typeof t === 'function' ? t('groupCountLabel', { count: group.totalCount }) : group.totalCount + ' items');

      return '<section class="service-group" aria-labelledby="' + headingId + '">' +
        '<div class="service-group-header">' +
          '<h2 class="service-group-title" id="' + headingId + '">' + escapeHTML(group.name) + '</h2>' +
          '<span class="service-group-count" aria-label="' + escapeHTML(countLabel) + '">' + countText + '</span>' +
        '</div>' +
        '<div class="service-group-grid">' + group.items.map(secret => createSecretCard(secret)).join('') + '</div>' +
      '</section>';
    }

    function clearOTPIntervalsExcept(visibleSecrets) {
      const visibleIds = new Set((visibleSecrets || []).map(secret => String(secret.id)));
      Object.keys(otpIntervals).forEach(secretId => {
        if (visibleIds.has(secretId)) return;
        clearInterval(otpIntervals[secretId]);
        delete otpIntervals[secretId];
      });
    }

    // 渲染過濾後的金鑰列表
    async function renderFilteredSecrets() {
      const renderGeneration = ++secretRenderGeneration;
      const loading = document.getElementById('loading');
      const secretsList = document.getElementById('secretsList');
      const emptyState = document.getElementById('emptyState');

      // 重繪會替換 OTP 節點；先取消舊節點上的排隊/播放動效，避免 flyer 殘留或非同步回撥命中脫離節點。
      if (typeof clearAllOTPAnimations === 'function') {
        clearAllOTPAnimations();
      }
      if (typeof clearOTPWindowScheduler === 'function') {
        clearOTPWindowScheduler();
      }
      // 舊 interval 會命中新替換的佔位節點並啟動非 batch 請求；重繪完成後統一重建。
      clearOTPIntervalsExcept([]);

      loading.style.display = 'none';

      if (currentSearchQuery && filteredSecrets.length === 0) {
        clearOTPIntervalsExcept([]);
        secretsList.innerHTML = '';
        secretsList.style.display = 'none';
        emptyState.innerHTML =
          '<div class="icon" aria-hidden="true">${dialogIcon('search')}</div>' +
          '<h3>' + ((typeof t === 'function' ? t('noMatchingSecretsTitle') : null) || 'No matching keys found') + '</h3>' +
          '<p>' + ((typeof t === 'function' ? t('noMatchingSecretsDesc') : null) || 'Try searching with different keywords') + '</p>' +
          '<button type="button" class="workspace-action" onclick="clearSearch()">' + ((typeof t === 'function' ? t('clearSearchBtn') : null) || 'Clear Search') + '</button>';
        emptyState.style.display = 'block';
        return;
      }

      if (secrets.length === 0) {
        clearOTPIntervalsExcept([]);
        secretsList.innerHTML = '';
        secretsList.style.display = 'none';
        emptyState.innerHTML =
          '<div class="icon" aria-hidden="true">${dialogIcon('key')}</div>' +
          '<h3>' + ((typeof t === 'function' ? t('noSecretsTitle') : null) || 'No keys yet') + '</h3>' +
          '<p>' + ((typeof t === 'function' ? t('noSecretsDesc') : null) || 'Add two-factor authentication keys to get verification codes') + '</p>' +
          '<button type="button" class="workspace-action" onclick="showAddModal()">' + ((typeof t === 'function' ? t('emptyAddBtn') : null) || 'Add Key') + '</button>';
        emptyState.style.display = 'block';
        return;
      }

      emptyState.style.display = 'none';

      // 應用排序
      const sortedSecrets = sortSecrets(filteredSecrets, currentSortType);
      const isGroupedView = currentViewMode === 'grouped';
      secretsList.classList.toggle('is-grouped', isGroupedView);
      secretsList.style.display = isGroupedView ? 'block' : 'grid';

      if (isGroupedView) {
        const serviceGroups = groupSecretsByServiceFamily(sortedSecrets, secrets, currentGroupSortType);
        secretsList.innerHTML = serviceGroups.map((group, index) => createServiceGroupSection(group, index)).join('');
      } else {
        secretsList.innerHTML = sortedSecrets.map(secret => createSecretCard(secret)).join('');
      }

      // 🚀 效能最佳化：併發計算所有OTP
      const perfStart = performance.now();

      // 併發計算所有金鑰的OTP（等待全部完成）
      if (typeof updateOTPSecretsInBatch === 'function') {
        await updateOTPSecretsInBatch(sortedSecrets, { includeHOTP: true });
      } else {
        await Promise.all(
          sortedSecrets.map(secret => updateOTP(secret.id, null, secret))
        );
      }

      if (renderGeneration !== secretRenderGeneration) return;

      // 效能監控日誌
      const perfEnd = performance.now();
      const duration = (perfEnd - perfStart).toFixed(2);
      console.log('[性能优化] ' + sortedSecrets.length + '个密钥的OTP并发计算完成，耗时: ' + duration + 'ms');

      // OTP計算完成後再啟動定時器
      sortedSecrets.forEach(secret => {
        startOTPInterval(secret.id, secret);
      });

      clearOTPIntervalsExcept(filteredSecrets);
    }

    // 從卡片點選複製OTP驗證碼
    async function copyOTPFromCard(event, secretId) {
      // 檢查點選的目標元素，避免在點選互動元素時觸發
      const target = event.target;
      const isInteractiveElement = target.closest('.card-menu') || 
                                   target.closest('.otp-code') || 
                                   target.closest('.otp-next-container') ||
                                   target.closest('.secret-actions') ||
                                   target.closest('.action-btn');
      
      // 如果點選的是互動元素，不執行復制
      if (isInteractiveElement) {
        return;
      }
      
      // 執行復制操作
      await copyOTP(secretId);
    }

    // 複製OTP驗證碼
    async function copyOTP(secretId) {
      // 關閉所有開啟的卡片選單
      closeAllCardMenus();

      const secret = secrets.find(s => String(s.id) === String(secretId));
      if (secret && String(secret.type || '').toUpperCase() === 'HOTP') {
        return copyHOTPAndAdvanceCounter(secretId);
      }

      const otpElement = document.getElementById('otp-' + secretId);
      if (!otpElement) return;

      const otpText = otpElement.textContent;
      if (!isCopyableOTPValue(secretId, otpText)) return;

      try {
        await navigator.clipboard.writeText(otpText);
        showOTPCopyFeedback(secretId);
      } catch (err) {
        const textArea = document.createElement('textarea');
        textArea.value = otpText;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showOTPCopyFeedback(secretId);
      }
    }

    function copyHOTPAndAdvanceCounter(secretId) {
      const lockKey = String(secretId);
      const existing = hotpCopyLocks.get(lockKey);
      if (existing) return existing;

      // 等待更早的編輯/刪除完成後再讀取並複製，保證驗證碼與隨後推進的 counter 屬於同一快照。
      const operation = saveQueue
        .then(() => performHOTPCopyAndAdvance(secretId))
        .catch(async error => {
          console.error('HOTP 计数器更新失败:', error);
          try {
            await loadSecrets();
          } catch (reconcileError) {
            console.warn('重新加载 HOTP 计数器失败:', reconcileError);
          }
          const message = error.hotpCopied
            ? ((typeof t === 'function' ? t('hotpCounterSyncFailedCopied') : null) || 'Code copied, but counter sync failed: ')
            : ((typeof t === 'function' ? t('hotpCounterSyncFailedNotCopied') : null) || 'Code not copied, counter state reconciled: ');
          showCenterToast('⚠️', message + error.message);
          return false;
        });
      hotpCopyLocks.set(lockKey, operation);
      saveQueue = operation.then(() => undefined);
      const clearLock = () => {
        if (hotpCopyLocks.get(lockKey) === operation) {
          hotpCopyLocks.delete(lockKey);
        }
      };
      operation.then(clearLock, clearLock);
      return operation;
    }

    async function performHOTPCopyAndAdvance(secretId) {
      const secret = secrets.find(item => String(item.id) === String(secretId));
      const snapshot = getHOTPGenerationSnapshot(secret);
      if (!snapshot) {
        showCenterToast('⚠️', (typeof t === 'function' ? t('hotpCounterInvalid') : null) || 'HOTP counter is invalid or reached upper limit');
        return false;
      }

      const otpElement = document.getElementById('otp-' + secretId);
      if (!otpElement) return false;

      // 被批次替換的更新也會 resolve；必須同步確認節點實際提交了當前 counter 的驗證碼。
      const otpText = getCommittedHOTPToken(secretId, secret);
      if (!otpText) {
        // 恢復計算失敗或被取消的 HOTP；本次不等待計算後自動複製，避免丟失使用者啟用。
        updateOTP(secretId, null, secret).catch(error => console.warn('Failed to refresh HOTP:', error));
        showCenterToast('⏳', (typeof t === 'function' ? t('hotpUpdatingWait') : null) || 'Code is updating, please try again shortly');
        return false;
      }
      if (navigator.onLine === false) {
        showCenterToast('⚠️', (typeof t === 'function' ? t('hotpOfflineWarning') : null) || 'Cannot safely copy HOTP code while offline');
        return false;
      }

      // 本地校驗通過並即將預留；更早開始的 GET 不得在複製後回寫舊狀態。
      secretLoadGeneration += 1;
      // 剪貼簿呼叫必須在使用者啟用仍有效時啟動；與服務端預留併發，避免網路 await 後許可權失效。
      const clipboardOperation = copyHOTPText(otpText);
      const reservationOperation = reserveHOTPCounter(snapshot);
      const [clipboardResult, reservationResult] = await Promise.allSettled([
        clipboardOperation,
        reservationOperation
      ]);
      const copied = clipboardResult.status === 'fulfilled' && clipboardResult.value === true;
      if (reservationResult.status === 'rejected') {
        const reservationError = reservationResult.reason instanceof Error
          ? reservationResult.reason
          : new Error(String(reservationResult.reason));
        reservationError.hotpCopied = copied;
        throw reservationError;
      }

      try {
        await commitReservedHOTPCounter(snapshot);
      } catch (error) {
        error.hotpCopied = copied;
        throw error;
      }

      if (!copied) {
        showCenterToast('⚠️', (typeof t === 'function' ? t('hotpCopyFailedRetry') : null) || 'Copy failed, HOTP counter safely advanced, please retry with new code');
        return false;
      }

      showOTPCopyFeedback(secretId);
      return true;
    }

    async function copyHOTPText(otpText) {
      try {
        await navigator.clipboard.writeText(otpText);
        return true;
      } catch (clipboardError) {
        const textArea = document.createElement('textarea');
        try {
          textArea.value = otpText;
          document.body.appendChild(textArea);
          textArea.select();
          if (document.execCommand('copy') === false) throw clipboardError;
          return true;
        } catch (fallbackError) {
          console.warn('HOTP 复制失败:', fallbackError);
          return false;
        } finally {
          if (textArea.parentNode) textArea.parentNode.removeChild(textArea);
        }
      }
    }

    async function reserveHOTPCounter(snapshot) {
      const queuedSecret = secrets.find(item => String(item.id) === snapshot.id);
      const queuedCounter = queuedSecret && queuedSecret.counter !== undefined
        ? queuedSecret.counter
        : 0;
      if (
        !matchesHOTPGenerationSnapshot(queuedSecret, snapshot) ||
        queuedCounter !== snapshot.counter
      ) {
        throw new Error('Secret changed, cancelled counter update for previous code');
      }

      const response = await authenticatedFetch(
        '/api/secrets/' + encodeURIComponent(snapshot.id) + '/counter',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            expectedCounter: snapshot.counter,
            expectedSecret: snapshot.secret,
            expectedDigits: snapshot.digits,
            expectedAlgorithm: snapshot.algorithm,
            expectedNamespace: snapshot.hotpCounterNamespace
          })
        }
      );
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || result.error || 'Server rejected counter update');
      }

      const queuedOffline = result.queued === true && result.offline === true;
      if (queuedOffline) {
        throw new Error('Cannot safely advance HOTP counter while offline');
      }
      const responseSecret = result.data && result.data.secret;
      if (
        (!matchesHOTPGenerationSnapshot(responseSecret, snapshot) ||
          responseSecret.counter !== snapshot.nextCounter)
      ) {
        throw new Error('Server returned invalid counter state');
      }

      const currentSecret = secrets.find(item => String(item.id) === snapshot.id);
      const currentCounter = currentSecret && currentSecret.counter !== undefined
        ? currentSecret.counter
        : 0;
      if (
        !matchesHOTPGenerationSnapshot(currentSecret, snapshot) ||
        (currentCounter !== snapshot.counter &&
          currentCounter !== snapshot.nextCounter)
      ) {
        throw new Error('Secret state updated, please refresh and retry');
      }
    }

    async function commitReservedHOTPCounter(snapshot) {
      const currentSecret = secrets.find(item => String(item.id) === snapshot.id);
      const currentCounter = currentSecret && currentSecret.counter !== undefined
        ? currentSecret.counter
        : 0;
      if (
        !matchesHOTPGenerationSnapshot(currentSecret, snapshot) ||
        (currentCounter !== snapshot.counter &&
          currentCounter !== snapshot.nextCounter)
      ) {
        throw new Error('Secret state updated, please refresh and retry');
      }
      // 使 POST 期間啟動的 GET 失效，再提交本地新 counter。
      secretLoadGeneration += 1;
      currentSecret.counter = snapshot.nextCounter;
      cacheSecretsLocally();
      const counterElement = document.getElementById('counter-' + snapshot.id);
      if (counterElement) counterElement.textContent = ((typeof t === 'function' ? t('counterLabel') : null) || 'Counter: ') + snapshot.nextCounter;
      await updateOTP(snapshot.id, null, currentSecret);
    }

    function showOTPCopyFeedback(secretId) {
      const secret = secrets.find(s => s.id === secretId);
      const serviceName = secret ? secret.name : ((typeof t === 'function' ? t('otpCode') : null) || 'Code');
      const msg = (typeof t === 'function' ? t('otpCopiedToClipboard', { name: serviceName }) : null) || (serviceName + ' code copied to clipboard');
      showCenterToast('✅', msg);
    }

    async function copyNextOTP(secretId) {
      // 關閉所有開啟的卡片選單
      closeAllCardMenus();

      const nextOtpElement = document.getElementById('next-otp-' + secretId);
      if (!nextOtpElement) return;

      // 交接動畫期間 flyer 仍在展示舊值，而節點已儲存新的未來驗證碼。
      // 單次點選先結束過渡、露出節點中的未來值，再複製與畫面一致的數字。
      if (
        typeof isNextOTPTransitionActive === 'function' &&
        isNextOTPTransitionActive(secretId)
      ) {
        if (typeof clearOTPAnimationTimer !== 'function') return;
        clearOTPAnimationTimer(nextOtpElement);
      }

      const nextOtpText = nextOtpElement.textContent;
      if (!isCopyableOTPValue(secretId, nextOtpText)) return;

      try {
        await navigator.clipboard.writeText(nextOtpText);
        showNextOTPCopyFeedback(secretId);
      } catch (err) {
        const textArea = document.createElement('textarea');
        textArea.value = nextOtpText;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showNextOTPCopyFeedback(secretId);
      }
    }

    function showNextOTPCopyFeedback(secretId) {
      const secret = secrets.find(s => s.id === secretId);
      const serviceName = secret ? secret.name : ((typeof t === 'function' ? t('otpCode') : null) || 'Code');
      const msg = (typeof t === 'function' ? t('nextOtpCopiedToClipboard', { name: serviceName }) : null) || (serviceName + ' next code copied to clipboard');
      showCenterToast('⏭️', msg);
    }

    function isCopyableOTPValue(secretId, value) {
      const secret = secrets.find(s => String(s.id) === String(secretId));
      const expectedLength = Number(secret && secret.digits) || 6;
      return typeof value === 'string' &&
        value.length === expectedLength &&
        /^[0-9]+$/.test(value);
    }

    // 複製驗證器配置 URI（otpauth:// 格式，用於匯入驗證器）
    async function copyOTPAuthURL(secretId) {
      const secret = secrets.find(s => s.id === secretId);
      if (!secret) {
        showCenterToast('❌', (typeof t === 'function' ? t('secretNotFound') : null) || 'Key not found');
        return;
      }

      try {
        // 構建標籤
        const serviceName = secret.name.trim();
        const accountName = secret.account ? secret.account.trim() : '';
        let label;
        if (accountName) {
          label = encodeURIComponent(serviceName) + ':' + encodeURIComponent(accountName);
        } else {
          label = encodeURIComponent(serviceName);
        }

        // 根據型別構建不同的引數
        const type = secret.type || 'TOTP';
        let params;

        switch (type.toUpperCase()) {
          case 'HOTP':
            params = new URLSearchParams({
              secret: secret.secret.toUpperCase(),
              issuer: serviceName,
              algorithm: secret.algorithm || 'SHA1',
              digits: (secret.digits || 6).toString(),
              counter: (secret.counter || 0).toString()
            });
            break;
          case 'TOTP':
          default:
            params = new URLSearchParams({
              secret: secret.secret.toUpperCase(),
              issuer: serviceName,
              algorithm: secret.algorithm || 'SHA1',
              digits: (secret.digits || 6).toString(),
              period: (secret.period || 30).toString()
            });
            break;
        }

        // 根據型別選擇正確的scheme
        const scheme = type.toUpperCase() === 'HOTP' ? 'hotp' : 'totp';
        const otpauthURL = 'otpauth://' + scheme + '/' + label + '?' + params.toString();

        // 複製到剪貼簿
        await navigator.clipboard.writeText(otpauthURL);
        const uriMsg = (typeof t === 'function' ? t('uriCopiedToClipboard', { name: secret.name }) : null) || (secret.name + ' authenticator URI copied to clipboard');
        showCenterToast('🔗', uriMsg);
      } catch (err) {
        console.error('复制验证器 URI 失败:', err);
        const errToast = (typeof t === 'function' ? t('uriCopyFailed', { error: err.message }) : null) || ('Failed to copy authenticator URI: ' + err.message);
        showCenterToast('❌', errToast);
      }
    }

    // 複製當前站點的驗證碼頁面連結，保留影響 OTP 生成的非預設引數。
    async function copyOTPPageURL(secretId) {
      const secret = secrets.find(s => s.id === secretId);
      if (!secret) {
        showCenterToast('❌', (typeof t === 'function' ? t('secretNotFound') : null) || 'Key not found');
        return;
      }

      try {
        const url = new URL('/otp/' + encodeURIComponent(secret.secret.toUpperCase()), window.location.origin);
        const type = (secret.type || 'TOTP').toUpperCase();
        const digits = Number(secret.digits) || 6;
        const algorithm = (secret.algorithm || 'SHA1').toUpperCase();

        if (type === 'HOTP') {
          url.searchParams.set('type', 'HOTP');
          url.searchParams.set('counter', String(secret.counter ?? 0));
        } else {
          const period = Number(secret.period) || 30;
          if (period !== 30) url.searchParams.set('period', String(period));
        }
        if (digits !== 6) url.searchParams.set('digits', String(digits));
        if (algorithm !== 'SHA1') url.searchParams.set('algorithm', algorithm);

        await navigator.clipboard.writeText(url.toString());
        const linkMsg = (typeof t === 'function' ? t('linkCopiedToClipboard', { name: secret.name }) : null) || (secret.name + ' code link copied to clipboard');
        showCenterToast('🔗', linkMsg);
      } catch (err) {
        console.error('复制验证码链接失败:', err);
        const errToast = (typeof t === 'function' ? t('linkCopyFailed', { error: err.message }) : null) || ('Failed to copy code link: ' + err.message);
        showCenterToast('❌', errToast);
      }
    }

    // 切換卡片選單
    function toggleCardMenu(secretId) {
      const dropdown = document.getElementById('menu-' + secretId);
      if (!dropdown) return;
      
      document.querySelectorAll('.card-menu-dropdown').forEach(menu => {
        if (menu.id !== 'menu-' + secretId) {
          menu.classList.remove('show');
          updateCardMenuTrigger(menu);
        }
      });
      
      dropdown.classList.toggle('show');
      updateCardMenuTrigger(dropdown);
      if (dropdown.classList.contains('show')) {
        const firstAction = getEnabledCardMenuActions(dropdown)[0];
        if (firstAction) firstAction.focus();
      }
    }

    function updateCardMenuTrigger(menu) {
      const trigger = document.querySelector('[aria-controls="' + menu.id + '"]');
      if (trigger) trigger.setAttribute('aria-expanded', String(menu.classList.contains('show')));
    }
    
    function closeAllCardMenus() {
      document.querySelectorAll('.card-menu-dropdown').forEach(menu => {
        menu.classList.remove('show');
        updateCardMenuTrigger(menu);
      });
    }

    function isVisibleCardElement(element) {
      if (!element || element.closest('[hidden], [inert], [aria-hidden="true"]')) return false;
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' &&
        style.visibility !== 'hidden' && style.visibility !== 'collapse';
    }

    function getEnabledCardMenuActions(menu) {
      return Array.from(menu.querySelectorAll('.menu-item')).filter(action =>
        !action.disabled && action.getAttribute('aria-disabled') !== 'true' && isVisibleCardElement(action)
      );
    }

    // Use rendered positions so navigation follows responsive grids and service groups.
    function getAdjacentSecretCard(card, key) {
      const origin = card.getBoundingClientRect();
      const horizontal = key === 'ArrowLeft' || key === 'ArrowRight';
      let nearest = null;
      let nearestDistance = Infinity;
      let nearestOffset = Infinity;

      document.querySelectorAll('.secret-card').forEach(candidate => {
        if (candidate === card || !isVisibleCardElement(candidate)) return;
        const rect = candidate.getBoundingClientRect();
        // Left/right stay in the current row; up/down can cross group boundaries.
        if (horizontal && Math.min(origin.bottom, rect.bottom) <= Math.max(origin.top, rect.top)) return;
        const distance = key === 'ArrowLeft' ? origin.left - rect.right :
          key === 'ArrowRight' ? rect.left - origin.right :
          key === 'ArrowUp' ? origin.top - rect.bottom : rect.top - origin.bottom;
        if (distance < -1) return;
        const offset = horizontal
          ? Math.abs((rect.top + rect.bottom) - (origin.top + origin.bottom))
          : Math.abs((rect.left + rect.right) - (origin.left + origin.right));
        if (distance < nearestDistance - 1 || (Math.abs(distance - nearestDistance) <= 1 && offset < nearestOffset)) {
          nearest = candidate;
          nearestDistance = distance;
          nearestOffset = offset;
        }
      });
      return nearest;
    }

    function handleCardArrowKey(event) {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || event.isComposing ||
          !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return false;
      const target = event.target;
      if (!target || typeof target.closest !== 'function' ||
          target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]')) return false;

      const card = target.closest('.secret-card');
      if (!isVisibleCardElement(card)) return false;
      const menuItem = target.closest('.menu-item');
      const menu = menuItem && menuItem.closest('.card-menu-dropdown.show');
      const control = target.closest('.otp-code, .otp-next-container, .card-menu-trigger');
      if (!menu && !control) return false;

      // Consume the boundary arrows too, keeping keyboard navigation from scrolling the page.
      event.preventDefault();
      if (menu && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
        const actions = getEnabledCardMenuActions(menu);
        const index = actions.indexOf(menuItem);
        const nextIndex = event.key === 'ArrowDown' ? (index + 1) % actions.length :
          (index < 0 ? actions.length - 1 : (index + actions.length - 1) % actions.length);
        if (actions[nextIndex]) actions[nextIndex].focus();
        return true;
      }

      const nextCard = getAdjacentSecretCard(card, event.key);
      const selector = menu || control.classList.contains('card-menu-trigger') ? '.card-menu-trigger' :
        control.classList.contains('otp-next-container') ? '.otp-next-container' : '.otp-code';
      closeAllCardMenus();
      if (nextCard || menu) {
        const destination = nextCard || card;
        let nextControl = destination.querySelector(selector);
        if (!nextControl || nextControl.disabled || !isVisibleCardElement(nextControl)) {
          nextControl = destination.querySelector('.otp-code');
        }
        if (nextControl && !nextControl.disabled && isVisibleCardElement(nextControl)) nextControl.focus();
      }
      return true;
    }

    document.addEventListener('click', function(event) {
      if (!event.target.closest('.card-menu')) {
        closeAllCardMenus();
      }
    });


    // 編輯金鑰
    function editSecret(id) {
      const secret = secrets.find(s => s.id === id);
      if (!secret) return;
      
      editingId = id;
      document.getElementById('modalTitle').textContent = (typeof t === 'function' ? t('editSecretTitle') : null) || 'Edit Key';
      document.getElementById('submitBtn').textContent = (typeof t === 'function' ? t('update') : null) || 'Update';
      document.getElementById('secretId').value = id;
      document.getElementById('secretName').value = secret.name;
      document.getElementById('secretService').value = secret.account || '';
      document.getElementById('secretKey').value = secret.secret;
      
      // 填充高階引數
      document.getElementById('secretType').value = secret.type || 'TOTP';
      document.getElementById('secretDigits').value = secret.digits || 6;
      document.getElementById('secretPeriod').value = secret.period || 30;
      document.getElementById('secretAlgorithm').value = secret.algorithm || 'SHA1';
      document.getElementById('secretCounter').value = secret.counter || 0;
      
      // 如果有非預設的高階引數，顯示進階選項
      const hasAdvancedOptions = (secret.type && secret.type !== 'TOTP') ||
                                (secret.digits && secret.digits !== 6) || 
                                (secret.period && secret.period !== 30) || 
                                (secret.algorithm && secret.algorithm !== 'SHA1') ||
                                (secret.counter && secret.counter !== 0);
      
      const checkbox = document.getElementById('showAdvanced');
      if (hasAdvancedOptions) {
        checkbox.checked = true;
        toggleAdvancedOptions();
      } else {
        checkbox.checked = false;
        toggleAdvancedOptions();
      }
      
      const modal = document.getElementById('secretModal');
      modal.style.display = 'flex';
      setTimeout(() => modal.classList.add('show'), 10);
      disableBodyScroll();
    }
    
    async function deleteSecret(id) {
      const secret = secrets.find(s => s.id === id);
      if (!secret) return;

      const confirmed = await showConfirmDialog({
        title: (typeof t === 'function' ? t('deleteSecretTitle') : null) || 'Delete Secret',
        message: (typeof t === 'function' ? t('deleteSecretConfirm', { name: secret.name }) : null) || ('Are you sure you want to delete "' + secret.name + '"?\\nThis action cannot be undone.'),
        confirmText: (typeof t === 'function' ? t('delete') : null) || 'Delete',
        cancelText: (typeof t === 'function' ? t('cancel') : null) || 'Cancel',
        danger: true
      });
      if (!confirmed) {
        return;
      }

      // 🔒 刪除操作也使用佇列，避免與編輯操作產生競態條件
      saveQueue = saveQueue.then(async () => {
        try {
          console.log('🗑️ [保存队列] 提交删除请求:', secret.name);

          const response = await authenticatedFetch('/api/secrets/' + id, {
            method: 'DELETE'
          });

          if (response.ok) {
            const result = await response.json();

            // 檢查是否為離線排隊響應
            if (result.queued && result.offline) {
              console.log('📥 [离线模式] 删除操作已排队，等待同步:', result.operationId);
              showCenterToast('📥', result.message || (typeof t === 'function' ? t('offlineDeleteQueued') : null) || 'Operation saved, will sync automatically when online');

              // 離線模式下，暫時不更新本地狀態，等待同步完成後由 PWA 模組重新整理
              return;
            }

            // 正常線上響應，立即刪除本地資料
            secrets = secrets.filter(s => s.id !== id);
            await renderSecrets();

            if (otpIntervals[id]) {
              clearInterval(otpIntervals[id]);
              delete otpIntervals[id];
            }

            console.log('✅ [保存队列] 删除成功:', secret.name);
          } else {
            showCenterToast('❌', (typeof t === 'function' ? t('deleteFailed') : null) || 'Failed to delete, please try again');
          }
        } catch (error) {
          console.error('❌ [保存队列] 删除失败:', error);
          showCenterToast('❌', (typeof t === 'function' ? t('deleteFailedWithReason', { error: error.message }) : null) || ('Delete failed: ' + error.message));
        }
      }).catch(err => {
        console.error('❌ [保存队列] 队列执行错误:', err);
      });
    }
    
    // 二維碼解析工具
    function showQRScanAndDecode() {
      hideToolsModal();
      showQRDecodeModal();
    }
    
    // 二維碼生成工具
    function showQRGenerateTool() {
      hideToolsModal();
      showQRGenerateModal();
    }
    
    // Base32編解碼工具
    function showBase32Tool() {
      hideToolsModal();
      showBase32Modal();
    }
    
    // 時間戳工具
    function showTimestampTool() {
      hideToolsModal();
      showTimestampModal();
    }
    
    // 金鑰檢查器
    function showKeyCheckTool() {
      hideToolsModal();
      showKeyCheckModal();
    }
    
    // 金鑰生成器
    function showKeyGeneratorTool() {
      hideToolsModal();
      showKeyGeneratorModal();
    }
    
    async function handleSubmit(event) {
      event.preventDefault();

      const name = document.getElementById('secretName').value.trim();
      const account = document.getElementById('secretService').value.trim();
      const secret = document.getElementById('secretKey').value.trim().toUpperCase();

      // 獲取高階引數
      const type = document.getElementById('secretType').value || 'TOTP';
      const digits = parseInt(document.getElementById('secretDigits').value) || 6;
      const period = parseInt(document.getElementById('secretPeriod').value) || 30;
      const algorithm = document.getElementById('secretAlgorithm').value || 'SHA1';
      const counterValue = document.getElementById('secretCounter').value;
      const counter = counterValue === '' ? 0 : Number(counterValue);

      if (!name || !secret) {
        showCenterToast('❌', (typeof t === 'function' ? t('pleaseFillNameAndKey') : null) || 'Please fill in service name and secret');
        return;
      }
      if (
        type.toUpperCase() === 'HOTP' &&
        (!Number.isSafeInteger(counter) || counter < 0)
      ) {
        showCenterToast('❌', (typeof t === 'function' ? t('hotpCounterRangeError') : null) || 'HOTP counter must be an integer between 0 and 9007199254740991');
        return;
      }

      const submitBtn = document.getElementById('submitBtn');
      const originalText = submitBtn.textContent;
      submitBtn.textContent = (typeof t === 'function' ? t('saving') : null) || 'Saving...';
      submitBtn.disabled = true;

      // 🔒 關鍵修復：使用佇列確保儲存操作序列執行，避免併發覆蓋
      // 當快速連續編輯多個金鑰時，後端的讀-修改-寫操作會產生race condition
      // 通過Promise鏈式呼叫，確保前一個儲存完成後再執行下一個
      saveQueue = saveQueue.then(async () => {
        try {
          let response;
          const data = {
            name,
            account: account,
            secret,
            type,
            digits,
            period,
            algorithm,
            counter
          };

          const action = editingId ? 'Update' : 'Create';
          console.log('🔄 [保存队列] 提交保存请求:', action, name, { period, digits, algorithm });

          if (editingId) {
            response = await authenticatedFetch('/api/secrets/' + editingId, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data)
            });
          } else {
            response = await authenticatedFetch('/api/secrets', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data)
            });
          }

          if (response.ok) {
            const result = await response.json();

            // 檢查是否為離線排隊響應
            if (result.queued && result.offline) {
              console.log('📥 [离线模式] 操作已排队，等待同步:', result.operationId);
              showCenterToast('📥', result.message || (typeof t === 'function' ? t('offlineSaveQueued') : null) || 'Operation saved, will sync automatically when online');

              // 離線模式下，暫時不更新本地狀態，等待同步完成後由 PWA 模組重新整理
              hideSecretModal();
              return;
            }

            // 正常線上響應，更新本地狀態
            console.log('✅ [保存队列] 保存成功:', result.data ? result.data.secret.name : result.name, '- period:', result.data ? result.data.secret.period : result.period);

            if (editingId) {
              const index = secrets.findIndex(s => s.id === editingId);
              if (index !== -1) {
                secrets[index] = result.data ? result.data.secret : result;
                console.log('✅ [本地更新] 密钥已更新:', secrets[index].name, '- period:', secrets[index].period);
              }
            } else {
              secrets.push(result.data ? result.data.secret : result);
            }

            await renderSecrets();
            hideSecretModal();
          } else {
            const error = await response.json();
            const errorMessage = error.message || error.error || ((typeof t === 'function' ? t('saveFailed') : null) || 'Failed to save, please try again');
            showCenterToast('❌', errorMessage);
          }
        } catch (error) {
          console.error('❌ [保存队列] 保存失败:', error);
          showCenterToast('❌', (typeof t === 'function' ? t('saveFailedWithReason', { error: error.message }) : null) || ('Save failed: ' + error.message));
        } finally {
          submitBtn.textContent = originalText;
          submitBtn.disabled = false;
        }
      }).catch(err => {
        // 佇列執行失敗的最終兜底
        console.error('❌ [保存队列] 队列执行错误:', err);
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
      });
    }

    // 切換除錯模式
    function toggleDebugMode() {
      debugMode = !debugMode;
      console.log('Debug mode ' + (debugMode ? 'enabled' : 'disabled'));
      const statusLabel = debugMode ? ((typeof t === 'function' ? t('enabled') : null) || 'Enabled') : ((typeof t === 'function' ? t('disabled') : null) || 'Disabled');
      showCenterToast('ℹ️', (typeof t === 'function' ? t('debugModeStatus', { status: statusLabel }) : null) || ('Debug Mode: ' + statusLabel));
    }

    // 手動重新整理所有驗證碼（用於除錯或強制同步）
    function forceRefreshAllOTPs() {
      console.log('Manually refreshing all OTP codes');
      if (typeof updateOTPSecretsInBatch === 'function') {
        updateOTPSecretsInBatch(secrets, { includeHOTP: true });
      } else {
        secrets.forEach(secret => {
          updateOTP(secret.id, null, secret);
        });
      }
      showCenterToast('ℹ️', (typeof t === 'function' ? t('allOtpsRefreshed') : null) || 'All codes manually refreshed');
    }

    // 鍵盤快捷鍵
    document.addEventListener('keydown', function(e) {
      if (handleCardArrowKey(e)) return;
      if (e.key === 'Escape') {
        const openCardMenu = document.querySelector('.card-menu-dropdown.show');
        if (openCardMenu) {
          const trigger = document.querySelector('[aria-controls="' + openCardMenu.id + '"]');
          closeAllCardMenus();
          if (trigger) trigger.focus();
          return;
        }
        hideSecretModal();
        hideQRModal();
        hideQRScanner();
        hideImportModal();
      }
      
      if (e.ctrlKey && e.key === 'd') {
        e.preventDefault();
        toggleDebugMode();
      }
      
      if (e.ctrlKey && e.key === 'r') {
        e.preventDefault();
        forceRefreshAllOTPs();
      }
    });

    // 頁面解除安裝時清理定時器
    window.addEventListener('beforeunload', function() {
      Object.values(otpIntervals).forEach(interval => {
        clearInterval(interval);
      });
    });

    // 🛡️ 安全機制：定期檢查所有驗證碼是否需要更新
    // 防止定時器失效導致驗證碼過期
    // 每5秒檢查一次（不會影響效能）
    setInterval(() => {
      if (document.hidden) {
        // 如果頁面在後臺，跳過檢查（節省資源）
        return;
      }

      const currentTime = Math.floor(getCorrectedNowMs() / 1000);
      
      secrets.forEach(secret => {
        // 只檢查TOTP型別
        if (secret.type && secret.type.toUpperCase() === 'HOTP') {
          return;
        }

        const otpElement = document.getElementById('otp-' + secret.id);
        if (!otpElement) return;

        // 檢查驗證碼是否為預設值（未初始化或更新失敗）
        if (otpElement.textContent === '------') {
          console.warn('⚠️  [安全检查] 发现未初始化的验证码:', secret.name);
          updateOTP(secret.id, null, secret);
          return;
        }

        // 檢查當前時間視窗，判斷驗證碼是否應該更新
        const timeStep = secret.period || 30;
        const currentWindow = Math.floor(currentTime / timeStep);
        
        // 在時間視窗剛切換時（前3秒），強制重新整理驗證碼
        const secondsInWindow = currentTime % timeStep;
        if (secondsInWindow <= 2) {
          // 避免重複重新整理：檢查上次重新整理時間
          const lastRefreshKey = 'lastRefresh-' + secret.id;
          const lastRefreshWindow = window[lastRefreshKey];
          
          if (lastRefreshWindow !== currentWindow) {
            console.log('🔄 [安全检查] 时间窗口已切换，刷新验证码:', secret.name, '窗口:', currentWindow);
            window[lastRefreshKey] = currentWindow;
            // 共享視窗排程器負責可見卡片的統一重新整理；僅在其不可用時走單卡兜底。
            if (typeof isOTPWindowScheduled !== 'function' || !isOTPWindowScheduled(secret.id)) {
              updateOTP(secret.id, null, secret);
            }
          }
        }
      });
    }, 5000); // 每5秒检查一次
`;
}
