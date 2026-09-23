/**
 * 身份驗證工具模組
 * 提供 JWT Token 認證功能，支援自動過期
 */

import { createErrorResponse } from './response.js';
import { checkRateLimit, createRateLimitResponse, getClientIdentifier, RATE_LIMIT_PRESETS } from './rateLimit.js';
import { getAllowedOrigin, getSecurityHeaders } from './security.js';
import { getLogger } from './logger.js';
import {
	ValidationError,
	AuthenticationError,
	AuthorizationError,
	ConflictError,
	ConfigurationError,
	ErrorFactory,
	errorToResponse,
	logError,
} from './errors.js';

// JWT 配置
const JWT_EXPIRY_DAYS_DEFAULT = 30; // JWT 預設有效期：30天
const JWT_ALGORITHM = 'HS256';

// Cookie 配置
const COOKIE_NAME = 'auth_token';

// KV 儲存鍵
const KV_USER_PASSWORD_KEY = 'user_password';
const KV_SETUP_COMPLETED_KEY = 'setup_completed';
const KV_SETTINGS_KEY = 'settings';

/**
 * 獲取 JWT 過期天數（從 KV settings 讀取）
 * @param {Object} env - 環境變數物件
 * @returns {Promise<number>} JWT 過期天數
 */
export async function getJwtExpiryDays(env) {
	if (env && env.SECRETS_KV) {
		try {
			const raw = await env.SECRETS_KV.get(KV_SETTINGS_KEY);
			if (raw) {
				const settings = JSON.parse(raw);
				if (settings.jwtExpiryDays) {
					const days = Number(settings.jwtExpiryDays);
					if (Number.isFinite(days) && days >= 1 && days <= 365) {
						return days;
					}
				}
			}
		} catch {
			// 解析失敗，使用預設值
		}
	}
	return JWT_EXPIRY_DAYS_DEFAULT;
}

/**
 * 獲取 JWT 自動續期閾值天數
 * 預設為過期天數的 1/4，至少 1 天
 * @param {Object} env - 環境變數物件
 * @returns {Promise<number>} 自動續期閾值天數
 */
async function getJwtRefreshThresholdDays(env) {
	const expiryDays = await getJwtExpiryDays(env);
	return Math.max(1, Math.floor(expiryDays / 4));
}

// 密碼配置
const PASSWORD_MIN_LENGTH = 8;
const PBKDF2_ITERATIONS = 100000; // PBKDF2 迭代次數

/**
 * 驗證密碼強度
 * @param {string} password - 密碼
 * @returns {Object} { valid: boolean, message: string }
 */
export function validatePasswordStrength(password) {
	if (!password || password.length < PASSWORD_MIN_LENGTH) {
		return {
			valid: false,
			message: `密码长度至少为 ${PASSWORD_MIN_LENGTH} 位`,
		};
	}

	const hasUpperCase = /[A-Z]/.test(password);
	const hasLowerCase = /[a-z]/.test(password);
	const hasNumber = /[0-9]/.test(password);
	const hasSymbol = /[^A-Za-z0-9]/.test(password);

	if (!hasUpperCase) {
		return { valid: false, message: '密码必须包含至少一个大写字母' };
	}
	if (!hasLowerCase) {
		return { valid: false, message: '密码必须包含至少一个小写字母' };
	}
	if (!hasNumber) {
		return { valid: false, message: '密码必须包含至少一个数字' };
	}
	if (!hasSymbol) {
		return { valid: false, message: '密码必须包含至少一个特殊字符' };
	}

	return { valid: true, message: '密码强度符合要求' };
}

/**
 * 使用 PBKDF2 加密密碼
 * ⚠️ 強制驗證密碼強度，不符合要求將丟擲錯誤
 * @param {string} password - 明文密碼
 * @returns {Promise<string>} 加密後的密碼（格式：salt$hash）
 * @throws {ValidationError} 密碼強度不符合要求時丟擲錯誤
 */
