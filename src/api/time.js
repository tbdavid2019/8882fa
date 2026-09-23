import { createJsonResponse } from '../utils/response.js';

/**
 * 返回 Worker 當前的 Unix 毫秒時間，供客戶端校準 TOTP 時鐘。
 *
 * @param {Request|null} request - HTTP 請求，用於生成安全響應頭
 * @returns {Response} 包含服務端時間的 JSON 響應
 */
export function handleGetTime(request = null) {
	return createJsonResponse({ serverTimeMs: Date.now() }, 200, request, {
		'Cache-Control': 'no-store',
	});
}
