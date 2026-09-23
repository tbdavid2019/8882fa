/**
 * 匯入加密解密模組
 * 包含 TOTP Authenticator、FreeOTP 等加密備份的解密功能
 */

/**
 * 獲取 TOTP Authenticator 解密程式碼
 * @returns {string} JavaScript 程式碼
 */
export function getTOTPAuthDecryptCode() {
	return String.raw`
    // ========== TOTP Authenticator 解密 ==========

    // TOTP Authenticator 備份資料（臨時儲存）
    let totpAuthBackupData = null;

    /**
     * 檢測是否是 TOTP Authenticator 加密備份格式
     * @param {string} content - 檔案內容
     * @returns {boolean} 是否是 TOTP Authenticator 格式
     */
    function isTOTPAuthenticatorBackup(content) {
      // TOTP Authenticator 加密備份是純 Base64 編碼
      // 檢測：只包含 Base64 字元，沒有其他結構
      const trimmed = content.trim();
      // Base64 字元集: A-Z, a-z, 0-9, +, /, =
      const base64Regex = /^[A-Za-z0-9+/=]+$/;
      // 不是 JSON, 不是 XML, 不是 HTML, 只是純 Base64
      if (base64Regex.test(trimmed) &&
          !trimmed.startsWith('{') &&
          !trimmed.startsWith('[') &&
          !trimmed.startsWith('<') &&
          trimmed.length > 100) {
        // 嘗試 Base64 解碼檢查長度是否合理（AES 塊大小的倍數）
        try {
          const decoded = atob(trimmed);
          return decoded.length > 0 && decoded.length % 16 === 0;
        } catch (e) {
          return false;
        }
      }
      return false;
    }

    /**
     * 解密 TOTP Authenticator 加密備份
     * 加密方式: AES-256-CBC, 金鑰 = SHA256(password), IV = 16 位元組 0x00
     * @param {string} content - Base64 編碼的加密內容
     * @param {string} password - 解密密碼
     * @returns {Array<string>} otpauth:// URL 陣列
     */
    async function decryptTOTPAuthenticatorBackup(content, password) {
      const trimmed = content.trim();

      // 生成金鑰: SHA256(password)
      const encoder = new TextEncoder();
      const passwordData = encoder.encode(password);
      const keyHash = await crypto.subtle.digest('SHA-256', passwordData);

      // 匯入 AES 金鑰
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyHash,
        { name: 'AES-CBC' },
        false,
        ['decrypt']
      );

      // IV = 16 位元組 0x00
      const iv = new Uint8Array(16);

      // Base64 解碼
      const encryptedData = Uint8Array.from(atob(trimmed), c => c.charCodeAt(0));

      // AES-CBC 解密
      const decryptedBuffer = await crypto.subtle.decrypt(
        { name: 'AES-CBC', iv: iv },
        cryptoKey,
        encryptedData
      );

      const decryptedText = new TextDecoder().decode(decryptedBuffer);
      console.log('TOTP Authenticator 解密成功');

      // 解析 JSON
      // 格式: {"[json array string]": "timestamp"}
      const jsonData = JSON.parse(decryptedText);

      // 獲取第一個 key（它是一個巢狀的 JSON 陣列字串）
      const keys = Object.keys(jsonData);
      if (keys.length === 0) {
        throw new Error('Decrypted data is empty');
      }

      const entriesJson = keys[0];
      const entries = JSON.parse(entriesJson);

      const otpauthUrls = [];

      entries.forEach((entry, index) => {
        try {
          const issuer = entry.issuer || '';
          const name = entry.name || '';
          let secret = entry.key || '';
          const base = entry.base || 16;

          if (base === 16 && secret) {
            secret = hexToBase32(secret);
          }

          if (!secret) {
            console.warn('跳过无密钥的 TOTP Authenticator 条目 (索引 ' + index + ')');
            return;
          }

          const digits = entry.digits ? parseInt(entry.digits, 10) : 6;
          const period = entry.period ? parseInt(entry.period, 10) : 30;

          let label = '';
          if (issuer && name) {
            label = encodeURIComponent(issuer) + ':' + encodeURIComponent(name);
          } else if (issuer) {
            label = encodeURIComponent(issuer);
          } else if (name) {
            label = encodeURIComponent(name);
          } else {
            label = 'Unknown';
          }

          const params = new URLSearchParams();
          params.set('secret', secret);
          if (issuer) params.set('issuer', issuer);
          if (digits !== 6) params.set('digits', digits);
          if (period !== 30) params.set('period', period);

          const otpauthUrl = 'otpauth://totp/' + label + '?' + params.toString();
          otpauthUrls.push(otpauthUrl);

          console.log('TOTP Authenticator 条目 ' + (index + 1) + ':', issuer, name);
        } catch (err) {
          console.error('解析 TOTP Authenticator 条目失败 (索引 ' + index + '):', err);
        }
      });

      console.log('成功解析 TOTP Authenticator 格式,共 ' + otpauthUrls.length + ' 条');
      return otpauthUrls;
    }

    /**
     * 解密並預覽 TOTP Authenticator 備份
     */
    async function decryptAndPreviewTOTPAuth() {
      const passwordInput = document.getElementById('totpAuthPassword');
      const password = passwordInput ? passwordInput.value : '';

      if (!password) {
        showCenterToast('❌', (typeof t === 'function' ? t('importEnterDecryptPassword') : null) || 'Please enter decryption password');
        return;
      }

      if (!totpAuthBackupData) {
        showCenterToast('❌', (typeof t === 'function' ? t('importBackupDataNotFound') : null) || 'Backup data not found');
        return;
      }

      try {
        showCenterToast('⏳', (typeof t === 'function' ? t('importDecrypting') : null) || 'Decrypting...');

        const otpauthUrls = await decryptTOTPAuthenticatorBackup(totpAuthBackupData, password);

        if (otpauthUrls.length === 0) {
          showCenterToast('⚠️', (typeof t === 'function' ? t('importDecryptSuccessNoSecrets') : null) || 'Decryption succeeded but no valid keys found');
          return;
        }

        document.getElementById('importText').value = otpauthUrls.join('\n');
        previewImport();

        showCenterToast('✅', (typeof t === 'function' ? t('importDecryptSuccessCount', { count: otpauthUrls.length }) : null) || ('Decrypted successfully, ' + otpauthUrls.length + ' keys found'));
      } catch (error) {
        console.error('TOTP Authenticator decrypt failed:', error);
        if (error.message && error.message.includes('decrypt')) {
          showCenterToast('❌', (typeof t === 'function' ? t('importDecryptPasswordIncorrect') : null) || 'Decryption failed: incorrect password');
        } else {
          showCenterToast('❌', ((typeof t === 'function' ? t('importDecryptFailed', { error: error.message || 'Unknown error' }) : null) || ('Decryption failed: ' + (error.message || 'Unknown error'))));
        }
      }
    }
`;
}

