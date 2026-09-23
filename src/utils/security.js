/**
 * 安全配置模組
 * 統一管理 CORS、CSP 等安全頭配置
 *
 * 🔒 安全特性：
 * - CORS: 限制允許的來源（防止跨域攻擊）
 * - CSP: 內容安全策略（防止 XSS 和資料注入）
 * - 其他安全頭：X-Frame-Options, X-Content-Type-Options 等
 */

/**
 * 動態同源檢查策略
 *
 * 🔒 安全說明：
 * - 前後端部署在同一域名下（Cloudflare Workers）
 * - 只允許與當前 Host 同源的請求
 * - 自動適配任何部署域名（無需硬編碼）
 * - 仍然阻止來自其他網站的跨站請求（CSRF 防護）
 */

/**
 * 內容安全策略 (CSP) 配置
 *
 * 說明：
 * - default-src 'self': 預設只允許同源資源
 * - script-src: 允許內聯指令碼 + 必需的 CDN 庫（jsQR、QRCode）
 * - style-src 'self' 'unsafe-inline': 允許內聯樣式
 * - img-src: 允許同源、data URI、blob 和外部 Logo 圖片
 * - connect-src 'self': 僅允許同源 AJAX 請求
 * - font-src 'self': 僅允許同源字型
 * - object-src 'none': 禁止外掛（Flash、Java 等）
 * - base-uri 'self': 限制 <base> 標籤
 * - form-action 'self': 限制表單提交目標
 * - frame-ancestors 'none': 禁止被嵌入 iframe（防點選劫持）
 * - upgrade-insecure-requests: 自動升級 HTTP 到 HTTPS
 */
const CONTENT_SECURITY_POLICY = [
	"default-src 'self'",
	"script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com",
	"style-src 'self' 'unsafe-inline'",
	"img-src 'self' data: blob: https://logo.clearbit.com https://www.google.com https:",
	"connect-src 'self'",
	"font-src 'self'",
	"object-src 'none'",
	"base-uri 'self'",
	"form-action 'self'",
	"frame-ancestors 'none'",
	'upgrade-insecure-requests',
].join('; ');

/**
 * 檢查請求來源是否與當前 Host 同源
 * @param {string} origin - 請求的 Origin header
 * @param {Request} request - HTTP 請求物件
 * @returns {boolean} 是否允許該來源
 */
function isOriginAllowed(origin, request) {
	if (!origin) {
		return false;
	}

	// 獲取當前請求的 Host
	const host = request.headers.get('Host');
	if (!host) {
		return false;
	}

	// 構建允許的來源列表（同源策略）
	const allowedOrigins = [
		`https://${host}`, // HTTPS（生產環境）
		`http://${host}`, // HTTP（本地開發）
	];

	// 檢查 Origin 是否與當前 Host 同源
	if (allowedOrigins.includes(origin)) {
		return true;
	}

	// 額外相容：localhost 的不同埠
	// 例如：http://localhost:8787、http://localhost:3000
	if (host.startsWith('localhost') || host.startsWith('127.0.0.1')) {
		const originUrl = new URL(origin);
		const hostWithoutPort = host.split(':')[0];
		if (originUrl.hostname === hostWithoutPort || originUrl.hostname === 'localhost' || originUrl.hostname === '127.0.0.1') {
			return true;
		}
	}

	return false;
}

/**
 * 獲取允許的 CORS Origin
 * @param {Request} request - HTTP 請求物件
 * @returns {string} 允許的 Origin 或 'null'
 */
export function getAllowedOrigin(request) {
	const origin = request.headers.get('Origin');

	// 如果沒有 Origin header（同源請求），返回 null
	if (!origin) {
		return null;
	}

	// 檢查是否與當前 Host 同源
	if (isOriginAllowed(origin, request)) {
		return origin; // 返回請求的 Origin（而不是 '*'）
	}

	// 不同源，不設定 CORS header（瀏覽器會阻止）
	return null;
}

/**
 * 獲取標準安全響應頭
 * @param {Request} request - HTTP 請求物件
 * @param {Object} options - 可選配置
 * @param {boolean} options.includeCors - 是否包含 CORS 頭（預設 true）
 * @param {boolean} options.includeCredentials - 是否允許攜帶憑據（預設 true，用於 Cookie）
 * @param {boolean} options.includeCSP - 是否包含 CSP 頭（預設 true）
 * @returns {Object} 安全響應頭物件
 */
