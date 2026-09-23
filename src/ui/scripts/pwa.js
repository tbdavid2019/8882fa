/**
 * PWA (Progressive Web App) 功能模組
 * Service Worker 註冊、PWA 檢測、安裝提示
 */

/**
 * 獲取 PWA 相關程式碼
 * @returns {string} PWA JavaScript 程式碼
 */
export function getPWACode() {
	return `// ==================== PWA Service Worker 註冊 ====================

    /**
     * 註冊 Service Worker 以支援 PWA 和離線功能
     */
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', async () => {
        try {
          const registration = await navigator.serviceWorker.register('/sw.js', {
            scope: '/'
          });

          console.log('✅ Service Worker 注册成功:', registration.scope);

          // 監聽更新（僅記錄日誌，不顯示通知）
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            console.log('🔄 发现 Service Worker 更新');

            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('✨ 新的 Service Worker 已安装，下次访问时自动使用新版本');
              }
            });
          });

          // 監聽控制器變化
          navigator.serviceWorker.addEventListener('controllerchange', () => {
            console.log('🔄 Service Worker 控制器已更新');
            requestPendingOperationSync();
          });

          // 📨 監聽 Service Worker 訊息（離線同步通知）
          navigator.serviceWorker.addEventListener('message', (event) => {
            console.log('[PWA] 收到 Service Worker 消息:', event.data);
            handleServiceWorkerMessage(event.data);
          });

          requestPendingOperationSync(registration);

          // 定期檢查更新（每小時）
          setInterval(() => {
            registration.update().catch(err => {
              console.warn('检查 Service Worker 更新失败:', err);
            });
          }, 60 * 60 * 1000);

        } catch (error) {
          console.warn('⚠️  Service Worker 注册失败:', error);
          // PWA 功能不可用，但不影響應用正常執行
        }
      });
    } else {
      console.log('ℹ️  当前浏览器不支持 Service Worker');
    }

    /**
     * 觸發離線操作同步；不支援 Background Sync 時直接通知 Service Worker。
     * @param {ServiceWorkerRegistration|null} registration - 當前註冊物件
     */
    function requestPendingOperationSync(registration = null) {
      if (navigator.onLine === false) return;

      const postSyncMessage = () => {
        // 註冊後臺同步失敗時，頁面可能已經離線。
        if (navigator.onLine !== false && navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({ type: 'SYNC_OPERATIONS' });
        }
      };

      if (registration && registration.sync) {
        registration.sync.register('sync-operations').catch(error => {
          console.warn('注册后台同步失败，改用页面触发:', error);
          postSyncMessage();
        });
        return;
      }
      postSyncMessage();
    }

    /**
     * 處理 Service Worker 訊息
     * @param {Object} message - 訊息物件
     */
    function handleServiceWorkerMessage(message) {
      const { type } = message;

      switch (type) {
        case 'SYNC_SUCCESS':
          // 單個操作同步成功
          console.log('✅ 离线操作已同步:', message.operationType, message.operationId);
          // 重新整理金鑰列表
          if (typeof loadSecrets === 'function') {
            loadSecrets();
          }
          break;

        case 'SYNC_FAILED':
          // 單個操作同步失敗
          console.error('❌ 离线操作同步失败:', message.operationType, message.error);
          showCenterToast('⚠️', (typeof t === 'function' ? t('pwaSyncFailed', { type: message.operationType }) : null) || ('Sync failed: ' + message.operationType));
          break;

        case 'SYNC_COMPLETE':
          // 所有操作同步完成
          console.log(\`🎉 同步完成: 成功 \${message.successCount} 个, 失败 \${message.failCount} 个\`);

          if (message.successCount > 0) {
            showCenterToast('✅', (typeof t === 'function' ? t('pwaSyncSuccessCount', { count: message.successCount }) : null) || ('Synced ' + message.successCount + ' offline actions'));
            // 重新整理金鑰列表
            if (typeof loadSecrets === 'function') {
              loadSecrets();
            }
          }

          if (message.failCount > 0) {
            showCenterToast('⚠️', (typeof t === 'function' ? t('pwaSyncFailCount', { count: message.failCount }) : null) || (message.failCount + ' actions failed to sync'));
          }

          // 網路傳輸失敗只延後同步；線上訊號可能滯後，保留頁面重試機會。
          if ((message.failCount > 0 || message.deferredCount > 0) && navigator.onLine !== false) {
            setTimeout(() => {
              navigator.serviceWorker.ready
                .then(requestPendingOperationSync)
                .catch(error => console.warn('Failed to retry offline sync:', error));
            }, 30000);
          }
          break;

        default:
          console.log('[PWA] 未知消息类型:', type);
      }
    }

    /**
     * 監聽PWA安裝提示事件
     */
    let deferredPrompt = null;
    const PWA_BANNER_DISMISS_KEY = 'pwa-banner-dismissed';
    const PWA_BANNER_DISMISS_DAYS = 7;

    function isPwaBannerDismissed() {
      try {
        const dismissedAt = localStorage.getItem(PWA_BANNER_DISMISS_KEY);
        if (!dismissedAt) return false;
        const timeDiff = Date.now() - parseInt(dismissedAt, 10);
        return timeDiff < PWA_BANNER_DISMISS_DAYS * 24 * 60 * 60 * 1000;
      } catch {
        return false;
      }
    }

    function dismissPwaBanner() {
      const banner = document.getElementById('pwaInstallBanner');
      if (banner) {
        banner.classList.remove('show');
        setTimeout(() => { banner.style.display = 'none'; }, 400);
      }
      try {
        localStorage.setItem(PWA_BANNER_DISMISS_KEY, Date.now().toString());
      } catch {}
    }

    function checkAndShowPwaBanner() {
      if (isPWAMode()) return;
      if (isPwaBannerDismissed()) return;

      const banner = document.getElementById('pwaInstallBanner');
      if (!banner) return;

      const isIos = /iPhone|iPad|iPod/.test(navigator.userAgent) && !window.MSStream;
      const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

      if (isIos && isSafari) {
        // iOS Safari: 提示通過分享按鈕“加入主畫面”
        const descEl = document.getElementById('pwaBannerDesc');
        const actionBtn = document.getElementById('pwaBannerActionBtn');
        if (descEl) {
          descEl.textContent = (typeof t === 'function' ? t('pwaBannerIosPrompt') : null) || 'Tap Share below, then select "Add to Home Screen"';
        }
        if (actionBtn) {
          actionBtn.style.display = 'none';
        }
        banner.style.display = 'flex';
        requestAnimationFrame(() => banner.classList.add('show'));
        return;
      }

      if (deferredPrompt) {
        // Chromium / Android / Edge: 提示原生安裝
        banner.style.display = 'flex';
        requestAnimationFrame(() => banner.classList.add('show'));
      }
    }

    async function handlePwaBannerInstall() {
      if (!deferredPrompt) return;
      try {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log('PWA banner user choice:', outcome);
        if (outcome === 'accepted') {
          dismissPwaBanner();
        }
      } catch (err) {
        console.warn('PWA banner install error:', err);
      } finally {
        deferredPrompt = null;
        updateSettingsPwaInstallButton();
      }
    }

    window.addEventListener('beforeinstallprompt', (e) => {
      console.log('💡 PWA 安装提示事件触发');
      e.preventDefault();
      deferredPrompt = e;
      updateSettingsPwaInstallButton();
      setTimeout(checkAndShowPwaBanner, 1500);
    });

    window.addEventListener('load', () => {
      setTimeout(checkAndShowPwaBanner, 3000);
    });

    /**
     * 同步 系統設定 › 偏好 的 PWA 安裝按鈕狀態
     * - PWA 模式下：隱藏整節
     * - 已捕獲 beforeinstallprompt：啟用按鈕
     * - 未捕獲：停用並用 title 提示
     */
    function updateSettingsPwaInstallButton() {
      const section = document.getElementById('settingsPwaSection');
      const btn = document.getElementById('settingsPwaInstallBtn');
      if (!section || !btn) return;

      if (isPWAMode()) {
        section.style.display = 'none';
        return;
      }

      section.style.display = '';
      btn.textContent = (typeof t === 'function' ? t('pwaInstallDesktop') : null) || 'Install App';

      if (deferredPrompt) {
        btn.disabled = false;
        btn.title = (typeof t === 'function' ? t('pwaInstallTooltip') : null) || 'Click to install to desktop / home screen';
      } else {
        btn.disabled = true;
        btn.title = (typeof t === 'function' ? t('pwaInstallUnavailable') : null) || 'Unavailable (browser install prompt not triggered)';
      }
    }

    /**
     * 從 系統設定 觸發 PWA 安裝
     */
    async function triggerPwaInstallFromSettings() {
      const btn = document.getElementById('settingsPwaInstallBtn');
      if (!deferredPrompt) return;

      if (btn) {
        btn.disabled = true;
        btn.textContent = (typeof t === 'function' ? t('pwaInstalling') : null) || 'Installing…';
      }

      try {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log('PWA user choice:', outcome);

        if (outcome === 'accepted') {
          showCenterToast('✅', (typeof t === 'function' ? t('pwaInstallStarted') : null) || 'Install started');
          dismissPwaBanner();
        } else {
          showCenterToast('❌', (typeof t === 'function' ? t('pwaInstallCancelled') : null) || 'Install cancelled');
        }
      } finally {
        deferredPrompt = null;
        updateSettingsPwaInstallButton();
      }
    }

    /**
     * 監聽PWA安裝成功事件
     */
    window.addEventListener('appinstalled', () => {
      console.log('✅ PWA 应用已成功安装');
      deferredPrompt = null;
      updateSettingsPwaInstallButton();
      dismissPwaBanner();
      showCenterToast('✅', (typeof t === 'function' ? t('pwaInstallSuccess') : null) || 'App installed successfully');
    });

    /**
     * 檢測是否在PWA模式下執行
     */
    function isPWAMode() {
      return window.matchMedia('(display-mode: standalone)').matches ||
             window.navigator.standalone === true;
    }

    if (isPWAMode()) {
      console.log('🚀 应用正在 PWA 模式下运行');
      // 可以根據PWA模式調整UI
    }

    if (typeof window !== 'undefined') {
      window.dismissPwaBanner = dismissPwaBanner;
      window.handlePwaBannerInstall = handlePwaBannerInstall;
    }

    /**
     * 監聽線上/離線狀態變化
     */
    window.addEventListener('online', () => {
      console.log('🌐 网络已连接');

      // 移除離線橫幅
      document.body.classList.remove('offline-mode');
      const offlineBanner = document.getElementById('offline-banner');
      if (offlineBanner) {
        offlineBanner.classList.remove('show');
        setTimeout(() => offlineBanner.remove(), 300);
      }

      showCenterToast('🌐', (typeof t === 'function' ? t('pwaNetworkOnline') : null) || 'Network restored, syncing...');

      // 手動觸發同步（作為備用，如果 Background Sync 不可用）
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then(requestPendingOperationSync).catch(err => {
          console.warn('手动触发同步失败:', err);
        });
      }
    });

    window.addEventListener('offline', () => {
      console.log('📡 网络已断开');

      // 新增離線橫幅
      document.body.classList.add('offline-mode');
      showOfflineBanner();

      showCenterToast('📡', (typeof t === 'function' ? t('pwaNetworkOffline') : null) || 'Offline, operations will be saved for sync');
    });

    /**
     * 顯示離線橫幅
     */
    function showOfflineBanner() {
      // 檢查是否已經顯示過
      if (document.getElementById('offline-banner')) {
        return;
      }

      // 建立離線橫幅
      const banner = document.createElement('div');
      banner.id = 'offline-banner';
      banner.className = 'offline-banner';
      banner.innerHTML =
        '<span class="offline-banner-icon">📡</span>' +
        '<span class="offline-banner-text">' + ((typeof t === 'function' ? t('pwaOfflineBanner') : null) || 'Offline mode - operations will sync automatically once connected') + '</span>';
      document.body.prepend(banner); // 添加到页面顶部

      // 新增顯示動畫
      setTimeout(() => banner.classList.add('show'), 100);
    }

    // 初始化時檢查網路狀態
    if (!navigator.onLine) {
      console.log('📡 应用启动时处于离线状态');
      document.body.classList.add('offline-mode');
      showOfflineBanner();
    }

    // ==================== 頁面可見性處理 ====================
    // 解決手機切後臺/鎖屏後驗證碼不準確的問題
    
    /**
     * 當頁面從後臺切回前臺時，重新整理所有驗證碼
     * 原因：移動瀏覽器會暫停後臺頁面的定時器，導致驗證碼和倒計時不同步
     */
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        // 頁面變為可見（從後臺切回前臺）
        console.log('📱 页面恢复可见，刷新所有验证码');
        
        // 立即重新整理所有OTP驗證碼，確保時間同步
        if (typeof secrets !== 'undefined' && secrets && secrets.length > 0) {
          console.log('🔄 正在刷新 ' + secrets.length + ' 个验证码...');
          
          // 併發計算並原子提交所有驗證碼，避免快卡先閃現、慢卡隨後再播放動畫。
          const refreshPromise = typeof updateOTPSecretsInBatch === 'function'
            ? updateOTPSecretsInBatch(secrets, { includeHOTP: true })
            : Promise.all(
              secrets.map(secret => {
                if (typeof updateOTP === 'function') {
                  return updateOTP(secret.id, null, secret);
                }
                return Promise.resolve();
              })
            );
          refreshPromise.then(() => {
            console.log('✅ 所有验证码已刷新完成');
          }).catch(err => {
            console.error('❌ 刷新验证码时出错:', err);
          });
        }
      } else {
        // 頁面變為隱藏（切到後臺）
        console.log('📱 页面进入后台');
      }
    });

    /**
     * 監聽頁面獲得焦點事件（備用方案）
     * 某些瀏覽器在鎖屏解鎖時只會觸發focus而不觸發visibilitychange
     */
    window.addEventListener('focus', () => {
      console.log('📱 窗口获得焦点');
      
      // 延遲100ms執行，避免與visibilitychange重複
      setTimeout(() => {
        if (typeof secrets !== 'undefined' && secrets && secrets.length > 0) {
          console.log('🔄 窗口焦点恢复，检查并刷新验证码');
          
          if (typeof updateOTPSecretsInBatch === 'function') {
            updateOTPSecretsInBatch(secrets, { includeHOTP: true });
          } else {
            secrets.forEach(secret => {
              if (typeof updateOTP === 'function') {
                updateOTP(secret.id, null, secret);
              }
            });
          }
        }
      }, 100);
    });

    /**
     * 監聽頁面失去焦點事件
     */
    window.addEventListener('blur', () => {
      console.log('📱 窗口失去焦点');
    });

    /**
     * 使用 Page Visibility API 監控頁面活躍狀態
     * 提供更詳細的日誌用於除錯
     */
    if (typeof document.hidden !== 'undefined') {
      console.log('✅ Page Visibility API 已启用');
      console.log('📊 当前页面状态:', document.hidden ? '隐藏' : '可见');
    } else {
      console.warn('⚠️  浏览器不支持 Page Visibility API');
    }

`;
}
