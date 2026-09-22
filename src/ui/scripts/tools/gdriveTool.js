/**
 * Google Drive sync tool UI module.
 */

export function getGoogleDriveToolCode() {
	return `
    // ==================== Google Drive 同步工具 ====================

    let _googleDriveOnClose = null;
    let _googleDriveOAuthListenerReady = false;
    let _googleDriveExpectedCallbackOrigin = null;

    function showGoogleDriveModal(onClose) {
      _googleDriveOnClose = typeof onClose === 'function' ? onClose : null;
      _ensureGoogleDriveOAuthListener();
      showModal('googleDriveModal', () => {
        loadGoogleDriveDestinations();
      });
    }

    function hideGoogleDriveModal() {
      const onClose = _googleDriveOnClose;
      _googleDriveOnClose = null;
      hideModal('googleDriveModal', onClose);
    }

    function _ensureGoogleDriveOAuthListener() {
      if (_googleDriveOAuthListenerReady) return;
      _googleDriveOAuthListenerReady = true;

      window.addEventListener('message', function(event) {
        const allowedOrigins = [window.location.origin];
        if (_googleDriveExpectedCallbackOrigin) {
          allowedOrigins.push(_googleDriveExpectedCallbackOrigin);
        }
        if (!allowedOrigins.includes(event.origin)) return;
        const data = event.data || {};
        if (data.type !== 'cloudBackupAuthComplete' || data.provider !== 'gdrive') return;

        _googleDriveExpectedCallbackOrigin = null;
        loadGoogleDriveDestinations();
        const icon = data.severity === 'warning' ? '⚠️' : (data.success ? '✅' : '❌');
        showCenterToast(icon, data.message || (data.success ? ((typeof t === 'function' ? t('syncGdriveAuthSuccess') : null) || 'Google Drive authorized successfully') : ((typeof t === 'function' ? t('syncGdriveAuthFailed') : null) || 'Google Drive authorization failed')));
      });
    }

    function _escapeGoogleDriveHtml(str) {
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    }

    async function loadGoogleDriveDestinations() {
      const listEl = document.getElementById('googleDriveDestinationList');
      const addBtn = document.getElementById('googleDriveAddBtn');
      const warningEl = document.getElementById('googleDriveOauthWarning');

      try {
        const response = await authenticatedFetch('/api/gdrive/config');
        const data = await response.json();

        if (warningEl) {
          if (data.oauthConfigured) {
            warningEl.style.display = 'none';
          } else {
            warningEl.style.display = 'block';
            warningEl.textContent = (typeof t === 'function' ? t('remoteMissingCredentialsWarning', { target: 'Google Drive' }) : null) || 'Server has not configured Google Drive OAuth credentials. You can still view and edit targets, but authorization is not available yet.';
          }
        }

        if (data.destinations && data.destinations.length > 0) {
          listEl.innerHTML = data.destinations.map(dest => _renderGoogleDriveCard(dest)).join('');
        } else {
          listEl.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-tertiary); font-size: var(--dialog-caption-size);">' + ((typeof t === 'function' ? t('googleDriveEmptyList') : null) || 'No Google Drive targets yet. Click button below to add.') + '</div>';
        }

        const canAdd = data.count < data.maxAllowed;
        addBtn.dataset.canAdd = canAdd ? 'true' : 'false';
        addBtn.style.display = canAdd ? 'block' : 'none';
        hideGoogleDriveForm();
      } catch (error) {
        console.error('Failed to load Google Drive config:', error);
        listEl.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--danger-color); font-size: var(--dialog-caption-size);">' + ((typeof t === 'function' ? t('loadFailedRetry') : null) || 'Failed to load, please try again later') + '</div>';
      }
    }

    function _renderGoogleDriveCard(dest) {
      let statusDot = 'dest-status-dot-gray';
      let statusText = (typeof t === 'function' ? t('syncStatusNotConfigured') : null) || 'Not authorized';

      if (dest.status.lastError) {
        statusDot = 'dest-status-dot-red';
        statusText = ((typeof t === 'function' ? t('syncStatusFailedPrefix') : null) || 'Failed: ') + dest.status.lastError.error;
      } else if (dest.status.lastSuccess) {
        statusDot = 'dest-status-dot-green';
        statusText = new Date(dest.status.lastSuccess.timestamp).toLocaleString();
      } else if (dest.authorized) {
        statusText = (typeof t === 'function' ? t('syncStatusAuthorizedWaitingPush') : null) || 'Authorized, waiting for first push';
      }

      const enabledClass = dest.enabled ? '' : 'dest-card-disabled';
      const accountText = dest.account && (dest.account.email || dest.account.displayName)
        ? ((dest.account.displayName || 'Google Account') + (dest.account.email ? ' · ' + dest.account.email : ''))
        : ((typeof t === 'function' ? t('syncStatusNotConfigured') : null) || 'Not authorized');

      return '<div class="dest-card ' + enabledClass + '" data-id="' + dest.id + '">'
        + '<div class="dest-card-header">'
        + '<div class="dest-card-info">'
        + '<span class="dest-card-name">' + _escapeGoogleDriveHtml(dest.name) + '</span>'
        + '<span class="dest-card-url">' + _escapeGoogleDriveHtml(accountText) + '</span>'
        + '<span class="dest-card-url">' + ((typeof t === 'function' ? t('gdriveFolder') : null) || 'Folder: ') + _escapeGoogleDriveHtml(dest.config.folderPath || '/2FA-Backups') + '</span>'
        + '</div>'
        + '<label class="dest-toggle" onclick="event.stopPropagation()">'
        + '<input type="checkbox" aria-label="' + ((typeof t === 'function' ? t('enableSyncTargetAriaLabel') : null) || 'Enable this sync target') + '" ' + (dest.enabled ? 'checked' : '') + ' ' + (!dest.authorized ? 'disabled ' : '') + 'onchange="toggleGoogleDriveDest(\\'' + dest.id + '\\', this.checked)" />'
        + '<span class="dest-toggle-slider"></span>'
        + '</label>'
        + '</div>'
        + '<div class="dest-card-status">'
        + '<span class="dest-status-dot ' + statusDot + '"></span>'
        + '<span class="dest-status-text">' + _escapeGoogleDriveHtml(statusText) + '</span>'
        + '</div>'
        + '<div class="dest-card-actions">'
        + '<button class="btn btn-sm btn-info" onclick="event.stopPropagation(); authorizeGoogleDriveDest(\\'' + dest.id + '\\')" >' + (dest.authorized ? ((typeof t === 'function' ? t('reauthorize') : null) || 'Reauthorize') : ((typeof t === 'function' ? t('authorize') : null) || 'Authorize')) + '</button>'
        + '<button class="btn btn-sm" onclick="event.stopPropagation(); editGoogleDriveDest(\\'' + dest.id + '\\')" >' + ((typeof t === 'function' ? t('edit') : null) || 'Edit') + '</button>'
        + '<button class="btn btn-sm btn-danger-outline" onclick="event.stopPropagation(); deleteGoogleDriveDest(\\'' + dest.id + '\\', \\'' + _escapeGoogleDriveHtml(dest.name).replace(/'/g, "\\\\'") + '\\')" >' + ((typeof t === 'function' ? t('delete') : null) || 'Delete') + '</button>'
        + '</div>'
        + '</div>';
    }

    function showGoogleDriveForm(id) {
      const formArea = document.getElementById('googleDriveFormArea');
      const addBtn = document.getElementById('googleDriveAddBtn');
      formArea.style.display = 'block';
      addBtn.style.display = 'none';

      if (!id) {
        document.getElementById('googleDriveEditId').value = '';
        document.getElementById('googleDriveName').value = '';
        document.getElementById('googleDriveFolderPath').value = '/2FA-Backups';
      }
    }

    function hideGoogleDriveForm() {
      document.getElementById('googleDriveFormArea').style.display = 'none';
      const addBtn = document.getElementById('googleDriveAddBtn');
      if (addBtn && addBtn.dataset.canAdd !== 'false') {
        addBtn.style.display = 'block';
      }
    }

    async function editGoogleDriveDest(id) {
      try {
        const response = await authenticatedFetch('/api/gdrive/config');
        const data = await response.json();
        const dest = data.destinations.find(d => d.id === id);
        if (!dest) return;

        document.getElementById('googleDriveEditId').value = dest.id;
        document.getElementById('googleDriveName').value = dest.name;
        document.getElementById('googleDriveFolderPath').value = dest.config.folderPath || '/2FA-Backups';
        showGoogleDriveForm(id);
      } catch (error) {
        showCenterToast('❌', ((typeof t === 'function' ? t('remoteTargetSaveFailed', { error: error.message }) : null) || ('Failed to load config: ' + error.message)));
      }
    }

    async function _upsertGoogleDriveConfig() {
      const id = document.getElementById('googleDriveEditId').value;
      const name = document.getElementById('googleDriveName').value.trim();
      const folderPath = document.getElementById('googleDriveFolderPath').value.trim() || '/2FA-Backups';

      if (!name) {
        showCenterToast('⚠️', (typeof t === 'function' ? t('gdriveFillRequired') : null) || 'Please enter target name');
        return null;
      }

      const body = { name, folderPath };
      if (id) body.id = id;

      const response = await authenticatedFetch('/api/gdrive/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || (typeof t === 'function' ? t('saveFailed') : null) || 'Save failed');
      }

      if (data.warning) {
        showCenterToast('⚠️', data.warning);
      }

      return data;
    }

    async function saveGoogleDriveConfig() {
      const saveBtn = document.getElementById('googleDriveSaveBtn');
      const originalText = saveBtn.textContent;
      saveBtn.textContent = (typeof t === 'function' ? t('remoteSavingBtn') : null) || 'Saving...';
      saveBtn.disabled = true;

      try {
        const data = await _upsertGoogleDriveConfig();
        if (!data) return;

        showCenterToast('✅', (typeof t === 'function' ? t('saved') : null) || 'Google Drive configuration saved');
        loadGoogleDriveDestinations();
      } catch (error) {
        showCenterToast('❌', ((typeof t === 'function' ? t('remoteTargetSaveFailed', { error: error.message }) : null) || ('Save failed: ' + error.message)));
      } finally {
        saveBtn.textContent = originalText;
        saveBtn.disabled = false;
      }
    }

    async function authorizeGoogleDriveDest(id) {
      let targetId = id;
      const authBtn = document.getElementById('googleDriveAuthorizeBtn');
      const hadFormButton = !!authBtn;
      const originalText = hadFormButton ? authBtn.textContent : '';

      if (hadFormButton) {
        authBtn.textContent = (typeof t === 'function' ? t('remoteAuthorizingBtn') : null) || 'Preparing authorization...';
        authBtn.disabled = true;
      }

      try {
        if (!targetId) {
          const saved = await _upsertGoogleDriveConfig();
          if (!saved) return;
          targetId = saved.id;
        }

        const popup = window.open('about:blank', 'gdrive-oauth', 'width=560,height=720');

        const response = await authenticatedFetch('/api/gdrive/oauth/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: targetId })
        });
        const data = await response.json();

        if (!response.ok || !data.success || !data.authorizeUrl) {
          if (popup && !popup.closed) popup.close();
          throw new Error(data.message || (typeof t === 'function' ? t('remoteAuthFailed', { target: 'Google Drive' }) : null) || 'Failed to start authorization');
        }

        _googleDriveExpectedCallbackOrigin = _resolveGoogleDriveCallbackOrigin(data.callbackOrigin);

        if (popup) {
          popup.location.href = data.authorizeUrl;
        } else {
          window.location.href = data.authorizeUrl;
        }

        showCenterToast('ℹ️', (typeof t === 'function' ? t('remoteAuthPopupHint', { target: 'Google Drive' }) : null) || 'Please complete Google Drive authorization in the popup window');
        loadGoogleDriveDestinations();
      } catch (error) {
        _googleDriveExpectedCallbackOrigin = null;
        showCenterToast('❌', ((typeof t === 'function' ? t('remoteAuthFailed', { target: 'Google Drive' }) : null) || ('Authorization failed: ' + error.message)));
      } finally {
        if (hadFormButton) {
          authBtn.textContent = originalText;
          authBtn.disabled = false;
        }
      }
    }

    function _resolveGoogleDriveCallbackOrigin(callbackOrigin) {
      if (!callbackOrigin) return window.location.origin;
      try {
        return new URL(callbackOrigin).origin;
      } catch {
        return window.location.origin;
      }
    }

    async function deleteGoogleDriveDest(id, name) {
      const confirmed = await showConfirmDialog({
        title: (typeof t === 'function' ? t('remoteDeleteConfirmTitle', { target: 'Google Drive' }) : null) || 'Delete Google Drive Target',
        message: (typeof t === 'function' ? t('remoteDeleteConfirmMsg', { target: 'Google Drive', name: name }) : null) || ('Are you sure you want to delete Google Drive target "' + name + '"?\\nIt will no longer receive backup pushes.'),
        confirmText: (typeof t === 'function' ? t('delete') : null) || 'Delete',
        cancelText: (typeof t === 'function' ? t('cancel') : null) || 'Cancel',
        danger: true
      });
      if (!confirmed) {
        return;
      }

      try {
        const response = await authenticatedFetch('/api/gdrive/config?id=' + encodeURIComponent(id), {
          method: 'DELETE'
        });
        const data = await response.json();

        if (data.success) {
          showCenterToast('✅', (typeof t === 'function' ? t('remoteTargetDeleted', { target: 'Google Drive' }) : null) || 'Google Drive target deleted');
          loadGoogleDriveDestinations();
        } else {
          showCenterToast('❌', data.message || (typeof t === 'function' ? t('remoteTargetDeleteFailed', { error: '' }) : null) || 'Delete failed');
        }
      } catch (error) {
        showCenterToast('❌', ((typeof t === 'function' ? t('remoteTargetDeleteFailed', { error: error.message }) : null) || ('Delete failed: ' + error.message)));
      }
    }

    async function toggleGoogleDriveDest(id, enabled) {
      try {
        const response = await authenticatedFetch('/api/gdrive/toggle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, enabled })
        });
        const data = await response.json();

        if (data.success) {
          showCenterToast('✅', data.message);
        } else {
          showCenterToast('❌', data.message || (typeof t === 'function' ? t('operationFailed') : null) || 'Operation failed');
        }
        loadGoogleDriveDestinations();
      } catch (error) {
        showCenterToast('❌', (typeof t === 'function' ? t('operationFailed') : null) || ('Operation failed: ' + error.message));
        loadGoogleDriveDestinations();
      }
    }
`;
}