export async function hashPassword(password) {
	// 🔒 強制驗證密碼強度（防禦性程式設計）
	const validation = validatePasswordStrength(password);
	if (!validation.valid) {
		throw ErrorFactory.passwordWeak(validation.message, { password: '***' });
	}

	// 生成隨機鹽值
	const salt = crypto.getRandomValues(new Uint8Array(16));

	// 將密碼轉換為 ArrayBuffer
	const encoder = new TextEncoder();
	const passwordBuffer = encoder.encode(password);

	// 匯入密碼作為金鑰
	const keyMaterial = await crypto.subtle.importKey('raw', passwordBuffer, { name: 'PBKDF2' }, false, ['deriveBits']);

	// 使用 PBKDF2 派生金鑰
	const hashBuffer = await crypto.subtle.deriveBits(
		{
			name: 'PBKDF2',
			salt: salt,
			iterations: PBKDF2_ITERATIONS,
			hash: 'SHA-256',
		},
		keyMaterial,
		256, // 輸出 256 位
	);

	// 將鹽值和雜湊值轉換為 Base64
	const saltB64 = btoa(String.fromCharCode(...salt));
	const hashB64 = btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));

	// 返回格式：salt$hash
	return `${saltB64}$${hashB64}`;
}

/**
 * 驗證密碼
 * @param {string} password - 明文密碼
 * @param {string} storedHash - 儲存的雜湊值（格式：salt$hash）
 * @param {Object} env - 環境變數物件（可選，用於日誌）
 * @returns {Promise<boolean>} 是否匹配
 */
export async function verifyPassword(password, storedHash, env = null) {
	try {
		// 分離鹽值和雜湊值
		const [saltB64, hashB64] = storedHash.split('$');
		if (!saltB64 || !hashB64) {
			return false;
		}

		// 解碼鹽值
		const salt = Uint8Array.from(atob(saltB64), (c) => c.charCodeAt(0));

		// 將密碼轉換為 ArrayBuffer
		const encoder = new TextEncoder();
		const passwordBuffer = encoder.encode(password);

		// 匯入密碼作為金鑰
		const keyMaterial = await crypto.subtle.importKey('raw', passwordBuffer, { name: 'PBKDF2' }, false, ['deriveBits']);

		// 使用相同的鹽值派生金鑰
		const hashBuffer = await crypto.subtle.deriveBits(
			{
				name: 'PBKDF2',
				salt: salt,
				iterations: PBKDF2_ITERATIONS,
				hash: 'SHA-256',
			},
			keyMaterial,
			256,
		);

		// 將計算的雜湊值轉換為 Base64
		const calculatedHashB64 = btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));

		// 比較雜湊值
		return calculatedHashB64 === hashB64;
	} catch (error) {
		if (env) {
			const logger = getLogger(env);
			logger.error(
				'密码验证失败',
				{
					errorMessage: error.message,
				},
				error,
			);
		}
		return false;
	}
}

/**
 * 生成 JWT Token
 * @param {Object} payload - 要編碼的資料
 * @param {string} secret - 簽名金鑰
 * @param {number} expiryDays - 過期天數
 * @returns {Promise<string>} JWT token
 */
export async function generateJWT(payload, secret, expiryDays = JWT_EXPIRY_DAYS_DEFAULT) {
	const header = {
		alg: JWT_ALGORITHM,
		typ: 'JWT',
	};

	const now = Math.floor(Date.now() / 1000);
	const jwtPayload = {
		...payload,
		iat: now, // 簽發時間
		exp: now + expiryDays * 24 * 60 * 60, // 過期時間
	};

	// Base64URL 編碼
	const base64UrlEncode = (str) => {
		return btoa(String.fromCharCode(...new Uint8Array(typeof str === 'string' ? new TextEncoder().encode(str) : str)))
			.replace(/\+/g, '-')
			.replace(/\//g, '_')
			.replace(/=/g, '');
	};

	const headerB64 = base64UrlEncode(JSON.stringify(header));
	const payloadB64 = base64UrlEncode(JSON.stringify(jwtPayload));
	const data = `${headerB64}.${payloadB64}`;

	// 使用 HMAC-SHA256 簽名
	const encoder = new TextEncoder();
	const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);

	const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));

	const signatureB64 = base64UrlEncode(signature);
	return `${data}.${signatureB64}`;
}

