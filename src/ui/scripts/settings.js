/**
 * Settings Module - 设置模块
 * 提供设置弹窗的标签切换、修改密码、偏好设置等功能
 */

/**
 * 获取设置模块代码
 * @returns {string} Settings JavaScript 代码
 */
export function getSettingsCode() {
	return `
    // ========== 设置模块 ==========

    // 当前激活的设置标签
    let activeSettingsTab = 'security';
    let preferencesLoadRequestId = 0;
    let defaultExportFormatChangeVersion = 0;
    let defaultExportFormatSaveRequestId = 0;
    let languagePreferenceSaveVersion = 0;
    let preferenceSaveQueue = Promise.resolve();
    const NUMERIC_PREFERENCE_SAVE_DELAY = 500;
    const numericPreferences = {
      jwtExpiryDays: {
        inputId: 'settingsJwtExpiryDays', resultId: 'settingsJwtExpiryResult', min: 1, max: 365,
        version: 0, dirty: false, savedValue: null, timer: null, saving: null
      },
      maxBackups: {
        inputId: 'settingsMaxBackups', resultId: 'settingsMaxBackupsResult', min: 0, max: 1000,
        version: 0, dirty: false, savedValue: null, timer: null, saving: null
      }
    };

    // Settings are stored together on the server. Serialize writes from all
    // preference controls so one field cannot overwrite another field's update.
    function enqueuePreferenceSave(save) {
      const request = preferenceSaveQueue.then(save);
      preferenceSaveQueue = request.catch(() => {});
      return request;
    }

    /**
     * 切换设置标签
     * @param {string} tabName - 标签名称
     */
    function switchSettingsTab(tabName) {
      activeSettingsTab = tabName;

      // 更新标签按钮状态
      document.querySelectorAll('.settings-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
      });

      // 更新内容面板
      document.querySelectorAll('.settings-panel').forEach(panel => {
        panel.classList.toggle('active', panel.dataset.panel === tabName);
      });

      // 每次进入标签页都从顶部开始，避免沿用上一个面板的滚动位置。
      const settingsContent = document.querySelector('#settingsModal .settings-content');
      if (settingsContent) {
        settingsContent.scrollTop = 0;
      }

      // 安全设置标签页打开时加载 Passkeys
      if (tabName === 'security') {
        loadPasskeys();
      }

      // 同步设置标签页打开时加载配置
      if (tabName === 'sync') {
        loadSyncStatus();
      }

      // 偏好设置标签页打开时加载当前值
      if (tabName === 'preferences') {
        loadPreferences();
        if (typeof updateSettingsPwaInstallButton === 'function') {
          updateSettingsPwaInstallButton();
        }
      }
    }

    /**
     * 加载同步配置状态（WebDAV 和 S3）
     */
    async function loadSyncStatus() {
      // 加载 WebDAV 状态
      try {
        const webdavResp = await authenticatedFetch('/api/webdav/config');
        const webdavData = await webdavResp.json();
        const webdavStatusEl = document.getElementById('settingsWebdavStatus');
        if (webdavStatusEl) {
          if (webdavData.count > 0) {
            webdavStatusEl.textContent = (typeof t === 'function' ? t('syncStatusConfigured', { count: webdavData.count }) : null) || (webdavData.count + ' target(s) configured');
            webdavStatusEl.className = 'sync-status configured';
          } else {
            webdavStatusEl.textContent = (typeof t === 'function' ? t('syncStatusNotConfigured') : null) || 'Not configured';
            webdavStatusEl.className = 'sync-status not-configured';
          }
        }
      } catch {
        const webdavStatusEl = document.getElementById('settingsWebdavStatus');
        if (webdavStatusEl) {
          webdavStatusEl.textContent = (typeof t === 'function' ? t('syncStatusError') : null) || 'Failed to load';
          webdavStatusEl.className = 'sync-status not-configured';
        }
      }

      // 加载 S3 状态
      try {
        const s3Resp = await authenticatedFetch('/api/s3/config');
        const s3Data = await s3Resp.json();
        const s3StatusEl = document.getElementById('settingsS3Status');
        if (s3StatusEl) {
          if (s3Data.count > 0) {
            s3StatusEl.textContent = (typeof t === 'function' ? t('syncStatusConfigured', { count: s3Data.count }) : null) || (s3Data.count + ' target(s) configured');
            s3StatusEl.className = 'sync-status configured';
          } else {
            s3StatusEl.textContent = (typeof t === 'function' ? t('syncStatusNotConfigured') : null) || 'Not configured';
            s3StatusEl.className = 'sync-status not-configured';
          }
        }
      } catch {
        const s3StatusEl = document.getElementById('settingsS3Status');
        if (s3StatusEl) {
          s3StatusEl.textContent = (typeof t === 'function' ? t('syncStatusError') : null) || 'Failed to load';
          s3StatusEl.className = 'sync-status not-configured';
        }
      }

      // 加载 OneDrive 状态
      try {
        const oneDriveResp = await authenticatedFetch('/api/onedrive/config');
        const oneDriveData = await oneDriveResp.json();
        const oneDriveStatusEl = document.getElementById('settingsOneDriveStatus');
        if (oneDriveStatusEl) {
          if (oneDriveData.count > 0) {
            oneDriveStatusEl.textContent = (typeof t === 'function' ? t('syncStatusConfigured', { count: oneDriveData.count }) : null) || (oneDriveData.count + ' target(s) configured');
            oneDriveStatusEl.className = 'sync-status configured';
          } else {
            oneDriveStatusEl.textContent = (typeof t === 'function' ? t('syncStatusNotConfigured') : null) || 'Not configured';
            oneDriveStatusEl.className = 'sync-status not-configured';
          }
        }
      } catch {
        const oneDriveStatusEl = document.getElementById('settingsOneDriveStatus');
        if (oneDriveStatusEl) {
          oneDriveStatusEl.textContent = (typeof t === 'function' ? t('syncStatusError') : null) || 'Failed to load';
          oneDriveStatusEl.className = 'sync-status not-configured';
        }
      }

      // 加载 Google Drive 状态
      try {
        const googleDriveResp = await authenticatedFetch('/api/gdrive/config');
        const googleDriveData = await googleDriveResp.json();
        const googleDriveStatusEl = document.getElementById('settingsGoogleDriveStatus');
        if (googleDriveStatusEl) {
          if (googleDriveData.count > 0) {
            googleDriveStatusEl.textContent = (typeof t === 'function' ? t('syncStatusConfigured', { count: googleDriveData.count }) : null) || (googleDriveData.count + ' target(s) configured');
            googleDriveStatusEl.className = 'sync-status configured';
          } else {
            googleDriveStatusEl.textContent = (typeof t === 'function' ? t('syncStatusNotConfigured') : null) || 'Not configured';
            googleDriveStatusEl.className = 'sync-status not-configured';
          }
        }
      } catch {
        const googleDriveStatusEl = document.getElementById('settingsGoogleDriveStatus');
        if (googleDriveStatusEl) {
          googleDriveStatusEl.textContent = (typeof t === 'function' ? t('syncStatusError') : null) || 'Failed to load';
          googleDriveStatusEl.className = 'sync-status not-configured';
        }
      }
    }

    /**
     * 从设置弹窗打开 WebDAV 配置
     */
    function openWebdavFromSettings() {
      hideSettingsModal();
      // 延迟打开以避免两个模态框重叠
      setTimeout(() => {
        showWebdavModal(() => showSettingsModal());
      }, 350);
    }

    /**
     * 从设置弹窗打开 S3 配置
     */
    function openS3FromSettings() {
      hideSettingsModal();
      setTimeout(() => {
        showS3Modal(() => showSettingsModal());
      }, 350);
    }

    /**
     * 从设置弹窗打开 OneDrive 配置
     */
    function openOneDriveFromSettings() {
      hideSettingsModal();
      setTimeout(() => {
        showOneDriveModal(() => showSettingsModal());
      }, 350);
    }

    /**
     * 从设置弹窗打开 Google Drive 配置
     */
    function openGoogleDriveFromSettings() {
      hideSettingsModal();
      setTimeout(() => {
        showGoogleDriveModal(() => showSettingsModal());
      }, 350);
    }

    /**
     * 修改密码
     */
    async function changePassword() {
      const currentPassword = document.getElementById('settingsCurrentPassword').value;
      const newPassword = document.getElementById('settingsNewPassword').value;
      const confirmPassword = document.getElementById('settingsConfirmPassword').value;
      const resultEl = document.getElementById('changePasswordResult');

      // 前端验证
      if (!currentPassword || !newPassword || !confirmPassword) {
        resultEl.textContent = (typeof t === 'function' ? t('setupErrorEmpty') : null) || 'Please fill in all password fields';
        resultEl.className = 'change-password-result error';
        resultEl.style.display = 'block';
        return;
      }

      if (newPassword !== confirmPassword) {
        resultEl.textContent = (typeof t === 'function' ? t('setupErrorMismatch') : null) || 'The two entered passwords do not match';
        resultEl.className = 'change-password-result error';
        resultEl.style.display = 'block';
        return;
      }

      if (newPassword.length < 8) {
        resultEl.textContent = (typeof t === 'function' ? t('setupErrorLength') : null) || 'New password must be at least 8 characters';
        resultEl.className = 'change-password-result error';
        resultEl.style.display = 'block';
        return;
      }

      const btn = document.getElementById('changePasswordBtn');
      const originalText = btn.textContent;
      btn.textContent = (typeof t === 'function' ? t('updating') : null) || 'Updating...';
      btn.disabled = true;
      resultEl.style.display = 'none';

      try {
        const response = await authenticatedFetch('/api/change-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
        });

        const data = await response.json();

        if (response.ok && data.success) {
          resultEl.textContent = data.message || (typeof t === 'function' ? t('changePasswordSuccess') : null) || 'Password changed successfully, please log in again';
          resultEl.className = 'change-password-result success';
          resultEl.style.display = 'block';

          // 清空表单
          document.getElementById('settingsCurrentPassword').value = '';
          document.getElementById('settingsNewPassword').value = '';
          document.getElementById('settingsConfirmPassword').value = '';

          // 延迟后退出登录
          setTimeout(() => {
            logout();
          }, 2000);
        } else {
          resultEl.textContent = data.message || (typeof t === 'function' ? t('changePasswordFail') : null) || 'Failed to change password';
          resultEl.className = 'change-password-result error';
          resultEl.style.display = 'block';
        }
      } catch (error) {
        resultEl.textContent = (typeof t === 'function' ? t('networkError') : null) || 'Network error, please try again later';
        resultEl.className = 'change-password-result error';
        resultEl.style.display = 'block';
      } finally {
        btn.textContent = originalText;
        btn.disabled = false;
      }
    }

    /**
     * 加载偏好设置
     */
    async function loadPreferences() {
      // 主题模式
      const requestId = ++preferencesLoadRequestId;
      const formatVersionAtStart = defaultExportFormatChangeVersion;
      const languageVersionAtStart = languagePreferenceSaveVersion;
      const numericVersionsAtStart = {};
      Object.keys(numericPreferences).forEach(key => {
        const state = numericPreferences[key];
        numericVersionsAtStart[key] = state.dirty ? null : state.version;
      });

      const currentTheme = localStorage.getItem('theme') || 'auto';
      const themeRadios = document.querySelectorAll('input[name="settingsTheme"]');
      themeRadios.forEach(radio => {
        radio.checked = radio.value === currentTheme;
      });

      const animationSelect = document.getElementById('settingsOTPAnimationMode');
      if (animationSelect) {
        animationSelect.value = getOTPAnimationMode();
      }

      const formatSelect = document.getElementById('settingsDefaultExportFormat');
      const localDefaultFormat = localStorage.getItem('defaultExportFormat') || 'json';
      if (formatSelect) {
        formatSelect.value = localDefaultFormat;
      }

      const langSelect = document.getElementById('settingsLanguage');
      const localLanguage = (typeof getLanguagePreference === 'function' ? getLanguagePreference() : (typeof localStorage !== 'undefined' ? localStorage.getItem('language') : null)) || 'en';
      if (langSelect) {
        langSelect.value = localLanguage;
      }

      // 导出偏好格式、语言偏好、登录有效期和备份保留数量（从服务器读取）
      try {
        const resp = await authenticatedFetch('/api/settings');
        if (resp.ok) {
          const data = await resp.json();
          if (requestId !== preferencesLoadRequestId) {
            return;
          }

          if (formatSelect && data.defaultExportFormat && defaultExportFormatChangeVersion === formatVersionAtStart) {
            formatSelect.value = data.defaultExportFormat;
            localStorage.setItem('defaultExportFormat', data.defaultExportFormat);
          }
          if (langSelect && data.language && languagePreferenceSaveVersion === languageVersionAtStart) {
            langSelect.value = data.language;
            if (typeof setLanguage === 'function') {
              setLanguage(data.language);
            }
          }
          Object.keys(numericPreferences).forEach(key => {
            const state = numericPreferences[key];
            const input = document.getElementById(state.inputId);
            if (input && !state.dirty && numericVersionsAtStart[key] === state.version && Number.isInteger(data[key])) {
              input.value = String(data[key]);
              state.savedValue = data[key];
            }
          });
        }
      } catch {
        // 加载失败静默处理
      }
    }

    /**
     * 应用主题设置
     * @param {string} theme - 主题名称
     */
    function applyThemeFromSettings(theme) {
      localStorage.setItem('theme', theme);
      applyTheme(theme, true);
    }

    /**
     * 应用验证码切换动效
     * @param {string} mode - 动效模式
     */
    function applyOTPAnimationFromSettings(mode) {
      const appliedMode = setOTPAnimationMode(mode);
      const animationSelect = document.getElementById('settingsOTPAnimationMode');
      if (animationSelect) {
        animationSelect.value = appliedMode;
      }
    }

    /**
     * 保存导出偏好格式
     */
    async function saveDefaultExportFormat() {
      const formatSelect = document.getElementById('settingsDefaultExportFormat');
      if (!formatSelect) return;
      const selectedFormat = formatSelect.value;
      const requestId = ++defaultExportFormatSaveRequestId;
      defaultExportFormatChangeVersion += 1;

      try {
        const resp = await enqueuePreferenceSave(() => authenticatedFetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ defaultExportFormat: selectedFormat }),
        }));
        const data = await resp.json();
        if (requestId !== defaultExportFormatSaveRequestId) {
          return;
        }

        if (resp.ok && data.success) {
          const savedFormat = (data.settings && data.settings.defaultExportFormat) || selectedFormat;
          formatSelect.value = savedFormat;
          localStorage.setItem('defaultExportFormat', savedFormat);
          showCenterToast('✅', (typeof t === 'function' ? t('defaultFormatSaved') : null) || 'Default format saved. Batch export and backup will prioritize this format');
        } else {
          showCenterToast('❌', data.message || (typeof t === 'function' ? t('defaultFormatSaveFailed') : null) || 'Failed to save default format');
        }
      } catch {
        if (requestId !== defaultExportFormatSaveRequestId) {
          return;
        }
        showCenterToast('❌', (typeof t === 'function' ? t('networkError') : null) || 'Network error, please try again later');
      }
    }

    /**
     * 保存界面语言偏好
     * @param {string} selectedLang - 选中的语言代码
     */
    function chooseQuickLanguage(selectedLang) {
      const languageControl = document.getElementById('quickLanguageControl');
      if (languageControl) languageControl.open = false;
      saveLanguagePreference(selectedLang);
    }

    async function saveLanguagePreference(selectedLang) {
      const saveVersion = ++languagePreferenceSaveVersion;
      if (typeof setLanguage === 'function') {
        setLanguage(selectedLang);
      }
      try {
        const resp = await enqueuePreferenceSave(() => authenticatedFetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ language: selectedLang }),
        }));
        const data = await resp.json();
        if (saveVersion !== languagePreferenceSaveVersion) return;
        if (resp.ok && data.success) {
          const msg = (typeof t === 'function' ? t('languageSaved') : null) || 'Language preference saved';
          if (typeof showCenterToast === 'function') {
            showCenterToast('✅', msg);
          }
        } else if (typeof showCenterToast === 'function') {
          showCenterToast('❌', data.message || (typeof t === 'function' ? t('networkErrorRetry') : null) || 'Language preference could not be saved. Please try again.');
        }
      } catch {
        if (saveVersion === languagePreferenceSaveVersion && typeof showCenterToast === 'function') {
          showCenterToast('❌', (typeof t === 'function' ? t('networkErrorRetry') : null) || 'Network error. Language preference was not saved. Please retry later.');
        }
      }
    }

    function showNumericPreferenceResult(key, message, status = '') {
      const result = document.getElementById(numericPreferences[key].resultId);
      result.textContent = message;
      result.className = 'settings-result' + (status ? ' ' + status : '');
      result.style.display = 'block';
    }

    function readNumericPreference(key) {
      const state = numericPreferences[key];
      const input = document.getElementById(state.inputId);
      const raw = input.value.trim();
      const value = Number(raw);
      const valid = raw !== '' && Number.isInteger(value) && value >= state.min && value <= state.max;
      input.setAttribute('aria-invalid', String(!valid));
      if (!valid) {
        showNumericPreferenceResult(key, (typeof t === 'function' ? t('numericRangeError', { min: state.min, max: state.max }) : null) || ('Please enter an integer between ' + state.min + ' and ' + state.max), 'error');
        return null;
      }
      return value;
    }

    function numericPreferenceSavedMessage(key, value) {
      if (key === 'jwtExpiryDays') return (typeof t === 'function' ? t('jwtExpirySaved') : null) || 'Saved, takes effect next login';
      return value === 0
        ? ((typeof t === 'function' ? t('maxBackupsSavedUnlimited') : null) || 'Saved, unlimited backups')
        : ((typeof t === 'function' ? t('maxBackupsSavedLimit', { value }) : null) || ('Saved, keeping latest ' + value + ' backups'));
    }

    // Input events debounce typing and spinner changes. Blur and Enter flush
    // immediately; loading a value programmatically never schedules a save.
    function scheduleNumericPreferenceSave(key) {
      const state = numericPreferences[key];
      state.version += 1;
      state.dirty = true;
      if (state.timer !== null) clearTimeout(state.timer);
      showNumericPreferenceResult(key, (typeof t === 'function' ? t('waitingToSave') : null) || 'Waiting to save...');
      state.timer = setTimeout(() => {
        state.timer = null;
        saveNumericPreference(key);
      }, NUMERIC_PREFERENCE_SAVE_DELAY);
    }

    async function saveNumericPreference(key) {
      const state = numericPreferences[key];
      if (state.timer !== null) clearTimeout(state.timer);
      state.timer = null;
      if (!state.dirty || readNumericPreference(key) === null) return;
      if (state.saving) return state.saving;

      state.saving = (async () => {
        while (state.dirty) {
          const version = state.version;
          const value = readNumericPreference(key);
          if (value === null) break;
          if (value === state.savedValue) {
            state.dirty = false;
            showNumericPreferenceResult(key, numericPreferenceSavedMessage(key, value), 'success');
            break;
          }

          showNumericPreferenceResult(key, (typeof t === 'function' ? t('saving') : null) || 'Saving...');
          try {
            const resp = await enqueuePreferenceSave(() => authenticatedFetch('/api/settings', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ [key]: value }),
            }));
            const data = await resp.json();
            if (resp.ok && data.success) {
              state.savedValue = value;
              if (state.version === version) {
                state.dirty = false;
                document.getElementById(state.inputId).value = String(value);
                showNumericPreferenceResult(key, numericPreferenceSavedMessage(key, value), 'success');
              }
            } else {
              state.savedValue = null;
              if (state.version === version) {
                showNumericPreferenceResult(key, data.message || (typeof t === 'function' ? t('saveFailedRetry') : null) || 'Failed to save, please try again later', 'error');
                break;
              }
            }
          } catch {
            // A lost response does not prove the server left the old value intact.
            state.savedValue = null;
            if (state.version === version) {
              showNumericPreferenceResult(key, (typeof t === 'function' ? t('networkErrorRetry') : null) || 'Network error, not saved, please try again later', 'error');
              break;
            }
          }
          // If editing continues, let the pending debounce finish. If its timer
          // already fired during this request, save the latest value next.
          if (state.timer !== null) break;
        }
      })();

      try {
        await state.saving;
      } finally {
        state.saving = null;
      }
    }

    function saveJwtExpiryDays() {
      return saveNumericPreference('jwtExpiryDays');
    }

    function saveMaxBackups() {
      return saveNumericPreference('maxBackups');
    }

    // ==================== 通行密钥 (Passkey / Touch ID) 管理 ====================

    async function loadPasskeys() {
      const listEl = document.getElementById('passkeyList');
      const addBtn = document.getElementById('addPasskeyBtn');
      if (!listEl) return;

      if (!window.PublicKeyCredential) {
        if (addBtn) addBtn.style.display = 'none';
        listEl.innerHTML = '<div class="passkey-empty">' + ((typeof t === 'function' ? t('passkeyNotSupported') : null) || 'WebAuthn / Passkey is not supported in this browser') + '</div>';
        return;
      }

      try {
        listEl.innerHTML = '<div class="passkey-loading">' + ((typeof t === 'function' ? t('passkeyLoading') : null) || 'Loading passkeys...') + '</div>';
        const res = await authenticatedFetch('/api/webauthn/credentials');
        if (!res.ok) throw new Error('Failed to load passkeys');
        const data = await res.json();
        const creds = data.credentials || [];

        if (creds.length === 0) {
          listEl.innerHTML = '<div class="passkey-empty">' + ((typeof t === 'function' ? t('passkeyNone') : null) || 'No passkeys added yet. Add this device to enable fast Touch ID / Passkey sign-in.') + '</div>';
          return;
        }

        listEl.innerHTML = creds.map(c => {
          const dateStr = c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '';
          const safeName = escapeHTML(c.name || 'Passkey');
          const safeId = escapeHTML(c.id);
          const delLabel = (typeof t === 'function' ? t('delete') : null) || 'Delete';
          return '<div class="passkey-item">' +
            '<div class="passkey-item-info">' +
              '<div class="passkey-item-icon">' +
                '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                  '<path d="M12 11c0 1.66-1.34 3-3 3s-3-1.34-3-3 1.34-3 3-3 3 1.34 3 3z"/>' +
                  '<path d="m11 13 4.5 4.5"/>' +
                  '<path d="m13.5 15.5 2 2"/>' +
                  '<path d="m15.5 13.5 2 2"/>' +
                  '<circle cx="12" cy="12" r="10"/>' +
                '</svg>' +
              '</div>' +
              '<div>' +
                '<div class="passkey-item-name">' + safeName + '</div>' +
                '<div class="passkey-item-date">' + dateStr + '</div>' +
              '</div>' +
            '</div>' +
            '<button type="button" class="btn btn-danger btn-sm" onclick="deletePasskey(\\'' + safeId + '\\', \\'' + safeName.replace(/'/g, "\\\\'") + '\\')">' +
              delLabel +
            '</button>' +
          '</div>';
        }).join('');
      } catch (err) {
        console.error('Failed to load passkeys:', err);
        listEl.innerHTML = '<div class="passkey-empty" style="color:var(--danger);">' + err.message + '</div>';
      }
    }

    async function registerCurrentDevicePasskey() {
      if (!window.PublicKeyCredential) {
        alert((typeof t === 'function' ? t('passkeyNotSupported') : null) || 'WebAuthn / Passkey is not supported in this browser');
        return;
      }

      let defaultDeviceName = 'My Device';
      const ua = navigator.userAgent;
      if (/Macintosh/i.test(ua)) defaultDeviceName = 'Mac (Touch ID)';
      else if (/iPhone|iPad/i.test(ua)) defaultDeviceName = 'iOS (Face ID / Touch ID)';
      else if (/Android/i.test(ua)) defaultDeviceName = 'Android (Biometrics)';
      else if (/Windows/i.test(ua)) defaultDeviceName = 'Windows Hello';

      const deviceNamePrompt = (typeof t === 'function' ? t('passkeyNamePrompt') : null) || 'Enter a label for this device passkey:';
      const deviceName = prompt(deviceNamePrompt, defaultDeviceName);
      if (deviceName === null) return; // cancelled

      const addBtn = document.getElementById('addPasskeyBtn');
      if (addBtn) addBtn.disabled = true;

      try {
        const optRes = await authenticatedFetch('/api/webauthn/register-options');
        if (!optRes.ok) throw new Error('Failed to get registration options');
        const options = await optRes.json();

        const challengeBytes = base64UrlToBytes(options.challenge);
        const userIdBytes = base64UrlToBytes(options.user.id);

        const credential = await navigator.credentials.create({
          publicKey: {
            challenge: challengeBytes,
            rp: options.rp,
            user: {
              id: userIdBytes,
              name: options.user.name,
              displayName: options.user.displayName
            },
            pubKeyCredParams: options.pubKeyCredParams,
            authenticatorSelection: options.authenticatorSelection,
            timeout: options.timeout || 60000,
            attestation: 'none'
          }
        });

        if (!credential) throw new Error('No credential returned');

        const regPayload = {
          deviceName: deviceName.trim() || defaultDeviceName,
          id: credential.id,
          rawId: bytesToBase64Url(credential.rawId),
          response: {
            attestationObject: bytesToBase64Url(credential.response.attestationObject),
            clientDataJSON: bytesToBase64Url(credential.response.clientDataJSON)
          }
        };

        const regRes = await authenticatedFetch('/api/webauthn/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(regPayload)
        });

        const regData = await regRes.json();
        if (regRes.ok && regData.success) {
          showCenterToast('✅', (typeof t === 'function' ? t('passkeyCreated') : null) || 'Passkey added successfully!');
          loadPasskeys();
        } else {
          throw new Error(regData.message || 'Registration failed');
        }
      } catch (err) {
        if (err.name === 'NotAllowedError' || err.name === 'AbortError') {
          console.log('User cancelled passkey registration:', err.message);
        } else {
          console.error('Passkey registration error:', err);
          alert(err.message || 'Failed to register passkey');
        }
      } finally {
        if (addBtn) addBtn.disabled = false;
      }
    }

    async function deletePasskey(credId, name) {
      const confirmMsg = (typeof t === 'function' ? t('passkeyDeleteConfirm', { name }) : null) || ('Are you sure you want to remove this passkey "' + name + '"?');
      if (!confirm(confirmMsg)) return;

      try {
        const res = await authenticatedFetch('/api/webauthn/credentials/' + encodeURIComponent(credId), {
          method: 'DELETE'
        });
        const data = await res.json();
        if (res.ok && data.success) {
          showCenterToast('🗑️', (typeof t === 'function' ? t('passkeyDeleted') : null) || 'Passkey removed');
          loadPasskeys();
        } else {
          throw new Error(data.message || 'Failed to delete passkey');
        }
      } catch (err) {
        console.error('Delete passkey error:', err);
        alert(err.message || 'Failed to delete passkey');
      }
    }

    if (typeof window !== 'undefined') {
      window.loadPasskeys = loadPasskeys;
      window.registerCurrentDevicePasskey = registerCurrentDevicePasskey;
      window.deletePasskey = deletePasskey;
    }
  `;
}
