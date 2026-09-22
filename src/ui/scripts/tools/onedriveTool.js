/**
 * OneDrive sync tool UI module.
 */

export function getOneDriveToolCode() {
	return `
    // ==================== OneDrive 同步工具 ====================

    let _oneDriveOnClose = null;
    let _oneDriveOAuthListenerReady = false;
    let _oneDriveExpectedCallbackOrigin = null;

    function showOneDriveModal(onClose) {
      _oneDriveOnClose = typeof onClose === 'function' ? onClose : null;
      _ensureOneDriveOAuthListener();
      showModal('oneDriveModal', () => {
        loadOneDriveDestinations();
      });
    }

    function hideOneDriveModal() {
      const onClose = _oneDriveOnClose;
      _oneDriveOnClose = null;
      hideModal('oneDriveModal', onClose);
    }

    function _ensureOneDriveOAuthListener() {
      if (_oneDriveOAuthListenerReady) return;
      _oneDriveOAuthListenerReady = true;

      window.addEventListener('message', function(event) {
        const allowedOrigins = [window.location.origin];
        if (_oneDriveExpectedCallbackOrigin) {
          allowedOrigins.push(_oneDriveExpectedCallbackOrigin);
        }
        if (!allowedOrigins.includes(event.origin)) return;
        const data = event.data || {};
        if (data.type !== 'cloudBackupAuthComplete' || data.provider !== 'onedrive') return;

        _oneDriveExpectedCallbackOrigin = null;
        loadOneDriveDestinations();
        const icon = data.severity === 'warning' ? '⚠️' : (data.success ? '✅' : '❌');
        showCenterToast(icon, data.message || (data.success ? ((typeof t === 'function' ? t('syncOnedriveAuthSuccess') : null) || 'OneDrive authorized successfully') : ((typeof t === 'function' ? t('syncOnedriveAuthFailed') : null) || 'OneDrive authorization failed')));
      });
    }

    function _escapeOneDriveHtml(str) {
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    }

    async function loadOneDriveDestinations() {
      const listEl = document.getElementById('oneDriveDestinationList');
      const addBtn = document.getElementById('oneDriveAddBtn');
      const warningEl = document.getElementById('oneDriveOauthWarning');

      try {
        const response = await authenticatedFetch('/api/onedrive/config');
        const data = await response.json();

        if (warningEl) {
          if (data.oauthConfigured) {
            warningEl.style.display = 'none';
          } else {
            warningEl.style.display = 'block';
            warningEl.textContent = (typeof t === 'function' ? t('remoteMissingCredentialsWarning', { target: 'OneDrive' }) : null) || 'Server has not configured OneDrive OAuth credentials. You can still view and edit targets, but authorization is not available yet.';
          }
        }

        if (data.destinations && data.destinations.length > 0) {
          listEl.innerHTML = data.destinations.map(dest => _renderOneDriveCard(dest)).join('');
        } else {
          listEl.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-tertiary); font-size: var(--dialog-caption-size);">' + ((typeof t === 'function' ? t('oneDriveEmptyList') : null) || 'No OneDrive targets yet. Click button below to add.') + '</div>';
        }

        const canAdd = data.count < data.maxAllowed;
        addBtn.dataset.canAdd = canAdd ? 'true' : 'false';
        addBtn.style.display = canAdd ? 'block' : 'none';
        hideOneDriveForm();
      } catch (error) {
        console.error('Failed to load OneDrive config:', error);
        listEl.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--danger-color); font-size: var(--dialog-caption-size);">' + ((typeof t === 'function' ? t('loadFailedRetry') : null) || 'Failed to load, please try again later') + '</div>';
      }
    }

    function _renderOneDriveCard(dest) {
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
        ? ((dest.account.displayName || 'OneDrive Account') + (dest.account.email ? ' · ' + dest.account.email : ''))
        : ((typeof t === 'function' ? t('syncStatusNotConfigured') : null) || 'Not authorized');

      return '<div class="dest-card ' + enabledClass + '" data-id="' + dest.id + '">'
        + '<div class="dest-card-header">'
        + '<div class="dest-card-info">'
        + '<span class="dest-card-name">' + _escapeOneDriveHtml(dest.name) + '</span>'
        + '<span class="dest-card-url">' + _escapeOneDriveHtml(accountText) + '</span>'
        + '<span class="dest-card-url">' + ((typeof t === 'function' ? t('onedriveAppDir') : null) || 'App Directory: ') + _escapeOneDriveHtml(dest.config.folderPath || '/2FA-Backups') + '</span>'
        + '</div>'
        + '<label class="dest-toggle" onclick="event.stopPropagation()">'
        + '<input type="checkbox" aria-label="' + ((typeof t === 'function' ? t('enableSyncTargetAriaLabel') : null) || 'Enable this sync target') + '" ' + (dest.enabled ? 'checked' : '') + ' ' + (!dest.authorized ? 'disabled ' : '') + 'onchange="toggleOneDriveDest(\\'' + dest.id + '\\', this.checked)" />'
        + '<span class="dest-toggle-slider"></span>'
        + '</label>'
        + '</div>'
        + '<div class="dest-card-status">'
        + '<span class="dest-status-dot ' + statusDot + '"></span>'
        + '<span class="dest-status-text">' + _escapeOneDriveHtml(statusText) + '</span>'
        + '</div>'
        + '<div class="dest-card-actions">'
        + '<button class="btn btn-sm btn-info" onclick="event.stopPropagation(); authorizeOneDriveDest(\\'' + dest.id + '\\')" >' + (dest.authorized ? ((typeof t === 'function' ? t('reauthorize') : null) || 'Reauthorize') : ((typeof t === 'function' ? t('authorize') : null) || 'Authorize')) + '</button>'
        + '<button class="btn btn-sm" onclick="event.stopPropagation(); editOneDriveDest(\\'' + dest.id + '\\')" >' + ((typeof t === 'function' ? t('edit') : null) || 'Edit') + '</button>'
        + '<button class="btn btn-sm btn-danger-outline" onclick="event.stopPropagation(); deleteOneDriveDest(\\'' + dest.id + '\\', \\'' + _escapeOneDriveHtml(dest.name).replace(/'/g, "\\\\'") + '\\')" >' + ((typeof t === 'function' ? t('delete') : null) || 'Delete') + '</button>'
        + '</div>'
        + '</div>';
    }

    function showOneDriveForm(id) {
      const formArea = document.getElementById('oneDriveFormArea');
      const addBtn = document.getElementById('oneDriveAddBtn');
      formArea.style.display = 'block';
      addBtn.style.display = 'none';

      if (!id) {
        document.getElementById('oneDriveEditId').value = '';
        document.getElementById('oneDriveName').value = '';
        document.getElementById('oneDriveFolderPath').value = '/2FA-Backups';
      }
    }

    function hideOneDriveForm() {
      document.getElementById('oneDriveFormArea').style.display = 'none';
      const addBtn = document.getElementById('oneDriveAddBtn');
      if (addBtn && addBtn.dataset.canAdd !== 'false') {
        addBtn.style.display = 'block';
      }
    }

    async function editOneDriveDest(id) {
      try {
        const response = await authenticatedFetch('/api/onedrive/config');
        const data = await response.json();
        const dest = data.destinations.find(d => d.id === id);
        if (!dest) return;

        document.getElementById('oneDriveEditId').value = dest.id;
        document.getElementById('oneDriveName').value = dest.name;
        document.getElementById('oneDriveFolderPath').value = dest.config.folderPath || '/2FA-Backups';
        showOneDriveForm(id);
      } catch (error) {
        showCenterToast('❌', ((typeof t === 'function' ? t('remoteTargetSaveFailed', { error: error.message }) : null) || ('Failed to load config: ' + error.message)));
      }
    }

    async function _upsertOneDriveConfig() {
      const id = document.getElementById('oneDriveEditId').value;
      const name = document.getElementById('oneDriveName').value.trim();
      const folderPath = document.getElementById('oneDriveFolderPath').value.trim() || '/2FA-Backups';

      if (!name) {
        showCenterToast('⚠️', (typeof t === 'function' ? t('onedriveFillRequired') : null) || 'Please enter target name');
        return null;
      }

      const body = { name, folderPath };
      if (id) body.id = id;

      const response = await authenticatedFetch('/api/onedrive/config', {
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

    async function saveOneDriveConfig() {
      const saveBtn = document.getElementById('oneDriveSaveBtn');
      const originalText = saveBtn.textContent;
      saveBtn.textContent = (typeof t === 'function' ? t('remoteSavingBtn') : null) || 'Saving...';
      saveBtn.disabled = true;

      try {
        const data = await _upsertOneDriveConfig();
        if (!data) return;

        showCenterToast('✅', (typeof t === 'function' ? t('saved') : null) || 'OneDrive configuration saved');
        loadOneDriveDestinations();
      } catch (error) {
        showCenterToast('❌', ((typeof t === 'function' ? t('remoteTargetSaveFailed', { error: error.message }) : null) || ('Save failed: ' + error.message)));
      } finally {
        saveBtn.textContent = originalText;
        saveBtn.disabled = false;
      }
    }

    async function authorizeOneDriveDest(id) {
      let targetId = id;
      const authBtn = document.getElementById('oneDriveAuthorizeBtn');
      const hadFormButton = !!authBtn;
      const originalText = hadFormButton ? authBtn.textContent : '';

      if (hadFormButton) {
        authBtn.textContent = (typeof t === 'function' ? t('remoteAuthorizingBtn') : null) || 'Preparing authorization...';
        authBtn.disabled = true;
      }

      try {
        if (!targetId) {
          const saved = await _upsertOneDriveConfig();
          if (!saved) return;
          targetId = saved.id;
        }

        const popup = window.open('about:blank', 'onedrive-oauth', 'width=560,height=720');

        const response = await authenticatedFetch('/api/onedrive/oauth/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: targetId })
        });
        const data = await response.json();

        if (!response.ok || !data.success || !data.authorizeUrl) {
          if (popup && !popup.closed) popup.close();
          throw new Error(data.message || (typeof t === 'function' ? t('remoteAuthFailed', { target: 'OneDrive' }) : null) || 'Failed to start authorization');
        }

        _oneDriveExpectedCallbackOrigin = _resolveOneDriveCallbackOrigin(data.callbackOrigin);

        if (popup) {
          popup.location.href = data.authorizeUrl;
        } else {
          window.location.href = data.authorizeUrl;
        }

        showCenterToast('ℹ️', (typeof t === 'function' ? t('remoteAuthPopupHint', { target: 'OneDrive' }) : null) || 'Please complete OneDrive authorization in the popup window');
        loadOneDriveDestinations();
      } catch (error) {
        _oneDriveExpectedCallbackOrigin = null;
        showCenterToast('❌', ((typeof t === 'function' ? t('remoteAuthFailed', { target: 'OneDrive' }) : null) || ('Authorization failed: ' + error.message)));
      } finally {
        if (hadFormButton) {
          authBtn.textContent = originalText;
          authBtn.disabled = false;
        }
      }
    }

    function _resolveOneDriveCallbackOrigin(callbackOrigin) {
      if (!callbackOrigin) return window.location.origin;
      try {
        return new URL(callbackOrigin).origin;
      } catch {
        return window.location.origin;
      }
    }

    async function deleteOneDriveDest(id, name) {
      const confirmed = await showConfirmDialog({
        title: (typeof t === 'function' ? t('remoteDeleteConfirmTitle', { target: 'OneDrive' }) : null) || 'Delete OneDrive Target',
        message: (typeof t === 'function' ? t('remoteDeleteConfirmMsg', { target: 'OneDrive', name: name }) : null) || ('Are you sure you want to delete OneDrive target "' + name + '"?\\nIt will no longer receive backup pushes.'),
        confirmText: (typeof t === 'function' ? t('delete') : null) || 'Delete',
        cancelText: (typeof t === 'function' ? t('cancel') : null) || 'Cancel',
        danger: true
      });
      if (!confirmed) {
        return;
      }

      try {
        const response = await authenticatedFetch('/api/onedrive/config?id=' + encodeURIComponent(id), {
          method: 'DELETE'
        });
        const data = await response.json();

        if (data.success) {
          showCenterToast('✅', (typeof t === 'function' ? t('remoteTargetDeleted', { target: 'OneDrive' }) : null) || 'OneDrive target deleted');
          loadOneDriveDestinations();
        } else {
          showCenterToast('❌', data.message || (typeof t === 'function' ? t('remoteTargetDeleteFailed', { error: '' }) : null) || 'Delete failed');
        }
      } catch (error) {
        showCenterToast('❌', ((typeof t === 'function' ? t('remoteTargetDeleteFailed', { error: error.message }) : null) || ('Delete failed: ' + error.message)));
      }
    }

    async function toggleOneDriveDest(id, enabled) {
      try {
        const response = await authenticatedFetch('/api/onedrive/toggle', {
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
        loadOneDriveDestinations();
      } catch (error) {
        showCenterToast('❌', (typeof t === 'function' ? t('operationFailed') : null) || ('Operation failed: ' + error.message));
        loadOneDriveDestinations();
      }
    }
`;
}
