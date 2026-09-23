/**
 * 匯入工具函式模組
 * 包含編碼轉換、格式檢測等通用工具函式
 */

/**
 * 獲取匯入工具函式程式碼
 * @returns {string} JavaScript 程式碼
 */
export function getImportUtilsCode() {
	return String.raw`
    // ========== 匯入工具函式 ==========

    /**
     * 位元組陣列轉 Base32 編碼
     * 用於處理 FreeOTP+ 舊版本的位元組陣列格式金鑰
     * @param {Array<number>} bytes - 位元組陣列
     * @returns {string} Base32 編碼字串
     */
    function bytesToBase32(bytes) {
      const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
      let result = '';
      let bits = 0;
      let value = 0;

      for (let i = 0; i < bytes.length; i++) {
        // 處理有符號位元組（Java 匯出可能是 -128 到 127）
        let byte = bytes[i];
        if (byte < 0) byte += 256;

        value = (value << 8) | byte;
        bits += 8;

        while (bits >= 5) {
          bits -= 5;
          result += alphabet[(value >> bits) & 0x1f];
        }
      }

      // 處理剩餘位
      if (bits > 0) {
        result += alphabet[(value << (5 - bits)) & 0x1f];
      }

      return result;
    }

    /**
     * 十六進位制字串轉 Base32 編碼
     * 用於處理 TOTP Authenticator 的十六進位制格式金鑰
     * @param {string} hex - 十六進位制字串
     * @returns {string} Base32 編碼字串
     */
    function hexToBase32(hex) {
      // 十六進位制轉位元組陣列
      const bytes = [];
      for (let i = 0; i < hex.length; i += 2) {
        bytes.push(parseInt(hex.substr(i, 2), 16));
      }
      // 使用現有的 bytesToBase32 函式
      return bytesToBase32(bytes);
    }

    /**
     * 解析CSV行（處理逗號、引號等轉義）
     * @param {string} line - CSV行
     * @returns {Array<string>} - 欄位陣列
     */
    function parseCSVLine(line) {
      const fields = [];
      let current = '';
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];

        if (char === '"') {
          if (inQuotes && nextChar === '"') {
            // 轉義的引號
            current += '"';
            i++; // 跳过下一个引号
          } else {
            // 切換引號狀態
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          // 欄位分隔符
          fields.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }

      // 新增最後一個欄位
      fields.push(current.trim());

      return fields;
    }

    /**
     * 將 Uint8Array 轉成二進位制字串
     * 保留 Java 序列化等二進位制格式中的原始位元組值
     * @param {Uint8Array} bytes - 原始位元組陣列
     * @returns {string} 二進位制字串
     */
    function bytesToBinaryString(bytes) {
      let result = '';
      const chunkSize = 0x8000;

      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.slice(i, i + chunkSize);
        result += String.fromCharCode.apply(null, Array.from(chunk));
      }

      return result;
    }

    /**
     * 解碼匯入檔案內容
     * 相容普通 UTF-8/UTF-16 文本以及 FreeOTP 的 Java 序列化二進位制備份
     * @param {string} fileName - 檔名
     * @param {ArrayBuffer|Uint8Array} arrayBuffer - 檔案二進位制內容
     * @returns {string} 解碼後的文本內容
     */
    function decodeImportFileContent(fileName, arrayBuffer) {
      const bytes = arrayBuffer instanceof Uint8Array ? arrayBuffer : new Uint8Array(arrayBuffer);
      const lowerFileName = String(fileName || '').toLowerCase();

      if (bytes.length >= 2) {
        if (bytes[0] === 0xff && bytes[1] === 0xfe) {
          return new TextDecoder('utf-16le').decode(bytes);
        }

        if (bytes[0] === 0xfe && bytes[1] === 0xff) {
          return new TextDecoder('utf-16be').decode(bytes);
        }

        // Java Object Serialization Stream Magic: 0xACED
        if (bytes[0] === 0xac && bytes[1] === 0xed) {
          return bytesToBinaryString(bytes);
        }
      }

      const utf8Text = new TextDecoder('utf-8').decode(bytes);
      if (!utf8Text.includes('\uFFFD')) {
        return utf8Text;
      }

      if (lowerFileName.endsWith('.xml') || lowerFileName.endsWith('.authpro') || lowerFileName.endsWith('.encrypt')) {
        return bytesToBinaryString(bytes);
      }

      return utf8Text;
    }
`;
}
