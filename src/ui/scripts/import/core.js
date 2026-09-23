/**
 * 匯入核心邏輯模組
 * 包含 previewImport 和 executeImport 核心函式
 */

import { LIMITS } from '../../../utils/constants.js';

/**
 * 獲取預覽匯入程式碼
 * @returns {string} JavaScript 程式碼
 */
export function getPreviewImportCode() {
	return `
    // ========== 預覽匯入 ==========

    // 預覽匯入
    function previewImport() {
      const text = document.getElementById('importText').value.trim();
      if (!text) {
        showCenterToast('❌', (typeof t === 'function' ? t('importEmptyNotice') : null) || 'Please input or select content to import first');
        return;
      }

      let lines = text.split('\\n').filter(line => line.trim());
      const previewList = document.getElementById('importPreviewList');
      const previewDiv = document.getElementById('importPreview');
      const executeBtn = document.getElementById('executeImportBtn');

      previewList.innerHTML = '';
      importPreviewData = [];
      resetImportRetryState();
      // 新一輪預覽必須把上一輪殘留的進度條/累計成功失敗計數也一起清掉，
      // 否則"部分匯入後不關模態框直接改文本重新預覽"的場景裡，舊資料會繼續顯示在新預覽旁邊誤導使用者
      resetImportProgress();

      let validCount = 0;
      let invalidCount = 0;
      let skippedCount = 0;

      // 檢測 FreeOTP 加密備份格式
      const freeotpData = parseFreeOTPBackup(text);
      if (freeotpData) {
        freeotpBackupData = freeotpData;
        const tokenCount = Object.keys(freeotpData.tokenMeta).length;

        const _t = typeof t === 'function' ? t : (k) => null;
        Object.entries(freeotpData.tokenMeta).forEach(([uuid, meta]) => {
          const item = document.createElement('div');
          item.className = 'import-preview-item valid';

          const issuer = meta.issuerExt || meta.issuerInt || '';
          const account = meta.label || '';
          let displayInfo = issuer || (_t('importUnknownService') || 'Unknown Service');
          if (meta.type && meta.type !== 'TOTP') displayInfo += ' [' + meta.type + ']';
          if (meta.digits && meta.digits !== 6) displayInfo += ' [' + meta.digits + (_t('digitsSuffix') || ' digits') + ']';

          item.innerHTML =
            '<div class="service-name">' + dialogIcon('lock') + ' ' + escapeHTML(displayInfo) + '</div>' +
            '<div class="account-name">' + escapeHTML(account || (_t('importNeedPasswordDecrypt') || '(Password required to decrypt)')) + '</div>';

          previewList.appendChild(item);

          importPreviewData.push({
            serviceName: issuer,
            account: account,
            uuid: uuid,
            encrypted: true,
            valid: true
          });
          validCount++;
        });

        const statsDiv = document.createElement('div');
        statsDiv.className = 'dialog-encrypted-import';
        const freeotpTitle = _t('importFreeotpEncryptedBackup') || 'FreeOTP Encrypted Backup';
        const freeotpCountMsg = (_t('importDetectedEncryptedSecrets') ? _t('importDetectedEncryptedSecrets').replace('{count}', tokenCount) : ('Detected ' + tokenCount + ' encrypted keys'));
        const pwdPlaceholder = _t('importInputBackupPassword') || 'Enter backup password';
        const pwdAria = _t('backupPasswordAriaLabel') || 'Backup password';
        const decryptBtn = _t('decryptBtnText') || 'Decrypt';
        statsDiv.innerHTML =
          '<strong>' + escapeHTML(freeotpTitle) + '</strong>' +
          '<p>' + escapeHTML(freeotpCountMsg) + '</p>' +
          '<div class="dialog-decrypt-controls">' +
          '<input type="password" id="freeotpPassword" placeholder="' + escapeHTML(pwdPlaceholder) + '" aria-label="' + escapeHTML(pwdAria) + '">' +
          '<button type="button" onclick="decryptAndPreviewFreeOTP()" class="btn btn-primary">' + escapeHTML(decryptBtn) + '</button>' +
          '</div>';

        previewList.insertBefore(statsDiv, previewList.firstChild);
        updateImportStats(validCount, 0, 0);
        previewDiv.style.display = 'block';
        executeBtn.disabled = true;
        executeBtn.textContent = _t('importDecryptRequiredFirst') || 'Decryption required first';
        return;
      }

      // 檢測 TOTP Authenticator 加密備份格式
      if (isTOTPAuthenticatorBackup(text)) {
        totpAuthBackupData = text;

        const _t = typeof t === 'function' ? t : (k) => null;
        const statsDiv = document.createElement('div');
        statsDiv.className = 'dialog-encrypted-import';
        const totpTitle = _t('importTotpAuthEncryptedBackup') || 'TOTP Authenticator Encrypted Backup';
        const totpCountMsg = _t('importDetectedTotpAuthBackup') || 'Detected encrypted TOTP Authenticator backup';
        const pwdPlaceholder = _t('importInputBackupPassword') || 'Enter backup password';
        const pwdAria = _t('backupPasswordAriaLabel') || 'Backup password';
        const decryptBtn = _t('decryptBtnText') || 'Decrypt';
        statsDiv.innerHTML =
          '<strong>' + escapeHTML(totpTitle) + '</strong>' +
          '<p>' + escapeHTML(totpCountMsg) + '</p>' +
          '<div class="dialog-decrypt-controls">' +
          '<input type="password" id="totpAuthPassword" placeholder="' + escapeHTML(pwdPlaceholder) + '" aria-label="' + escapeHTML(pwdAria) + '">' +
          '<button type="button" onclick="decryptAndPreviewTOTPAuth()" class="btn btn-primary">' + escapeHTML(decryptBtn) + '</button>' +
          '</div>';

        previewList.appendChild(statsDiv);
        previewDiv.style.display = 'block';
        executeBtn.disabled = true;
        executeBtn.textContent = _t('importDecryptRequiredFirst') || 'Decryption required first';
        return;
      }

      // 檢測並解析HTML格式
      const trimmedText = text.trim().toLowerCase();
      const isHtmlFormat = trimmedText.startsWith('<!doctype html') ||
                          trimmedText.startsWith('<html') ||
                          text.includes('class="otp-entry"') ||
                          text.includes('Ente Auth');
      if (isHtmlFormat) {
        const htmlLines = parseHTMLImport(text);
        if (htmlLines.length === 0) {
          showCenterToast('❌', ((typeof t === 'function' ? t('importNoValidKeysFromHtml') : null) || 'No valid keys extracted from HTML file'));
          return;
        }
        lines = htmlLines;
      }
      // 檢測並解析JSON格式
      else if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
        let jsonData;

        try {
          jsonData = JSON.parse(text);
        } catch (jsonError) {
          console.log('JSON parse failed, parsing as OTPAuth URL format:', jsonError.message);
        }

        if (jsonData) {
          try {
          lines = parseJsonImport(jsonData);
          if (lines.length === 0) {
            showCenterToast('❌', ((typeof t === 'function' ? t('importNoValidKeyDataFound') : null) || 'No valid key data found'));
            return;
          }
          } catch (parseError) {
            console.error('JSON import parse failed:', parseError);
            showCenterToast('❌', parseError.message || ((typeof t === 'function' ? t('unrecognizedJsonFormat') : null) || 'Unrecognized JSON import format'));
            return;
          }
        }
      }
      // 檢測並解析CSV格式
      else if (text.includes('服务名称,账户信息,密钥') ||
               parseCSVLine(text.split('\\n')[0]).some(column => column.trim().toLowerCase() === 'login_totp') ||
               (text.toLowerCase().includes('service') && text.toLowerCase().includes('secret') && text.includes(','))) {
        const csvLines = parseCSVImport(text);
        if (csvLines.length === 0) {
          showCenterToast('❌', ((typeof t === 'function' ? t('importNoValidKeysFromCsv') : null) || 'No valid keys extracted from CSV file'));
          return;
        }
        lines = csvLines;
      }

      lines.forEach((line, index) => {
        const trimmedLine = line.trim();
        if (!trimmedLine) return;

        const item = document.createElement('div');
        item.className = 'import-preview-item';

        try {
          if (trimmedLine.startsWith('otpauth://totp/') || trimmedLine.startsWith('otpauth://hotp/')) {
            const fixedLine = trimmedLine.replace(/&amp%3B/g, '&');
            const url = new URL(fixedLine);
            const type = url.protocol === 'otpauth:' ? url.hostname : 'totp';
            const secret = url.searchParams.get('secret');
            const issuer = url.searchParams.get('issuer') || '';
            const digits = parseInt(url.searchParams.get('digits')) || 6;
            const algorithm = (url.searchParams.get('algorithm') || 'SHA1').toUpperCase();
            const period = parseInt(url.searchParams.get('period')) || 30;
            const counter = parseInt(url.searchParams.get('counter')) || 0;

            // 檢查 Ente Auth 格式的已刪除標記
            const codeDisplayParam = url.searchParams.get('codeDisplay');
            let isDeleted = false;
            if (codeDisplayParam) {
              try {
                const codeDisplay = JSON.parse(decodeURIComponent(codeDisplayParam));
                isDeleted = codeDisplay.trashed === true;
              } catch (e) {
                console.warn('Failed to parse codeDisplay:', e.message);
              }
            }

            if (isDeleted) {
              const _t = typeof t === 'function' ? t : (k) => null;
              item.className += ' skipped';
              item.innerHTML =
                '<div class="service-name">' + dialogIcon('info') + ' ' + escapeHTML(issuer || (_t('importUnknownService') || 'Unknown Service')) + '</div>' +
                '<div class="account-name">' + escapeHTML(_t('importDeletedSkipped') || 'Deleted entry, skipped import') + '</div>';
              previewList.appendChild(item);
              skippedCount++;
              return;
            }

            const pathParts = decodeURIComponent(url.pathname.substring(1)).split(':');
            let serviceName = issuer;
            let account = '';

            if (pathParts.length >= 2) {
              serviceName = pathParts[0] || issuer;
              account = pathParts.slice(1).join(':');
            } else if (pathParts.length === 1) {
              if (issuer) {
                serviceName = issuer;
                account = pathParts[0];
              } else {
                serviceName = pathParts[0];
              }
            }

            // 清理金鑰中的空格和分隔符
            const cleanedSecret = secret ? secret.replace(/[\\s\\-+]/g, '') : secret;

            if (cleanedSecret && serviceName) {
              if (validateBase32(cleanedSecret)) {
                item.className += ' valid';

                const _t = typeof t === 'function' ? t : (k) => null;
                let displayInfo = serviceName;
                if (type === 'hotp') displayInfo += ' [HOTP]';
                if (digits !== 6) displayInfo += ' [' + digits + (_t('digitsSuffix') || ' digits') + ']';
                if (period !== 30 && type === 'totp') displayInfo += ' [' + period + 's]';
                if (algorithm !== 'SHA1') displayInfo += ' [' + algorithm + ']';

                item.innerHTML =
                  '<div class="service-name">' + dialogIcon('check') + ' ' + escapeHTML(displayInfo) + '</div>' +
                  '<div class="account-name">' + escapeHTML(account || (_t('importNoAccount') || '(No Account)')) + '</div>';

                importPreviewData.push({
                  serviceName: serviceName,
                  account: account,
                  secret: cleanedSecret.toUpperCase(),
                  type: type,
                  digits: digits,
                  period: period,
                  algorithm: algorithm,
                  counter: counter,
                  valid: true,
                  line: index + 1
                });

                validCount++;
              } else {
                throw new Error((typeof t === 'function' ? t('invalidBase32Secret') : null) || 'Invalid Base32 secret format');
              }
            } else {
              throw new Error((typeof t === 'function' ? t('missingRequiredSecretOrService') : null) || 'Missing required information (secret or service name)');
            }
          } else {
            throw new Error((typeof t === 'function' ? t('invalidOtpauthFormat') : null) || 'Not a valid otpauth:// format');
          }
        } catch (error) {
          item.className += ' invalid';
          item.innerHTML =
            '<div class="service-name">' + dialogIcon('error') + ' ' + escapeHTML(((typeof t === 'function' ? t('rowPrefix') : null) || 'Row ') + (index + 1)) + '</div>' +
            '<div class="error-msg">' + escapeHTML(error.message) + '</div>';

          importPreviewData.push({
            line: index + 1,
            error: error.message,
            valid: false
          });

          invalidCount++;
        }

        previewList.appendChild(item);
      });

      updateImportStats(validCount, invalidCount, skippedCount);
      previewDiv.style.display = 'block';
      executeBtn.textContent = (typeof t === 'function' ? t('importBtnText') : null) || 'Import';
      executeBtn.disabled = validCount === 0;
    }
`;
}

