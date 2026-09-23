/**
 * HTTP響應工具模組
 * 提供標準化的響應格式，包含安全頭
 *
 * 🔒 安全特性：
 * - CORS: 動態驗證請求來源
 * - CSP: 內容安全策略
 * - 其他安全頭：X-Frame-Options, X-Content-Type-Options 等
 */

import { getSecurityHeaders } from './security.js';

// 效能最佳化：快取預設 CORS headers，避免重複建立物件
const DEFAULT_CORS_HEADERS = {
	'Access-Control-Allow-Origin': '*',
};

// 效能最佳化：只警告一次（避免在迴圈中重複列印降低效能）
let hasWarnedMissingRequest = false;

/**
 * 重置警告標誌（僅供測試使用）
 * @internal
 */
export function _resetWarningFlag() {
	hasWarnedMissingRequest = false;
}

/**
 * 建立標準JSON響應（帶安全頭）
 * @param {any} data - 響應資料
 * @param {number} status - HTTP狀態碼
 * @param {Request} request - HTTP 請求物件（用於獲取安全頭）
 * @param {Object} additionalHeaders - 額外的響應頭
 * @returns {Response} HTTP響應物件
 */
export function createJsonResponse(data, status = 200, request = null, additionalHeaders = {}) {
	let headers;

	// 新增安全頭（如果提供了 request）
	if (request) {
		const securityHeaders = getSecurityHeaders(request);
		// 效能最佳化：減少物件展開次數
		headers = {
			'Content-Type': 'application/json',
			...securityHeaders,
			...additionalHeaders, // 額外的 headers 優先順序更高
		};
	} else {
		// 向後相容：如果沒有提供 request，使用舊的 CORS 配置
		// 效能最佳化：只警告一次
		if (!hasWarnedMissingRequest) {
			console.warn('⚠️ createJsonResponse 未提供 request 参数，使用默认 CORS 配置');
			hasWarnedMissingRequest = true;
		}

		// 效能最佳化：複用快取的預設 headers
		if (Object.keys(additionalHeaders).length === 0) {
			headers = {
				'Content-Type': 'application/json',
				...DEFAULT_CORS_HEADERS,
			};
		} else {
			headers = {
				'Content-Type': 'application/json',
				...DEFAULT_CORS_HEADERS,
				...additionalHeaders,
			};
		}
	}

	return new Response(JSON.stringify(data), {
		status,
		headers,
	});
}

/**
 * 建立錯誤響應
 * @param {string} title - 錯誤標題
 * @param {string} message - 錯誤詳細資訊
 * @param {number} status - HTTP狀態碼
 * @param {Request} request - HTTP 請求物件（用於獲取安全頭）
 * @returns {Response} 錯誤響應物件
 */
export function createErrorResponse(title, message, status = 500, request = null) {
	const errorData = {
		error: title,
		message: message,
		timestamp: new Date().toISOString(),
	};

	return createJsonResponse(errorData, status, request);
}

/**
 * 建立成功響應
 * @param {any} data - 成功響應資料
 * @param {string} message - 成功訊息
 * @param {Request} request - HTTP 請求物件（用於獲取安全頭）
 * @returns {Response} 成功響應物件
 */
export function createSuccessResponse(data, message, request = null) {
	return createJsonResponse(
		{
			success: true,
			message,
			data,
		},
		200,
		request,
	);
}

/**
 * 建立HTML響應（帶安全頭）
 * @param {string} html - HTML內容
 * @param {number} status - HTTP狀態碼
 * @param {Request} request - HTTP 請求物件（用於獲取安全頭）
 * @returns {Response} HTML響應物件
 */
export function createHtmlResponse(html, status = 200, request = null) {
	let headers = {
		'Content-Type': 'text/html; charset=utf-8',
	};

	// 新增安全頭（如果提供了 request）
	if (request) {
		const securityHeaders = getSecurityHeaders(request);
		headers = {
			...securityHeaders,
			...headers,
		};
	}

	return new Response(html, {
		status,
		headers,
	});
}
