import { getSecurityHeaders } from './security.js';
import { getLogger } from './logger.js';

/**
 * Rate Limiting 工具模組 V2 - 滑動視窗演算法
 * 基於 Cloudflare KV 實現的請求頻率限制
 *
 * 🎯 解決問題：
 * - 消除固定視窗的視窗邊界效應
 * - 防止攻擊者利用視窗切換時機突發大量請求
 *
 * 🔧 演算法：滑動視窗 (Sliding Window)
 *
 * 工作原理：
 * 1. 儲存每個請求的精確時間戳（陣列形式）
 * 2. 每次檢查時，過濾掉視窗外的舊時間戳
 * 3. 計算視窗內的有效請求數
 * 4. 如果超過限制，拒絕請求
 *
 * 優點：
 * ✅ 無視窗邊界效應，真正的滑動視窗
 * ✅ 精確的速率控制
 * ✅ 更好的使用者體驗（不會因視窗切換突然重置）
 * ✅ 有效防止突發攻擊
 *
 * 效能最佳化：
 * ✅ 自動清理過期時間戳，控制儲存大小
 * ✅ 單次 KV 操作，減少延遲
 * ✅ 時間戳陣列限制最大長度
 * ✅ 使用 expirationTtl 自動清理過期資料
 *
 * 對比固定視窗：
 * - 儲存成本：略高（儲存時間戳陣列 vs 單個計數）
 * - 計算成本：略高（過濾陣列 vs 簡單計數）
 * - 安全性：顯著提升（無視窗邊界漏洞）
 * - 使用者體驗：更好（平滑的限流）
 */

/**
 * 檢查是否超過速率限制（滑動視窗演算法）
 * @param {string} key - 限流鍵（如 IP 地址、使用者 ID）
 * @param {Object} env - 環境變數物件
 * @param {Object} options - 配置選項
 * @param {number} options.maxAttempts - 時間視窗內最大請求次數
 * @param {number} options.windowSeconds - 時間視窗大小（秒）
 * @returns {Promise<{allowed: boolean, remaining: number, resetAt: number, limit: number, algorithm: string}>}
 */
export async function checkRateLimitSlidingWindow(key, env, options = {}) {
	const { maxAttempts = 5, windowSeconds = 60 } = options;

	const rateLimitKey = `ratelimit:v2:${key}`;
	const logger = getLogger(env);
	const now = Date.now();
	const windowMs = windowSeconds * 1000;
	const windowStart = now - windowMs;

	try {
		// 獲取當前限流資料
		const data = await env.SECRETS_KV.get(rateLimitKey, 'json');

		// 初始化或獲取時間戳陣列
		let timestamps = [];
		if (data && Array.isArray(data.timestamps)) {
			// 過濾掉視窗外的舊時間戳（滑動視窗的核心）
			timestamps = data.timestamps.filter((ts) => ts > windowStart);
		}

		// 檢查是否超過限制
		if (timestamps.length >= maxAttempts) {
			logger.warn('速率限制超出（滑动窗口）', {
				key,
				count: timestamps.length,
				maxAttempts,
				windowSeconds,
				oldestRequest: new Date(timestamps[0]).toISOString(),
				newestRequest: new Date(timestamps[timestamps.length - 1]).toISOString(),
			});

			// 計算最早的請求何時過期（即何時可以再次請求）
			const oldestTimestamp = timestamps[0];
			const resetAt = oldestTimestamp + windowMs;

			return {
				allowed: false,
				remaining: 0,
				resetAt: resetAt,
				limit: maxAttempts,
				algorithm: 'sliding-window',
			};
		}

		// 添加當前請求時間戳
		timestamps.push(now);

		// 效能最佳化：限制陣列最大長度，防止無限增長
		// 只保留最近的 maxAttempts * 2 個時間戳（足夠判斷 + 歷史記錄）
		const maxStoredTimestamps = Math.max(maxAttempts * 2, 20);
		if (timestamps.length > maxStoredTimestamps) {
			timestamps = timestamps.slice(-maxStoredTimestamps);
		}

		// 儲存更新後的時間戳陣列
		await env.SECRETS_KV.put(
			rateLimitKey,
			JSON.stringify({
				timestamps: timestamps,
				lastUpdate: now,
			}),
			{
				// 過期時間設定為視窗大小 + 緩衝時間
				expirationTtl: windowSeconds + 60,
			},
		);

		// 計算下一次重置時間（最早的請求過期的時間）
		const oldestTimestamp = timestamps[0];
		const resetAt = oldestTimestamp + windowMs;

		return {
			allowed: true,
			remaining: maxAttempts - timestamps.length,
			resetAt: resetAt,
			limit: maxAttempts,
			algorithm: 'sliding-window',
		};
	} catch (error) {
		logger.error(
			'速率限制检查失败（滑动窗口）',
			{
				key,
				errorMessage: error.message,
			},
			error,
		);

		// 失敗時允許請求（fail open）
		return {
			allowed: true,
			remaining: maxAttempts,
			resetAt: now + windowMs,
			limit: maxAttempts,
			algorithm: 'sliding-window',
		};
	}
}