/**
 * 驗證並解析 JWT Token
 * @param {string} token - JWT token
 * @param {string} secret - 簽名金鑰
 * @param {Object} env - 環境變數物件（可選，用於日誌）
 * @returns {Promise<Object|null>} 解析後的 payload，驗證失敗返回 null
 */
async function verifyJWT(token, secret, env = null) {
	const logger = env ? getLogger(env) : null;

	try {
		const parts = token.split('.');
		if (parts.length !== 3) {
			return null;
		}

		const [headerB64, payloadB64, signatureB64] = parts;
		const data = `${headerB64}.${payloadB64}`;

		// Base64URL 解碼
		const base64UrlDecode = (str) => {
			str = str.replace(/-/g, '+').replace(/_/g, '/');
			const pad = str.length % 4;
			if (pad) {
				str += '='.repeat(4 - pad);
			}
			const binary = atob(str);
			return new Uint8Array([...binary].map((c) => c.charCodeAt(0)));
		};

		// 驗證簽名
		const encoder = new TextEncoder();
		const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);

		const signatureBytes = base64UrlDecode(signatureB64);
		const isValid = await crypto.subtle.verify('HMAC', key, signatureBytes, encoder.encode(data));

		if (!isValid) {
			if (logger) {
				logger.warn('JWT 签名验证失败');
			}
			return null;
		}

		// 解析 payload
		const payloadBytes = base64UrlDecode(payloadB64);
		const payloadJson = new TextDecoder().decode(payloadBytes);
		const payload = JSON.parse(payloadJson);

		// 檢查是否過期
		const now = Math.floor(Date.now() / 1000);
		if (payload.exp && payload.exp < now) {
			if (logger) {
				logger.warn('JWT 已过期', {
					exp: new Date(payload.exp * 1000).toISOString(),
					now: new Date(now * 1000).toISOString(),
				});
			}
			return null;
		}

		return payload;
	} catch (error) {
		if (logger) {
			logger.error(
				'JWT 验证失败',
				{
					errorMessage: error.message,
				},
				error,
			);
		}
		return null;
	}
}

/**
 * 建立 Set-Cookie header 值
 * @param {string} token - JWT token
 * @param {number} maxAge - Cookie 最大有效期（秒）
 * @returns {string} Set-Cookie header 值
 */
export function createSetCookieHeader(token, maxAge) {
	const cookieAttributes = [
		`${COOKIE_NAME}=${token}`,
		`Max-Age=${maxAge}`,
		'Path=/',
		'HttpOnly', // 防止 XSS 攻擊訪問 Cookie
		'SameSite=Strict', // 防止 CSRF 攻擊
		'Secure', // 僅在 HTTPS 下傳輸
	];

	return cookieAttributes.join('; ');
}

/**
 * 建立清除認證 Cookie 的 Set-Cookie header 值
 * @returns {string} Set-Cookie header 值
 */
function createClearCookieHeader() {
	const cookieAttributes = [
		`${COOKIE_NAME}=`,
		'Max-Age=0',
		'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
		'Path=/',
		'HttpOnly',
		'SameSite=Strict',
		'Secure',
	];

	return cookieAttributes.join('; ');
}

/**
 * 判斷退出登入請求是否來自同源頁面。
 * 前端 fetch 會攜帶 X-Requested-With；跨站表單無法新增該頭。
 * @param {Request} request - HTTP 請求物件
 * @returns {boolean} 是否允許處理退出登入
 */
function isLogoutRequestAllowed(request) {
	if (request.headers.get('X-Requested-With') !== 'XMLHttpRequest') {
		return false;
	}

	const origin = request.headers.get('Origin');
	if (origin && getAllowedOrigin(request) !== origin) {
		return false;
	}

	const fetchSite = request.headers.get('Sec-Fetch-Site');
	if (fetchSite && !['same-origin', 'same-site', 'none'].includes(fetchSite)) {
		return false;
	}

	return true;
}

