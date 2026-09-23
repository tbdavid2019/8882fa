/**
 * 資料加密/解密工具模組
 * 使用 AES-GCM 256位加密演算法保護敏感資料
 *
 * 配置說明：
 * - ENCRYPTION_KEY 是可選配置項
 * - 如果配置了 ENCRYPTION_KEY，資料將被加密儲存（推薦）
 * - 如果未配置 ENCRYPTION_KEY，資料將以明文儲存
 * - 可以隨時從明文模式切換到加密模式，但反向切換會導致無法讀取已加密的資料
 *
 * 安全特性：
 * - AES-GCM：現代、快速、帶認證的加密演算法
 * - 256位金鑰：業界標準的強加密
 * - 隨機IV：每次加密使用不同的初始化向量
 * - 認證標籤：防止資料被篡改
 */

import { ValidationError, ConfigurationError, ErrorFactory } from './errors.js';

/**
 * 從環境變數獲取加密金鑰（內部函式）
 * @param {Object} env - 環境變數物件
 * @returns {Promise<CryptoKey>} 加密金鑰
 * @throws {Error} 如果未配置 ENCRYPTION_KEY
 */
async function getEncryptionKey(env) {
	if (!env.ENCRYPTION_KEY) {
		throw ErrorFactory.missingConfig('ENCRYPTION_KEY', {
			hint: '请使用 "wrangler secret put ENCRYPTION_KEY" 设置加密密钥',
		});
	}

	// 將 base64 編碼的金鑰轉換為 CryptoKey
	const keyData = base64ToArrayBuffer(env.ENCRYPTION_KEY);

	return crypto.subtle.importKey('raw', keyData, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

/**
 * 加密資料
 * @param {Object} data - 要加密的資料物件
 * @param {Object} env - 環境變數物件
 * @returns {Promise<string>} 加密後的資料（格式：version:iv:encryptedData）
 */
export async function encryptData(data, env) {
	try {
		// 獲取加密金鑰
		const key = await getEncryptionKey(env);

		// 將資料轉換為 JSON 字串
		const jsonString = JSON.stringify(data);
		const encoder = new TextEncoder();
		const dataBuffer = encoder.encode(jsonString);

		// 生成隨機 IV（初始化向量）
		const iv = crypto.getRandomValues(new Uint8Array(12)); // 96位 IV 用於 GCM

		// 加密資料
		const encryptedBuffer = await crypto.subtle.encrypt(
			{
				name: 'AES-GCM',
				iv: iv,
				tagLength: 128, // 128位認證標籤
			},
			key,
			dataBuffer,
		);

		// 將 IV 和加密資料轉換為 base64
		const ivBase64 = arrayBufferToBase64(iv);
		const encryptedBase64 = arrayBufferToBase64(encryptedBuffer);

		// 格式：版本號:IV:加密資料
		// 版本號用於將來可能的加密演算法升級
		return `v1:${ivBase64}:${encryptedBase64}`;
	} catch (error) {
		// 如果是已知的配置錯誤，直接丟擲
		if (error instanceof ConfigurationError) {
			throw error;
		}

		console.error('数据加密失败:', error);
		throw ErrorFactory.encryptionFailed({
			originalError: error.message,
		});
	}
}

/**
 * 解密資料
 * @param {string} encryptedString - 加密的字串
 * @param {Object} env - 環境變數物件
 * @returns {Promise<Object>} 解密後的資料物件
 * @throws {Error} 如果解密失敗或資料已損壞
 */
export async function decryptData(encryptedString, env) {
	try {
		// 解析加密字串
		const parts = encryptedString.split(':');

		if (parts.length !== 3) {
			throw new ValidationError('加密数据格式无效', {
				format: 'expected "version:iv:encryptedData"',
				received: `${parts.length} parts`,
			});
		}

		const [version, ivBase64, encryptedBase64] = parts;

		// 檢查版本
		if (version !== 'v1') {
			throw new ValidationError(`不支持的加密版本: ${version}`, {
				supportedVersions: ['v1'],
				receivedVersion: version,
			});
		}

		// 獲取加密金鑰
		const key = await getEncryptionKey(env);

		// 將 base64 轉換回 ArrayBuffer
		const iv = base64ToArrayBuffer(ivBase64);
		const encryptedBuffer = base64ToArrayBuffer(encryptedBase64);

		// 解密資料
		const decryptedBuffer = await crypto.subtle.decrypt(
			{
				name: 'AES-GCM',
				iv: iv,
				tagLength: 128,
			},
			key,
			encryptedBuffer,
		);

		// 將解密後的資料轉換為字串和物件
		const decoder = new TextDecoder();
		const jsonString = decoder.decode(decryptedBuffer);

		return JSON.parse(jsonString);
	} catch (error) {
		// 如果是已知的配置或驗證錯誤，直接丟擲
		if (error instanceof ConfigurationError || error instanceof ValidationError) {
			throw error;
		}

		console.error('数据解密失败:', error);
		throw ErrorFactory.decryptionFailed({
			originalError: error.message,
			hint: '数据可能已损坏或使用了错误的密钥',
		});
	}
}

/**
 * 檢查資料是否已加密
 * @param {string|Object} data - 要檢查的資料
 * @returns {boolean} 是否已加密
 */
export function isEncrypted(data) {
	// 如果是字串且以 "v1:" 開頭，則認為已加密
	if (typeof data === 'string' && data.startsWith('v1:')) {
		return true;
	}
	return false;
}

/**
 * 生成新的加密金鑰（用於初始化設定）
 * @returns {Promise<string>} Base64 編碼的 256 位金鑰
 */
export async function generateEncryptionKey() {
	// 生成 256 位（32 位元組）隨機金鑰
	const keyBuffer = crypto.getRandomValues(new Uint8Array(32));
	return arrayBufferToBase64(keyBuffer);
}

/**
 * 加密金鑰列表（便捷函式）
 * @param {Array} secrets - 金鑰陣列
 * @param {Object} env - 環境變數物件
 * @returns {Promise<string>} 加密後的金鑰列表
 */
export async function encryptSecrets(secrets, env) {
	if (!env.ENCRYPTION_KEY) {
		console.warn('⚠️  ENCRYPTION_KEY 未配置，数据将以明文存储！强烈建议配置加密密钥。');
		// 向後相容：如果沒有配置加密金鑰，返回明文 JSON
		return JSON.stringify(secrets);
	}

	return encryptData(secrets, env);
}

/**
 * 解密金鑰列表（便捷函式，自動檢測是否加密）
 * @param {string} data - 可能已加密的資料
 * @param {Object} env - 環境變數物件
 * @returns {Promise<Array>} 解密後的金鑰陣列
 */
export async function decryptSecrets(data, env) {
	if (!data) {
		return [];
	}

	// 檢查是否已加密
	if (isEncrypted(data)) {
		// 資料已加密，需要解密
		if (!env.ENCRYPTION_KEY) {
			throw new ConfigurationError('检测到已有加密数据，但未配置 ENCRYPTION_KEY', {
				hint: '请恢复原来的 ENCRYPTION_KEY 后再访问、修改、导出或恢复数据',
				actionRequired: 'restore_original_encryption_key',
			});
		}
		return decryptData(data, env);
	} else {
		// 資料未加密（舊資料），直接解析
		if (!env.ENCRYPTION_KEY) {
			console.log('✅ 未配置 ENCRYPTION_KEY，使用明文模式');
		} else {
			console.warn('⚠️  检测到未加密的数据，建议尽快迁移到加密存储');
		}
		try {
			return JSON.parse(data);
		} catch (error) {
			console.error('解析未加密数据失败:', error);
			throw new ValidationError('密钥数据格式无效', {
				originalError: error.message,
				hint: '存储中的密钥数据已损坏或格式不兼容，请修复后再重试',
			});
		}
	}
}

/**
 * 將 ArrayBuffer 轉換為 Base64 字串
 * @param {ArrayBuffer|Uint8Array} buffer - 要轉換的緩衝區
 * @returns {string} Base64 字串
 */
function arrayBufferToBase64(buffer) {
	const uint8Array = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
	let binary = '';
	for (let i = 0; i < uint8Array.length; i++) {
		binary += String.fromCharCode(uint8Array[i]);
	}
	return btoa(binary);
}

/**
 * 將 Base64 字串轉換為 ArrayBuffer
 * @param {string} base64 - Base64 字串
 * @returns {Uint8Array} ArrayBuffer
 */
function base64ToArrayBuffer(base64) {
	const binary = atob(base64);
	const uint8Array = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		uint8Array[i] = binary.charCodeAt(i);
	}
	return uint8Array;
}

/**
 * 驗證加密配置是否正確
 * @param {Object} env - 環境變數物件
 * @returns {Object} 驗證結果 {configured: boolean, valid: boolean, message: string}
 */
export async function validateEncryptionConfig(env) {
	// 檢查是否配置了加密金鑰
	if (!env.ENCRYPTION_KEY) {
		return {
			configured: false,
			valid: true, // 未配置金鑰也是有效的（使用明文模式）
			message: '未配置 ENCRYPTION_KEY。将使用明文模式存储数据。建议配置加密密钥以增强安全性。',
		};
	}

	try {
		// 嘗試匯入金鑰以驗證格式
		await getEncryptionKey(env);

		// 測試加密和解密
		const testData = { test: 'encryption-test', timestamp: Date.now() };
		const encrypted = await encryptData(testData, env);
		const decrypted = await decryptData(encrypted, env);

		if (JSON.stringify(testData) === JSON.stringify(decrypted)) {
			return {
				configured: true,
				valid: true,
				message: '✅ 加密配置正确，数据将被加密存储',
			};
		} else {
			return {
				configured: true,
				valid: false,
				message: '加密配置异常：加密后无法正确解密',
			};
		}
	} catch (error) {
		return {
			configured: true,
			valid: false,
			message: `加密配置错误: ${error.message}`,
		};
	}
}
