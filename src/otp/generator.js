/**
 * OTP（一次性密碼）生成模組
 * 實現TOTP（時間基準一次性密碼）演算法
 */

import { getLogger } from '../utils/logger.js';

/**
 * 生成 OTP 驗證碼（支援 TOTP、HOTP）
 * @param {string} secret - Base32編碼的金鑰
 * @param {number} loadTime - 頁面載入時間戳
 * @param {Object} options - 可選引數
 * @param {number} options.digits - OTP位數，預設6
 * @param {number} options.period - 時間步長（秒），預設30
 * @param {string} options.algorithm - 演算法，預設SHA1
 * @param {string} options.type - OTP型別：TOTP、HOTP，預設TOTP
 * @param {number} options.counter - HOTP計數器（僅HOTP需要）
 * @param {Object} options.env - 環境變數物件（可選，用於日誌）
 * @returns {Promise<string>} OTP驗證碼
 */
export async function generateOTP(secret, loadTime, options = {}) {
	const logger = options.env ? getLogger(options.env) : null;

	try {
		const digits = options.digits || 6;
		const period = options.period || 30;
		const algorithm = options.algorithm || 'SHA1';
		const type = options.type || 'TOTP';

		let counter;

		// 根據型別計算 counter
		switch (type.toUpperCase()) {
			case 'HOTP':
				counter = options.counter || 0;
				break;
			case 'TOTP':
			default: {
				// 如果提供了 loadTime，直接使用它（用於測試和客戶端預覽）
				// 否則使用當前時間
				const timeForCalculation = loadTime || Math.floor(Date.now() / 1000);
				counter = Math.floor(timeForCalculation / period);
				break;
			}
		}

		// 將counter轉換為8位元組大端序陣列
		const counterBytes = new ArrayBuffer(8);
		const counterView = new DataView(counterBytes);

		// 將 counter 分解為高 32 位和低 32 位（大端序）
		// JavaScript 數字是 64 位浮點數，但整數運算精確到 53 位
		// 對於超大的計數器值，需要正確拆分為兩個 32 位值
		const highBits = Math.floor(counter / 0x100000000); // 高 32 位
		const lowBits = counter >>> 0; // 低 32 位（無符號右移確保正數）

		counterView.setUint32(0, highBits, false); // 偏移 0：高 32 位（大端序）
		counterView.setUint32(4, lowBits, false); // 偏移 4：低 32 位（大端序）

		const secretBytes = base32toByteArray(secret);

		// 支援多種雜湊演算法
		const hashAlgorithm = getHashAlgorithm(algorithm);

		const key = await crypto.subtle.importKey('raw', secretBytes, { name: 'HMAC', hash: { name: hashAlgorithm } }, false, ['sign']);

		const hmacBuffer = await crypto.subtle.sign('HMAC', key, counterBytes);
		const hmacArray = Array.from(new Uint8Array(hmacBuffer));

		const offset = hmacArray[hmacArray.length - 1] & 0xf;
		const truncatedHash = hmacArray.slice(offset, offset + 4);
		const otpValue = new DataView(new Uint8Array(truncatedHash).buffer).getUint32(0) & 0x7fffffff;

		// 生成標準數字 OTP
		const modulus = Math.pow(10, digits);
		const otp = (otpValue % modulus).toString().padStart(digits, '0');
		return otp;
	} catch (error) {
		if (logger) {
			logger.error(
				'OTP 生成失败',
				{
					errorMessage: error.message,
					type: options.type || 'TOTP',
				},
				error,
			);
		}
		throw new Error('Failed to generate OTP: ' + error.message);
	}
}

/**
 * 獲取雜湊演算法名稱
 * @param {string} algorithm - 演算法名稱
 * @returns {string} Web Crypto API支援的演算法名稱
 */
export function getHashAlgorithm(algorithm) {
	const algMap = {
		SHA1: 'SHA-1',
		'SHA-1': 'SHA-1',
		SHA256: 'SHA-256',
		'SHA-256': 'SHA-256',
		SHA512: 'SHA-512',
		'SHA-512': 'SHA-512',
	};

	return algMap[algorithm.toUpperCase()] || 'SHA-1';
}

/**
 * 將Base32編碼的金鑰轉換為位元組陣列
 * @param {string} base32 - Base32編碼的字串
 * @returns {Uint8Array} 轉換後的位元組陣列
 * @throws {Error} 當Base32格式無效時丟擲錯誤
 */