/**
 * 從請求中獲取 Cookie 中的 token
 * @param {Request} request - HTTP 請求物件
 * @returns {string|null} Token 或 null
 */
function getTokenFromCookie(request) {
	const cookieHeader = request.headers.get('Cookie');
	if (!cookieHeader) {
		return null;
	}

	// 解析 Cookie header
	const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
		const [name, value] = cookie.trim().split('=');
		acc[name] = value;
		return acc;
	}, {});

	return cookies[COOKIE_NAME] || null;
}

/**
 * 驗證請求的 Authorization Token
 * @param {Request} request - HTTP 請求物件
 * @param {Object} env - 環境變數物件
 * @returns {Promise<boolean>} 是否驗證通過
 */
export async function verifyAuth(request, env) {
	const logger = getLogger(env);

	// 🔑 檢查 KV 中的使用者密碼
	if (env.SECRETS_KV) {
		const storedPasswordHash = await env.SECRETS_KV.get(KV_USER_PASSWORD_KEY);

		if (!storedPasswordHash) {
			// 未設定密碼，需要首次設定
			logger.info('未设置用户密码，需要首次设置');
			return false;
		}

		// 從 Cookie 或 Authorization header 獲取 token
		let token = getTokenFromCookie(request);
		if (!token) {
			const authHeader = request.headers.get('Authorization');
			if (authHeader) {
				token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
			}
		}

		if (!token) {
			return false;
		}

		// 嘗試作為 JWT 驗證（使用使用者密碼雜湊作為金鑰）
		if (token.includes('.')) {
			const payload = await verifyJWT(token, storedPasswordHash, env);
			if (payload) {
				logger.debug('JWT 验证成功', {
					exp: new Date(payload.exp * 1000).toISOString(),
				});
				return true;
			}
		}

		return false;
	}

	// ❌ 沒有配置 KV 儲存
	logger.error('未配置 KV 存储，拒绝访问');
	return false;
}

/**
 * 驗證認證並返回詳細資訊（用於自動續期）
 * @param {Request} request - HTTP 請求物件
 * @param {Object} env - 環境變數物件
 * @returns {Promise<Object|null>} 認證資訊物件 { valid: boolean, payload: Object, remainingDays: number, needsRefresh: boolean } 或 null
 */
export async function verifyAuthWithDetails(request, env) {
	const logger = getLogger(env);

	// 🔑 檢查 KV 中的使用者密碼
	if (!env.SECRETS_KV) {
		logger.error('未配置 KV 存储，拒绝访问');
		return null;
	}

	const storedPasswordHash = await env.SECRETS_KV.get(KV_USER_PASSWORD_KEY);

	if (!storedPasswordHash) {
		logger.info('未设置用户密码，需要首次设置');
		return null;
	}

	// 從 Cookie 或 Authorization header 獲取 token
	let token = getTokenFromCookie(request);
	if (!token) {
		const authHeader = request.headers.get('Authorization');
		if (authHeader) {
			token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
		}
	}

	if (!token) {
		return null;
	}

	// 嘗試作為 JWT 驗證（使用使用者密碼雜湊作為金鑰）
	if (token.includes('.')) {
		const payload = await verifyJWT(token, storedPasswordHash, env);
		if (payload && payload.exp) {
			const now = Math.floor(Date.now() / 1000);
			const remainingSeconds = payload.exp - now;
			const remainingDays = remainingSeconds / (24 * 60 * 60);
			const needsRefresh = remainingDays < (await getJwtRefreshThresholdDays(env));

			logger.debug('JWT 验证成功（详细）', {
				exp: new Date(payload.exp * 1000).toISOString(),
				remainingDays: remainingDays.toFixed(2),
				needsRefresh,
			});

			return {
				valid: true,
				payload,
				remainingDays,
				needsRefresh,
				token,
			};
		}
	}

	return null;
}

