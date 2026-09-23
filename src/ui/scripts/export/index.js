/**
 * 匯出模組入口
 * 組合所有匯出子模組，提供完整的匯出功能
 */

import { getExportUICode } from './ui.js';
import { getExportConfigCode } from './config.js';
import { getStandardFormatsCode } from './formats.js';

/**
 * 獲取所有匯出相關程式碼（向後相容）
 * 注意：由於原始 export.js 包含大量第三方格式匯出程式碼（約1700行），
 * 完整拆分需要建立更多子模組。當前僅拆分了核心部分作為示例。
 * @returns {string} 完整的匯出 JavaScript 程式碼
 */
export function getExportCode() {
	// 組合所有子模組的程式碼
	return ['// ========== 导出功能模块 ==========', getExportConfigCode(), getExportUICode(), getStandardFormatsCode()].join('\n');
}

// 匯出子模組函式，支援按需載入
export { getExportUICode, getExportConfigCode, getStandardFormatsCode };
