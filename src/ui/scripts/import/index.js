/**
 * 匯入模組入口
 * 組合所有匯入子模組，提供完整的匯入功能
 */

import { getImportUtilsCode } from './utils.js';
import { getImportUICode } from './ui.js';
import { getCSVParserCode, getJSONParserCode } from './parsers.js';
import { getHTMLParserCode } from './htmlParser.js';
import { getTOTPAuthDecryptCode, getFreeOTPDecryptCode } from './crypto.js';
import { getPreviewImportCode, getExecuteImportCode } from './core.js';

/**
 * 獲取所有匯入相關程式碼（向後相容）
 * @returns {string} 完整的匯入 JavaScript 程式碼
 */
export function getImportCode() {
	// 組合所有子模組的程式碼
	// 注意順序：工具函式 -> 解析器 -> 加密解密 -> UI -> 核心邏輯
	return [
		'// ========== 导入功能模块 ==========',
		getImportUtilsCode(),
		getCSVParserCode(),
		getJSONParserCode(),
		getHTMLParserCode(),
		getTOTPAuthDecryptCode(),
		getFreeOTPDecryptCode(),
		getImportUICode(),
		getPreviewImportCode(),
		getExecuteImportCode(),
	].join('\n');
}

// 匯出子模組函式，支援按需載入
export {
	getImportUtilsCode,
	getImportUICode,
	getCSVParserCode,
	getJSONParserCode,
	getHTMLParserCode,
	getTOTPAuthDecryptCode,
	getFreeOTPDecryptCode,
	getPreviewImportCode,
	getExecuteImportCode,
};
