/**
 * Favicon 代理 API
 * 在 Worker 層代理 favicon 請求，支援多個上游源
 * 解決中國網路環境無法訪問 Google Favicon API 的問題
 */

import { createErrorResponse } from '../utils/response.js';
import { getLogger } from '../utils/logger.js';

/**
 * Favicon API 上游源配置
 * 按優先順序排序，失敗時自動降級到下一個源
 *
 * 🌐 源選擇說明：
 * 1. Google - 國際使用者首選（中國大陸可能無法訪問）
 * 2. Yandex - 俄羅斯搜尋引擎（全球包括中國通常可訪問）
 * 3. Direct HTTPS - 直接訪問網站標準位置的favicon
 * 4. Direct HTTP - 兜底方案（某些老舊網站仍使用HTTP）
 */
const FAVICON_SOURCES = [
	{
		name: 'Google',
		url: (domain) => `https://www.google.com/s2/favicons?domain=${domain}&sz=64`,
		timeout: 5000,
	},
	{
		name: 'Yandex',
		url: (domain) => `https://favicon.yandex.net/favicon/${domain}`,
		timeout: 5000,
	},
	{
		name: 'Direct-HTTPS',
		url: (domain) => `https://${domain}/favicon.ico`,
		timeout: 3000,
	},
	{
		name: 'Direct-HTTP',
		url: (domain) => `http://${domain}/favicon.ico`,
		timeout: 3000,
	},
];

/**
 * 處理 favicon 代理請求
 * @param {Request} request - HTTP 請求物件
 * @param {Object} env - 環境變數
 * @param {string} domain - 域名
 * @returns {Response} favicon 圖片響應
 */
export async function handleFaviconProxy(request, env, domain) {
	const logger = getLogger(env);

	// 驗證域名格式
	if (!domain || !isValidDomain(domain)) {
		return createErrorResponse('无效域名', '请提供有效的域名', 400, request);
	}

	// 嘗試從多個源獲取 favicon
	let lastError = null;

	for (const source of FAVICON_SOURCES) {
		try {
			const faviconUrl = source.url(domain);
			logger.debug(`尝试从 ${source.name} 获取 favicon`, { domain, url: faviconUrl });

			// 使用 AbortController 實現超時
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), source.timeout);

			try {
				const response = await fetch(faviconUrl, {
					signal: controller.signal,
					headers: {
						'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
						Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
					},
				});

				clearTimeout(timeoutId);

				// 檢查響應狀態
				if (response.ok && response.headers.get('content-type')?.startsWith('image/')) {
					logger.info(`成功从 ${source.name} 获取 favicon`, { domain });

					// 克隆響應並新增快取頭
					return new Response(response.body, {
						status: response.status,
						statusText: response.statusText,
						headers: {
							'Content-Type': response.headers.get('content-type') || 'image/x-icon',
							'Cache-Control': 'public, max-age=86400', // 快取24小時
							'X-Favicon-Source': source.name,
							'Access-Control-Allow-Origin': '*',
						},
					});
				}

				// 非圖片響應或錯誤狀態，嘗試下一個源
				lastError = new Error(`${source.name} 返回非成功状态: ${response.status}`);
				logger.warn(`${source.name} 获取失败`, { domain, status: response.status });
			} catch (fetchError) {
				clearTimeout(timeoutId);

				if (fetchError.name === 'AbortError') {
					lastError = new Error(`${source.name} 请求超时`);
					logger.warn(`${source.name} 请求超时`, { domain, timeout: source.timeout });
				} else {
					lastError = fetchError;
					logger.warn(`${source.name} 请求失败`, { domain, error: fetchError.message });
				}
			}
		} catch (error) {
			lastError = error;
			logger.error(`${source.name} 处理失败`, { domain, error: error.message });
		}
	}

	// 所有源都失敗，返回錯誤
	logger.error('所有 favicon 源都失败', { domain, lastError: lastError?.message });

	// 返回 404，但不返回錯誤 JSON（讓客戶端的 img onerror 處理）
	return new Response('', {
		status: 404,
		statusText: 'Not Found',
		headers: {
			'Content-Type': 'text/plain',
			'Cache-Control': 'no-cache',
			'X-Favicon-Error': lastError?.message || 'All sources failed',
		},
	});
}

/**
 * 驗證域名格式
 * @param {string} domain - 域名
 * @returns {boolean} 是否有效
 */
function isValidDomain(domain) {
	// 基本的域名格式驗證
	const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

	// 檢查是否包含危險字元
	if (domain.includes('..') || domain.includes('//') || domain.includes('@')) {
		return false;
	}

	return domainRegex.test(domain) && domain.length <= 253;
}
