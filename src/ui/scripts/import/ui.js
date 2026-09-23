/**
 * 匯入UI互動模組
 * 包含模態框、拖拽、檔案處理等UI相關功能
 */

/**
 * 獲取匯入UI互動程式碼
 * @returns {string} JavaScript 程式碼
 */
export function getImportUICode() {
	return `
    // ========== 匯入UI互動 ==========

    // 匯入預覽資料
    let importPreviewData = [];
    let pendingImportRetryItems = null;
    // 續傳累計狀態：上一次分片匯入中已完成部分的成功/失敗計數及失敗明細，
    // 讓使用者在多輪續傳後仍能看到整批匯入的真實彙總（含早先分片裡服務端返回的失敗項）
    let pendingImportPriorSuccessCount = 0;
    let pendingImportPriorFailCount = 0;
    let pendingImportPriorFailures = [];
    // 進度面板用：首輪進入時記錄整批原始總數 + 每輪結束時累加的"已處理"計數，
    // 這樣續傳時 totalItems/processedItems 與 successCount/failCount 同處一個座標系，
    // 不再出現 "20 / 20 成功 120 失敗 3" 這種本輪分母 + 累計計數的混顯
    let pendingImportOriginalTotalItems = 0;
    let pendingImportPriorProcessedItems = 0;

    // 自動預覽防抖計時器
    let autoPreviewTimer = null;

    // 自動預覽匯入（帶防抖）
    function autoPreviewImport() {
      // 清除之前的計時器
      if (autoPreviewTimer) {
        clearTimeout(autoPreviewTimer);
      }

      // 設定新的計時器，500ms 後觸發預覽
      autoPreviewTimer = setTimeout(() => {
        const text = document.getElementById('importText').value.trim();
        if (text) {
          previewImport();
        } else {
          // 如果文本為空，隱藏預覽區域並重置按鈕
          document.getElementById('importPreview').style.display = 'none';
          document.getElementById('executeImportBtn').disabled = true;
          importPreviewData = [];
          resetImportRetryState();
          resetImportProgress();
        }
      }, 500);
    }

    // ========== 智慧輸入區拖拽功能 ==========

    // 處理拖拽懸停
    function handleDragOver(event) {
      event.preventDefault();
      event.stopPropagation();
      const textarea = document.getElementById('importText');
      if (textarea) {
        textarea.classList.add('drag-over');
      }
    }

    // 處理拖拽離開
    function handleDragLeave(event) {
      event.preventDefault();
      event.stopPropagation();
      const textarea = document.getElementById('importText');
      if (textarea) {
        textarea.classList.remove('drag-over');
      }
    }

    // 處理檔案拖放
    function handleFileDrop(event) {
      event.preventDefault();
      event.stopPropagation();

      const textarea = document.getElementById('importText');
      if (textarea) {
        textarea.classList.remove('drag-over');
      }

      const files = event.dataTransfer.files;
      if (files.length > 0) {
        processImportFile(files[0]);
      }
    }

    // 清除已選檔案
    function clearSelectedFile(event) {
      event.stopPropagation();

      // 重置檔案輸入
      const fileInput = document.getElementById('importFileInput');
      if (fileInput) fileInput.value = '';

      // 隱藏檔案資訊徽章
      const badge = document.getElementById('fileInfoBadge');
      if (badge) badge.style.display = 'none';

      // 重置文本區域狀態
      const textarea = document.getElementById('importText');
      if (textarea) {
        textarea.value = '';
        textarea.classList.remove('has-content');
      }

      // 隱藏預覽並停用匯入按鈕
      document.getElementById('importPreview').style.display = 'none';
      document.getElementById('executeImportBtn').disabled = true;
      importPreviewData = [];
      resetImportRetryState();
      resetImportProgress();
    }

    // 更新檔案資訊徽章顯示
    function updateFileInfo(file) {
      const badge = document.getElementById('fileInfoBadge');
      const nameEl = document.getElementById('selectedFileName');
      const sizeEl = document.getElementById('selectedFileSize');
      const textarea = document.getElementById('importText');

      if (nameEl) nameEl.textContent = file.name;
      if (sizeEl) sizeEl.textContent = '(' + (file.size / 1024).toFixed(1) + 'KB)';
      if (badge) badge.style.display = 'flex';
      if (textarea) textarea.classList.add('has-content');
    }

    // 處理匯入檔案（統一處理拖拽和選擇）
    function processImportFile(file) {
      if (!file) return;

      // 檢查檔案型別
      // 支援 .html.txt (Ente Auth 匯出格式)
      const validExtensions = ['.txt', '.csv', '.json', '.html', '.htm', '.2fas', '.xml', '.html.txt', '.authpro', '.encrypt'];
      const fileName = file.name.toLowerCase();
      const isValidType = validExtensions.some(ext => fileName.endsWith(ext));

      if (!isValidType) {
        showCenterToast('❌', (typeof t === 'function' ? t('unsupportedFormat') : null) || 'Unsupported file format');
        return;
      }

      // 更新檔案資訊徽章
      updateFileInfo(file);

      const reader = new FileReader();
      reader.onload = function(e) {
        const content = decodeImportFileContent(file.name, e.target.result);
        document.getElementById('importText').value = content;

        // 自動預覽
        setTimeout(() => {
          previewImport();
        }, 100);
      };
      reader.onerror = function() {
        showCenterToast('❌', (typeof t === 'function' ? t('readFileFailed') : null) || 'Failed to read file');
      };
      reader.readAsArrayBuffer(file);
    }

    // 更新匯入統計資訊（新的內聯統計）
    function updateImportStats(validCount, invalidCount, skippedCount) {
      const statValid = document.getElementById('statValid');
      const statInvalid = document.getElementById('statInvalid');
      const statTotal = document.getElementById('statTotal');

      if (statValid) statValid.textContent = (typeof t === 'function' ? t('importValidCount', { count: validCount }) : null) || (validCount + ' valid');
      if (statInvalid) statInvalid.textContent = (typeof t === 'function' ? t('importInvalidCount', { count: invalidCount }) : null) || (invalidCount + ' invalid');
      if (statTotal) {
        const total = validCount + invalidCount + (skippedCount || 0);
        statTotal.textContent = (typeof t === 'function' ? t('importTotalCount', { total: total }) : null) || ('Total ' + total);
      }
    }

    // 清空續傳累計狀態（pendingImportRetryItems 要同步清空時一起呼叫，保證不殘留舊的失敗明細）
    function resetImportRetryState() {
      pendingImportRetryItems = null;
      pendingImportPriorSuccessCount = 0;
      pendingImportPriorFailCount = 0;
      pendingImportPriorFailures = [];
      pendingImportOriginalTotalItems = 0;
      pendingImportPriorProcessedItems = 0;
    }

    // 顯示匯入模態框
    function setImportProgressVisible(visible) {
      const progressPanel = document.getElementById('importProgress');
      if (progressPanel) {
        progressPanel.style.display = visible ? 'block' : 'none';
      }
    }

    function resetImportProgress() {
      setImportProgressVisible(false);

      const defaults = {
        importProgressTitle: (typeof t === 'function' ? t('importProgress') : null) || 'Import Progress',
        importProgressPercent: '0%',
        importProgressStatus: (typeof t === 'function' ? t('importReady') : null) || 'Ready to start...',
        importProgressDetail: '0 / 0',
        importProgressChunk: (typeof t === 'function' ? t('importChunkProgress', { current: 0, total: 0 }) : null) || 'Batch 0 / 0',
        importProgressSuccess: (typeof t === 'function' ? t('importSuccessStat', { count: 0 }) : null) || 'Success 0',
        importProgressFail: (typeof t === 'function' ? t('importFailStat', { count: 0 }) : null) || 'Failed 0'
      };

      Object.keys(defaults).forEach(function(id) {
        const element = document.getElementById(id);
        if (element) {
          element.textContent = defaults[id];
        }
      });

      const progressFill = document.getElementById('importProgressFill');
      if (progressFill) {
        progressFill.style.width = '0%';
      }
    }

    function showImportProgress(state) {
      setImportProgressVisible(true);
      updateImportProgress(state);
    }

    function updateImportProgress(state) {
      const totalItems = Math.max(Number(state && state.totalItems) || 0, 0);
      const processedItems = Math.min(Math.max(Number(state && state.processedItems) || 0, 0), totalItems || 0);
      const successCount = Math.max(Number(state && state.successCount) || 0, 0);
      const failCount = Math.max(Number(state && state.failCount) || 0, 0);
      const chunkCount = Math.max(Number(state && state.chunkCount) || 0, 0);
      const chunkIndex = Math.min(Math.max(Number(state && state.chunkIndex) || 0, 0), chunkCount || 0);
      const percent = totalItems > 0 ? Math.round((processedItems / totalItems) * 100) : 0;

      setImportProgressVisible(true);

      const title = document.getElementById('importProgressTitle');
      const percentEl = document.getElementById('importProgressPercent');
      const status = document.getElementById('importProgressStatus');
      const detail = document.getElementById('importProgressDetail');
      const chunk = document.getElementById('importProgressChunk');
      const success = document.getElementById('importProgressSuccess');
      const fail = document.getElementById('importProgressFail');
      const progressFill = document.getElementById('importProgressFill');

      if (title) title.textContent = (state && state.title) || ((typeof t === 'function' ? t('importProgress') : null) || 'Import Progress');
      if (percentEl) percentEl.textContent = percent + '%';
      if (status) status.textContent = (state && state.message) || ((typeof t === 'function' ? t('importExecuting') : null) || 'Importing...');
      if (detail) detail.textContent = processedItems + ' / ' + totalItems;
      if (chunk) chunk.textContent = (typeof t === 'function' ? t('importChunkProgress', { current: chunkIndex, total: chunkCount }) : null) || ('Batch ' + chunkIndex + ' / ' + chunkCount);
      if (success) success.textContent = (typeof t === 'function' ? t('importSuccessStat', { count: successCount }) : null) || ('Success ' + successCount);
      if (fail) fail.textContent = (typeof t === 'function' ? t('importFailStat', { count: failCount }) : null) || ('Failed ' + failCount);
      if (progressFill) progressFill.style.width = percent + '%';
    }

    function showImportModal() {
      showModal('importModal', () => {
        // 清空文本輸入框
        const textarea = document.getElementById('importText');
        if (textarea) {
          textarea.value = '';
          textarea.classList.remove('has-content', 'drag-over');
        }
        // 隱藏預覽區域
        document.getElementById('importPreview').style.display = 'none';
        // 重置匯入按鈕
        const executeBtn = document.getElementById('executeImportBtn');
        executeBtn.disabled = true;
        executeBtn.textContent = (typeof t === 'function' ? t('importBtnText') : null) || 'Import';
        // 隱藏檔案資訊徽章
        const badge = document.getElementById('fileInfoBadge');
        if (badge) badge.style.display = 'none';
        // 重置檔案輸入框
        const fileInput = document.getElementById('importFileInput');
        if (fileInput) fileInput.value = '';
        // 重置統計資訊
        updateImportStats(0, 0, 0);
        resetImportProgress();
        // 清空預覽資料
        importPreviewData = [];
        resetImportRetryState();
      });
    }

    // 隱藏匯入模態框
    function hideImportModal() {
      // 清除自動預覽計時器
      if (autoPreviewTimer) {
        clearTimeout(autoPreviewTimer);
        autoPreviewTimer = null;
      }

      hideModal('importModal', () => {
        // 清空文本輸入框並重置狀態
        const textarea = document.getElementById('importText');
        if (textarea) {
          textarea.value = '';
          textarea.classList.remove('has-content', 'drag-over');
        }
        // 隱藏預覽區域
        document.getElementById('importPreview').style.display = 'none';
        // 清空預覽列表內容
        const previewList = document.getElementById('importPreviewList');
        if (previewList) {
          previewList.innerHTML = '';
        }
        // 重置匯入按鈕
        const executeBtn = document.getElementById('executeImportBtn');
        executeBtn.disabled = true;
        executeBtn.textContent = (typeof t === 'function' ? t('importBtnText') : null) || 'Import';
        // 清空預覽資料陣列
        importPreviewData = [];
        resetImportRetryState();
        // 重置檔案輸入框，確保下次可以選擇同一個檔案
        const fileInput = document.getElementById('importFileInput');
        if (fileInput) {
          fileInput.value = '';
        }
        // 隱藏檔案資訊徽章
        const badge = document.getElementById('fileInfoBadge');
        if (badge) {
          badge.style.display = 'none';
        }
        resetImportProgress();
      });
    }

    // 處理匯入檔案（選擇檔案）
    function handleImportFile(event) {
      const file = event.target.files[0];
      processImportFile(file);
    }
`;
}