/**
 * 檢查是否超過速率限制（自動選擇演算法）
 * 預設使用滑動視窗演算法，可選降級到固定視窗
 * @param {string} key - 限流鍵
 * @param {Object} env - 環境變數物件
 * @param {Object} options - 配置選項
 * @param {string} options.algorithm - 演算法選擇 ('sliding-window' | 'fixed-window')
 * @returns {Promise<{allowed: boolean, remaining: number, resetAt: number, limit: number}>}
 */
export async function checkRateLimit(key, env, options = {}) {
	const algorithm = options.algorithm || 'sliding-window'; // 預設使用滑動視窗

	if (algorithm === 'sliding-window') {
		return checkRateLimitSlidingWindow(key, env, options);
	} else {
		// 固定視窗實現（向後相容）
		return checkRateLimitFixedWindow(key, env, options);
	}
}

/**
 * 檢查是否超過速率限制（固定視窗演算法 - 向後相容）
 * @param {string} key - 限流鍵
 * @param {Object} env - 環境變數物件
 * @param {Object} options - 配置選項
 * @returns {Promise<{allowed: boolean, remaining: number, resetAt: number, limit: number}>}
 */
async function checkRateLimitFixedWindow(key, env, options = {}) {
	const { maxAttempts = 5, windowSeconds = 60 } = options;

	const rateLimitKey = `ratelimit:${key}`;
	const logger = getLogger(env);

	try {
		const data = await env.SECRETS_KV.get(rateLimitKey, 'json');
		const now = Date.now();

		if (!data || now > data.resetAt) {
			const newResetAt = now + windowSeconds * 1000;

			await env.SECRETS_KV.put(
				rateLimitKey,
				JSON.stringify({
					count: 1,
					resetAt: newResetAt,
					firstRequest: now,
				}),
				{ expirationTtl: windowSeconds + 10 },
			);

			return {
				allowed: true,
				remaining: maxAttempts - 1,
				resetAt: newResetAt,
				limit: maxAttempts,
				algorithm: 'fixed-window',
			};
		}

		if (data.count >= maxAttempts) {
			logger.warn('速率限制超出（固定窗口）', {
				key,
				count: data.count,
				maxAttempts,
				resetAt: new Date(data.resetAt).toISOString(),
			});

			return {
				allowed: false,
				remaining: 0,
				resetAt: data.resetAt,
				limit: maxAttempts,
				algorithm: 'fixed-window',
			};
		}

		data.count++;
		const ttl = Math.ceil((data.resetAt - now) / 1000) + 10;

		await env.SECRETS_KV.put(rateLimitKey, JSON.stringify(data), { expirationTtl: Math.max(ttl, windowSeconds + 10) });

		return {
			allowed: true,
			remaining: maxAttempts - data.count,
			resetAt: data.resetAt,
			limit: maxAttempts,
			algorithm: 'fixed-window',
		};
	} catch (error) {
		logger.error(
			'速率限制检查失败（固定窗口）',
			{
				key,
				errorMessage: error.message,
			},
			error,
		);

		return {
			allowed: true,
			remaining: maxAttempts,
			resetAt: Date.now() + windowSeconds * 1000,
			limit: maxAttempts,
			algorithm: 'fixed-window',
		};
	}
}

/**
 * 重置指定鍵的速率限制
 * @param {string} key - 限流鍵
 * @param {Object} env - 環境變數物件
 * @returns {Promise<void>}
 */