/**
 * 建立未授權響應
 * @param {string} message - 錯誤訊息（可選）
 * @param {Request} request - HTTP 請求物件（用於安全頭）
 * @returns {Response} 401 未授權響應
 */
export function createUnauthorizedResponse(message = '未授权访问', request = null) {
	return createErrorResponse('身份验证失败', message || '请提供有效的访问令牌。如果您忘记了令牌，请联系管理员重新配置。', 401, request);
}

/**
 * 檢查是否需要首次設定
 * @param {Object} env - 環境變數物件
 * @returns {Promise<boolean>} 是否需要首次設定
 */
export async function checkIfSetupRequired(env) {
	// 檢查 KV 中是否已設定密碼
	if (env.SECRETS_KV) {
		const storedPasswordHash = await env.SECRETS_KV.get(KV_USER_PASSWORD_KEY);
		return !storedPasswordHash; // 未設定則需要首次設定
	}

	return true; // 沒有 KV 也需要設定
}

/**
 * 處理首次設定請求
 * @param {Request} request - HTTP 請求物件
 * @param {Object} env - 環境變數物件
 * @returns {Promise<Response>} 響應
 */
export async function handleFirstTimeSetup(request, env) {
	const logger = getLogger(env);

	try {
		// 🛡️ Rate Limiting: 防止暴力破解
		const clientIP = getClientIdentifier(request, 'ip');
		const rateLimitInfo = await checkRateLimit(clientIP, env, RATE_LIMIT_PRESETS.login);

		if (!rateLimitInfo.allowed) {
			logger.warn('首次设置速率限制超出', {
				clientIP,
				limit: rateLimitInfo.limit,
				resetAt: rateLimitInfo.resetAt,
			});
			return createRateLimitResponse(rateLimitInfo, request);
		}

		const { password, confirmPassword } = await request.json();

		// 驗證密碼
		if (!password || !confirmPassword) {
			throw new ValidationError('请提供密码和确认密码', {
				missing: !password ? 'password' : 'confirmPassword',
			});
		}

		if (password !== confirmPassword) {
			throw new ValidationError('两次输入的密码不一致', {
				issue: 'password_mismatch',
			});
		}

		// 檢查是否已經設定過
		const existingHash = await env.SECRETS_KV.get(KV_USER_PASSWORD_KEY);
		if (existingHash) {
			throw new ConflictError('密码已设置，无法重复设置。如需修改密码，请联系管理员。', {
				operation: 'first_time_setup',
				alreadyCompleted: true,
			});
		}

		// 驗證密碼強度（快速失敗，提供友好的錯誤訊息）
		// 注意：hashPassword() 也會進行驗證作為最後的防線
		const validation = validatePasswordStrength(password);
		if (!validation.valid) {
			throw ErrorFactory.passwordWeak(validation.message, {
				operation: 'first_time_setup',
			});
		}

		// 加密密碼（內部會再次驗證密碼強度）
		const passwordHash = await hashPassword(password);

		// 儲存到 KV
		await env.SECRETS_KV.put(KV_USER_PASSWORD_KEY, passwordHash);
		await env.SECRETS_KV.put(KV_SETUP_COMPLETED_KEY, new Date().toISOString());

		logger.info('首次设置完成', {
			setupAt: new Date().toISOString(),
			passwordEncrypted: true,
		});

		// 生成 JWT token
		const jwtExpiryDays = await getJwtExpiryDays(env);
		const jwtToken = await generateJWT(
			{
				auth: true,
				setupAt: new Date().toISOString(),
			},
			passwordHash,
			jwtExpiryDays,
		);

		const expiryDate = new Date(Date.now() + jwtExpiryDays * 24 * 60 * 60 * 1000);

		// 🍪 使用 HttpOnly Cookie 儲存 JWT token
		const securityHeaders = getSecurityHeaders(request);

		return new Response(
			JSON.stringify({
				success: true,
				message: '密码设置成功，已自动登录',
				expiresAt: expiryDate.toISOString(),
				expiresIn: `${jwtExpiryDays}天`,
			}),
			{
				status: 200,
				headers: {
					...securityHeaders,
					'Content-Type': 'application/json',
					'Set-Cookie': createSetCookieHeader(jwtToken, jwtExpiryDays * 24 * 60 * 60),
					'X-RateLimit-Limit': rateLimitInfo.limit.toString(),
					'X-RateLimit-Remaining': rateLimitInfo.remaining.toString(),
					'X-RateLimit-Reset': rateLimitInfo.resetAt.toString(),
				},
			},
		);
	} catch (error) {
		// 如果是已知的應用錯誤，直接轉換為響應
		if (error instanceof ValidationError || error instanceof ConflictError || error instanceof AuthenticationError) {
			logError(error, logger, { operation: 'first_time_setup' });
			return errorToResponse(error, request);
		}

		// 未知錯誤
		logger.error(
			'首次设置失败',
			{
				errorMessage: error.message,
			},
			error,
		);

		// 檢測 KV 未繫結的情況
		if (!env.SECRETS_KV) {
			return createErrorResponse(
				'设置失败',
				'KV 存储未绑定，请在 Cloudflare Dashboard 或 wrangler.toml 中配置 SECRETS_KV 命名空间后重试',
				500,
				request,
			);
		}

		return createErrorResponse('设置失败', '处理设置请求时发生错误', 500, request);
	}
}