export function base32toByteArray(base32) {
	const charTable = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
	const cleanBase32 = base32.toUpperCase().replace(/=/g, '');

	for (const c of cleanBase32) {
		if (charTable.indexOf(c) === -1) {
			throw new Error('Invalid Base32 character: ' + c);
		}
	}

	const bits = cleanBase32
		.split('')
		.map((char) => {
			const index = charTable.indexOf(char);
			if (index === -1) {
				throw new Error('Invalid Base32 character: ' + char);
			}
			return index.toString(2).padStart(5, '0');
		})
		.join('');

	const bytes = [];
	for (let i = 0; i < bits.length; i += 8) {
		const byte = bits.slice(i, i + 8);
		if (byte.length === 8) {
			bytes.push(parseInt(byte, 2));
		}
	}

	return new Uint8Array(bytes);
}

/**
 * 客戶端OTP生成函式（用於預覽下一個程式碼，支援所有型別）
 * @param {string} secret - Base32編碼的金鑰
 * @param {number} counter - 時間計數器或HOTP計數器
 * @param {Object} options - 可選引數
 * @param {number} options.digits - OTP位數，預設6
 * @param {string} options.algorithm - 演算法，預設SHA1
 * @param {string} options.type - OTP型別：TOTP、HOTP，預設TOTP
 * @returns {Promise<string>} OTP驗證碼
 */
export async function generateTOTP(secret, counter, options = {}) {
	try {
		const digits = options.digits || 6;
		const algorithm = options.algorithm || 'SHA1';
		const _type = options.type || 'TOTP';

		// Base32解碼
		const key = base32toByteArray(secret);

		// 將counter轉換為8位元組陣列
		const counterBytes = new ArrayBuffer(8);
		const counterView = new DataView(counterBytes);
		const highBits = Math.floor(counter / 0x100000000);
		const lowBits = counter % 0x100000000;
		counterView.setUint32(0, highBits, false);
		counterView.setUint32(4, lowBits, false);

		// 支援多種雜湊演算法
		const hashAlgorithm = getHashAlgorithm(algorithm);

		// 使用Web Crypto API進行HMAC
		const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: hashAlgorithm }, false, ['sign']);

		const signature = await crypto.subtle.sign('HMAC', cryptoKey, counterBytes);
		const hmac = new Uint8Array(signature);

		// 動態擷取
		const offset = hmac[hmac.length - 1] & 0x0f;
		const binary =
			((hmac[offset] & 0x7f) << 24) | ((hmac[offset + 1] & 0xff) << 16) | ((hmac[offset + 2] & 0xff) << 8) | (hmac[offset + 3] & 0xff);

		// 生成標準數字 OTP (TOTP/HOTP)
		const modulus = Math.pow(10, digits);
		const otp = binary % modulus;
		return otp.toString().padStart(digits, '0');
	} catch {
		// 客戶端預覽失敗時返回佔位符（不記錄日誌，避免汙染客戶端控制台）
		return '-'.repeat(options.digits || 6);
	}
}

/**
 * 生成OTP Auth URL用於二維碼
 * @param {string} serviceName - 服務名稱
 * @param {string} accountName - 賬戶名稱
 * @param {string} secret - Base32金鑰
 * @param {Object} options - 可選引數
 * @param {number} options.digits - OTP位數，預設6
 * @param {number} options.period - 時間步長（秒），預設30
 * @param {string} options.algorithm - 演算法，預設SHA1
 * @param {string} options.type - OTP型別：TOTP、HOTP，預設TOTP
 * @param {number} options.counter - HOTP計數器（僅HOTP需要）
 * @returns {string} otpauth:// URL
 */
export function generateOTPAuthURL(serviceName, accountName, secret, options = {}) {
	const digits = options.digits || 6;
	const period = options.period || 30;
	const algorithm = options.algorithm || 'SHA1';
	const type = options.type || 'TOTP';
	const counter = options.counter || 0;

	// 構建標籤，格式：服務名:賬戶名
	const label = serviceName + (accountName ? ':' + encodeURIComponent(accountName) : '');

	// 根據型別構建不同的 URL
	let scheme, params;

	switch (type.toUpperCase()) {
		case 'HOTP':
			scheme = 'hotp';
			params = new URLSearchParams({
				secret: secret.toUpperCase(),
				issuer: serviceName,
				algorithm: algorithm.toUpperCase(),
				digits: digits.toString(),
				counter: counter.toString(),
			});
			break;
		case 'TOTP':
		default:
			scheme = 'totp';
			params = new URLSearchParams({
				secret: secret.toUpperCase(),
				issuer: serviceName,
				algorithm: algorithm.toUpperCase(),
				digits: digits.toString(),
				period: period.toString(),
			});
			break;
	}

	return `otpauth://${scheme}/${encodeURIComponent(label)}?${params.toString()}`;
}