/**
 * 獲取執行匯入程式碼
 * @returns {string} JavaScript 程式碼
 */
export function getExecuteImportCode() {
	return `
    // ========== 執行匯入 ==========

    // 執行匯入
    // 由構建期從 LIMITS.BULK_IMPORT_CHUNK_SIZE 注入，與後端 batch.js/validation.js 保持一致
    const BULK_IMPORT_CHUNK_SIZE = ${LIMITS.BULK_IMPORT_CHUNK_SIZE};

    function buildBatchImportPayload(item) {
      return {
        name: item.serviceName,
        account: item.account || '',
        secret: item.secret,
        type: item.type || 'totp',
        digits: item.digits || 6,
        period: item.period || 30,
        algorithm: item.algorithm || 'SHA1',
        counter: item.counter || 0
      };
    }

    function splitBatchImportItems(items, chunkSize) {
      const chunks = [];
      for (let i = 0; i < items.length; i += chunkSize) {
        chunks.push(items.slice(i, i + chunkSize));
      }
      return chunks;
    }

    async function readBatchImportErrorMessage(response) {
      try {
        const error = await response.clone().json();
        return error.message || error.error || ('HTTP ' + response.status);
      } catch (jsonError) {
        try {
          const text = await response.text();
          return text || ('HTTP ' + response.status);
        } catch (textError) {
          return 'HTTP ' + response.status;
        }
      }
    }

    function reportImportProgress(onProgress, state) {
      if (typeof onProgress === 'function') {
        onProgress(state);
      }
    }

    function createChunkImportError(message, meta) {
      const error = new Error(message);
      Object.assign(error, meta);
      return error;
    }

    async function executeImport() {
      const isRetryingPendingItems = Array.isArray(pendingImportRetryItems) && pendingImportRetryItems.length > 0;
      const validItems = isRetryingPendingItems
        ? pendingImportRetryItems
        : importPreviewData.filter(item => item.valid);

      if (validItems.length === 0) {
        showCenterToast('❌', (typeof t === 'function' ? t('importNoValidSecrets') : null) || 'No valid keys to import');
        return;
      }

      const executeBtn = document.getElementById('executeImportBtn');
      executeBtn.disabled = true;
      executeBtn.textContent = (typeof t === 'function' ? t('importExecuting') : null) || '⏳ Importing...';

      // 跨輪累計的進度座標系：
      //   - 首輪把當前 validItems.length 記為整批原始總數
      //   - 續傳時沿用首輪總數，priorProcessed 代表之前各輪累計已處理的條數
      // 面板上 totalItems/processedItems/successCount/failCount 都在這個累計座標系下顯示
      const originalTotalItems = isRetryingPendingItems && pendingImportOriginalTotalItems > 0
        ? pendingImportOriginalTotalItems
        : validItems.length;
      const priorProcessedItems = isRetryingPendingItems ? pendingImportPriorProcessedItems : 0;
      if (!isRetryingPendingItems) {
        pendingImportOriginalTotalItems = originalTotalItems;
        pendingImportPriorProcessedItems = 0;
      }

      const totalChunks = Math.max(1, Math.ceil(validItems.length / BULK_IMPORT_CHUNK_SIZE));
      showImportProgress({
        title: (typeof t === 'function' ? t('importBatchInProgress') : null) || 'Batch importing',
        message: totalChunks > 1 ? ((typeof t === 'function' ? t('importBatchPreparing', { current: 1, total: totalChunks }) : null) || ('Preparing batch 1 / ' + totalChunks + '...')) : ((typeof t === 'function' ? t('importExecuting') : null) || 'Preparing import...'),
        totalItems: originalTotalItems,
        processedItems: priorProcessedItems,
        successCount: pendingImportPriorSuccessCount,
        failCount: pendingImportPriorFailCount,
        chunkIndex: 0,
        chunkCount: totalChunks
      });

      // 把分片返回的結果陣列轉成失敗明細（{line, name, error}），其中 line 取自原始文本；
      // validItemsForResults 是該輪呼叫時傳給分片函式的 items，索引需要相對該陣列解析
      function collectFailureDetails(results, validItemsForResults) {
        const failures = [];
        if (!Array.isArray(results)) return failures;
        results.forEach(function(itemResult) {
          if (itemResult && itemResult.success === false) {
            const resultIndex = typeof itemResult.index === 'number' ? itemResult.index : 0;
            const srcItem = validItemsForResults[resultIndex];
            const line = srcItem && typeof srcItem.line === 'number' ? srcItem.line : resultIndex + 1;
            const name = srcItem ? (srcItem.serviceName || ((typeof t === 'function' ? t('importUnknownService') : null) || 'Unknown Service')) : ((typeof t === 'function' ? t('importUnknownService') : null) || 'Unknown Service');
            failures.push({ line: line, name: name, error: itemResult.error || ((typeof t === 'function' ? t('importUnknownError') : null) || 'Unknown error') });
          }
        });
        return failures;
      }

      // 本輪進入時從 prior 狀態繼承（續傳時非零）；完成/部分失敗時再寫回
      const priorSuccessCountAtStart = pendingImportPriorSuccessCount;
      const priorFailCountAtStart = pendingImportPriorFailCount;
      const priorFailuresAtStart = pendingImportPriorFailures.slice();

      let successCount = 0;
      let failCount = 0;
      let thisRunFailures = [];

      try {
        console.log('Starting batch import of ' + validItems.length + ' keys');

        // importSecretsInChunks 的 progressState 以"本輪"為座標，這裡把它重對映到"整批累計"座標系，
        // 讓進度面板的 totalItems/processedItems 與 successCount/failCount 保持同一口徑
        const importResult = await importSecretsInChunks(validItems, function(progressState) {
          updateImportProgress(Object.assign({}, progressState, {
            totalItems: originalTotalItems,
            processedItems: priorProcessedItems + (Number(progressState && progressState.processedItems) || 0),
            successCount: priorSuccessCountAtStart + (Number(progressState && progressState.successCount) || 0),
            failCount: priorFailCountAtStart + (Number(progressState && progressState.failCount) || 0),
          }));
        });
        successCount = importResult.successCount;
        failCount = importResult.failCount;

        importResult.results.forEach(function(itemResult) {
          const resultIndex = typeof itemResult.index === 'number' ? itemResult.index : 0;
          const fallbackItem = validItems[resultIndex];
          // 優先用原始文本里的行號（預覽階段寫入 item.line），續傳時仍指向正確的來源行；
          // 若缺失（如來自 Google 遷移 protobuf 的無行號項），退回到 validItems 下標 + 1
          const lineNumber = fallbackItem && typeof fallbackItem.line === 'number'
            ? fallbackItem.line
            : resultIndex + 1;

          if (itemResult.success) {
            const secretName = itemResult.secret && itemResult.secret.name ? itemResult.secret.name : (fallbackItem ? fallbackItem.serviceName : ((typeof t === 'function' ? t('importUnknownService') : null) || 'Unknown Service'));
            console.log('✅ Row ' + lineNumber + ' imported successfully', secretName);
          } else {
            const name = fallbackItem ? (fallbackItem.serviceName || ((typeof t === 'function' ? t('importUnknownService') : null) || 'Unknown Service')) : ((typeof t === 'function' ? t('importUnknownService') : null) || 'Unknown Service');
            thisRunFailures.push({ line: lineNumber, name: name, error: itemResult.error || ((typeof t === 'function' ? t('importUnknownError') : null) || 'Unknown error') });
            console.error('❌ Row ' + lineNumber + ' import failed', itemResult.error);
          }
        });
      } catch (error) {
        console.error('Import process error:', error);
        await loadSecrets();
        const partialSuccessCount = typeof error?.partialSuccessCount === 'number' ? error.partialSuccessCount : 0;
        const partialFailCount = typeof error?.partialFailCount === 'number' ? error.partialFailCount : 0;
        const processedValidItems = Math.min(
          typeof error?.processedItems === 'number' ? error.processedItems : partialSuccessCount + partialFailCount,
          validItems.length
        );
        if (processedValidItems > 0) {
          const remainingRetryItems = validItems.slice(processedValidItems);
          pendingImportRetryItems = remainingRetryItems.length > 0 ? remainingRetryItems : null;
          // 把本輪已完成分片中的失敗項併入累積狀態，續傳成功後再一次性彙總給使用者
          const newFailures = collectFailureDetails(error.results, validItems);
          pendingImportPriorSuccessCount = priorSuccessCountAtStart + partialSuccessCount;
          pendingImportPriorFailCount = priorFailCountAtStart + partialFailCount;
          pendingImportPriorFailures = priorFailuresAtStart.concat(newFailures);
          // 跨輪累計的"已處理"計數：下一輪讀它重建進度面板
          pendingImportPriorProcessedItems = priorProcessedItems + processedValidItems;

          const aggregateSuccess = pendingImportPriorSuccessCount;
          const aggregateFail = pendingImportPriorFailCount;
          const aggregateProcessed = pendingImportPriorProcessedItems;
          showCenterToast('⚠️', ((typeof t === 'function' ? t('importResultSummary', { success: aggregateSuccess, fail: aggregateFail }) : null) || ('Import finished: ' + aggregateSuccess + ' succeeded, ' + aggregateFail + ' failed')));
          executeBtn.disabled = false;
          executeBtn.textContent = remainingRetryItems.length > 0 ? ((typeof t === 'function' ? t('importContinueRemaining') : null) || 'Continue Remaining') : ((typeof t === 'function' ? t('importBtnText') : null) || 'Import');
          updateImportProgress({
            title: (typeof t === 'function' ? t('importPartialSuccess') : null) || 'Partially imported',
            message: aggregateProcessed + ' / ' + originalTotalItems + ', ' + remainingRetryItems.length + ' remaining',
            totalItems: originalTotalItems,
            processedItems: aggregateProcessed,
            successCount: aggregateSuccess,
            failCount: aggregateFail,
            chunkIndex: typeof error?.chunkIndex === 'number' ? error.chunkIndex : 0,
            chunkCount: typeof error?.chunkCount === 'number' ? error.chunkCount : totalChunks
          });
          return;
        }

        // 完全失敗時：若本次本來就是續傳（validItems 來自 pendingImportRetryItems），
        // 保留剩餘列表和累計明細，便於使用者再次點選"繼續匯入剩餘項"重試；否則全清
        if (!isRetryingPendingItems) {
          resetImportRetryState();
        }
        showCenterToast('❌', ((typeof t === 'function' ? t('importFailed', { error: error.message }) : null) || ('Import failed: ' + error.message)));
        executeBtn.disabled = false;
        executeBtn.textContent = isRetryingPendingItems ? ((typeof t === 'function' ? t('importContinueRemaining') : null) || 'Continue Remaining') : ((typeof t === 'function' ? t('importBtnText') : null) || 'Import');
        return;
      }

      // 本輪成功：與之前續傳累計狀態合併，得到整批匯總
      const aggregateSuccess = priorSuccessCountAtStart + successCount;
      const aggregateFailures = priorFailuresAtStart.concat(thisRunFailures);
      const aggregateFail = priorFailCountAtStart + failCount;
      const aggregateProcessed = priorProcessedItems + validItems.length;

      updateImportProgress({
        title: (typeof t === 'function' ? t('importBatchComplete') : null) || 'Batch import completed',
        message: aggregateFail === 0 ? ((typeof t === 'function' ? t('importComplete') : null) || 'Import completed') : ((typeof t === 'function' ? t('importCompleteWithErrors') : null) || 'Import completed with errors'),
        totalItems: originalTotalItems,
        processedItems: aggregateProcessed,
        successCount: aggregateSuccess,
        failCount: aggregateFail,
        chunkIndex: totalChunks,
        chunkCount: totalChunks
      });

      if (aggregateFail === 0) {
        showCenterToast('✅', (typeof t === 'function' ? t('importSuccessCount', { count: aggregateSuccess }) : null) || ('Successfully imported ' + aggregateSuccess + ' keys'));
      } else {
        showCenterToast('⚠️', (typeof t === 'function' ? t('importResultSummary', { success: aggregateSuccess, fail: aggregateFail }) : null) || ('Import finished: ' + aggregateSuccess + ' succeeded, ' + aggregateFail + ' failed'));
        // 把累計失敗明細打印出來，方便使用者在 devtools 裡核對（UI 層沒有專門的彙總模態框）
        aggregateFailures.forEach(function(f) {
          console.error('❌ Line ' + f.line + ' import failed (cumulative):', f.name, f.error);
        });
      }

      await loadSecrets();
      hideImportModal();
    }

    async function importSecretsInChunks(items, onProgress) {
      let successCount = 0;
      let failCount = 0;
      const results = [];
      let processedItems = 0;
      const chunks = splitBatchImportItems(items, BULK_IMPORT_CHUNK_SIZE);
      const chunkCount = chunks.length;

      for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
        const chunk = chunks[chunkIndex];
        const startIndex = chunkIndex * BULK_IMPORT_CHUNK_SIZE;
        const currentChunkNumber = chunkIndex + 1;

        reportImportProgress(onProgress, {
          title: (typeof t === 'function' ? t('importBatchInProgress') : null) || 'Batch importing',
          message: (typeof t === 'function' ? t('importBatchProcessing', { current: currentChunkNumber, total: chunkCount }) : null) || ('Processing batch ' + currentChunkNumber + ' / ' + chunkCount + '...'),
          totalItems: items.length,
          processedItems: processedItems,
          successCount: successCount,
          failCount: failCount,
          chunkIndex: currentChunkNumber,
          chunkCount: chunkCount
        });

        try {
          console.log('Batch import chunk', (chunkIndex + 1) + '/' + chunks.length, 'size:', chunk.length);

          const response = await authenticatedFetch('/api/secrets/batch', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              secrets: chunk.map(buildBatchImportPayload),
              immediateBackup: currentChunkNumber === chunkCount,
              chunkIndex: currentChunkNumber,
              chunkCount: chunkCount
            })
          });

          if (response.ok) {
            const result = await response.json();
            const chunkSuccessCount = typeof result.successCount === 'number' ? result.successCount : chunk.length;
            const chunkFailCount = typeof result.failCount === 'number' ? result.failCount : 0;

            successCount += chunkSuccessCount;
            failCount += chunkFailCount;

            if (Array.isArray(result.results)) {
              result.results.forEach(function(itemResult, index) {
                results.push(Object.assign({}, itemResult, {
                  index: typeof itemResult.index === 'number' ? itemResult.index + startIndex : startIndex + index
                }));
              });
            }

            processedItems += chunk.length;
            reportImportProgress(onProgress, {
              title: (typeof t === 'function' ? t('importBatchInProgress') : null) || 'Batch importing',
              message: (typeof t === 'function' ? t('importBatchCompletedChunk', { current: currentChunkNumber, total: chunkCount }) : null) || ('Completed batch ' + currentChunkNumber + ' / ' + chunkCount),
              totalItems: items.length,
              processedItems: processedItems,
              successCount: successCount,
              failCount: failCount,
              chunkIndex: currentChunkNumber,
              chunkCount: chunkCount
            });

            continue;
          }

          // 所有非 2xx 響應和網路異常走同一處錯誤出口，
          // 由 catch 統一附加 partial 進度後設資料，避免在多處重複組裝同樣的 meta
          let errorMessage;
          if (response.status === 429) {
            errorMessage = (typeof t === 'function' ? t('importRateLimited') : null) || 'Batch import was rate-limited. Submissions paused. Please try again later.';
          } else if (response.status >= 500) {
            errorMessage = 'Batch ' + currentChunkNumber + ' / ' + chunkCount + ' import response error, status unknown. Please refresh and check.';
          } else {
            errorMessage = 'Batch ' + currentChunkNumber + ' / ' + chunkCount + ' import failed: ' + (await readBatchImportErrorMessage(response));
          }
          throw new Error(errorMessage);

        } catch (error) {
          throw createChunkImportError(
            (error && error.message) || (((typeof t === 'function' ? t('importChunkFailed', { current: currentChunkNumber, total: chunkCount }) : null) || ('Batch ' + currentChunkNumber + ' / ' + chunkCount + ' request failed. Current batch state may be uncertain, please refresh and verify.'))),
            {
              partialSuccessCount: successCount,
              partialFailCount: failCount,
              processedItems: processedItems,
              results: results.slice(),
              chunkIndex: currentChunkNumber,
              chunkCount: chunkCount,
              cause: error
            }
          );
        }
      }

      return { successCount, failCount, results };
    }
`;
}