export async function resetRateLimit(key, env) {
	const logger = getLogger(env);

	try {
		// 清理兩個版本的資料
		await Promise.all([
			env.SECRETS_KV.delete(`ratelimit:${key}`), // v1 固定視窗
			env.SECRETS_KV.delete(`ratelimit:v2:${key}`), // v2 滑動視窗
		]);
		logger.info('速率限制已重置', { key });
	} catch (error) {
		logger.error(
			'重置速率限制失败',
			{
				key,
				errorMessage: error.message,
			},
			error,
		);
	}
}

/**
 * 獲取速率限制資訊（不增加計數）
 * @param {string} key - 限流鍵
 * @param {Object} env - 環境變數物件
 * @param {Object|number} optionsOrMaxAttempts - 配置選項或最大嘗試次數（向後相容）
 * @returns {Promise<{count: number, remaining: number, resetAt: number, limit: number}>}
 */
export async function getRateLimitInfo(key, env, optionsOrMaxAttempts = {}) {
	// 向後相容：如果傳入的是數字，轉換為options物件
	let options;
	if (typeof optionsOrMaxAttempts === 'number') {
		options = {
			maxAttempts: optionsOrMaxAttempts,
			windowSeconds: 60,
			algorithm: 'sliding-window',
		};
	} else {
		options = optionsOrMaxAttempts;
	}

	const { maxAttempts = 5, windowSeconds = 60, algorithm = 'sliding-window' } = options;

	const rateLimitKey = algorithm === 'sliding-window' ? `ratelimit:v2:${key}` : `ratelimit:${key}`;
	const logger = getLogger(env);
	const now = Date.now();
	const windowMs = windowSeconds * 1000;

	try {
		const data = await env.SECRETS_KV.get(rateLimitKey, 'json');

		if (!data) {
			return {
				count: 0,
				remaining: maxAttempts,
				resetAt: now,
				limit: maxAttempts,
				algorithm,
			};
		}

		if (algorithm === 'sliding-window' && Array.isArray(data.timestamps)) {
			// 滑動視窗：過濾有效時間戳
			const windowStart = now - windowMs;
			const validTimestamps = data.timestamps.filter((ts) => ts > windowStart);
			const oldestTimestamp = validTimestamps[0] || now;
			const resetAt = oldestTimestamp + windowMs;

			return {
				count: validTimestamps.length,
				remaining: Math.max(0, maxAttempts - validTimestamps.length),
				resetAt: resetAt,
				limit: maxAttempts,
				algorithm,
			};
		} else {
			// 固定視窗
			if (now > data.resetAt) {
				return {
					count: 0,
					remaining: maxAttempts,
					resetAt: now,
					limit: maxAttempts,
					algorithm: 'fixed-window',
				};
			}

			return {
				count: data.count || 0,
				remaining: Math.max(0, maxAttempts - (data.count || 0)),
				resetAt: data.resetAt,
				limit: maxAttempts,
				algorithm: 'fixed-window',
			};
		}
	} catch (error) {
		logger.error(
			'获取速率限制信息失败',
			{
				key,
				errorMessage: error.message,
			},
			error,
		);
		return {
			count: 0,
			remaining: maxAttempts,
			resetAt: now,
			limit: maxAttempts,
			algorithm,
		};
	}
}

/**
 * 建立 429 Too Many Requests 響應
 * @param {Object} rateLimitInfo - 速率限制資訊
 * @param {Request} request - HTTP 請求物件（用於安全頭）
 * @returns {Response}
 */
export function createRateLimitResponse(rateLimitInfo, request = null) {
	const retryAfter = Math.ceil((rateLimitInfo.resetAt - Date.now()) / 1000);

	let headers = {
		'Content-Type': 'application/json',
		'Retry-After': retryAfter.toString(),
		'X-RateLimit-Limit': rateLimitInfo.limit.toString(),
		'X-RateLimit-Remaining': rateLimitInfo.remaining.toString(),
		'X-RateLimit-Reset': rateLimitInfo.resetAt.toString(),
		'X-RateLimit-Algorithm': rateLimitInfo.algorithm || 'sliding-window',
	};

	// 新增安全頭（如果提供了 request）
	if (request) {
		const securityHeaders = getSecurityHeaders(request);
		headers = {
			...securityHeaders,
			...headers,
		};
	} else {
		headers['Access-Control-Allow-Origin'] = '*';
		headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
		headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
	}

	return new Response(
		JSON.stringify({
			error: '请求过于频繁',
			message: `您的请求次数过多，请在 ${retryAfter} 秒后重试`,
			retryAfter: retryAfter,
			limit: rateLimitInfo.limit,
			remaining: rateLimitInfo.remaining,
			resetAt: new Date(rateLimitInfo.resetAt).toISOString(),
			algorithm: rateLimitInfo.algorithm || 'sliding-window',
		}),
		{
			status: 429,
			headers,
		},
	);
}

