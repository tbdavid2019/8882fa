/**
 * 認證模組
 * 包含認證相關函式
 */

/**
 * 獲取認證相關程式碼
 * @returns {string} 認證 JavaScript 程式碼
 */
export function getAuthCode() {
	return `    // ========== 認證相關函式 ==========
    // 注意：現在使用 HttpOnly Cookie 儲存 token，不再使用 localStorage
    let loginModalHideTimer = null;

    // 獲取儲存的令牌（已棄用 - Cookie 自動管理）
    function getAuthToken() {
      // Cookie 由瀏覽器自動管理，前端無需訪問
      return null;
    }

    // 儲存令牌（已棄用 - Cookie 自動設定）
    function saveAuthToken(token, expiresAt = null) {
      // HttpOnly Cookie 在服務端設定，前端無需操作
      // 保留此函式僅為向後相容
    }

    // 清除令牌（已棄用 - Cookie 自動管理）
    function clearAuthToken() {
      // Cookie 由服務端管理（通過設定過期的 Cookie）
      // 前端無需手動清除
    }

    // 檢查 token 是否即將過期（已棄用）
    function isTokenExpiringSoon() {
      // Cookie 過期由瀏覽器自動管理
      return false;
    }

    // 檢查 token 是否已過期（已棄用）
    function isTokenExpired() {
      // Cookie 過期由瀏覽器自動管理
      return false;
    }

    // 重新整理 Token
    async function refreshAuthToken() {
      // Token 由 Cookie 管理，重新整理請求會自動攜帶 Cookie
      try {
        console.log('🔄 正在刷新 Token...');
        const response = await fetch('/api/refresh-token', {
          method: 'POST',
          credentials: 'include' // 🍪 自动携带 Cookie
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            console.log('✅ Token 刷新成功');
            return true;
          }
        }

        console.warn('⚠️ Token 刷新失败');
        return false;
      } catch (error) {
        console.error('Token 刷新错误:', error);
        return false;
      }
    }

    function setLoginPasswordVisibility(visible) {
      const tokenInput = document.getElementById('loginToken');
      const toggleButton = document.getElementById('loginPasswordToggle');

      if (!tokenInput || !toggleButton) {
        return;
      }

      tokenInput.type = visible ? 'text' : 'password';
      toggleButton.classList.toggle('is-visible', visible);
      const label = visible ? ((typeof t === 'function' ? t('hidePassword') : null) || 'Hide password') : ((typeof t === 'function' ? t('showPassword') : null) || 'Show password');
      toggleButton.setAttribute('aria-label', label);
      toggleButton.title = label;
    }

    function toggleLoginPasswordVisibility() {
      const tokenInput = document.getElementById('loginToken');

      if (!tokenInput) {
        return;
      }

      setLoginPasswordVisibility(tokenInput.type === 'password');
    }

    // 檢測是否處於無法儲存 Secure Cookie 的不安全上下文（HTTP 且非本機地址）
    // 登入 Cookie 帶有 Secure 屬性，HTTP 訪問時瀏覽器會拒絕儲存，導致反覆要求登入
    function isInsecureCookieContext() {
      if (typeof window.isSecureContext === 'boolean') {
        return !window.isSecureContext;
      }
      const localHosts = ['localhost', '127.0.0.1', '[::1]'];
      return location.protocol === 'http:' && !localHosts.includes(location.hostname);
    }

    // 顯示登入模態框
    function showLoginModal() {
      const modal = document.getElementById('loginModal');
      const tokenInput = document.getElementById('loginToken');
      const errorDiv = document.getElementById('loginError');
      const insecureWarning = document.getElementById('loginInsecureWarning');

      if (!modal) {
        return;
      }

      if (insecureWarning) {
        insecureWarning.style.display = isInsecureCookieContext() ? 'block' : 'none';
      }

      const passkeyContainer = document.getElementById('passkeyLoginContainer');
      if (passkeyContainer) {
        passkeyContainer.style.display = (window.PublicKeyCredential && typeof window.PublicKeyCredential === 'function') ? 'block' : 'none';
      }

      if (loginModalHideTimer) {
        clearTimeout(loginModalHideTimer);
        loginModalHideTimer = null;
      }

      modal.style.display = 'flex';
      requestAnimationFrame(() => modal.classList.add('show'));

      errorDiv.style.display = 'none';
      tokenInput.value = '';
      setLoginPasswordVisibility(false);

      setTimeout(() => tokenInput.focus(), 100);

      // 回車鍵提交由 <form> 原生 submit 事件處理（loginForm 的 onsubmit）
    }

    // 隱藏登入模態框
    function hideLoginModal() {
      const modal = document.getElementById('loginModal');
      if (!modal) {
        return;
      }

      if (loginModalHideTimer) {
        clearTimeout(loginModalHideTimer);
      }

      modal.classList.remove('show');
      loginModalHideTimer = setTimeout(() => {
        modal.style.display = 'none';
        loginModalHideTimer = null;
      }, 300);
    }

    // 處理登入提交
    async function handleLoginSubmit() {
      const tokenInput = document.getElementById('loginToken');
      const errorDiv = document.getElementById('loginError');
      const credential = tokenInput.value.trim();

      if (!credential) {
        errorDiv.textContent = (typeof t === 'function' ? t('loginErrorEmpty') : null) || 'Please enter password';
        errorDiv.style.display = 'block';
        return;
      }

      try {
        const response = await fetch('/api/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include', // 🍪 携带 Cookie
          body: JSON.stringify({ credential })
        });

        const data = await response.json();

        if (response.ok && data.success) {
          // 登入成功 - token 已通過 HttpOnly Cookie 自動設定
          hideLoginModal();

          // 顯示登入成功資訊（包含過期時間）
          if (data.expiresIn) {
            showCenterToast('✅', (typeof t === 'function' ? t('loginSuccessExpires', { expiresIn: data.expiresIn }) : null) || ('Login successful, valid for ' + data.expiresIn));
          } else {
            showCenterToast('✅', (typeof t === 'function' ? t('loginSuccess') : null) || 'Login successful');
          }

          // 重新載入金鑰列表
          loadSecrets();
        } else {
          // 登入失敗
          errorDiv.textContent = data.message || ((typeof t === 'function' ? t('loginFailedInvalidPassword') : null) || 'Incorrect password, please try again');
          errorDiv.style.display = 'block';
          tokenInput.value = '';
          tokenInput.focus();
        }
      } catch (error) {
        console.error('登录失败:', error);
        errorDiv.textContent = ((typeof t === 'function' ? t('loginFailedPrefix') : null) || 'Login failed: ') + error.message;
        errorDiv.style.display = 'block';
      }
    }

    // 使用 Passkey / Touch ID 登入
    async function handlePasskeyLogin() {
      const errorDiv = document.getElementById('loginError');
      const passkeyBtn = document.getElementById('passkeyLoginBtn');
      if (!window.PublicKeyCredential) {
        if (errorDiv) {
          errorDiv.textContent = (typeof t === 'function' ? t('passkeyNotSupported') : null) || 'WebAuthn / Passkey is not supported in this browser';
          errorDiv.style.display = 'block';
        }
        return;
      }

      if (passkeyBtn) passkeyBtn.disabled = true;
      if (errorDiv) errorDiv.style.display = 'none';

      try {
        const optRes = await fetch('/api/webauthn/login-options');
        if (!optRes.ok) {
          throw new Error('Failed to fetch login options');
        }
        const options = await optRes.json();
        if (!options.hasCredentials) {
          const msg = (typeof t === 'function' ? t('passkeyNoCredentials') : null) || 'No passkeys found for this server. Please log in with password first to add one in Settings.';
          if (errorDiv) {
            errorDiv.textContent = msg;
            errorDiv.style.display = 'block';
          }
          return;
        }

        const challengeBytes = base64UrlToBytes(options.challenge);
        const allowCredentials = (options.allowCredentials || []).map(c => ({
          id: base64UrlToBytes(c.id),
          type: 'public-key',
          transports: c.transports
        }));

        const assertion = await navigator.credentials.get({
          publicKey: {
            challenge: challengeBytes,
            timeout: options.timeout || 60000,
            rpId: options.rpId,
            allowCredentials: allowCredentials.length > 0 ? allowCredentials : undefined,
            userVerification: 'preferred'
          }
        });

        if (!assertion) {
          throw new Error('No credential returned');
        }

        const payload = {
          id: assertion.id,
          rawId: bytesToBase64Url(assertion.rawId),
          response: {
            authenticatorData: bytesToBase64Url(assertion.response.authenticatorData),
            clientDataJSON: bytesToBase64Url(assertion.response.clientDataJSON),
            signature: bytesToBase64Url(assertion.response.signature),
            userHandle: assertion.response.userHandle ? bytesToBase64Url(assertion.response.userHandle) : null
          }
        };

        const verifyRes = await fetch('/api/webauthn/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload)
        });

        const verifyData = await verifyRes.json();
        if (verifyRes.ok && verifyData.success) {
          hideLoginModal();
          if (verifyData.expiresIn) {
            showCenterToast('✅', (typeof t === 'function' ? t('loginSuccessExpires', { expiresIn: verifyData.expiresIn }) : null) || ('Login successful, valid for ' + verifyData.expiresIn));
          } else {
            showCenterToast('✅', (typeof t === 'function' ? t('loginSuccess') : null) || 'Login successful');
          }
          loadSecrets();
        } else {
          if (errorDiv) {
            errorDiv.textContent = verifyData.message || 'Passkey verification failed';
            errorDiv.style.display = 'block';
          }
        }
      } catch (err) {
        if (err.name === 'NotAllowedError' || err.name === 'AbortError') {
          console.log('User cancelled passkey operation:', err.message);
          if (errorDiv) {
            errorDiv.textContent = (typeof t === 'function' ? t('passkeyLoginCancelled') : null) || 'Passkey sign-in cancelled or timed out';
            errorDiv.style.display = 'block';
          }
        } else {
          console.error('Passkey login error:', err);
          if (errorDiv) {
            errorDiv.textContent = err.message || 'Failed to sign in with passkey';
            errorDiv.style.display = 'block';
          }
        }
      } finally {
        if (passkeyBtn) passkeyBtn.disabled = false;
      }
    }

    if (typeof window !== 'undefined') {
      window.handlePasskeyLogin = handlePasskeyLogin;
    }

    // 檢查認證狀態
    function checkAuth() {
      // 🍪 Cookie 認證由伺服器驗證
      // 前端無法直接檢查 HttpOnly Cookie
      // 如果 Cookie 無效，API 請求會返回 401，觸發登入
      // 為了更好的使用者體驗，總是先嚐試載入，讓伺服器決定
      return true;
    }
    
    // 定時檢查 token 過期（每小時檢查一次）
    // 啟動 Token 過期檢查（已棄用 - Cookie 自動管理）
    function startTokenExpiryCheck() {
      // HttpOnly Cookie 過期由瀏覽器自動管理
      // 保留此函式僅為向後相容
    }

    // 處理未授權響應
    function handleUnauthorized() {
      clearAuthToken();

      // 清除快取的金鑰資料（安全考慮）
      try {
        localStorage.removeItem('2fa-secrets-cache');
      } catch (e) {
        console.warn('清除缓存失败:', e);
      }

      try {
        Object.keys(otpIntervals || {}).forEach(secretId => {
          clearInterval(otpIntervals[secretId]);
          delete otpIntervals[secretId];
        });
      } catch (e) {
        console.warn('清除验证码定时器失败:', e);
      }

      if (typeof clearAllOTPAnimations === 'function') {
        clearAllOTPAnimations();
      }
      if (typeof clearOTPWindowScheduler === 'function') {
        clearOTPWindowScheduler();
      }

      secrets = [];
      filteredSecrets = [];
      currentSearchQuery = '';
      const secretsList = document.getElementById('secretsList');
      if (secretsList) {
        secretsList.innerHTML = '';
        secretsList.style.display = 'none';
      }

      showCenterToast('⚠️', (typeof t === 'function' ? t('loginExpired') : null) || 'Session expired, please login again');
      setTimeout(() => {
        showLoginModal();
      }, 1500);
    }

    // 退出登入
    async function logout() {
      let serverSuccess = false;
      let serverErrorMessage = '';

      // 1. 嘗試通知服務端清除 Cookie；記錄結果但不因失敗中止
      try {
        const response = await fetch('/api/logout', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'X-Requested-With': 'XMLHttpRequest'
          }
        });

        if (response.ok) {
          serverSuccess = true;
        } else {
          // 透傳服務端錯誤資訊（包括 403 CSRF 拒絕、429 限流等）
          const data = await response.json().catch(() => ({}));
          serverErrorMessage = data.message || ('Server returned ' + response.status);
          console.warn('退出登录服务端响应异常:', response.status, serverErrorMessage);
        }
      } catch (error) {
        // 網路錯誤不阻塞本地登出；HttpOnly Cookie 由瀏覽器最終隨過期清除
        console.error('退出登录网络错误:', error);
        serverErrorMessage = error.message || 'Network error';
      }

      // 2. 無論服務端是否確認，都清理本地狀態，確保使用者視覺上已登出
      try {
        localStorage.removeItem('2fa-secrets-cache');
      } catch (e) {
        console.warn('清除缓存失败:', e);
      }

      try {
        Object.keys(otpIntervals || {}).forEach(secretId => {
          clearInterval(otpIntervals[secretId]);
          delete otpIntervals[secretId];
        });
      } catch (e) {
        console.warn('清除验证码定时器失败:', e);
      }

      if (typeof clearAllOTPAnimations === 'function') {
        clearAllOTPAnimations();
      }
      if (typeof clearOTPWindowScheduler === 'function') {
        clearOTPWindowScheduler();
      }

      secrets = [];
      filteredSecrets = [];
      currentSearchQuery = '';

      const secretsList = document.getElementById('secretsList');
      if (secretsList) {
        secretsList.innerHTML = '';
        secretsList.style.display = 'none';
      }

      if (typeof hideSettingsModal === 'function') {
        hideSettingsModal();
      }

      // 3. 反饋給使用者
      if (serverSuccess) {
        showCenterToast('👋', (typeof t === 'function' ? t('loggedOut') : null) || 'Logged out');
      } else {
        showCenterToast('⚠️', ((typeof t === 'function' ? t('loggedOut') : null) || 'Logged out') + ': ' + serverErrorMessage);
      }

      setTimeout(() => {
        showLoginModal();
      }, 500);

      return serverSuccess;
    }

    if (typeof window !== 'undefined') {
      window.logout = logout;
    }

    // 為 fetch 請求新增認證（使用 Cookie）並支援自動續期
    async function authenticatedFetch(url, options = {}) {
      // 🍪 使用 HttpOnly Cookie 進行認證，瀏覽器自動攜帶
      options.credentials = 'include'; // 自动携带 Cookie
      
      const response = await fetch(url, options);
      
      // 🔄 自動續期：檢查響應頭中是否有重新整理標記
      if (response.headers.get('X-Token-Refresh-Needed') === 'true') {
        const remainingDays = response.headers.get('X-Token-Remaining-Days');
        console.log('⏰ Token 即将过期（剩余 ' + remainingDays + ' 天），正在自动刷新...');
        
        // 非同步重新整理 Token（不阻塞當前請求）
        refreshAuthToken().then(success => {
          if (success) {
            console.log('✅ Token 自动续期成功，已延长30天');
          } else {
            console.warn('⚠️  Token 自动续期失败，请稍后重试');
          }
        }).catch(error => {
          console.error('❌ Token 自动续期错误:', error);
        });
      }
      
      return response;
    }

`;
}