export function getSecurityHeaders(request, options = {}) {
	const {
		includeCors = true,
		includeCredentials = true, // HttpOnly Cookie 需要
		includeCSP = true,
	} = options;

	const headers = {};

	// ========== CORS 配置 ==========
	if (includeCors) {
		const allowedOrigin = getAllowedOrigin(request);

		if (allowedOrigin) {
			// 返回具體的 Origin（不是 '*'）
			headers['Access-Control-Allow-Origin'] = allowedOrigin;

			// 當使用具體 Origin 時，必須設定 Vary header
			headers['Vary'] = 'Origin';

			// 如果使用 Cookie，必須允許憑據
			if (includeCredentials) {
				headers['Access-Control-Allow-Credentials'] = 'true';
			}
		}
		// 如果 Origin 不在允許列表，不設定 CORS header，瀏覽器會阻止請求
	}

	// ========== CSP 配置 ==========
	if (includeCSP) {
		headers['Content-Security-Policy'] = CONTENT_SECURITY_POLICY;
	}

	// ========== 其他安全頭 ==========

	// 防止點選劫持（禁止頁面被嵌入 iframe）
	headers['X-Frame-Options'] = 'DENY';

	// 防止 MIME 型別嗅探（強制瀏覽器遵守 Content-Type）
	headers['X-Content-Type-Options'] = 'nosniff';

	// 啟用瀏覽器 XSS 過濾器
	headers['X-XSS-Protection'] = '1; mode=block';

	// Referrer 策略（控制 Referer header 傳送）
	headers['Referrer-Policy'] = 'strict-origin-when-cross-origin';

	// 許可權策略（限制瀏覽器功能訪問）
	headers['Permissions-Policy'] = 'geolocation=(), microphone=(), camera=()';

	return headers;
}

/**
 * 獲取 CORS 預檢請求的響應頭
 * @param {Request} request - HTTP 請求物件
 * @returns {Object} CORS 預檢響應頭
 */
export function getCorsPreflightHeaders(request) {
	const allowedOrigin = getAllowedOrigin(request);

	if (!allowedOrigin) {
		// Origin 不在允許列表，返回空物件（瀏覽器會阻止）
		return {};
	}

	return {
		'Access-Control-Allow-Origin': allowedOrigin,
		'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
		'Access-Control-Allow-Credentials': 'true', // 允許 Cookie
		'Access-Control-Max-Age': '86400', // 預檢快取 24 小時
		Vary: 'Origin',
	};
}

/**
 * 檢查是否為預檢請求
 * @param {Request} request - HTTP 請求物件
 * @returns {boolean} 是否為預檢請求
 */
export function isPreflightRequest(request) {
	return request.method === 'OPTIONS' && request.headers.has('Access-Control-Request-Method');
}

/**
 * 建立 CORS 預檢響應
 * @param {Request} request - HTTP 請求物件
 * @returns {Response|null} 預檢響應或 null
 */
export function createPreflightResponse(request) {
	if (!isPreflightRequest(request)) {
		return null;
	}

	const headers = getCorsPreflightHeaders(request);

	// 如果沒有允許的 Origin，返回 403
	if (Object.keys(headers).length === 0) {
		return new Response('CORS policy violation', {
			status: 403,
			headers: {
				'Content-Type': 'text/plain',
			},
		});
	}

	return new Response(null, {
		status: 204,
		headers,
	});
}

/**
 * 合併安全頭到現有 headers 物件
 * @param {Request} request - HTTP 請求物件
 * @param {Object} existingHeaders - 現有的 headers 物件
 * @param {Object} options - 可選配置
 * @returns {Object} 合併後的 headers 物件
 */
export function mergeSecurityHeaders(request, existingHeaders = {}, options = {}) {
	const securityHeaders = getSecurityHeaders(request, options);
	return {
		...securityHeaders,
		...existingHeaders, // 現有 headers 優先順序更高
	};
}

/**
 * 獲取 CSP 策略（用於文件和除錯）
 * @returns {string} CSP 策略字串
 */
export function getCSPPolicy() {
	return CONTENT_SECURITY_POLICY;
}