/**
 * 從請求中提取客戶端標識
 * @param {Request} request - HTTP 請求物件
 * @param {string} type - 標識型別 ('ip' | 'token' | 'combined')
 * @returns {string} 客戶端標識
 */
export function getClientIdentifier(request, type = 'ip') {
	switch (type) {
		case 'ip':
			return (
				request.headers.get('CF-Connecting-IP') ||
				request.headers.get('X-Real-IP') ||
				request.headers.get('X-Forwarded-For')?.split(',')[0] ||
				'unknown'
			);

		case 'token': {
			const authHeader = request.headers.get('Authorization');
			if (authHeader && authHeader.startsWith('Bearer ')) {
				const token = authHeader.substring(7);
				return `token:${token.substring(0, 16)}`;
			}
			return 'no-token';
		}

		case 'combined': {
			const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
			const auth = request.headers.get('Authorization');
			if (auth && auth.startsWith('Bearer ')) {
				const token = auth.substring(7);
				return `${ip}:${token.substring(0, 16)}`;
			}
			return ip;
		}

		default:
			return request.headers.get('CF-Connecting-IP') || 'unknown';
	}
}

/**
 * Rate Limiting 預設配置（滑動視窗最佳化版）
 */
export const RATE_LIMIT_PRESETS = {
	// 登入端點：5 次嘗試 / 分鐘
	login: {
		maxAttempts: 5,
		windowSeconds: 60,
		algorithm: 'sliding-window',
	},

	// 登入端點（嚴格）：3 次嘗試 / 分鐘
	loginStrict: {
		maxAttempts: 3,
		windowSeconds: 60,
		algorithm: 'sliding-window',
	},

	// API 操作：30 次請求 / 分鐘
	api: {
		maxAttempts: 30,
		windowSeconds: 60,
		algorithm: 'sliding-window',
	},

	// 敏感操作：10 次請求 / 分鐘
	sensitive: {
		maxAttempts: 10,
		windowSeconds: 60,
		algorithm: 'sliding-window',
	},

	// 批次操作：20 次請求 / 5 分鐘
	bulk: {
		maxAttempts: 20,
		windowSeconds: 300,
		algorithm: 'sliding-window',
	},

	// 全域性保護：100 次請求 / 分鐘
	global: {
		maxAttempts: 100,
		windowSeconds: 60,
		algorithm: 'sliding-window',
	},
};

/**
 * Rate Limiting 中介軟體包裝器
 * @param {Function} handler - 原始處理函式
 * @param {Object} options - Rate limiting 配置
 * @returns {Function} 包裝後的處理函式
 */
export function withRateLimit(handler, options = {}) {
	const { preset = 'api', identifierType = 'ip', customKey = null } = options;

	return async (request, env, ...args) => {
		// 生成限流鍵
		let key;
		if (customKey) {
			key = typeof customKey === 'function' ? customKey(request) : customKey;
		} else {
			key = getClientIdentifier(request, identifierType);
		}

		// 獲取預設配置
		const rateLimitConfig = RATE_LIMIT_PRESETS[preset] || RATE_LIMIT_PRESETS.api;

		// 檢查速率限制
		const rateLimitInfo = await checkRateLimit(key, env, rateLimitConfig);

		if (!rateLimitInfo.allowed) {
			return createRateLimitResponse(rateLimitInfo, request);
		}

		// 呼叫原始處理函式
		const response = await handler(request, env, ...args);

		// 在響應中新增 rate limit headers
		if (response instanceof Response) {
			const newHeaders = new Headers(response.headers);
			newHeaders.set('X-RateLimit-Limit', rateLimitInfo.limit.toString());
			newHeaders.set('X-RateLimit-Remaining', rateLimitInfo.remaining.toString());
			newHeaders.set('X-RateLimit-Reset', rateLimitInfo.resetAt.toString());
			newHeaders.set('X-RateLimit-Algorithm', rateLimitInfo.algorithm || 'sliding-window');

			return new Response(response.body, {
				status: response.status,
				statusText: response.statusText,
				headers: newHeaders,
			});
		}

		return response;
	};
}
