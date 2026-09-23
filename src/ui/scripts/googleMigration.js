/**
 * Google Authenticator 遷移模組
 * 支援 Google Authenticator 的匯入匯出功能
 *
 * 功能：
 * - 解析 otpauth-migration:// 格式的遷移二維碼（匯入）
 * - 生成 otpauth-migration:// 格式的遷移二維碼（匯出）
 * - Protobuf 編解碼
 */

import { LIMITS } from '../../utils/constants.js';

/**
 * 獲取 Google 遷移相關程式碼
 * @returns {string} JavaScript 程式碼
 */
export function getGoogleMigrationCode() {
	return `
    // ========== Google Authenticator 遷移模組 ==========
    // 支援 otpauth-migration:// 格式的匯入匯出

    // ==================== Protobuf 解碼（匯入）====================

    /**
     * 處理 Google Authenticator 遷移二維碼
     * 格式: otpauth-migration://offline?data=<base64-encoded-protobuf>
     */
    function processGoogleMigration(qrCodeData) {
      try {
        console.log('检测到 Google Authenticator 迁移格式');

        // 提取 data 引數
        const url = new URL(qrCodeData);
        const dataParam = url.searchParams.get('data');

        if (!dataParam) {
          showScannerError((typeof t === 'function' ? t('googleMigrationMissingData') : null) || 'Migration QR code missing data');
          return;
        }

        // URL 解碼然後 Base64 解碼
        const base64Data = decodeURIComponent(dataParam);
        const binaryData = atob(base64Data);
        const bytes = new Uint8Array(binaryData.length);
        for (let i = 0; i < binaryData.length; i++) {
          bytes[i] = binaryData.charCodeAt(i);
        }

        // 解析 Protobuf 資料
        const secrets = parseGoogleMigrationPayload(bytes);

        if (secrets.length === 0) {
          showScannerError((typeof t === 'function' ? t('googleMigrationNoKeysFound') : null) || 'Failed to parse any keys from migration QR code');
          return;
        }

        console.log('成功解析 ' + secrets.length + ' 个密钥:', secrets);

        // 關閉掃描器
        hideQRScanner();

        // 顯示匯入預覽
        showGoogleMigrationPreview(secrets);

      } catch (error) {
        console.error('解析 Google 迁移二维码失败:', error);
        showScannerError(((typeof t === 'function' ? t('googleMigrationParseFailed', { error: error.message }) : null) || ('Failed to parse Google migration QR code: ' + error.message)));
      }
    }

    /**
     * 解析 Google Migration Payload (Protobuf 格式)
     * 簡化的 Protobuf 解碼器，專門用於解析 Google Authenticator 遷移格式
     */
    function parseGoogleMigrationPayload(bytes) {
      const secrets = [];
      let pos = 0;

      // 讀取 varint
      function readVarint() {
        let result = 0;
        let shift = 0;
        while (pos < bytes.length) {
          const byte = bytes[pos++];
          result |= (byte & 0x7F) << shift;
          if ((byte & 0x80) === 0) break;
          shift += 7;
        }
        return result;
      }

      // 讀取指定長度的位元組
      function readBytes(length) {
        const result = bytes.slice(pos, pos + length);
        pos += length;
        return result;
      }

      // 解析單個 OTP 引數
      function parseOtpParameters(data) {
        const otp = {
          secret: '',
          name: '',
          issuer: '',
          algorithm: 'SHA1',
          digits: 6,
          type: 'TOTP',
          counter: 0
        };

        let p = 0;

        while (p < data.length) {
          const tag = data[p++];
          const fieldNumber = tag >> 3;
          const wireType = tag & 0x07;

          if (wireType === 0) {
            // Varint
            let value = 0;
            let shift = 0;
            while (p < data.length) {
              const byte = data[p++];
              value |= (byte & 0x7F) << shift;
              if ((byte & 0x80) === 0) break;
              shift += 7;
            }

            switch (fieldNumber) {
              case 4: // algorithm
                otp.algorithm = ['SHA1', 'SHA1', 'SHA256', 'SHA512', 'MD5'][value] || 'SHA1';
                break;
              case 5: // digits
                otp.digits = value === 2 ? 8 : 6;
                break;
              case 6: // type
                otp.type = value === 1 ? 'HOTP' : 'TOTP';
                break;
              case 7: // counter
                otp.counter = value;
                break;
            }
          } else if (wireType === 2) {
            // Length-delimited (string/bytes)
            let length = 0;
            let shift = 0;
            while (p < data.length) {
              const byte = data[p++];
              length |= (byte & 0x7F) << shift;
              if ((byte & 0x80) === 0) break;
              shift += 7;
            }

            const fieldData = data.slice(p, p + length);
            p += length;

            switch (fieldNumber) {
              case 1: // secret (bytes)
                // 將位元組轉換為 Base32
                otp.secret = bytesToBase32(fieldData);
                break;
              case 2: // name (string)
                otp.name = new TextDecoder().decode(fieldData);
                break;
              case 3: // issuer (string)
                otp.issuer = new TextDecoder().decode(fieldData);
                break;
            }
          }
        }

        return otp;
      }

      // 解析主 payload
      while (pos < bytes.length) {
        const tag = bytes[pos++];
        const fieldNumber = tag >> 3;
        const wireType = tag & 0x07;

        if (wireType === 0) {
          // Varint - 跳過 version, batch_size 等欄位
          readVarint();
        } else if (wireType === 2) {
          // Length-delimited
          const length = readVarint();

          if (fieldNumber === 1) {
            // otp_parameters
            const otpData = readBytes(length);
            const otp = parseOtpParameters(otpData);
            if (otp.secret) {
              secrets.push(otp);
            }
          } else {
            // 跳過其他欄位
            pos += length;
          }
        }
      }

      return secrets;
    }

    /**
     * 將位元組陣列轉換為 Base32 字串
     */
    function bytesToBase32(bytes) {
      const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
      let result = '';
      let bits = 0;
      let value = 0;

      for (let i = 0; i < bytes.length; i++) {
        value = (value << 8) | bytes[i];
        bits += 8;

        while (bits >= 5) {
          bits -= 5;
          result += alphabet[(value >> bits) & 0x1F];
        }
      }

      if (bits > 0) {
        result += alphabet[(value << (5 - bits)) & 0x1F];
      }

      return result;
    }

    // ==================== Protobuf 編碼（匯出）====================

    /**
     * 將 Base32 字串轉換為位元組陣列（bytesToBase32 的逆操作）
     */
    function base32ToBytes(base32String) {
      const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
      const cleanedInput = base32String.replace(/[\\s=]/g, '').toUpperCase();
      const bytes = [];
      let bits = 0;
      let value = 0;

      for (let i = 0; i < cleanedInput.length; i++) {
        const char = cleanedInput[i];
        const index = alphabet.indexOf(char);
        if (index === -1) continue; // 跳过无效字符

        value = (value << 5) | index;
        bits += 5;

        if (bits >= 8) {
          bits -= 8;
          bytes.push((value >> bits) & 0xFF);
        }
      }

      return new Uint8Array(bytes);
    }

    /**
     * 編碼 Protobuf Varint
     */
    function encodeVarint(value) {
      const bytes = [];
      while (value > 0x7F) {
        bytes.push((value & 0x7F) | 0x80);
        value >>>= 7;
      }
      bytes.push(value & 0x7F);
      return bytes;
    }

    /**
     * 編碼 Protobuf 長度字首欄位
     */
    function encodeLengthDelimited(fieldNumber, data) {
      const tag = (fieldNumber << 3) | 2; // wire type 2 = length-delimited
      const result = [];
      result.push(...encodeVarint(tag));
      result.push(...encodeVarint(data.length));
      for (let i = 0; i < data.length; i++) {
        result.push(data[i]);
      }
      return result;
    }

    /**
     * 編碼 Protobuf Varint 欄位
     */
    function encodeVarintField(fieldNumber, value) {
      const tag = (fieldNumber << 3) | 0; // wire type 0 = varint
      const result = [];
      result.push(...encodeVarint(tag));
      result.push(...encodeVarint(value));
      return result;
    }

    /**
     * 編碼單個 OTP 引數為 Protobuf 格式
     */
    function encodeOtpParameters(secret) {
      const result = [];

      // Field 1: secret (bytes) - Base32 解碼後的二進位制
      const secretBytes = base32ToBytes(secret.secret || '');
      result.push(...encodeLengthDelimited(1, secretBytes));

      // Field 2: name (string) - 賬戶名
      const name = secret.account || secret.name || '';
      const nameBytes = new TextEncoder().encode(name);
      result.push(...encodeLengthDelimited(2, nameBytes));

      // Field 3: issuer (string) - 服務名
      const issuer = secret.name || '';
      const issuerBytes = new TextEncoder().encode(issuer);
      result.push(...encodeLengthDelimited(3, issuerBytes));

      // Field 4: algorithm (varint)
      // Google: 0=UNSPECIFIED, 1=SHA1, 2=SHA256, 3=SHA512, 4=MD5
      const algorithmMap = { 'SHA1': 1, 'SHA256': 2, 'SHA512': 3, 'MD5': 4 };
      const algorithm = algorithmMap[(secret.algorithm || 'SHA1').toUpperCase()] || 1;
      result.push(...encodeVarintField(4, algorithm));

      // Field 5: digits (varint)
      // Google: 0=UNSPECIFIED, 1=SIX, 2=EIGHT
      const digitsValue = (secret.digits || 6) === 8 ? 2 : 1;
      result.push(...encodeVarintField(5, digitsValue));

      // Field 6: type (varint)
      // Google: 0=UNSPECIFIED, 1=HOTP, 2=TOTP
      const typeValue = (secret.type || 'TOTP').toUpperCase() === 'HOTP' ? 1 : 2;
      result.push(...encodeVarintField(6, typeValue));

      // Field 7: counter (varint) - 僅 HOTP 需要
      if ((secret.type || 'TOTP').toUpperCase() === 'HOTP') {
        result.push(...encodeVarintField(7, secret.counter || 0));
      }

      return new Uint8Array(result);
    }

    /**
     * 生成 Google Migration Payload
     * @param {Array} secrets - 金鑰陣列
     * @param {Object} batchInfo - 批次資訊
     * @param {number} batchInfo.totalBatches - 總二維碼數量
     * @param {number} batchInfo.batchIndex - 當前二維碼索引 (0-based)
     * @param {number} batchInfo.batchId - 批次ID (所有二維碼使用相同ID)
     * @returns {Uint8Array} Protobuf 編碼的 payload
     */
    function generateGoogleMigrationPayload(secrets, batchInfo = {}) {
      const result = [];

      // 每個金鑰作為 Field 1 (repeated otp_parameters)
      for (const secret of secrets) {
        const otpData = encodeOtpParameters(secret);
        result.push(...encodeLengthDelimited(1, otpData));
      }

      // Field 2: version (int32) = 1
      result.push(...encodeVarintField(2, 1));

      // Field 3: batch_size (int32) = 總二維碼數量
      const totalBatches = batchInfo.totalBatches || 1;
      result.push(...encodeVarintField(3, totalBatches));

      // Field 4: batch_index (int32) = 當前二維碼索引
      const batchIndex = batchInfo.batchIndex || 0;
      result.push(...encodeVarintField(4, batchIndex));

      // Field 5: batch_id (int32) - 批次ID (所有二維碼使用相同ID)
      const batchId = batchInfo.batchId || Math.floor(Math.random() * 1000000);
      result.push(...encodeVarintField(5, batchId));

      return new Uint8Array(result);
    }

    /**
     * 生成 Google Migration URL
     * @param {Array} secrets - 金鑰陣列
     * @param {Object} batchInfo - 批次資訊
     * @returns {string} otpauth-migration:// URL
     */
    function generateGoogleMigrationURL(secrets, batchInfo = {}) {
      const payload = generateGoogleMigrationPayload(secrets, batchInfo);

      // 轉換為 Base64
      let binary = '';
      for (let i = 0; i < payload.length; i++) {
        binary += String.fromCharCode(payload[i]);
      }
      const base64Data = btoa(binary);

      // URL 編碼
      const encodedData = encodeURIComponent(base64Data);

      return 'otpauth-migration://offline?data=' + encodedData;
    }

    // ==================== 匯出 UI ====================

    /**
     * 顯示匯出到 Google Authenticator 的模態框
     */
    function showExportToGoogleModal() {
      if (!secrets || secrets.length === 0) {
        showCenterToast('⚠️', (typeof t === 'function' ? t('googleNoSecretsToExport') : null) || 'No keys available to export');
        return;
      }

      // 建立匯出選擇模態框
      const modal = document.createElement('div');
      modal.id = 'exportToGoogleModal';
      modal.className = 'modal fab-modal';
      modal.style.display = 'flex';

      const content = document.createElement('div');
      content.className = 'modal-content fab-modal-content';

      content.innerHTML =
        '<div class="modal-header">' +
          '<h2>' + ((typeof t === 'function' ? t('googleExportTitle') : null) || 'Export to Google Authenticator') + '</h2>' +
          '<button class="close-btn" type="button" aria-label="' + ((typeof t === 'function' ? t('closeModalAriaLabel') : null) || 'Close dialog') + '" onclick="closeExportToGoogleModal()">' + dialogIcon('close') + '</button>' +
        '</div>' +
        '<div class="modal-body">' +
          '<p style="margin-bottom: 15px; color: var(--text-secondary);">' + ((typeof t === 'function' ? t('googleExportSelectLabel', { count: secrets.length }) : null) || ('Select keys to export (total <strong>' + secrets.length + '</strong>):')) + '</p>' +
          '<div style="margin-bottom: 15px; display: flex; gap: 10px;">' +
            '<button class="btn btn-secondary btn-sm" onclick="selectAllExportSecrets(true)">' + ((typeof t === 'function' ? t('googleExportSelectAll') : null) || 'Select All') + '</button>' +
            '<button class="btn btn-secondary btn-sm" onclick="selectAllExportSecrets(false)">' + ((typeof t === 'function' ? t('googleExportDeselectAll') : null) || 'Deselect All') + '</button>' +
          '</div>' +
          '<div class="export-secret-list" style="max-height: 300px; overflow-y: auto; border: 1px solid var(--border-primary); border-radius: 8px; margin-bottom: 15px;">' +
            secrets.map(function(s, i) {
              return '<div class="export-secret-item" style="padding: 12px; border-bottom: 1px solid var(--border-primary); display: flex; align-items: center; gap: 10px;">' +
                '<input type="checkbox" id="export-' + i + '" checked style="width: 18px; height: 18px;">' +
                '<div style="flex: 1; min-width: 0;">' +
                  '<div style="font-weight: 600; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">' + escapeHTML(s.name || ((typeof t === 'function' ? t('unknownService') : null) || 'Unknown Service')) + '</div>' +
                  '<div style="font-size: var(--dialog-caption-size); color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">' + escapeHTML(s.account || '') + '</div>' +
                '</div>' +
                '<span style="font-size: var(--dialog-caption-size); padding: 2px 6px; background: var(--bg-tertiary); border-radius: 4px; color: var(--text-tertiary);">' + escapeHTML(s.type || 'TOTP') + '</span>' +
              '</div>';
            }).join('') +
          '</div>' +
          '<div style="display: flex; gap: 10px;">' +
            '<button class="btn btn-secondary" style="flex: 1;" onclick="closeExportToGoogleModal()">' + ((typeof t === 'function' ? t('cancel') : null) || 'Cancel') + '</button>' +
            '<button class="btn btn-primary" style="flex: 1;" onclick="generateExportQRCodes()">' + ((typeof t === 'function' ? t('googleExportGenerateQrBtn') : null) || 'Generate QR Code') + '</button>' +
          '</div>' +
        '</div>';

      modal.appendChild(content);
      document.body.appendChild(modal);

      setTimeout(function() { modal.classList.add('show'); }, 10);
      disableBodyScroll();
    }

    /**
     * 關閉匯出到 Google 模態框
     */
    function closeExportToGoogleModal() {
      const modal = document.getElementById('exportToGoogleModal');
      if (modal) {
        modal.classList.remove('show');
        setTimeout(function() { modal.remove(); }, 300);
      }
      enableBodyScroll();
    }

    /**
     * 全選/取消全選匯出金鑰
     */
    function selectAllExportSecrets(selectAll) {
      const checkboxes = document.querySelectorAll('[id^="export-"]');
      checkboxes.forEach(function(cb) {
        cb.checked = selectAll;
      });
    }

    /**
     * 生成匯出二維碼
     */
    async function generateExportQRCodes() {
      // 獲取選中的金鑰
      const selectedSecrets = secrets.filter(function(s, i) {
        const checkbox = document.getElementById('export-' + i);
        return checkbox && checkbox.checked;
      });

      if (selectedSecrets.length === 0) {
        showCenterToast('⚠️', (typeof t === 'function' ? t('googleExportSelectAtLeastOne') : null) || 'Please select at least one key');
        return;
      }

      // 關閉選擇模態框
      closeExportToGoogleModal();

      // 分批處理（每批最多 10 個）
      const batchSize = 10;
      const batches = [];
      for (let i = 0; i < selectedSecrets.length; i += batchSize) {
        batches.push(selectedSecrets.slice(i, i + batchSize));
      }

      // 生成一個批次ID，所有二維碼使用同一個ID
      const batchId = Math.floor(Math.random() * 1000000);

      // 顯示二維碼
      showExportQRCodeModal(batches, 0, batchId);
    }

    /**
     * 顯示匯出二維碼模態框
     * @param {Array} batches - 分批後的金鑰陣列
     * @param {number} currentPage - 當前頁碼
     * @param {number} batchId - 批次ID (所有二維碼使用相同ID)
     */
    async function showExportQRCodeModal(batches, currentPage, batchId) {
      const totalPages = batches.length;
      const currentBatch = batches[currentPage];

      // 生成當前批次的遷移 URL，傳入批次資訊
      const batchInfo = {
        totalBatches: totalPages,
        batchIndex: currentPage,
        batchId: batchId
      };
      const migrationURL = generateGoogleMigrationURL(currentBatch, batchInfo);

      // 建立或更新模態框（翻頁時複用同一個 modal，避免重複鎖定 body scroll）
      let modal = document.getElementById('exportQRCodeModal');
      const wasAlreadyOpen = !!modal && (modal.classList.contains('show') || modal.style.display === 'flex');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'exportQRCodeModal';
        modal.className = 'modal fab-modal-sm';
        modal.style.display = 'flex';
        document.body.appendChild(modal);
      }

      const startIndex = currentPage * 10 + 1;
      const endIndex = Math.min((currentPage + 1) * 10, (currentPage * 10) + currentBatch.length);
      const totalSecrets = batches.reduce(function(sum, b) { return sum + b.length; }, 0);

      modal.innerHTML =
        '<div class="modal-content fab-modal-sm-content">' +
          '<div class="modal-header">' +
            '<h2>' + ((typeof t === 'function' ? t('googleScanModalTitle') : null) || 'Scan to Import to Google Authenticator') + '</h2>' +
            '<button class="close-btn" type="button" aria-label="' + ((typeof t === 'function' ? t('closeModalAriaLabel') : null) || 'Close dialog') + '" onclick="closeExportQRCodeModal()">' + dialogIcon('close') + '</button>' +
          '</div>' +
          '<div class="modal-body">' +
            (totalPages > 1 ?
              '<p style="margin-bottom: 10px; color: var(--text-secondary);">' + ((typeof t === 'function' ? t('googleScanStepLabel', { current: currentPage + 1, total: totalPages }) : null) || ('QR code ' + (currentPage + 1) + '/' + totalPages)) + '</p>' :
              '<p style="margin-bottom: 10px; color: var(--text-secondary);">' + ((typeof t === 'function' ? t('googleScanTotalSecrets', { count: totalSecrets }) : null) || ('Total ' + totalSecrets + ' keys')) + '</p>'
            ) +
            '<div class="qr-code-container" style="display: flex; justify-content: center; align-items: center; min-height: 250px; background: white; border-radius: 12px; padding: 20px; margin-bottom: 15px;">' +
              '<div style="color: #666;">' + ((typeof t === 'function' ? t('generatingQrCode') : null) || 'Generating...') + '</div>' +
            '</div>' +
            '<div style="margin-bottom: 15px; font-size: var(--dialog-caption-size); color: var(--text-tertiary);">' +
              ((typeof t === 'function' ? t('googleScanInstruction') : null) || 'Scan this QR code with Google Authenticator') +
              (totalPages > 1 ? '<br>' + ((typeof t === 'function' ? t('googleScanMultiHint', { total: totalPages }) : null) || (' (Scan all ' + totalPages + ' QR codes in order)')) : '') +
            '</div>' +
            (totalPages > 1 ?
              '<div style="display: flex; gap: 10px; margin-bottom: 15px;">' +
                '<button class="btn btn-secondary" style="flex: 1;" onclick="showExportQRCodePage(' + (currentPage - 1) + ')" ' + (currentPage === 0 ? 'disabled' : '') + '>' + ((typeof t === 'function' ? t('prev') : null) || 'Previous') + '</button>' +
                '<button class="btn btn-secondary" style="flex: 1;" onclick="showExportQRCodePage(' + (currentPage + 1) + ')" ' + (currentPage === totalPages - 1 ? 'disabled' : '') + '>' + ((typeof t === 'function' ? t('next') : null) || 'Next') + '</button>' +
              '</div>' : ''
            ) +
            '<button class="btn btn-primary" style="width: 100%;" onclick="closeExportQRCodeModal()">' + ((typeof t === 'function' ? t('googleScanDoneBtn') : null) || 'Done') + '</button>' +
          '</div>' +
        '</div>';

      // 儲存批次資料和batchId供翻頁使用
      window.exportQRCodeBatches = batches;
      window.exportQRCodeBatchId = batchId;

      setTimeout(function() { modal.classList.add('show'); }, 10);
      // 僅首次開啟時鎖 body scroll；翻頁複用同一 modal 不再重複加鎖
      if (!wasAlreadyOpen) {
        disableBodyScroll();
      }

      // 生成二維碼
      try {
        const qrDataURL = await generateQRCodeDataURL(migrationURL, { width: 250, height: 250 });
        const container = modal.querySelector('.qr-code-container');
        container.innerHTML = '<img src="' + qrDataURL + '" alt="Migration QR Code" style="width: 250px; height: 250px; border-radius: 8px;">';
      } catch (error) {
        console.error('生成二维码失败:', error);
        const container = modal.querySelector('.qr-code-container');
        container.innerHTML = '<div style="color: #e74c3c;">' + ((typeof t === 'function' ? t('failedToGenerate') : null) || 'Failed to generate: ') + escapeHTML(error.message) + '</div>';
      }
    }

    /**
     * 切換匯出二維碼頁面
     */
    function showExportQRCodePage(page) {
      if (window.exportQRCodeBatches && page >= 0 && page < window.exportQRCodeBatches.length) {
        showExportQRCodeModal(window.exportQRCodeBatches, page, window.exportQRCodeBatchId);
      }
    }

    /**
     * 關閉匯出二維碼模態框
     */
    function closeExportQRCodeModal() {
      const modal = document.getElementById('exportQRCodeModal');
      if (modal) {
        modal.classList.remove('show');
        setTimeout(function() { modal.remove(); }, 300);
      }
      window.exportQRCodeBatches = null;
      window.exportQRCodeBatchId = null;
      enableBodyScroll();
    }

    // ==================== 匯入 UI ====================

    /**
     * 顯示 Google 遷移匯入預覽
     */
    function showGoogleMigrationPreview(parsedSecrets) {
      // 冪等：若上一次 closeMigrationPreview 的 300ms 延遲移除還沒觸發，
      // 先立即移除舊 modal，避免新舊兩個同 id modal 在 DOM 中短暫共存
      const existingModal = document.getElementById('migrationPreviewModal');
      if (existingModal) {
        existingModal.remove();
      }

      // 建立預覽模態框
      const modal = document.createElement('div');
      modal.id = 'migrationPreviewModal';
      modal.className = 'modal fab-modal';
      modal.style.display = 'flex';

      const content = document.createElement('div');
      content.className = 'modal-content fab-modal-content';

      content.innerHTML =
        '<div class="modal-header">' +
          '<h2>' + ((typeof t === 'function' ? t('googleImportTitle') : null) || 'Google Authenticator Import') + '</h2>' +
          '<button class="close-btn" type="button" aria-label="' + ((typeof t === 'function' ? t('closeModalAriaLabel') : null) || 'Close dialog') + '" onclick="closeMigrationPreview()">' + dialogIcon('close') + '</button>' +
        '</div>' +
        '<div class="modal-body">' +
          '<p style="margin-bottom: 15px; color: var(--text-secondary);">' + ((typeof t === 'function' ? t('googleImportDetected', { count: parsedSecrets.length }) : null) || ('Detected <strong>' + parsedSecrets.length + '</strong> keys. Confirm import?')) + '</p>' +
          '<div class="migration-preview-list" style="max-height: 300px; overflow-y: auto; border: 1px solid var(--border-primary); border-radius: 8px; margin-bottom: 15px;">' +
            parsedSecrets.map(function(s, i) {
              return '<div class="migration-preview-item" style="padding: 12px; border-bottom: 1px solid var(--border-primary); display: flex; align-items: center; gap: 10px;">' +
                '<input type="checkbox" id="migrate-' + i + '" checked style="width: 18px; height: 18px;">' +
                '<div style="flex: 1; min-width: 0;">' +
                  '<div style="font-weight: 600; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">' + escapeHTML(s.issuer || s.name || ((typeof t === 'function' ? t('unknownService') : null) || 'Unknown Service')) + '</div>' +
                  '<div style="font-size: var(--dialog-caption-size); color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">' + escapeHTML(s.name || '') + '</div>' +
                '</div>' +
                '<span style="font-size: var(--dialog-caption-size); padding: 2px 6px; background: var(--bg-tertiary); border-radius: 4px; color: var(--text-tertiary);">' + escapeHTML(s.type || 'TOTP') + '</span>' +
              '</div>';
            }).join('') +
          '</div>' +
          '<div style="display: flex; gap: 10px;">' +
            '<button class="btn btn-secondary" style="flex: 1;" onclick="closeMigrationPreview()">' + ((typeof t === 'function' ? t('cancel') : null) || 'Cancel') + '</button>' +
            '<button class="btn btn-primary" style="flex: 1;" onclick="confirmGoogleMigration()">' + ((typeof t === 'function' ? t('googleImportConfirmBtn') : null) || 'Import Selected') + '</button>' +
          '</div>' +
        '</div>';

      modal.appendChild(content);
      document.body.appendChild(modal);

      // 儲存金鑰資料供匯入使用
      window.pendingMigrationSecrets = parsedSecrets;

      setTimeout(function() { modal.classList.add('show'); }, 10);
      disableBodyScroll();
    }

    /**
     * 關閉遷移預覽模態框
     */
    function closeMigrationPreview(preservePendingSecrets) {
      const modal = document.getElementById('migrationPreviewModal');
      if (modal) {
        modal.classList.remove('show');
        setTimeout(function() { modal.remove(); }, 300);
      }
      if (!preservePendingSecrets) {
        // 續傳未觸發 / 使用者主動取消時，連帶清掉累計的失敗明細，避免下一次匯入串入舊狀態
        window.pendingMigrationSecrets = null;
        window.pendingMigrationPriorSuccessCount = 0;
        window.pendingMigrationPriorFailCount = 0;
        window.pendingMigrationPriorFailures = [];
      }
      enableBodyScroll();
    }

    /**
     * 顯示匯入結果模態框（包含失敗詳情）
     */
    function showImportResultModal(successCount, failCount, failedDetails) {
      // 建立結果模態框
      const modal = document.createElement('div');
      modal.id = 'importResultModal';
      modal.className = 'modal fab-modal-sm';
      modal.style.display = 'flex';

      const content = document.createElement('div');
      content.className = 'modal-content fab-modal-sm-content';

      content.innerHTML =
        '<div class="modal-header">' +
          '<h2>' + ((typeof t === 'function' ? t('googleResultTitle') : null) || 'Import Results') + '</h2>' +
          '<button class="close-btn" type="button" aria-label="' + ((typeof t === 'function' ? t('closeModalAriaLabel') : null) || 'Close dialog') + '" onclick="closeImportResultModal()">' + dialogIcon('close') + '</button>' +
        '</div>' +
        '<div class="modal-body">' +
          '<div style="text-align: center; margin-bottom: 20px;">' +
            '<div class="dialog-result-icon">' + dialogIcon(failCount ? 'warning' : 'check') + '</div>' +
            '<div style="font-size: var(--dialog-body-size); color: var(--text-primary);">' +
              ((typeof t === 'function' ? t('googleResultSuccess', { count: successCount }) : null) || ('Success: <span style="color: var(--dialog-success); font-weight: bold;">' + successCount + '</span>')) + ', ' +
              ((typeof t === 'function' ? t('googleResultFail', { count: failCount }) : null) || ('Failed: <span style="color: var(--dialog-danger); font-weight: bold;">' + failCount + '</span>')) +
            '</div>' +
          '</div>' +
          '<div style="background: var(--bg-secondary); border-radius: 8px; padding: 15px; margin-bottom: 15px;">' +
            '<div style="font-weight: 600; margin-bottom: 10px; color: var(--dialog-danger);">' + ((typeof t === 'function' ? t('googleResultFailDetails') : null) || 'Failure Details:') + '</div>' +
            '<div style="font-size: var(--dialog-caption-size); color: var(--text-secondary); white-space: pre-wrap; line-height: 1.6;">' + escapeHTML(failedDetails) + '</div>' +
          '</div>' +
          '<div class="dialog-result-actions">' +
            '<button class="btn btn-primary" onclick="closeImportResultModal()">' + ((typeof t === 'function' ? t('ok') : null) || 'OK') + '</button>' +
          '</div>' +
        '</div>';

      modal.appendChild(content);
      document.body.appendChild(modal);

      setTimeout(function() { modal.classList.add('show'); }, 10);
      disableBodyScroll();
    }

    /**
     * 關閉匯入結果模態框
     */
    function closeImportResultModal() {
      const modal = document.getElementById('importResultModal');
      if (modal) {
        modal.classList.remove('show');
        setTimeout(function() { modal.remove(); }, 300);
      }
      enableBodyScroll();
    }

    /**
     * 確認匯入 Google 遷移的金鑰
     */
    // 由構建期從 LIMITS.BULK_IMPORT_CHUNK_SIZE 注入，與後端 batch.js/validation.js 保持一致
    const GOOGLE_MIGRATION_IMPORT_CHUNK_SIZE = ${LIMITS.BULK_IMPORT_CHUNK_SIZE};

    function splitGoogleMigrationImportItems(items, chunkSize) {
      const chunks = [];
      for (let i = 0; i < items.length; i += chunkSize) {
        chunks.push(items.slice(i, i + chunkSize));
      }
      return chunks;
    }

    async function readGoogleMigrationImportErrorMessage(response) {
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

    function createGoogleMigrationImportError(message, meta) {
      const error = new Error(message);
      Object.assign(error, meta);
      return error;
    }

    async function importGoogleMigrationSecretsIndividually(items, startIndex) {
      let successCount = 0;
      let failCount = 0;
      const results = [];

      for (let index = 0; index < items.length; index++) {
        const item = items[index];
        const globalIndex = startIndex + index;

        try {
          const response = await authenticatedFetch('/api/secrets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item)
          });

          if (response.ok) {
            successCount++;
            results.push({
              index: globalIndex,
              success: true,
              secret: {
                name: item.name
              }
            });
          } else {
            failCount++;
            const errorMessage = await readGoogleMigrationImportErrorMessage(response);
            results.push({
              index: globalIndex,
              success: false,
              error: errorMessage
            });
          }
        } catch (error) {
          failCount++;
          const errorMessage = error && error.message ? error.message : 'Unknown error';
          results.push({
            index: globalIndex,
            success: false,
            error: errorMessage
          });
        }
      }

      return { successCount, failCount, results };
    }

    async function importGoogleMigrationSecretsInChunks(items) {
      let successCount = 0;
      let failCount = 0;
      const results = [];
      const chunks = splitGoogleMigrationImportItems(items, GOOGLE_MIGRATION_IMPORT_CHUNK_SIZE);

      for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
        const chunk = chunks[chunkIndex];
        const startIndex = chunkIndex * GOOGLE_MIGRATION_IMPORT_CHUNK_SIZE;

        try {
          const response = await authenticatedFetch('/api/secrets/batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              secrets: chunk,
              immediateBackup: chunkIndex === chunks.length - 1,
              chunkIndex: chunkIndex + 1,
              chunkCount: chunks.length
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

            continue;
          }

          if (response.status === 429) {
            throw createGoogleMigrationImportError('\u6279\u91cf\u5bfc\u5165\u88ab\u9650\u6d41\uff0c\u5df2\u505c\u6b62\u540e\u7eed\u63d0\u4ea4\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002', {
              partialSuccessCount: successCount,
              partialFailCount: failCount,
              processedItems: successCount + failCount,
              results: results.slice(),
              chunkIndex: chunkIndex + 1,
              chunkCount: chunks.length
            });
          }
          if (response.status >= 500) {
            throw createGoogleMigrationImportError('\u7b2c ' + (chunkIndex + 1) + ' / ' + chunks.length + ' \u6279\u5bfc\u5165\u54cd\u5e94\u5f02\u5e38\uff0c\u5f53\u524d\u6279\u6b21\u7ed3\u679c\u53ef\u80fd\u672a\u77e5\uff0c\u8bf7\u5237\u65b0\u540e\u6838\u5bf9\u5df2\u5bfc\u5165\u6570\u636e\u3002', {
              partialSuccessCount: successCount,
              partialFailCount: failCount,
              processedItems: successCount + failCount,
              results: results.slice(),
              chunkIndex: chunkIndex + 1,
              chunkCount: chunks.length
            });
          }
          throw createGoogleMigrationImportError('\u7b2c ' + (chunkIndex + 1) + ' / ' + chunks.length + ' \u6279\u5bfc\u5165\u5931\u8d25\uff1a' + (await readGoogleMigrationImportErrorMessage(response)) + '\uff0c\u5df2\u505c\u6b62\u540e\u7eed\u63d0\u4ea4\u3002', {
            partialSuccessCount: successCount,
            partialFailCount: failCount,
            processedItems: successCount + failCount,
            results: results.slice(),
            chunkIndex: chunkIndex + 1,
            chunkCount: chunks.length
          });

        } catch (error) {
          throw createGoogleMigrationImportError(
            error instanceof Error
              ? error.message
              : '\u7b2c ' + (chunkIndex + 1) + ' / ' + chunks.length + ' \u6279\u8bf7\u6c42\u5931\u8d25\uff0c\u5f53\u524d\u6279\u6b21\u7ed3\u679c\u53ef\u80fd\u672a\u77e5\uff0c\u8bf7\u5237\u65b0\u540e\u6838\u5bf9\u5df2\u5bfc\u5165\u6570\u636e\u3002',
            {
              partialSuccessCount: successCount,
              partialFailCount: failCount,
              processedItems: successCount + failCount,
              results: results.slice(),
              chunkIndex: chunkIndex + 1,
              chunkCount: chunks.length,
              cause: error
            }
          );
        }
      }

      return { successCount, failCount, results };
    }

    async function confirmGoogleMigration() {
      const pendingSecrets = window.pendingMigrationSecrets;
      if (!pendingSecrets || pendingSecrets.length === 0) {
        showCenterToast('❌', (typeof t === 'function' ? t('googleNoSecretsToExport') : null) || 'No keys to import');
        closeMigrationPreview();
        return;
      }

      const selectedSecrets = pendingSecrets.filter(function(s, i) {
        const checkbox = document.getElementById('migrate-' + i);
        return checkbox && checkbox.checked;
      });

      if (selectedSecrets.length === 0) {
        showCenterToast('⚠️', (typeof t === 'function' ? t('googleExportSelectAtLeastOne') : null) || 'Please select at least one key');
        return;
      }

      window.pendingMigrationSecrets = selectedSecrets.slice();
      closeMigrationPreview(true);
      showCenterToast('⏳', (typeof t === 'function' ? t('googleImportingWithCount', { count: selectedSecrets.length }) : null) || ('Importing ' + selectedSecrets.length + ' keys...'));

      const secretsToImport = selectedSecrets.map(function(secret) {
        let serviceName = secret.issuer || '';
        let accountName = secret.name || '';

        if (!serviceName && accountName.includes(':')) {
          const parts = accountName.split(':');
          serviceName = parts[0];
          accountName = parts.slice(1).join(':');
        }

        if (!serviceName) {
          serviceName = accountName || ((typeof t === 'function' ? t('importedSecret') : null) || 'Imported Key');
        }

        return {
          name: serviceName,
          account: accountName,
          secret: secret.secret,
          type: secret.type,
          digits: secret.digits,
          period: secret.period,
          algorithm: secret.algorithm,
          counter: secret.counter || 0
        };
      });

      // 本輪進入時從 prior 狀態繼承（續傳時非零），完成/部分失敗時再寫回。
      // 關鍵不變數：accumulate results across retries，讓最終 showImportResultModal 彙總整批（含早先分片裡被服務端拒絕的條目）
      const priorSuccessCountAtStart = typeof window.pendingMigrationPriorSuccessCount === 'number' ? window.pendingMigrationPriorSuccessCount : 0;
      const priorFailCountAtStart = typeof window.pendingMigrationPriorFailCount === 'number' ? window.pendingMigrationPriorFailCount : 0;
      const priorFailuresAtStart = Array.isArray(window.pendingMigrationPriorFailures) ? window.pendingMigrationPriorFailures.slice() : [];

      function buildFailureLine(originalSecret, errMsg) {
        const name = originalSecret ? (originalSecret.issuer || originalSecret.name || 'Unknown') : 'Unknown';
        return '• ' + name + ': ' + (errMsg || 'Unknown error');
      }

      try {
        const importResult = await importGoogleMigrationSecretsInChunks(secretsToImport);
        const successCount = importResult.successCount;
        const failCount = importResult.failCount;
        const results = importResult.results;

        await loadSecrets();

        const thisRunFailures = (results || [])
          .filter(function(r) { return r && r.success === false; })
          .map(function(r) { return buildFailureLine(selectedSecrets[r.index], r.error); });

        const aggregateSuccess = priorSuccessCountAtStart + successCount;
        const aggregateFail = priorFailCountAtStart + failCount;
        const aggregateFailureLines = priorFailuresAtStart.concat(thisRunFailures);

        // 成功完成整批，清空續傳狀態
        window.pendingMigrationSecrets = null;
        window.pendingMigrationPriorSuccessCount = 0;
        window.pendingMigrationPriorFailCount = 0;
        window.pendingMigrationPriorFailures = [];

        if (aggregateFail === 0) {
          showCenterToast('✅', (typeof t === 'function' ? t('googleImportSuccessSummary', { count: aggregateSuccess }) : null) || ('Successfully imported ' + aggregateSuccess + ' keys'));
        } else {
          showImportResultModal(aggregateSuccess, aggregateFail, aggregateFailureLines.join('\\n'));
        }
      } catch (error) {
        console.error('Google 迁移批量导入出错:', error);
        const partialSuccessCount = typeof error?.partialSuccessCount === 'number' ? error.partialSuccessCount : 0;
        const partialFailCount = typeof error?.partialFailCount === 'number' ? error.partialFailCount : 0;
        const processedItems = Math.min(
          typeof error?.processedItems === 'number' ? error.processedItems : partialSuccessCount + partialFailCount,
          selectedSecrets.length
        );
        const remainingSecrets = selectedSecrets.slice(processedItems);

        // 本輪已完成分片裡的失敗項（服務端返回的 per-item error）併入 prior 累計
        const thisRunFailures = Array.isArray(error?.results)
          ? error.results
              .filter(function(r) { return r && r.success === false; })
              .map(function(r) { return buildFailureLine(selectedSecrets[r.index], r.error); })
          : [];
        const aggregateSuccess = priorSuccessCountAtStart + partialSuccessCount;
        const aggregateFail = priorFailCountAtStart + partialFailCount;
        const aggregateFailureLines = priorFailuresAtStart.concat(thisRunFailures);

        await loadSecrets();

        if (remainingSecrets.length > 0) {
          // 續傳：把累計狀態持久化，下一輪 confirmGoogleMigration 會讀回來
          window.pendingMigrationSecrets = remainingSecrets;
          window.pendingMigrationPriorSuccessCount = aggregateSuccess;
          window.pendingMigrationPriorFailCount = aggregateFail;
          window.pendingMigrationPriorFailures = aggregateFailureLines;

          if (aggregateSuccess > 0) {
            showCenterToast('⚠️', (typeof t === 'function' ? t('googleImportPartialSuccess', { count: aggregateSuccess, remaining: remainingSecrets.length, error: error.message }) : null) || ('Imported ' + aggregateSuccess + ' keys, ' + remainingSecrets.length + ' remaining: ' + error.message));
          } else {
            showCenterToast('❌', (typeof t === 'function' ? t('googleImportInterrupted', { remaining: remainingSecrets.length, error: error.message }) : null) || ('Import interrupted, ' + remainingSecrets.length + ' keys remaining: ' + error.message));
          }
          showGoogleMigrationPreview(remainingSecrets);
        } else if (aggregateSuccess > 0 || aggregateFail > 0) {
          // 沒有剩餘可續傳、但本輪或之前已有實際處理結果：彙總展示，清空續傳狀態
          window.pendingMigrationSecrets = null;
          window.pendingMigrationPriorSuccessCount = 0;
          window.pendingMigrationPriorFailCount = 0;
          window.pendingMigrationPriorFailures = [];

          if (aggregateFail === 0) {
            showCenterToast('⚠️', (typeof t === 'function' ? t('googleImportStopped', { count: aggregateSuccess, error: error.message }) : null) || ('Imported ' + aggregateSuccess + ' keys, subsequent stopped: ' + error.message));
          } else {
            showImportResultModal(aggregateSuccess, aggregateFail, aggregateFailureLines.join('\\n'));
          }
        } else {
          // 首輪未產生任何結果就失敗：重新開啟預覽，讓使用者整批重試
          // （showGoogleMigrationPreview 會把 selectedSecrets 寫回 window.pendingMigrationSecrets）
          showCenterToast('❌', (typeof t === 'function' ? t('importFailed', { error: error.message }) : null) || ('Import failed: ' + error.message));
          showGoogleMigrationPreview(selectedSecrets);
        }
      }
    }
`;
}
