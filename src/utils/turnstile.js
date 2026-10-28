/**
 * Cloudflare Turnstile 零打擾防護與站點驗證服務
 * 提供人機驗證、通關 Cookie 簽發與降階容錯（Fail-Open Fallback）
 */

import { getLogger } from './logger.js';

const TURNSTILE_VERIFY_ENDPOINT = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
export const TURNSTILE_CLEARANCE_COOKIE = '2fa_turnstile_cleared';
export const TURNSTILE_DEFAULT_MAX_AGE = 7200; // 2 小時

/**
 * 計算字串的 HMAC-SHA256 簽名
 * @param {string} secret
 * @param {string} message
 * @returns {Promise<string>} Hex 編碼簽名
 */
export async function signHmacSha256(secret, message) {
	const enc = new TextEncoder();
	const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
	const signature = await crypto.subtle.sign('HMAC', key, enc.encode(message));
	return Array.from(new Uint8Array(signature))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

/**
 * 時間常數安全的字串比對
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export function timingSafeEqualHex(a, b) {
	if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) {
		return false;
	}
	let mismatch = 0;
	for (let i = 0; i < a.length; i++) {
		mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
	}
	return mismatch === 0;
}

/**
 * 建立通關 Cookie 標頭字串（非 HttpOnly，允許前端讀取實現零打擾快取）
 * @param {Object} options
 * @param {string} options.secretKey
 * @param {number} [options.maxAgeSeconds]
 * @returns {Promise<string>} Set-Cookie 標頭值
 */
export async function createTurnstileClearanceCookie({ secretKey, maxAgeSeconds = TURNSTILE_DEFAULT_MAX_AGE }) {
	const now = Math.floor(Date.now() / 1000);
	const message = `cleared:${now}`;
	const signature = await signHmacSha256(secretKey, message);
	const cookieValue = `${now}.${signature}`;
	return `${TURNSTILE_CLEARANCE_COOKIE}=${cookieValue}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax; Secure`;
}

/**
 * 驗證通關 Cookie
 * @param {Object} options
 * @param {Request} options.request
 * @param {string} options.secretKey
 * @param {number} [options.maxAgeSeconds]
 * @returns {Promise<boolean>}
 */
export async function verifyTurnstileClearanceCookie({ request, secretKey, maxAgeSeconds = TURNSTILE_DEFAULT_MAX_AGE }) {
	if (!secretKey) {
		return false;
	}
	const cookieHeader = request.headers.get('Cookie');
	if (!cookieHeader) {
		return false;
	}

	const cookies = cookieHeader.split(';').reduce((acc, item) => {
		const [key, ...vals] = item.trim().split('=');
		acc[key] = vals.join('=');
		return acc;
	}, {});

	const clearance = cookies[TURNSTILE_CLEARANCE_COOKIE];
	if (!clearance || !clearance.includes('.')) {
		return false;
	}

	const [timestampStr, signature] = clearance.split('.');
	const timestamp = Number.parseInt(timestampStr, 10);
	if (!Number.isFinite(timestamp)) {
		return false;
	}

	const now = Math.floor(Date.now() / 1000);
	if (now - timestamp > maxAgeSeconds || timestamp > now + 300) {
		return false;
	}

	const expectedSignature = await signHmacSha256(secretKey, `cleared:${timestamp}`);
	return timingSafeEqualHex(signature, expectedSignature);
}

/**
 * 向上游 Cloudflare Siteverify 驗證 Token
 * 內建 5 秒超時與 Fail-Open 降階機制
 * @param {Object} options
 * @param {string} options.token
 * @param {string} options.secret
 * @param {string} [options.remoteip]
 * @param {number} [options.timeoutMs]
 * @param {boolean} [options.failOpen]
 * @param {Object} [options.env]
 * @returns {Promise<{ success: boolean, bypassed?: boolean, reason?: string, errorCodes?: string[] }>}
 */
export async function verifyTurnstileToken({ token, secret, remoteip, timeoutMs = 5000, failOpen = true, env = null }) {
	const logger = getLogger(env);

	if (!token) {
		return { success: false, reason: 'missing_token' };
	}
	if (!secret) {
		return { success: true, bypassed: true, reason: 'secret_not_configured' };
	}

	const formData = new URLSearchParams();
	formData.append('secret', secret);
	formData.append('response', token);
	if (remoteip) {
		formData.append('remoteip', remoteip);
	}

	try {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

		const response = await fetch(TURNSTILE_VERIFY_ENDPOINT, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			body: formData.toString(),
			signal: controller.signal,
		});

		clearTimeout(timeoutId);

		if (!response.ok) {
			logger.warn('Cloudflare Turnstile 服務端驗證非 200 回應', {
				status: response.status,
				failOpen,
			});
			if (failOpen && response.status >= 500) {
				return { success: true, bypassed: true, reason: 'upstream_5xx_fail_open' };
			}
			return { success: false, reason: `upstream_http_${response.status}` };
		}

		const data = await response.json();
		if (data.success) {
			return { success: true };
		}

		logger.warn('Cloudflare Turnstile 驗證未通過', {
			errorCodes: data['error-codes'],
		});
		return {
			success: false,
			errorCodes: data['error-codes'] || [],
			reason: 'verification_failed',
		};
	} catch (error) {
		logger.warn('Cloudflare Turnstile 站點驗證連線失敗或超時', {
			message: error.message,
			failOpen,
		});

		if (failOpen) {
			return {
				success: true,
				bypassed: true,
				reason: 'upstream_error_fail_open',
			};
		}

		return {
			success: false,
			reason: error.name === 'AbortError' ? 'timeout' : 'network_error',
		};
	}
}

/**
 * 統一檢查請求之 Turnstile 權限
 * 順序：
 * 1. 檢查是否未配置密鑰（未配置則跳過）
 * 2. 檢查是否有合法通關 Cookie（快速通道 Fast-Path）
 * 3. 檢查傳入之 Token 並向 Cloudflare 驗證
 *
 * @param {Object} options
 * @param {Request} options.request
 * @param {Object} options.env
 * @param {string} [options.token]
 * @param {string} [options.clientIP]
 * @returns {Promise<{ ok: boolean, bypassed?: boolean, cleared?: boolean, shouldSetClearance?: boolean, error?: string }>}
 */
export async function verifyTurnstileAccess({ request, env, token = null, clientIP = null }) {
	const secret = env?.TURNSTILE_SECRET;
	if (!secret) {
		return { ok: true, bypassed: true, reason: 'not_configured' };
	}

	// 1. 檢查快速通道通關 Cookie
	const isCleared = await verifyTurnstileClearanceCookie({
		request,
		secretKey: secret,
	});
	if (isCleared) {
		return { ok: true, cleared: true };
	}

	// 2. 提取 Token
	let verificationToken = token;
	if (!verificationToken) {
		verificationToken = request.headers.get('cf-turnstile-response') || request.headers.get('x-turnstile-token');
	}

	if (!verificationToken) {
		return {
			ok: false,
			error: 'Turnstile verification required',
		};
	}

	// 3. 驗證 Token
	const failOpen = env?.TURNSTILE_FAIL_OPEN !== '0';
	const result = await verifyTurnstileToken({
		token: verificationToken,
		secret,
		remoteip: clientIP,
		failOpen,
		env,
	});

	if (result.success) {
		return {
			ok: true,
			bypassed: result.bypassed,
			shouldSetClearance: true,
		};
	}

	return {
		ok: false,
		error: 'Turnstile verification failed',
	};
}
