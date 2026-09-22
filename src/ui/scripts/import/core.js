/**
 * 导入核心逻辑模块
 * 包含 previewImport 和 executeImport 核心函数
 */

import { LIMITS } from '../../../utils/constants.js';

/**
 * 获取预览导入代码
 * @returns {string} JavaScript 代码
 */
export function getPreviewImportCode() {
	return `
    // ========== 预览导入 ==========

    // 预览导入
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
      // 新一轮预览必须把上一轮残留的进度条/累计成功失败计数也一起清掉，
      // 否则"部分导入后不关模态框直接改文本重新预览"的场景里，旧数据会继续显示在新预览旁边误导用户
      resetImportProgress();

      let validCount = 0;
      let invalidCount = 0;
      let skippedCount = 0;

      // 检测 FreeOTP 加密备份格式
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

      // 检测 TOTP Authenticator 加密备份格式
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

      // 检测并解析HTML格式
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
      // 检测并解析JSON格式
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
      // 检测并解析CSV格式
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

            // 检查 Ente Auth 格式的已删除标记
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

            // 清理密钥中的空格和分隔符
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
 * 获取执行导入代码
 * @returns {string} JavaScript 代码
 */
export function getExecuteImportCode() {
	return `
    // ========== 执行导入 ==========

    // 执行导入
    // 由构建期从 LIMITS.BULK_IMPORT_CHUNK_SIZE 注入，与后端 batch.js/validation.js 保持一致
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

      // 跨轮累计的进度坐标系：
      //   - 首轮把当前 validItems.length 记为整批原始总数
      //   - 续传时沿用首轮总数，priorProcessed 代表之前各轮累计已处理的条数
      // 面板上 totalItems/processedItems/successCount/failCount 都在这个累计坐标系下显示
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

      // 把分片返回的结果数组转成失败明细（{line, name, error}），其中 line 取自原始文本；
      // validItemsForResults 是该轮调用时传给分片函数的 items，索引需要相对该数组解析
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

      // 本轮进入时从 prior 状态继承（续传时非零）；完成/部分失败时再写回
      const priorSuccessCountAtStart = pendingImportPriorSuccessCount;
      const priorFailCountAtStart = pendingImportPriorFailCount;
      const priorFailuresAtStart = pendingImportPriorFailures.slice();

      let successCount = 0;
      let failCount = 0;
      let thisRunFailures = [];

      try {
        console.log('Starting batch import of ' + validItems.length + ' keys');

        // importSecretsInChunks 的 progressState 以"本轮"为坐标，这里把它重映射到"整批累计"坐标系，
        // 让进度面板的 totalItems/processedItems 与 successCount/failCount 保持同一口径
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
          // 优先用原始文本里的行号（预览阶段写入 item.line），续传时仍指向正确的来源行；
          // 若缺失（如来自 Google 迁移 protobuf 的无行号项），退回到 validItems 下标 + 1
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
          // 把本轮已完成分片中的失败项并入累积状态，续传成功后再一次性汇总给用户
          const newFailures = collectFailureDetails(error.results, validItems);
          pendingImportPriorSuccessCount = priorSuccessCountAtStart + partialSuccessCount;
          pendingImportPriorFailCount = priorFailCountAtStart + partialFailCount;
          pendingImportPriorFailures = priorFailuresAtStart.concat(newFailures);
          // 跨轮累计的"已处理"计数：下一轮读它重建进度面板
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

        // 完全失败时：若本次本来就是续传（validItems 来自 pendingImportRetryItems），
        // 保留剩余列表和累计明细，便于用户再次点击"继续导入剩余项"重试；否则全清
        if (!isRetryingPendingItems) {
          resetImportRetryState();
        }
        showCenterToast('❌', ((typeof t === 'function' ? t('importFailed', { error: error.message }) : null) || ('Import failed: ' + error.message)));
        executeBtn.disabled = false;
        executeBtn.textContent = isRetryingPendingItems ? ((typeof t === 'function' ? t('importContinueRemaining') : null) || 'Continue Remaining') : ((typeof t === 'function' ? t('importBtnText') : null) || 'Import');
        return;
      }

      // 本轮成功：与之前续传累计状态合并，得到整批汇总
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
        // 把累计失败明细打印出来，方便用户在 devtools 里核对（UI 层没有专门的汇总模态框）
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

          // 所有非 2xx 响应和网络异常走同一处错误出口，
          // 由 catch 统一附加 partial 进度元数据，避免在多处重复组装同样的 meta
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
