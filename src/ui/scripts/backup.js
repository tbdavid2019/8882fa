import { LIMITS } from '../../utils/constants.js';

/**
 * 備份模組
 * 包含所有備份/恢復功能，用於管理金鑰備份
 */

/**
 * 獲取備份相關程式碼
 * @returns {string} 備份 JavaScript 程式碼
 */
export function getBackupCode() {
	return `    // ========== 備份恢復功能模組 ==========

    function getSavedDefaultBackupExportFormat() {
      return getCachedDefaultExportFormat();
    }

    function getBackupExportFormatLabel(format) {
      const labels = {
        txt: 'TXT',
        json: 'JSON',
        csv: 'CSV',
        html: 'HTML'
      };
      return labels[format] || format.toUpperCase();
    }

    function getBackupStoredFormat(backup) {
      const format = backup && backup.format ? String(backup.format).trim().toLowerCase() : 'json';
      return ['txt', 'json', 'csv', 'html'].includes(format) ? format : 'json';
    }

    function updateBackupDefaultExportButton(format = getSavedDefaultBackupExportFormat()) {
      const defaultBtn = document.getElementById('backupUseDefaultBtn');
      if (!defaultBtn) {
        return;
      }

      defaultBtn.textContent = (typeof t === 'function' ? t('backupExportDefaultFormatBtn', { format: getBackupExportFormatLabel(format) }) : null) || ('Export in default format (' + getBackupExportFormatLabel(format) + ')');
      defaultBtn.disabled = false;
    }

    // 還原配置相關函式
    async function syncBackupDefaultExportButton() {
      updateBackupDefaultExportButton();
      const format = await getServerDefaultExportFormat({ forceRefresh: true });
      updateBackupDefaultExportButton(format);
      return format;
    }

    let selectedBackup = null;
    let backupList = [];
    let backupListCursor = null;
    let backupListHasMore = false;
    let backupListLoading = false;
    let backupPreviewRequestToken = 0;
    const BACKUP_LIST_PAGE_SIZE = 50;
    const BACKUP_UPLOAD_MAX_BYTES = ${LIMITS.MAX_EXPORT_SIZE};
    const BACKUP_UPLOAD_FILE_REGEX = /^backup_\\d{4}-\\d{2}-\\d{2}(?:_[\\w-]+)?\\.(?:json|txt|csv|html)$/i;
    let backupExportFormat = 'txt'; // 备份导出格式

    function isActiveBackupPreviewRequest(backup, requestToken) {
      return requestToken === backupPreviewRequestToken && selectedBackup && selectedBackup.key === backup.key;
    }

    function formatBackupUploadSize(bytes) {
      if (!Number.isFinite(bytes) || bytes <= 0) {
        return '0 B';
      }
      if (bytes >= 1024 * 1024) {
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
      }
      if (bytes >= 1024) {
        return Math.ceil(bytes / 1024) + ' KB';
      }
      return bytes + ' B';
    }

    function getBackupFormatFromFileName(fileName) {
      const match = String(fileName || '').match(/\\.(json|txt|csv|html)$/i);
      return match ? match[1].toLowerCase() : 'json';
    }

    function setRestoreUploadStatus(message, isError) {
      const status = document.getElementById('restoreUploadStatus');
      if (!status) {
        return;
      }
      status.style.display = message ? 'block' : 'none';
      status.textContent = message || '';
      status.style.color = isError ? 'var(--dialog-danger)' : 'var(--text-secondary)';
    }

    function resetRestoreUploadInput() {
      const fileInput = document.getElementById('restoreBackupFileInput');
      if (fileInput) {
        fileInput.value = '';
      }
      setRestoreUploadStatus('', false);
    }

    function readRestoreBackupFile(file) {
      if (file && typeof file.text === 'function') {
        return file.text();
      }

      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
        reader.readAsText(file);
      });
    }

    function showRestorePreviewMessage(message, className) {
      const previewElement = document.getElementById('restorePreview');
      const previewContent = document.getElementById('backupPreviewContent');
      if (!previewElement || !previewContent) {
        return;
      }
      previewElement.style.display = 'block';
      previewContent.innerHTML = '<div class="' + (className || 'loading-backup') + '">' + escapeHTML(message) + '</div>';
    }

    function resetBackupSelection() {
      backupPreviewRequestToken += 1;
      selectedBackup = null;
      resetRestoreUploadInput();

      const confirmRestoreBtn = document.getElementById('confirmRestoreBtn');
      if (confirmRestoreBtn) {
        confirmRestoreBtn.disabled = true;
        confirmRestoreBtn.title = '';
      }

      const exportBackupBtn = document.getElementById('exportBackupBtn');
      if (exportBackupBtn) {
        exportBackupBtn.disabled = true;
        exportBackupBtn.title = '';
      }

      const previewElement = document.getElementById('restorePreview');
      if (previewElement) {
        previewElement.style.display = 'none';
      }
    }

    function updateBackupListPagination() {
      const statusElement = document.getElementById('backupListStatus');
      const loadMoreBtn = document.getElementById('backupLoadMoreBtn');

      if (statusElement) {
        if (backupList.length === 0) {
          statusElement.textContent = '';
        } else if (backupListHasMore) {
          statusElement.textContent = (typeof t === 'function' ? t('backupStatusPartial', { count: backupList.length }) : null) || ('Loaded ' + backupList.length + ' backups. Click to load older records');
        } else {
          statusElement.textContent = (typeof t === 'function' ? t('backupStatusAll', { count: backupList.length }) : null) || ('Loaded all ' + backupList.length + ' backups');
        }
      }

      if (loadMoreBtn) {
        const shouldShow = backupList.length > 0 && (backupListHasMore || backupListLoading);
        loadMoreBtn.style.display = shouldShow ? '' : 'none';
        loadMoreBtn.disabled = backupListLoading || !backupListHasMore;
        loadMoreBtn.textContent = backupListLoading
          ? ((typeof t === 'function' ? t('backupLoadingMore') : null) || 'Loading...')
          : ((typeof t === 'function' ? t('backupLoadMore') : null) || 'Load More');
      }
    }

    function showRestoreModal() {
      showModal('restoreModal', () => {
        loadBackupList();
      });
    }

    function hideRestoreModal() {
      hideModal('restoreModal', () => {
        backupListCursor = null;
        backupListHasMore = false;
        backupListLoading = false;
        resetBackupSelection();
        updateBackupListPagination();
      });
    }

    async function loadBackupList() {
      return loadBackupListPage();
    }

    async function loadMoreBackupList() {
      if (!backupListHasMore || !backupListCursor || backupListLoading) {
        return;
      }

      return loadBackupListPage({ append: true });
    }

    async function loadBackupListPage(options = {}) {
      const append = options.append === true;
      const backupSelectElement = document.getElementById('backupSelect');
      const selectedBackupKey = selectedBackup ? selectedBackup.key : '';

      if (!backupSelectElement || backupListLoading) {
        return;
      }

      if (!append) {
        backupList = [];
        backupListCursor = null;
        backupListHasMore = false;
        backupSelectElement.innerHTML = '<option value="">' + ((typeof t === 'function' ? t('backupLoadingList') : null) || 'Loading backup list...') + '</option>';
        backupSelectElement.disabled = true;
      }

      backupListLoading = true;
      updateBackupListPagination();

      try {
        const params = new URLSearchParams({ limit: String(BACKUP_LIST_PAGE_SIZE) });
        if (append && backupListCursor) {
          params.set('cursor', backupListCursor);
        }

        const response = await authenticatedFetch('/api/backup?' + params.toString());
        if (!response.ok) {
          throw new Error('Failed to load backup list');
        }

        const data = await response.json();
        const nextBackups = data.backups || [];
        backupList = append ? backupList.concat(nextBackups) : nextBackups;
        backupListCursor = data.pagination && data.pagination.hasMore ? data.pagination.cursor : null;
        backupListHasMore = Boolean(data.pagination && data.pagination.hasMore && data.pagination.cursor);

        if (backupList.length === 0) {
          backupSelectElement.innerHTML = '<option value="">' + ((typeof t === 'function' ? t('backupEmptyList') : null) || 'No backup files') + '</option>';
          backupSelectElement.disabled = true;
          resetBackupSelection();
          updateBackupListPagination();
          return;
        }

        renderBackupSelect(backupList, selectedBackupKey);
        backupSelectElement.disabled = false;

        if (selectedBackupKey) {
          const refreshedSelectedBackup = backupList.find(item => item.key === selectedBackupKey);
          if (refreshedSelectedBackup) {
            selectedBackup = refreshedSelectedBackup;
          } else if (!append) {
            resetBackupSelection();
          }
        }

        updateBackupListPagination();
      } catch (error) {
        console.error('加载备份列表失败:', error);

        if (!append) {
          backupSelectElement.innerHTML = '<option value="">' + ((typeof t === 'function' ? t('backupLoadFailed', { error: escapeHTML(error.message) }) : null) || ('Failed to load backup list: ' + escapeHTML(error.message))) + '</option>';
          backupSelectElement.disabled = true;
          resetBackupSelection();
        } else {
          showCenterToast('❌', (typeof t === 'function' ? t('backupLoadMoreFailed', { error: error.message }) : null) || ('Failed to load more backups: ' + error.message));
        }
      } finally {
        backupListLoading = false;
        updateBackupListPagination();
      }
    }

    function renderBackupSelect(backups, selectedBackupKey = '') {
      const backupSelectElement = document.getElementById('backupSelect');
      backupSelectElement.innerHTML = '<option value="">' + ((typeof t === 'function' ? t('restoreSelectPlaceholder') : null) || 'Please select a backup file...') + '</option>';

      backups.forEach((backup, index) => {
        // 格式化日期為簡潔格式，適配移動裝置
        const date = new Date(backup.created);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        
        const backupTime = year + '-' + month + '-' + day + ' ' + hours + ':' + minutes;
        const formatLabel = getBackupExportFormatLabel(getBackupStoredFormat(backup));
        const optionText = backupTime + ' | ' + formatLabel + ' | ' + (backup.count || 0) + ' ' + ((typeof t === 'function' ? t('backupKeysUnit') : null) || 'keys');

        const option = document.createElement('option');
        option.value = index;
        option.textContent = optionText;
        option.dataset.backupKey = backup.key;
        // 儲存完整時間資訊在 title 屬性中，用於懸停提示
        option.title = new Date(backup.created).toLocaleString() + ' | ' + formatLabel;
        option.selected = selectedBackupKey === backup.key;

        backupSelectElement.appendChild(option);
      });
    }

    function selectBackupFromDropdown() {
      const backupSelectElement = document.getElementById('backupSelect');
      const selectedIndex = backupSelectElement.value;

      if (selectedIndex === '' || selectedIndex === null) {
        resetBackupSelection();
        return;
      }

      const backup = backupList[parseInt(selectedIndex)];
      if (backup) {
        resetRestoreUploadInput();
        selectBackup(backup, parseInt(selectedIndex));
      }
    }

    async function handleRestoreBackupFile(event) {
      const file = event && event.target && event.target.files ? event.target.files[0] : null;
      if (!file) {
        return;
      }

      const fileName = file.name || '';
      const requestToken = ++backupPreviewRequestToken;
      const backupSelectElement = document.getElementById('backupSelect');
      const confirmRestoreBtn = document.getElementById('confirmRestoreBtn');
      const exportBackupBtn = document.getElementById('exportBackupBtn');

      selectedBackup = null;
      if (backupSelectElement) {
        backupSelectElement.value = '';
      }
      if (confirmRestoreBtn) {
        confirmRestoreBtn.disabled = true;
        confirmRestoreBtn.title = (typeof t === 'function' ? t('backupReadingUploaded') : null) || 'Reading uploaded backup file...';
      }
      if (exportBackupBtn) {
        exportBackupBtn.disabled = true;
        exportBackupBtn.title = (typeof t === 'function' ? t('backupUploadedNoReexport') : null) || 'Uploaded backup files do not need to be exported again';
      }

      if (!BACKUP_UPLOAD_FILE_REGEX.test(fileName)) {
        setRestoreUploadStatus((typeof t === 'function' ? t('backupInvalidFileNameFormat') : null) || 'Invalid backup file name format. Please choose a backup_*.(json|txt|csv|html) file.', true);
        showRestorePreviewMessage((typeof t === 'function' ? t('backupInvalidFileNameFormatShort') : null) || 'Unable to read uploaded file: invalid file name format', 'no-backups');
        return;
      }

      if (file.size > BACKUP_UPLOAD_MAX_BYTES) {
        const maxLabel = formatBackupUploadSize(BACKUP_UPLOAD_MAX_BYTES);
        setRestoreUploadStatus((typeof t === 'function' ? t('backupFileTooLargeWithMax', { max: maxLabel }) : null) || ('Backup file is too large, maximum supported is ' + maxLabel + '.'), true);
        showRestorePreviewMessage((typeof t === 'function' ? t('backupFileTooLargeShort', { max: maxLabel }) : null) || ('Unable to read uploaded file: file size exceeds ' + maxLabel), 'no-backups');
        return;
      }

      setRestoreUploadStatus(((typeof t === 'function' ? t('backupReadingFile') : null) || 'Reading uploaded file: ') + fileName + ' (' + formatBackupUploadSize(file.size) + ')', false);
      showRestorePreviewMessage((typeof t === 'function' ? t('backupReadingUploaded') : null) || 'Reading uploaded backup file...', 'loading-backup');

      try {
        const content = await readRestoreBackupFile(file);
        if (requestToken !== backupPreviewRequestToken) {
          return;
        }
        if (!content) {
          throw new Error('Backup file content is empty');
        }

        const uploadedBackup = {
          key: fileName,
          created: new Date().toISOString(),
          count: 0,
          format: getBackupFormatFromFileName(fileName),
          uploaded: true,
          content
        };
        selectedBackup = uploadedBackup;
        setRestoreUploadStatus(((typeof t === 'function' ? t('backupSelectedFile') : null) || 'Selected uploaded file: ') + fileName + ' (' + formatBackupUploadSize(file.size) + ')', false);
        await showBackupPreview(uploadedBackup, requestToken);
      } catch (error) {
        if (requestToken !== backupPreviewRequestToken) {
          return;
        }
        console.error('读取上传备份文件失败:', error);
        selectedBackup = null;
        if (confirmRestoreBtn) {
          confirmRestoreBtn.disabled = true;
          confirmRestoreBtn.title = (typeof t === 'function' ? t('backupReadFailedCannotRestore') : null) || 'Failed to read uploaded file, unable to restore';
        }
        setRestoreUploadStatus(((typeof t === 'function' ? t('backupReadUploadFailed') : null) || 'Failed to read uploaded backup file: ') + error.message, true);
        showRestorePreviewMessage(((typeof t === 'function' ? t('backupReadUploadFailed') : null) || 'Failed to read uploaded backup file: ') + error.message, 'no-backups');
      }
    }

    async function selectBackup(backup, index) {
      selectedBackup = backup;
      const requestToken = ++backupPreviewRequestToken;
      const confirmRestoreBtn = document.getElementById('confirmRestoreBtn');
      const exportBackupBtn = document.getElementById('exportBackupBtn');

      if (confirmRestoreBtn) {
        confirmRestoreBtn.disabled = true;
        confirmRestoreBtn.title = (typeof t === 'function' ? t('backupLoadingPreview') : null) || 'Loading backup preview...';
      }
      if (exportBackupBtn) {
        exportBackupBtn.disabled = true;
        exportBackupBtn.title = (typeof t === 'function' ? t('backupLoadingPreview') : null) || 'Loading backup preview...';
      }

      // 顯示備份預覽
      await showBackupPreview(backup, requestToken);
    }

    async function showBackupPreview(backup, requestToken) {
      const previewElement = document.getElementById('restorePreview');
      const previewContent = document.getElementById('backupPreviewContent');
      const confirmRestoreBtn = document.getElementById('confirmRestoreBtn');
      const exportBackupBtn = document.getElementById('exportBackupBtn');

      previewElement.style.display = 'block';
      previewContent.innerHTML = '<div class="loading-backup">' + ((typeof t === 'function' ? t('backupLoadingContent') : null) || 'Loading backup contents...') + '</div>';

      try {
        const isUploadedBackup = backup && backup.uploaded === true;
        const requestBody = isUploadedBackup
          ? { backupFileName: backup.key, backupContent: backup.content, preview: true }
          : { backupKey: backup.key, preview: true };
        const response = await authenticatedFetch('/api/backup/restore', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        });

        if (!isActiveBackupPreviewRequest(backup, requestToken)) {
          return;
        }

        if (!response.ok) {
          const errorData = await response.json();
          if (!isActiveBackupPreviewRequest(backup, requestToken)) {
            return;
          }
          throw new Error(errorData.message || errorData.error || 'Failed to retrieve backup content');
        }

        const responseData = await response.json();
        if (!isActiveBackupPreviewRequest(backup, requestToken)) {
          return;
        }
        const data = responseData.data || responseData; // 兼容不同的响应格式

        const formatLabel = getBackupExportFormatLabel(getBackupStoredFormat({ format: data.format || backup.format }));
        const sourceLabel = isUploadedBackup
          ? ((typeof t === 'function' ? t('backupSourceUploaded') : null) || 'Uploaded File')
          : ((typeof t === 'function' ? t('backupSourceKv') : null) || 'KV Backup');
        const encryptedLabel = data.encrypted
          ? ((typeof t === 'function' ? t('backupEncrypted') : null) || 'Encrypted')
          : ((typeof t === 'function' ? t('backupPlaintext') : null) || 'Plaintext');
        const skippedInvalidCount = Number(data.skippedInvalidCount || 0);
        const isPartialBackup = data.partial === true || skippedInvalidCount > 0;
        const hasSecrets = Array.isArray(data.secrets) && data.secrets.length > 0;
        const isEmptyBackup = !isPartialBackup && !hasSecrets && Number(data.count || 0) === 0;
        const warningMessage =
          Array.isArray(data.warnings) && data.warnings.length > 0
            ? data.warnings[0]
            : (isPartialBackup ? ((typeof t === 'function' ? t('backupPartialWarning') : null) || 'This backup is incomplete; data integrity cannot be guaranteed.') : '');
        const emptyBackupMessage = isEmptyBackup ? ((typeof t === 'function' ? t('backupEmptyWarning') : null) || 'This backup contains no recoverable keys. Recovery is blocked.') : '';
        const previewSummary =
          '<dl class="dialog-backup-summary">' +
            '<div>' +
              '<dt>' + ((typeof t === 'function' ? t('backupFormatField') : null) || 'Backup Format') + '</dt>' +
              '<dd>' + escapeHTML(formatLabel) + '</dd>' +
            '</div>' +
            '<div>' +
              '<dt>' + ((typeof t === 'function' ? t('backupEntriesField') : null) || 'Backup Entries') + '</dt>' +
              '<dd>' + (data.count || 0) + ' ' + ((typeof t === 'function' ? t('backupKeysUnit') : null) || 'keys') + '</dd>' +
            '</div>' +
            '<div>' +
              '<dt>' + ((typeof t === 'function' ? t('backupStorageField') : null) || 'Storage Status') + '</dt>' +
              '<dd>' + encryptedLabel + '</dd>' +
            '</div>' +
            '<div>' +
              '<dt>' + ((typeof t === 'function' ? t('backupSourceField') : null) || 'Restore Source') + '</dt>' +
              '<dd>' + escapeHTML(sourceLabel) + '</dd>' +
            '</div>' +
          '</dl>';
        const previewWarning = isPartialBackup
          ? '<div class="dialog-warning" role="status">' +
              dialogIcon('warning') + ' ' + escapeHTML(warningMessage) +
            '</div>'
          : '';
        const previewEmptyWarning = isEmptyBackup
          ? '<div class="dialog-warning" role="status">' +
              dialogIcon('warning') + ' ' + escapeHTML(emptyBackupMessage) +
            '</div>'
          : '';

        if (confirmRestoreBtn) {
          confirmRestoreBtn.disabled = isPartialBackup || isEmptyBackup;
          confirmRestoreBtn.title = isPartialBackup ? warningMessage : (isEmptyBackup ? emptyBackupMessage : '');
        }
        if (exportBackupBtn) {
          exportBackupBtn.disabled = isUploadedBackup || isPartialBackup;
          exportBackupBtn.title = isUploadedBackup
            ? ((typeof t === 'function' ? t('backupUploadedNoReexport') : null) || 'Uploaded backup files do not need to be exported again')
            : (isPartialBackup ? warningMessage : '');
        }

        if (hasSecrets) {
          previewContent.innerHTML =
            previewSummary +
            previewWarning +
            previewEmptyWarning +
            '<div class="backup-table-container">' +
              '<table class="backup-table">' +
                '<thead>' +
                  '<tr>' +
                    '<th>' + ((typeof t === 'function' ? t('exportHeaderServiceName') : null) || 'Service Name') + '</th>' +
                    '<th>' + ((typeof t === 'function' ? t('exportHeaderAccount') : null) || 'Account') + '</th>' +
                    '<th>' + ((typeof t === 'function' ? t('exportHeaderType') : null) || 'Type') + '</th>' +
                  '</tr>' +
                '</thead>' +
                '<tbody>' +
                  data.secrets.map(secret =>
                    '<tr class="backup-table-row">' +
                      '<td class="service-name">' + escapeHTML(secret.name || '') + '</td>' +
                      '<td class="account-info">' + escapeHTML(secret.account || secret.service || ((typeof t === 'function' ? t('noAccountInfo') : null) || 'No Account')) + '</td>' +
                      '<td class="secret-type">' + escapeHTML(secret.type || 'TOTP') + '</td>' +
                    '</tr>'
                  ).join('') +
                '</tbody>' +
              '</table>' +
            '</div>';
        } else {
          previewContent.innerHTML = previewSummary + previewWarning + previewEmptyWarning + '<div class="no-backups">' + ((typeof t === 'function' ? t('backupNoSecrets') : null) || 'No keys in this backup') + '</div>';
        }
      } catch (error) {
        if (!isActiveBackupPreviewRequest(backup, requestToken)) {
          return;
        }
        console.error('加载备份预览失败:', error);
        if (confirmRestoreBtn) {
          confirmRestoreBtn.disabled = true;
          confirmRestoreBtn.title = (typeof t === 'function' ? t('backupPreviewFailedCannotRestore') : null) || 'Backup preview failed, cannot restore';
        }
        if (exportBackupBtn) {
          exportBackupBtn.disabled = true;
          exportBackupBtn.title = (typeof t === 'function' ? t('backupPreviewFailedCannotExport') : null) || 'Backup preview failed, cannot export';
        }
        previewContent.innerHTML = '<div class="no-backups">' + ((typeof t === 'function' ? t('backupPreviewFailedMsg', { error: escapeHTML(error.message) }) : null) || ('Failed to load backup preview: ' + escapeHTML(error.message))) + '</div>';
      }
    }

    async function confirmRestore() {
      if (!selectedBackup) {
        showCenterToast('❌', (typeof t === 'function' ? t('backupSelectRequired') : null) || 'Please select a backup file first');
        return;
      }

      const backupLabel = selectedBackup.key.replace('backup_', '').replace(/\.(json|txt|csv|html)$/i, '');
      const confirmed = await showConfirmDialog({
        title: (typeof t === 'function' ? t('backupConfirmRestoreTitle') : null) || 'Restore Backup',
        message: (typeof t === 'function' ? t('backupConfirmRestoreMsg', { label: backupLabel }) : null) || ('Are you sure you want to restore backup "' + backupLabel + '"?\\nThis action will overwrite all current keys and cannot be undone.'),
        confirmText: (typeof t === 'function' ? t('restore') : null) || 'Restore',
        cancelText: (typeof t === 'function' ? t('cancel') : null) || 'Cancel',
        danger: true
      });

      if (!confirmed) {
        return;
      }

      const confirmBtn = document.getElementById('confirmRestoreBtn');
      const originalText = confirmBtn.textContent;
      confirmBtn.textContent = (typeof t === 'function' ? t('backupRestoringBtn') : null) || 'Restoring...';
      confirmBtn.disabled = true;

      try {
        const requestBody = selectedBackup.uploaded === true
          ? { backupFileName: selectedBackup.key, backupContent: selectedBackup.content }
          : { backupKey: selectedBackup.key };
        const response = await authenticatedFetch('/api/backup/restore', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || errorData.error || 'Restore failed');
        }

        const result = await response.json();
        showCenterToast('✅', (typeof t === 'function' ? t('backupRestoreSuccess', { count: result.count }) : null) || ('Restore successful! Restored ' + result.count + ' keys'));

        // 關閉模態框並重新整理頁面
        hideRestoreModal();
        setTimeout(() => {
          location.reload();
        }, 1000);

      } catch (error) {
        console.error('还原失败:', error);
        showCenterToast('❌', (typeof t === 'function' ? t('backupRestoreFailed', { error: error.message }) : null) || ('Restore failed: ' + error.message));
      } finally {
        confirmBtn.textContent = originalText;
        confirmBtn.disabled = false;
      }
    }

    // 顯示備份匯出格式選擇模態框
    function exportSelectedBackup() {
      if (!selectedBackup) {
        showCenterToast('❌', (typeof t === 'function' ? t('backupSelectRequired') : null) || 'Please select a backup file first');
        return;
      }
      if (selectedBackup.uploaded === true) {
        showCenterToast('ℹ️', (typeof t === 'function' ? t('backupUploadedNoReexport') : null) || 'Uploaded backup files do not need to be exported again');
        return;
      }

      // 顯示格式選擇模態框
      showBackupExportFormatModal();
    }

    function showBackupExportFormatModal() {
      showModal('backupExportFormatModal', () => {
        syncBackupDefaultExportButton();
      });
    }

    function hideBackupExportFormatModal() {
      hideModal('backupExportFormatModal');
    }

    async function exportSelectedBackupUsingDefaultFormat() {
      const format = await getServerDefaultExportFormat({ forceRefresh: true });
      await selectBackupExportFormat(format);
    }

    // 選擇備份匯出格式並執行匯出
    async function selectBackupExportFormat(format) {
      backupExportFormat = format;
      hideBackupExportFormatModal();

      await executeBackupExport(format);
    }

    async function executeBackupExport(format) {
      if (!selectedBackup) {
        showCenterToast('❌', (typeof t === 'function' ? t('backupSelectRequired') : null) || 'Please select a backup file first');
        return;
      }

      try {
        showCenterToast('ℹ️', (typeof t === 'function' ? t('backupExportingToast') : null) || 'Exporting backup file...');

        const exportUrl = '/api/backup/export/' + selectedBackup.key + '?format=' + format;
        const response = await authenticatedFetch(exportUrl);

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Export failed');
        }

        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = selectedBackup.key;
        if (contentDisposition) {
          const filenameMatch = contentDisposition.match(/filename="(.+)"/);
          if (filenameMatch) {
            filename = filenameMatch[1];
          }
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        const formatNames = {
          'txt': 'OTPAuth',
          'json': 'JSON',
          'csv': 'CSV',
          'html': 'HTML'
        };
        const formatName = formatNames[format] || format.toUpperCase();
        showCenterToast('✅', (typeof t === 'function' ? t('backupExportSuccessToast', { format: formatName }) : null) || ('Backup file exported as ' + formatName + ' format!'));
      } catch (error) {
        console.error('导出备份失败:', error);
        showCenterToast('❌', (typeof t === 'function' ? t('exportFailedWithReason', { error: error.message }) : null) || ('Export failed: ' + error.message));
      }
    }
`;
}
