/**
 * JavaScript指令碼模組整合
 * 支援核心模組和懶載入模組分離
 */

import { getI18nCode } from './i18n.js';
import { getStateCode } from './state.js';
import { getTimeCode } from './time.js';
import { getAuthCode } from './auth.js';
import { getOTPCode } from './otp.js';
import { getUICode } from './ui.js';
import { getSearchCode } from './search.js';
import { getExportCode } from './export.js';
import { getQRCodeCode } from './qrcode.js';
import { getImportCode } from './import/index.js';
import { getBackupCode } from './backup.js';
import { getToolsCode } from './tools.js';
import { getSettingsCode } from './settings.js';
import { getGoogleMigrationCode } from './googleMigration.js';
import { getCoreCode } from './core.js';
import { getServiceAggregationCode } from './serviceAggregation.js';
import { getUtilsCode } from './utils.js';
import { getPWACode } from './pwa.js';
import { getModuleLoaderCode } from './moduleLoader.js';
import { getVersionCheckCode } from './versionCheck.js';

export { getI18nCode };

/**
 * 獲取核心JavaScript程式碼（首次載入必需）
 * 包含：國際化、狀態管理、時間校準、認證、OTP、UI、搜尋、核心邏輯、PWA、模組載入器
 * @returns {string} 核心JavaScript程式碼
 */
export function getCoreScripts() {
	return `${getI18nCode()}${getUtilsCode()}${getStateCode()}${getTimeCode()}${getAuthCode()}${getOTPCode()}${getUICode()}${getSearchCode()}${getSettingsCode()}${getCoreCode()}${getServiceAggregationCode()}${getPWACode()}${getModuleLoaderCode()}${getVersionCheckCode()}`;
}

/**
 * 獲取完整的JavaScript程式碼（傳統模式，不分割）
 * i18n與Utils必須在最前面，因為其他模組需要使用它們的通用函式
 * @returns {string} 完整的JavaScript程式碼
 */
export function getScripts() {
	// QRCode must come before GoogleMigration, GoogleMigration must come before Export
	// because Export calls showExportToGoogleModal from GoogleMigration
	return `${getI18nCode()}${getUtilsCode()}${getStateCode()}${getTimeCode()}${getAuthCode()}${getOTPCode()}${getUICode()}${getSearchCode()}${getSettingsCode()}${getQRCodeCode()}${getGoogleMigrationCode()}${getExportCode()}${getImportCode()}${getBackupCode()}${getToolsCode()}${getCoreCode()}${getServiceAggregationCode()}${getPWACode()}${getVersionCheckCode()}`;
}

/**
 * 獲取單個模組的程式碼（用於懶載入）
 * @param {string} moduleName - 模組名稱
 * @returns {string} 模組JavaScript程式碼
 */
export function getModuleCode(moduleName) {
	const modules = {
		import: getImportCode,
		export: getExportCode,
		backup: getBackupCode,
		qrcode: getQRCodeCode,
		tools: getToolsCode,
		googleMigration: getGoogleMigrationCode,
	};

	const moduleGetter = modules[moduleName];
	if (!moduleGetter) {
		throw new Error(`Unknown module: ${moduleName}`);
	}

	return moduleGetter();
}