/**
 * 驗證登入請求並返回 JWT
 * @param {Request} request - HTTP 請求物件
 * @param {Object} env - 環境變數物件
 * @returns {Promise<Response|null>} 如果驗證失敗返回錯誤響應，否則返回 null
 */
export async function handleLogin(request, env) {
	const logger = getLogger(env);

	try {
		// 🛡️ Rate Limiting: 防止暴力破解
		const clientIP = getClientIdentifier(request, 'ip');
		const rateLimitInfo = await checkRateLimit(clientIP, env, RATE_LIMIT_PRESETS.login);

		if (!rateLimitInfo.allowed) {
			logger.warn('登录速率限制超出', {
				clientIP,
				limit: rateLimitInfo.limit,
				resetAt: rateLimitInfo.resetAt,
			});
			return createRateLimitResponse(rateLimitInfo, request);
		}

		const { credential } = await request.json();

		if (!credential) {
			throw new ValidationError('请提供密码', {
				missing: 'credential',
			});
		}

		// 🔑 KV 密碼認證
		if (!env.SECRETS_KV) {
			throw new ConfigurationError('服务器未配置 KV 存储，请联系管理员', {
				missingConfig: 'SECRETS_KV',
			});
		}

		const storedPasswordHash = await env.SECRETS_KV.get(KV_USER_PASSWORD_KEY);

		if (!storedPasswordHash) {
			throw new AuthorizationError('请先完成首次设置', {
				operation: 'login',
				setupRequired: true,
			});
		}

		// 驗證密碼
		const isValid = await verifyPassword(credential, storedPasswordHash, env);

		if (!isValid) {
			throw ErrorFactory.passwordIncorrect({
				operation: 'login',
			});
		}

		// 生成 JWT token
		const jwtExpiryDays = await getJwtExpiryDays(env);
		const jwtToken = await generateJWT(
			{
				auth: true,
				loginAt: new Date().toISOString(),
			},
			storedPasswordHash,
			jwtExpiryDays,
		);

		const expiryDate = new Date(Date.now() + jwtExpiryDays * 24 * 60 * 60 * 1000);
		const securityHeaders = getSecurityHeaders(request);

		return new Response(
			JSON.stringify({
				success: true,
				message: '登录成功',
				token: jwtToken, // 同時在響應 body 中返回 token（供測試和客戶端使用）
				expiresAt: expiryDate.toISOString(),
				expiresIn: `${jwtExpiryDays}天`,
			}),
			{
				status: 200,
				headers: {
					...securityHeaders,
					'Content-Type': 'application/json',
					'Set-Cookie': createSetCookieHeader(jwtToken, jwtExpiryDays * 24 * 60 * 60),
					'X-RateLimit-Limit': rateLimitInfo.limit.toString(),
					'X-RateLimit-Remaining': rateLimitInfo.remaining.toString(),
					'X-RateLimit-Reset': rateLimitInfo.resetAt.toString(),
				},
			},
		);
	} catch (error) {
		// 如果是已知的應用錯誤，直接轉換為響應
		if (
			error instanceof ValidationError ||
			error instanceof AuthenticationError ||
			error instanceof AuthorizationError ||
			error instanceof ConfigurationError
		) {
			logError(error, logger, { operation: 'login' });
			return errorToResponse(error, request);
		}

		// 未知錯誤
		logger.error(
			'登录处理失败',
			{
				errorMessage: error.message,
			},
			error,
		);
		return createErrorResponse('登录失败', '处理登录请求时发生错误', 500, request);
	}
}

