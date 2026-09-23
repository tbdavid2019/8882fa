/**
 * OTP 生成處理器
 *
 * 包含功能:
 * - handleGenerateOTP: 生成 OTP（公開 API，支援高階引數）
 *
 * 特點:
 * - 公開訪問（無需認證）
 * - 支援 CORS（跨域訪問）
 * - 支援 HTML 和 JSON 兩種響應格式
 * - 支援高階 OTP 引數（type, digits, period, algorithm, counter）
 */

import { createJsonResponse, createErrorResponse } from '../../utils/response.js';
import { getLogger } from '../../utils/logger.js';

/**
 * 處理生成OTP（支援高階引數）
 *
 * 公開 API，無需認證，允許跨域訪問
 *
 * 支援的查詢引數:
 * - type: TOTP|HOTP (預設 TOTP)
 * - digits: 6|8 (預設 6)
 * - period: 30|60|120 (預設 30，僅 TOTP)
 * - algorithm: SHA1|SHA256|SHA512 (預設 SHA1)
 * - counter: 非負整數 (預設 0，僅 HOTP)
 * - format: html|json (預設 html)
 * - preview: 1 (JSON 模式下返回 TOTP 後續兩期驗證碼及有效時間)
 *
 * @param {string} secret - Base32金鑰
 * @param {Request} request - HTTP請求物件（可選，用於獲取引數）
 * @returns {Response} HTTP響應
 */
export async function handleGenerateOTP(secret, request = null) {
	// 動態匯入（減少初始載入）
	const { validateBase32, validateOTPParams } = await import('../../utils/validation.js');
	const { generateOTP } = await import('../../otp/generator.js');
	const { createQuickOtpPage, createOtpEntryPage } = await import('../../ui/quickOtp.js');

	if (!secret) {
		// 如果沒有金鑰，根據 Accept 頭返回友好頁面或純文本使用說明
		const origin = request ? new URL(request.url).origin : '';
		const accept = request?.headers.get('Accept') || '';
		const wantsHtml = accept.includes('text/html');

		if (wantsHtml) {
			return createOtpEntryPage();
		}

		// 非瀏覽器（curl / API 呼叫）保留原有 400 + 文本說明
		return new Response(
			`Missing secret parameter!\n\nUsage: ${origin}/otp/YOUR_SECRET_KEY\nExample: ${origin}/otp/JBSWY3DPEHPK3PXP\n\nAPI Mode: ${origin}/otp/YOUR_SECRET_KEY?format=json\n\nAdvanced Options:\n- ?type=TOTP|HOTP\n- ?digits=6|8\n- ?period=30|60\n- ?algorithm=SHA1|SHA256|SHA512\n- ?counter=0 (for HOTP)`,
			{
				status: 400,
				headers: {
					'Content-Type': 'text/plain; charset=utf-8',
					'Access-Control-Allow-Origin': '*', // 公開 API 允許跨域
					'Access-Control-Allow-Methods': 'GET, OPTIONS',
					'Cache-Control': 'no-store', // 不快取錯誤響應
				},
			},
		);
	}

	const validation = validateBase32(secret);
	if (!validation.valid) {
		return createErrorResponse(
			'密钥格式错误',
			`密钥"${secret}"不是有效的Base32格式。Base32密钥应只包含字母A-Z和数字2-7，且长度至少8位`,
			400,
			request,
		);
	}

	try {
		// 從請求引數中獲取進階設定
		let digits = 6;
		let period = 30;
		let algorithm = 'SHA1';
		let type = 'TOTP';
		let counter = 0;
		let format = 'html'; // 預設HTML格式
		let preview = false;

		if (request) {
			const url = new URL(request.url);
			type = (url.searchParams.get('type') || 'TOTP').toUpperCase();
			digits = parseInt(url.searchParams.get('digits')) || 6;
			period = parseInt(url.searchParams.get('period')) || 30;
			algorithm = url.searchParams.get('algorithm') || 'SHA1';
			const counterParam = url.searchParams.get('counter');
			counter = counterParam === null || counterParam === '' ? 0 : Number(counterParam);
			format = url.searchParams.get('format') || 'html'; // 支援 ?format=json
			preview = url.searchParams.get('preview') === '1';

			// 驗證OTP引數
			const otpValidation = validateOTPParams({ type, digits, period, algorithm, counter });
			if (!otpValidation.valid) {
				return createErrorResponse('OTP参数验证失败', otpValidation.error, 400, request);
			}
		}

		const loadTime = Math.floor(Date.now() / 1000);
		const options = { type, digits, period, algorithm, counter };
		const otp = await generateOTP(secret, loadTime, options);

		// 預設 JSON 保持單驗證碼結構；HOTP 只讀取請求指定的計數器。
		if (format === 'json' && (!preview || type === 'HOTP')) {
			return createJsonResponse({ token: otp }, 200, request, { 'Cache-Control': 'no-store' });
		}

		// 三個驗證碼固定使用同一時間基準，避免生成過程中跨週期導致錯配。
		// 多預備一期，在下期碼提升為當前碼時即可連續顯示新的下期碼。
		const nextToken = type === 'TOTP' ? await generateOTP(secret, loadTime + period, options) : null;
		const followingToken = type === 'TOTP' ? await generateOTP(secret, loadTime + period * 2, options) : null;
		const validUntil = type === 'TOTP' ? (Math.floor(loadTime / period) + 1) * period * 1000 : null;
		const serverTime = Date.now();
		if (format === 'json') {
			return createJsonResponse({ token: otp, nextToken, followingToken, period, validUntil, serverTime }, 200, request, {
				'Cache-Control': 'no-store',
			});
		}

		const remainingTime = type === 'TOTP' ? Math.max(0, (validUntil - serverTime) / 1000) : 0;
		return createQuickOtpPage(otp, {
			period,
			remainingTime,
			type,
			counter,
			nextToken,
			followingToken,
			validUntil,
			serverTime,
		});
	} catch (error) {
		const logger = getLogger(null);
		logger.error(
			'OTP生成失败',
			{
				secretPreview: secret ? secret.substring(0, 8) + '...' : 'null',
				errorMessage: error.message,
			},
			error,
		);
		return createErrorResponse('OTP生成失败', `生成验证码时发生内部错误：${error.message}。请检查密钥格式是否正确或稍后重试`, 500, request);
	}
}
