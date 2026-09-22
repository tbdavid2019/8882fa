/**
 * WebDAV 同步工具模块
 * 提供多目标 WebDAV 配置管理 UI
 */

/**
 * 获取 WebDAV 工具代码
 * @returns {string} WebDAV 工具 JavaScript 代码
 */
export function getWebdavToolCode() {
	return `
    // ==================== WebDAV 同步工具（多目标） ====================

    let _webdavOnClose = null;

    function showWebdavModal(onClose) {
      _webdavOnClose = typeof onClose === 'function' ? onClose : null;
      showModal('webdavModal', () => {
        loadWebdavDestinations();
      });
    }

    function hideWebdavModal() {
      const onClose = _webdavOnClose;
      _webdavOnClose = null;
      hideModal('webdavModal', onClose);
    }

    async function loadWebdavDestinations() {
      const listEl = document.getElementById('webdavDestinationList');
      const addBtn = document.getElementById('webdavAddBtn');

      try {
        const response = await authenticatedFetch('/api/webdav/config');
        const data = await response.json();

        // 渲染目标列表
        if (data.destinations && data.destinations.length > 0) {
          listEl.innerHTML = data.destinations.map(dest => _renderWebdavCard(dest)).join('');
        } else {
          listEl.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-tertiary); font-size: var(--dialog-caption-size);">' + ((typeof t === 'function' ? t('webdavEmptyList') : null) || 'No WebDAV targets. Click button below to add') + '</div>';
        }

        // 达到上限时隐藏添加按钮
        addBtn.dataset.canAdd = data.count < data.maxAllowed ? 'true' : 'false';

        // 隐藏表单
        hideWebdavForm();
      } catch (error) {
        console.error('加载 WebDAV 配置失败:', error);
        listEl.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--danger-color); font-size: var(--dialog-caption-size);">' + ((typeof t === 'function' ? t('loadFailedRetry') : null) || 'Failed to load, please try again later') + '</div>';
      }
    }

    function _renderWebdavCard(dest) {
      let statusDot = 'dest-status-dot-gray';
      let statusText = (typeof t === 'function' ? t('syncStatusNotPushed') : null) || 'Not pushed';

      if (dest.status.lastError) {
        statusDot = 'dest-status-dot-red';
        statusText = ((typeof t === 'function' ? t('syncStatusFailedPrefix') : null) || 'Failed: ') + dest.status.lastError.error;
      } else if (dest.status.lastSuccess) {
        statusDot = 'dest-status-dot-green';
        statusText = new Date(dest.status.lastSuccess.timestamp).toLocaleString();
      }

      const enabledClass = dest.enabled ? '' : 'dest-card-disabled';

      return '<div class="dest-card ' + enabledClass + '" data-id="' + dest.id + '">'
        + '<div class="dest-card-header">'
        + '<div class="dest-card-info">'
        + '<span class="dest-card-name">' + _escapeHtml(dest.name) + '</span>'
        + '<span class="dest-card-url">' + _escapeHtml(dest.config.url) + '</span>'
        + '</div>'
        + '<label class="dest-toggle" onclick="event.stopPropagation()">'
        + '<input type="checkbox" aria-label="' + ((typeof t === 'function' ? t('enableSyncTargetAriaLabel') : null) || 'Enable this sync target') + '" ' + (dest.enabled ? 'checked' : '') + ' onchange="toggleWebdavDest(\\'' + dest.id + '\\', this.checked)" />'
        + '<span class="dest-toggle-slider"></span>'
        + '</label>'
        + '</div>'
        + '<div class="dest-card-status">'
        + '<span class="dest-status-dot ' + statusDot + '"></span>'
        + '<span class="dest-status-text">' + _escapeHtml(statusText) + '</span>'
        + '</div>'
        + '<div class="dest-card-actions">'
        + '<button class="btn btn-sm" onclick="event.stopPropagation(); editWebdavDest(\\'' + dest.id + '\\')" >' + ((typeof t === 'function' ? t('edit') : null) || 'Edit') + '</button>'
        + '<button class="btn btn-sm btn-danger-outline" onclick="event.stopPropagation(); deleteWebdavDest(\\'' + dest.id + '\\', \\'' + _escapeHtml(dest.name).replace(/'/g, "\\\\'") + '\\')" >' + ((typeof t === 'function' ? t('delete') : null) || 'Delete') + '</button>'
        + '</div>'
        + '</div>';
    }

    function _escapeHtml(str) {
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    }

    function showWebdavForm(id) {
      const formArea = document.getElementById('webdavFormArea');
      const addBtn = document.getElementById('webdavAddBtn');
      formArea.style.display = 'block';
      addBtn.style.display = 'none';

      if (!id) {
        // 新增模式：清空表单
        document.getElementById('webdavEditId').value = '';
        document.getElementById('webdavName').value = '';
        document.getElementById('webdavUrl').value = '';
        document.getElementById('webdavUsername').value = '';
        document.getElementById('webdavPassword').value = '';
        document.getElementById('webdavPassword').placeholder = (typeof t === 'function' ? t('remoteEnterPasswordPlaceholder') : null) || 'Enter password';
        document.getElementById('webdavPath').value = '/';
      }
    }

    function hideWebdavForm() {
      document.getElementById('webdavFormArea').style.display = 'none';
      const addBtn = document.getElementById('webdavAddBtn');
      addBtn.style.display = addBtn.dataset.canAdd === 'false' ? 'none' : 'block';
    }

    async function editWebdavDest(id) {
      try {
        const response = await authenticatedFetch('/api/webdav/config');
        const data = await response.json();
        const dest = data.destinations.find(d => d.id === id);
        if (!dest) return;

        document.getElementById('webdavEditId').value = dest.id;
        document.getElementById('webdavName').value = dest.name;
        document.getElementById('webdavUrl').value = dest.config.url;
        document.getElementById('webdavUsername').value = dest.config.username;
        document.getElementById('webdavPassword').value = '';
        document.getElementById('webdavPassword').placeholder = dest.config.hasPassword ? ((typeof t === 'function' ? t('remoteSavedPasswordKeepPlaceholder') : null) || 'Saved (leave blank to keep)') : ((typeof t === 'function' ? t('remoteEnterPasswordPlaceholder') : null) || 'Enter password');
        document.getElementById('webdavPath').value = dest.config.path || '/';

        showWebdavForm(id);
      } catch (error) {
        showCenterToast('❌', ((typeof t === 'function' ? t('remoteTargetSaveFailed', { error: error.message }) : null) || ('Failed to load config: ' + error.message)));
      }
    }

    async function saveWebdavConfig() {
      const id = document.getElementById('webdavEditId').value;
      const name = document.getElementById('webdavName').value.trim();
      const url = document.getElementById('webdavUrl').value.trim();
      const username = document.getElementById('webdavUsername').value.trim();
      const password = document.getElementById('webdavPassword').value;
      const path = document.getElementById('webdavPath').value.trim() || '/';

      if (!name || !url || !username) {
        showCenterToast('⚠️', (typeof t === 'function' ? t('webdavFillRequired') : null) || 'Please enter target name, server URL, and username');
        return;
      }

      const saveBtn = document.getElementById('webdavSaveBtn');
      const originalText = saveBtn.textContent;
      saveBtn.textContent = (typeof t === 'function' ? t('remoteSavingBtn') : null) || 'Saving...';
      saveBtn.disabled = true;

      try {
        const body = { name, url, username, password, path };
        if (id) body.id = id;

        const response = await authenticatedFetch('/api/webdav/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        const data = await response.json();

        if (data.success) {
          if (data.warning) {
            showCenterToast('⚠️', data.warning);
          } else {
            showCenterToast('✅', (typeof t === 'function' ? t('webdavSaved') : null) || 'WebDAV configuration saved');
          }
          loadWebdavDestinations();
        } else {
          showCenterToast('❌', data.message || (typeof t === 'function' ? t('saveFailed') : null) || 'Save failed');
        }
      } catch (error) {
        showCenterToast('❌', ((typeof t === 'function' ? t('remoteTargetSaveFailed', { error: error.message }) : null) || ('Save failed: ' + error.message)));
      } finally {
        saveBtn.textContent = originalText;
        saveBtn.disabled = false;
      }
    }

    async function testWebdavConnection() {
      const id = document.getElementById('webdavEditId').value;
      const name = document.getElementById('webdavName').value.trim();
      const url = document.getElementById('webdavUrl').value.trim();
      const username = document.getElementById('webdavUsername').value.trim();
      const password = document.getElementById('webdavPassword').value;
      const path = document.getElementById('webdavPath').value.trim() || '/';

      if (!name || !url || !username) {
        showCenterToast('⚠️', (typeof t === 'function' ? t('webdavFillRequired') : null) || 'Please enter target name, server URL, and username');
        return;
      }

      const testBtn = document.getElementById('webdavTestBtn');
      const originalText = testBtn.textContent;
      testBtn.textContent = (typeof t === 'function' ? t('remoteTestingBtn') : null) || 'Testing...';
      testBtn.disabled = true;

      try {
        const body = { name, url, username, password, path };
        if (id) body.id = id;

        const response = await authenticatedFetch('/api/webdav/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        const data = await response.json();

        if (data.success) {
          showCenterToast('✅', data.message || (typeof t === 'function' ? t('remoteTestSuccess') : null) || 'Connection successful');
        } else {
          showCenterToast('❌', data.message || (typeof t === 'function' ? t('remoteTestFailed') : null) || 'Connection failed');
        }
      } catch (error) {
        showCenterToast('❌', (typeof t === 'function' ? t('remoteTestFailed') : null) || ('Test failed: ' + error.message));
      } finally {
        testBtn.textContent = originalText;
        testBtn.disabled = false;
      }
    }

    async function deleteWebdavDest(id, name) {
      const confirmed = await showConfirmDialog({
        title: (typeof t === 'function' ? t('remoteDeleteConfirmTitle', { target: 'WebDAV' }) : null) || 'Delete WebDAV Target',
        message: (typeof t === 'function' ? t('remoteDeleteConfirmMsg', { target: 'WebDAV', name: name }) : null) || ('Are you sure you want to delete WebDAV target "' + name + '"?\\nIt will no longer receive backup pushes.'),
        confirmText: (typeof t === 'function' ? t('delete') : null) || 'Delete',
        cancelText: (typeof t === 'function' ? t('cancel') : null) || 'Cancel',
        danger: true
      });
      if (!confirmed) {
        return;
      }

      try {
        const response = await authenticatedFetch('/api/webdav/config?id=' + encodeURIComponent(id), {
          method: 'DELETE'
        });
        const data = await response.json();

        if (data.success) {
          showCenterToast('✅', (typeof t === 'function' ? t('remoteTargetDeleted', { target: 'WebDAV' }) : null) || 'WebDAV target deleted');
          loadWebdavDestinations();
        } else {
          showCenterToast('❌', data.message || (typeof t === 'function' ? t('remoteTargetDeleteFailed', { error: '' }) : null) || 'Delete failed');
        }
      } catch (error) {
        showCenterToast('❌', ((typeof t === 'function' ? t('remoteTargetDeleteFailed', { error: error.message }) : null) || ('Delete failed: ' + error.message)));
      }
    }

    async function toggleWebdavDest(id, enabled) {
      try {
        const response = await authenticatedFetch('/api/webdav/toggle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, enabled })
        });
        const data = await response.json();

        if (data.success) {
          showCenterToast('✅', data.message);
          loadWebdavDestinations();
        } else {
          showCenterToast('❌', data.message || (typeof t === 'function' ? t('operationFailed') : null) || 'Operation failed');
          loadWebdavDestinations();
        }
      } catch (error) {
        showCenterToast('❌', (typeof t === 'function' ? t('operationFailed') : null) || ('Operation failed: ' + error.message));
        loadWebdavDestinations();
      }
    }

`;
}