/**
 * 重新整理 JWT Token
 * @param {Request} request - HTTP 請求物件
 * @param {Object} env - 環境變數物件
 * @returns {Promise<Response>} 包含新 token 的響應
 */
export async function handleRefreshToken(request, env) {
	const logger = getLogger(env);

	try {
		// 優先從 Cookie 獲取 token，向後相容 Authorization header
		let token = getTokenFromCookie(request);

		if (!token) {
			const authHeader = request.headers.get('Authorization');
			if (!authHeader) {
				throw ErrorFactory.jwtMissing({
					operation: 'refresh_token',
				});
			}
			token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
		}

		// 獲取 KV 中的密碼雜湊作為 JWT 金鑰
		if (!env.SECRETS_KV) {
			throw new ConfigurationError('服务器未配置 KV 存储', {
				missingConfig: 'SECRETS_KV',
			});
		}

		const storedPasswordHash = await env.SECRETS_KV.get(KV_USER_PASSWORD_KEY);
		if (!storedPasswordHash) {
			throw new AuthorizationError('请先完成首次设置', {
				operation: 'refresh_token',
				setupRequired: true,
			});
		}

		// 驗證當前 token
		const payload = await verifyJWT(token, storedPasswordHash, env);
		if (!payload) {
			throw ErrorFactory.jwtInvalid({
				operation: 'refresh_token',
			});
		}

		// 生成新的 JWT token
		const jwtExpiryDays = await getJwtExpiryDays(env);
		const newToken = await generateJWT(
			{
				auth: true,
				loginAt: payload.loginAt || new Date().toISOString(),
				refreshedAt: new Date().toISOString(),
			},
			storedPasswordHash,
			jwtExpiryDays,
		);

		const expiryDate = new Date(Date.now() + jwtExpiryDays * 24 * 60 * 60 * 1000);

		// 🍪 使用 HttpOnly Cookie 儲存重新整理後的 JWT token
		// 🔒 使用安全頭（CORS, CSP 等）
		const securityHeaders = getSecurityHeaders(request);

		return new Response(
			JSON.stringify({
				success: true,
				message: '令牌刷新成功',
				token: newToken, // 同時在響應 body 中返回 token（供測試和客戶端使用）
				expiresAt: expiryDate.toISOString(),
				expiresIn: `${jwtExpiryDays}天`,
			}),
			{
				status: 200,
				headers: {
					...securityHeaders, // 🔒 包含 CORS, CSP 等安全頭
					'Content-Type': 'application/json',
					// 🍪 設定新的 HttpOnly Cookie
					'Set-Cookie': createSetCookieHeader(newToken, jwtExpiryDays * 24 * 60 * 60),
				},
			},
		);
	} catch (error) {
		// 如果是已知的應用錯誤，直接轉換為響應
		if (
			error instanceof ValidationError ||
			error instanceof AuthenticationError ||
			error instanceof AuthorizationError ||
			error instanceof ConfigurationError
		) {
			logError(error, logger, { operation: 'refresh_token' });
			return errorToResponse(error, request);
		}

		// 未知錯誤
		logger.error(
			'刷新令牌失败',
			{
				errorMessage: error.message,
			},
			error,
		);
		return createErrorResponse('刷新失败', '刷新令牌时发生错误', 500, request);
	}
}