/**
 * 獲取 FreeOTP 解密程式碼
 * @returns {string} JavaScript 程式碼
 */
export function getFreeOTPDecryptCode() {
	return String.raw`
    // ========== FreeOTP 解密 ==========

    // FreeOTP 備份資料（臨時儲存）
    let freeotpBackupData = null;

    /**
     * 解析 FreeOTP 加密備份格式（Java 序列化的 HashMap）
     * @param {string} content - 檔案內容
     * @returns {Object|null} 解析結果，包含 tokens、tokenMeta 和 masterKey
     */
    function parseFreeOTPBackup(content) {
      if (!content.includes('java.util.HashMap') && !content.includes('masterKey')) {
        return null;
      }

      const result = {
        tokens: {},
        tokenMeta: {},
        masterKey: null
      };

      try {
        const tokenMetaRegex = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-token[^{]*({[^}]+})/gi;
        let match;
        while ((match = tokenMetaRegex.exec(content)) !== null) {
          const uuid = match[1];
          try {
            const meta = JSON.parse(match[2]);
            result.tokenMeta[uuid] = meta;
          } catch (error) {
            // 解析失敗時靜默跳過該條目
          }
        }

        const uuidRegex = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?!-token)/gi;
        while ((match = uuidRegex.exec(content)) !== null) {
          const uuid = match[1];
          if (!result.tokenMeta[uuid]) {
            continue;
          }

          const startPos = match.index + uuid.length;
          const keyMarker = '{"key":"';
          const keyStart = content.indexOf(keyMarker, startPos);
          if (keyStart === -1 || keyStart >= startPos + 50) {
            continue;
          }

          let depth = 0;
          let inString = false;
          let escape = false;
          let jsonEnd = -1;

          for (let i = keyStart; i < content.length; i++) {
            const char = content[i];
            if (escape) {
              escape = false;
              continue;
            }
            if (char === '\\') {
              escape = true;
              continue;
            }
            if (char === '"') {
              inString = !inString;
            }
            if (!inString) {
              if (char === '{') depth++;
              if (char === '}') {
                depth--;
                if (depth === 0) {
                  jsonEnd = i + 1;
                  break;
                }
              }
            }
          }

          if (jsonEnd <= keyStart) {
            continue;
          }

          try {
            const keyJson = content.substring(keyStart, jsonEnd);
            const keyData = JSON.parse(keyJson);
            if (keyData.key) {
              result.tokens[uuid] = JSON.parse(keyData.key);
            }
          } catch (error) {
            // 解析失敗時靜默跳過該條目
          }
        }

        const masterKeyStart = content.indexOf('"mAlgorithm"');
        if (masterKeyStart !== -1) {
          let jsonStart = masterKeyStart;
          while (jsonStart > 0 && content[jsonStart] !== '{') {
            jsonStart--;
          }

          let braceCount = 0;
          let jsonEnd = jsonStart;
          for (let i = jsonStart; i < content.length; i++) {
            if (content[i] === '{') braceCount++;
            if (content[i] === '}') {
              braceCount--;
              if (braceCount === 0) {
                jsonEnd = i + 1;
                break;
              }
            }
          }

          if (jsonEnd > jsonStart) {
            try {
              const masterKeyJson = content.substring(jsonStart, jsonEnd);
              result.masterKey = JSON.parse(masterKeyJson);
            } catch (error) {
              // masterKey 解析失敗時靜默跳過
            }
          }
        }

        if (Object.keys(result.tokenMeta).length > 0) {
          return result;
        }
      } catch (error) {
        // 解析失敗時返回 null
      }

      return null;
    }

    /**
     * 將 Java 有符號位元組陣列轉換為 Uint8Array
     * @param {Array<number>|Uint8Array} bytes - 原始位元組陣列
     * @returns {Uint8Array} 歸一化後的位元組陣列
     */
    function normalizeFreeOTPByteArray(bytes) {
      if (bytes instanceof Uint8Array) {
        return bytes;
      }

      if (!Array.isArray(bytes)) {
        return new Uint8Array();
      }

      return new Uint8Array(bytes.map(byte => (byte < 0 ? byte + 256 : byte)));
    }

    /**
     * 構建 FreeOTP PBKDF2 hash 候選列表
     * @param {string} algorithm - FreeOTP 備份中的 mAlgorithm
     * @returns {Array<string>} Web Crypto 支援的 hash 名稱候選
     */
    function buildFreeOTPPbkdf2HashCandidates(algorithm) {
      const candidates = [];

      function addCandidate(hashName) {
        if (hashName && !candidates.includes(hashName)) {
          candidates.push(hashName);
        }
      }

      const aliasMap = {
        SHA1: 'SHA-1',
        SHA224: 'SHA-224',
        SHA256: 'SHA-256',
        SHA384: 'SHA-384',
        SHA512: 'SHA-512'
      };

      const normalized = String(algorithm || '')
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '');

      let parsedHash = '';
      const pbkdf2Prefix = 'PBKDF2WITHHMAC';
      if (normalized.startsWith(pbkdf2Prefix)) {
        parsedHash = normalized.slice(pbkdf2Prefix.length);
      } else if (normalized.startsWith('HMAC')) {
        parsedHash = normalized.slice(4);
      } else if (normalized.startsWith('SHA')) {
        parsedHash = normalized;
      }

      addCandidate(aliasMap[parsedHash] || '');

      ['SHA-512', 'SHA-256', 'SHA-1', 'SHA-384', 'SHA-224'].forEach(addCandidate);

      return candidates;
    }

    /**
     * 解析 FreeOTP 的 GCM 引數
     * @param {Array<number>|Uint8Array} parameters - ASN.1 編碼的 GCM 引數
     * @returns {{iv: Uint8Array, tagLengthCandidates: Array<number>}} 解析結果
     */
    function parseFreeOTPGcmParameters(parameters) {
      const bytes = normalizeFreeOTPByteArray(parameters);
      let iv = new Uint8Array();
      let parsedTagLengthBits = null;

      if (bytes.length >= 4 && bytes[0] === 0x30) {
        let cursor = 2;
        while (cursor < bytes.length) {
          const tag = bytes[cursor++];
          if (cursor >= bytes.length) {
            break;
          }

          let length = bytes[cursor++];
          if ((length & 0x80) !== 0) {
            const lengthBytes = length & 0x7f;
            if (cursor + lengthBytes > bytes.length) {
              break;
            }

            length = 0;
            for (let i = 0; i < lengthBytes; i++) {
              length = (length << 8) | bytes[cursor++];
            }
          }

          if (cursor + length > bytes.length) {
            break;
          }

          const value = bytes.slice(cursor, cursor + length);
          if (tag === 0x04 && value.length > 0 && iv.length === 0) {
            iv = value;
          } else if (tag === 0x02 && value.length > 0 && parsedTagLengthBits === null) {
            let parsedValue = 0;
            for (let i = 0; i < value.length; i++) {
              parsedValue = (parsedValue << 8) | value[i];
            }
            if (parsedValue > 0) {
              parsedTagLengthBits = parsedValue <= 16 ? parsedValue * 8 : parsedValue;
            }
          }

          cursor += length;
        }
      }

      if (iv.length === 0 && bytes.length >= 16) {
        iv = bytes.slice(4, 16);
      }

      if (iv.length === 0 && bytes.length > 0) {
        iv = bytes.slice(0, Math.min(12, bytes.length));
      }

      const tagLengthCandidates = [];
      function addTagLength(bits) {
        if (typeof bits !== 'number') {
          return;
        }
        if (bits < 96 || bits > 128 || bits % 8 !== 0) {
          return;
        }
        if (!tagLengthCandidates.includes(bits)) {
          tagLengthCandidates.push(bits);
        }
      }

      addTagLength(parsedTagLengthBits);
      [128, 120, 112, 104, 96].forEach(addTagLength);

      return {
        iv: iv,
        tagLengthCandidates: tagLengthCandidates
      };
    }

    /**
     * 歸一化 AAD 候選列表
     * @param {Array<Uint8Array|string|null|undefined>} aadCandidates - 候選列表
     * @returns {Array<Uint8Array|null>} 去重後的候選列表
     */
    function normalizeFreeOTPAadCandidates(aadCandidates) {
      const normalizedCandidates = [];
      const seen = new Set();

      function addCandidate(candidate) {
        if (candidate == null) {
          if (!seen.has('__none__')) {
            seen.add('__none__');
            normalizedCandidates.push(null);
          }
          return;
        }

        let bytes = candidate;
        if (typeof bytes === 'string') {
          bytes = new TextEncoder().encode(bytes);
        } else if (Array.isArray(bytes)) {
          bytes = new Uint8Array(bytes);
        }

        if (!(bytes instanceof Uint8Array)) {
          return;
        }

        const key = Array.from(bytes).join(',');
        if (!seen.has(key)) {
          seen.add(key);
          normalizedCandidates.push(bytes);
        }
      }

      (aadCandidates || []).forEach(addCandidate);
      addCandidate(null);

      return normalizedCandidates;
    }

    /**
     * 使用多組 AAD 與 tag length 回退解密 FreeOTP GCM 資料
     * @param {CryptoKey} key - AES-GCM 金鑰
     * @param {Array<number>|Uint8Array} cipherText - 密文
     * @param {Array<number>|Uint8Array} parameters - ASN.1 GCM 引數
     * @param {Array<Uint8Array|string|null|undefined>} aadCandidates - AAD 候選列表
     * @returns {Promise<ArrayBuffer>} 解密後的 ArrayBuffer
     */
    async function decryptFreeOTPGcmWithFallback(key, cipherText, parameters, aadCandidates) {
      const normalizedCipherText = normalizeFreeOTPByteArray(cipherText);
      const { iv, tagLengthCandidates } = parseFreeOTPGcmParameters(parameters);
      const normalizedAadCandidates = normalizeFreeOTPAadCandidates(aadCandidates);

      if (iv.length === 0) {
        throw new Error('Missing IV in FreeOTP GCM parameters');
      }

      let lastError = null;
      for (const aad of normalizedAadCandidates) {
        for (const tagLength of tagLengthCandidates) {
          try {
            const decryptParams = {
              name: 'AES-GCM',
              iv: iv,
              tagLength: tagLength
            };

            if (aad) {
              decryptParams.additionalData = aad;
            }

            return await crypto.subtle.decrypt(
              decryptParams,
              key,
              normalizedCipherText
            );
          } catch (error) {
            lastError = error;
          }
        }
      }

      throw lastError || new Error('FreeOTP GCM decryption failed');
    }

    /**
     * 解密 FreeOTP 備份中的金鑰
     * @param {Object} backupData - parseFreeOTPBackup 返回的資料
     * @param {string} password - 使用者密碼
     * @returns {Promise<Array<string>>} otpauth:// URL 陣列
     */
    async function decryptFreeOTPBackup(backupData, password) {
      if (!backupData || !backupData.masterKey) {
        throw new Error('masterKey data not found');
      }

      const masterKeyData = backupData.masterKey;
      const encryptedMasterKey = masterKeyData.mEncryptedKey;
      if (!encryptedMasterKey) {
        throw new Error('Missing encrypted masterKey in backup data');
      }

      const salt = normalizeFreeOTPByteArray(masterKeyData.mSalt);
      const iterations = masterKeyData.mIterations || 100000;
      const passwordBytes = new TextEncoder().encode(password);

      const passwordKey = await crypto.subtle.importKey(
        'raw',
        passwordBytes,
        'PBKDF2',
        false,
        ['deriveKey']
      );

      const masterKeyCipherText = normalizeFreeOTPByteArray(encryptedMasterKey.mCipherText);
      const masterKeyParameters = normalizeFreeOTPByteArray(encryptedMasterKey.mParameters);
      const hashCandidates = buildFreeOTPPbkdf2HashCandidates(masterKeyData.mAlgorithm);

      let decryptedMasterKeyBuffer = null;
      let lastMasterKeyError = null;

      for (const hashName of hashCandidates) {
        try {
          const derivedKey = await crypto.subtle.deriveKey(
            {
              name: 'PBKDF2',
              salt: salt,
              iterations: iterations,
              hash: hashName
            },
            passwordKey,
            { name: 'AES-GCM', length: 256 },
            false,
            ['decrypt']
          );

          decryptedMasterKeyBuffer = await decryptFreeOTPGcmWithFallback(
            derivedKey,
            masterKeyCipherText,
            masterKeyParameters,
            [encryptedMasterKey.mToken, 'AES', null]
          );
          break;
        } catch (error) {
          lastMasterKeyError = error;
        }
      }

      if (!decryptedMasterKeyBuffer) {
        throw lastMasterKeyError || new Error('FreeOTP masterKey decryption failed');
      }

      const masterKey = await crypto.subtle.importKey(
        'raw',
        decryptedMasterKeyBuffer,
        { name: 'AES-GCM' },
        false,
        ['decrypt']
      );

      const otpauthUrls = [];
      for (const [uuid, encryptedToken] of Object.entries(backupData.tokens || {})) {
        const meta = backupData.tokenMeta[uuid];
        if (!meta) {
          continue;
        }

        try {
          const decryptedSecretBuffer = await decryptFreeOTPGcmWithFallback(
            masterKey,
            encryptedToken.mCipherText,
            encryptedToken.mParameters,
            [
              encryptedToken.mToken,
              meta.algo ? 'Hmac' + String(meta.algo).toUpperCase() : null,
              'HmacSHA1',
              null
            ]
          );

          const secretBytes = new Uint8Array(decryptedSecretBuffer);
          const secret = bytesToBase32(Array.from(secretBytes));

          const issuer = meta.issuerExt || meta.issuerInt || '';
          const account = meta.label || '';
          const type = (meta.type || 'TOTP').toLowerCase();

          let label = '';
          if (issuer && account) {
            label = encodeURIComponent(issuer) + ':' + encodeURIComponent(account);
          } else if (issuer) {
            label = encodeURIComponent(issuer);
          } else if (account) {
            label = encodeURIComponent(account);
          } else {
            label = 'Unknown';
          }

          const params = new URLSearchParams();
          params.set('secret', secret);
          if (issuer) params.set('issuer', issuer);
          if (meta.digits && meta.digits !== 6) params.set('digits', meta.digits);
          if (meta.period && meta.period !== 30) params.set('period', meta.period);
          if (meta.algo && meta.algo !== 'SHA1') params.set('algorithm', meta.algo);
          if (type === 'hotp' && meta.counter != null) params.set('counter', meta.counter);

          const protocol = type === 'hotp' ? 'hotp' : 'totp';
          otpauthUrls.push('otpauth://' + protocol + '/' + label + '?' + params.toString());
        } catch (error) {
          console.warn('FreeOTP token 解密失败，已跳过:', uuid, error);
        }
      }

      return otpauthUrls;
    }

    /**
     * 解密並預覽 FreeOTP 備份
     */
    async function decryptAndPreviewFreeOTP() {
      const passwordInput = document.getElementById('freeotpPassword');
      const password = passwordInput ? passwordInput.value : '';

      if (!password) {
        showCenterToast('❌', (typeof t === 'function' ? t('importEnterDecryptPassword') : null) || 'Please enter decryption password');
        return;
      }

      if (!freeotpBackupData) {
        showCenterToast('❌', (typeof t === 'function' ? t('importBackupDataNotFound') : null) || 'Backup data not found');
        return;
      }

      try {
        showCenterToast('⏳', (typeof t === 'function' ? t('importDecrypting') : null) || 'Decrypting...');

        const otpauthUrls = await decryptFreeOTPBackup(freeotpBackupData, password);

        if (otpauthUrls.length === 0) {
          showCenterToast('⚠️', (typeof t === 'function' ? t('importDecryptSuccessNoSecrets') : null) || 'Decryption succeeded but no valid keys found');
          return;
        }

        document.getElementById('importText').value = otpauthUrls.join('\n');
        previewImport();

        showCenterToast('✅', (typeof t === 'function' ? t('importDecryptSuccessCount', { count: otpauthUrls.length }) : null) || ('Decrypted successfully, ' + otpauthUrls.length + ' keys found'));
      } catch (error) {
        console.error('FreeOTP decrypt failed:', error);
        if (error.name === 'OperationError') {
          showCenterToast('❌', (typeof t === 'function' ? t('importDecryptPasswordIncorrect') : null) || 'Decryption failed: password incorrect or format incompatible');
        } else if (error.message && error.message.includes('decrypt')) {
          showCenterToast('❌', (typeof t === 'function' ? t('importDecryptPasswordIncorrect') : null) || 'Decryption failed: incorrect password');
        } else {
          showCenterToast('❌', ((typeof t === 'function' ? t('importDecryptFailed', { error: error.message || 'Unknown error' }) : null) || ('Decryption failed: ' + (error.message || 'Unknown error'))));
        }
      }
    }
`;
}