/**
 * 處理退出登入請求
 * @param {Request} request - HTTP 請求物件
 * @param {Object} env - 環境變數物件（用於限流）
 * @returns {Response} 清除認證 Cookie 的響應
 */
export async function handleLogout(request, env) {
	if (!isLogoutRequestAllowed(request)) {
		return createErrorResponse('请求被拒绝', '退出登录请求必须来自同源页面', 403, request);
	}

	// 🛡️ Rate Limiting: 防止濫用登出端點製造日誌噪音/CSRF 探測
	// 使用 sensitive 預設（10 次/分鐘）—— 正常使用者登出頻率遠低於此
	if (env && env.SECRETS_KV) {
		const clientIP = getClientIdentifier(request, 'ip');
		const rateLimitInfo = await checkRateLimit(clientIP, env, RATE_LIMIT_PRESETS.sensitive);

		if (!rateLimitInfo.allowed) {
			return createRateLimitResponse(rateLimitInfo, request);
		}
	}

	return new Response(
		JSON.stringify({
			success: true,
			message: '已退出登录',
		}),
		{
			status: 200,
			headers: {
				...getSecurityHeaders(request),
				'Content-Type': 'application/json',
				'Cache-Control': 'no-store',
				'Set-Cookie': createClearCookieHeader(),
			},
		},
	);
}

/**
 * 檢查路徑是否需要認證
 * @param {string} pathname - 請求路徑
 * @returns {boolean} 是否需要認證
 */
export function requiresAuth(pathname) {
	// 不需要認證的路徑
	const publicPaths = [
		'/', // 主頁（會顯示登入介面）
		'/api/login', // 登入介面
		'/api/logout', // 退出登入介面
		'/api/refresh-token', // Token 重新整理介面（已在內部驗證）
		'/api/setup', // 首次設定介面
		'/api/time', // 客戶端 TOTP 時間校準介面
		'/setup', // 設定頁面
		'/manifest.json', // PWA manifest
		'/sw.js', // Service Worker
		'/icon-192.png', // PWA 圖示
		'/icon-512.png', // PWA 圖示
		'/favicon.ico', // 網站圖示
		'/favicon.svg', // 網站向量圖示
		'/favicon-32x32.png', // 32x32 圖示
		'/favicon-16x16.png', // 16x16 圖示
		'/apple-touch-icon.png', // iOS 桌面圖示
		'/apple-touch-icon-precomposed.png', // iOS 相容圖示
		'/og-image.jpg', // Open Graph / Twitter 分享封面圖
		'/og-image.png', // Open Graph PNG 別名
		'/fonts/maple-mono-regular.woff2', // UI webfont
		'/fonts/maple-mono-bold.woff2', // UI webfont
		'/fonts/maple-mono-cjk.css', // Maple Mono CJK glyph subsets
		'/otp', // OTP 生成頁面（無引數）
		'/api/onedrive/oauth/callback',
		'/api/gdrive/oauth/callback',
		'/api/webauthn/login-options', // WebAuthn 登入 Challenge 生成
		'/api/webauthn/login', // WebAuthn 登入驗證
	];

	// 精確匹配公開路徑
	if (publicPaths.includes(pathname)) {
		return false;
	}

	// OTP 生成路徑不需要認證（公開訪問）
	if (pathname.startsWith('/otp/')) {
		return false;
	}
	if (pathname.startsWith('/fonts/cjk/')) {
		return false;
	}

	// Favicon 代理路徑不需要認證（公開訪問）
	if (pathname.startsWith('/api/favicon/')) {
		return false;
	}

	// 所有其他路徑預設需要認證（包括 /api/, /admin, /settings 等）
	return true;
}
