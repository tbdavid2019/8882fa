/**
 * 驗證工具模組
 * 提供各種驗證功能和請求驗證中介軟體
 */

import { createErrorResponse } from './response.js';
import { LIMITS } from './constants.js';

// ==================== 驗證中介軟體系統 ====================

/**
 * Schema 驗證器類
 * 用於定義和驗證請求資料結構
 */
class Schema {
	constructor(definition) {
		this.definition = definition;
	}

	/**
	 * 驗證資料是否符合schema定義
	 * @param {Object} data - 要驗證的資料
	 * @returns {Object} { valid: boolean, errors: string[], data: Object }
	 */
	validate(data) {
		const errors = [];
		const validated = {};

		for (const [field, rules] of Object.entries(this.definition)) {
			const value = data[field];

			// 處理必填欄位
			if (rules.required && (value === undefined || value === null || value === '')) {
				errors.push(rules.message || `字段 "${field}" 是必填项`);
				continue;
			}

			// 可選欄位且未提供值，使用預設值
			if (!rules.required && (value === undefined || value === null)) {
				if (rules.default !== undefined) {
					validated[field] = rules.default;
				}
				continue;
			}

			// 型別驗證
			if (rules.type && value !== undefined && value !== null) {
				const typeValid = this._validateType(value, rules.type);
				if (!typeValid) {
					errors.push(`字段 "${field}" 类型错误，期望 ${rules.type}`);
					continue;
				}
			}

			// 自定義驗證函式
			if (rules.validator) {
				const result = rules.validator(value, data);
				if (result !== true) {
					errors.push(typeof result === 'string' ? result : `字段 "${field}" 验证失败`);
					continue;
				}
			}

			// 值轉換
			let finalValue = value;
			if (rules.transform) {
				finalValue = rules.transform(value);
			}

			validated[field] = finalValue;
		}

		return {
			valid: errors.length === 0,
			errors,
			data: validated,
		};
	}

	_validateType(value, type) {
		switch (type) {
			case 'string':
				return typeof value === 'string';
			case 'number':
				return typeof value === 'number' && !isNaN(value);
			case 'boolean':
				return typeof value === 'boolean';
			case 'array':
				return Array.isArray(value);
			case 'object':
				return typeof value === 'object' && !Array.isArray(value);
			default:
				return true;
		}
	}
}

/**
 * 請求驗證中介軟體
 * 自動解析 JSON body 並驗證
 *
 * @param {Schema|Object} schema - 驗證規則（Schema例項或定義物件）
 * @returns {Function} 驗證中介軟體函式
 *
 * @example
 * const body = await validateRequest(addSecretSchema)(request, env);
 * if (body instanceof Response) return body; // 驗證失敗
 * // body 現在是驗證並規範化後的資料
 */
export function validateRequest(schema) {
	const schemaInstance = schema instanceof Schema ? schema : new Schema(schema);

	return async (request) => {
		try {
			// 解析請求體
			const body = await request.json();

			// 驗證資料
			const result = schemaInstance.validate(body);

			if (!result.valid) {
				return createErrorResponse('请求验证失败', result.errors.join('; '), 400, request);
			}

			// 返回驗證後的資料
			return result.data;
		} catch (error) {
			if (error.name === 'SyntaxError') {
				return createErrorResponse('请求格式错误', '无效的JSON格式', 400, request);
			}
			throw error;
		}
	};
}

// ==================== 預定義驗證規則 ====================

/**
 * 新增金鑰的驗證規則
 */
export const addSecretSchema = new Schema({
	name: {
		required: true,
		type: 'string',
		message: '服务名称不能为空',
		transform: (v) => v.trim(),
		validator: (v) => {
			if (v.trim().length > 50) {
				return `服务名称过长，最多支持50个字符（当前：${v.trim().length}）`;
			}
			return true;
		},
	},
	secret: {
		required: true,
		type: 'string',
		message: '密钥不能为空',
		transform: (v) => v.toUpperCase().trim(),
		validator: (v) => {
			const validation = validateBase32(v);
			if (!validation.valid) {
				return `密钥验证失败：${validation.error}`;
			}
			return true;
		},
	},
	account: {
		required: false,
		type: 'string',
		default: '',
		transform: (v) => (v ? v.trim() : ''),
	},
	type: {
		required: false,
		type: 'string',
		default: 'TOTP',
		transform: (v) => v.toUpperCase(),
		validator: (v) => ['TOTP', 'HOTP'].includes(v.toUpperCase()) || '不支持的OTP类型，仅支持TOTP或HOTP',
	},
	digits: {
		required: false,
		type: 'number',
		default: 6,
		transform: (v) => parseInt(v, 10),
		validator: (v) => [6, 8].includes(parseInt(v, 10)) || '验证码位数仅支持6位或8位',
	},
	period: {
		required: false,
		type: 'number',
		default: 30,
		transform: (v) => parseInt(v, 10),
		validator: (v) => [30, 60, 120].includes(parseInt(v, 10)) || 'TOTP周期仅支持30、60或120秒',
	},
	algorithm: {
		required: false,
		type: 'string',
		default: 'SHA1',
		transform: (v) => v.toUpperCase(),
		validator: (v) => ['SHA1', 'SHA256', 'SHA512'].includes(v.toUpperCase()) || '哈希算法仅支持SHA1、SHA256或SHA512',
	},
	counter: {
		required: false,
		type: 'number',
		default: 0,
		validator: (v) => (v >= 0 && Number.isSafeInteger(v)) || 'HOTP计数器必须是非负安全整数',
	},
});

/**
 * HOTP counter advance request validation rules.
 */
export const advanceHOTPCounterSchema = new Schema({
	expectedNamespace: {
		required: false,
		type: 'string',
		default: null,
		validator: (v) => v.length > 0 || 'expectedNamespace必须是非空字符串',
	},
	expectedCounter: {
		required: true,
		type: 'number',
		validator: (v) => (v >= 0 && Number.isSafeInteger(v)) || 'expectedCounter必须是非负安全整数',
	},
	expectedSecret: {
		required: true,
		type: 'string',
		transform: (v) => v.toUpperCase().trim(),
		validator: (v) => validateBase32(v).valid || 'expectedSecret不是有效的Base32密钥',
	},
	expectedDigits: {
		required: true,
		type: 'number',
		validator: (v) => [6, 8].includes(v) || 'expectedDigits仅支持6位或8位',
	},
	expectedAlgorithm: {
		required: true,
		type: 'string',
		transform: (v) => v.toUpperCase(),
		validator: (v) => ['SHA1', 'SHA256', 'SHA512'].includes(v.toUpperCase()) || 'expectedAlgorithm仅支持SHA1、SHA256或SHA512',
	},
});

/**
 * 更新金鑰的驗證規則（與新增相同，但需要ID）
 */
export const updateSecretSchema = new Schema({
	id: {
		required: true,
		type: 'string',
		message: '密钥ID不能为空',
	},
	...addSecretSchema.definition,
});

/**
 * 批次匯入驗證規則
 */
export const batchImportSchema = new Schema({
	secrets: {
		required: true,
		type: 'array',
		message: '请提供密钥数组',
		validator: (v) => {
			if (!Array.isArray(v)) {
				return '密钥数据必须是数组格式';
			}
			if (v.length === 0) {
				return '密钥数组不能为空';
			}
			if (v.length > LIMITS.BULK_IMPORT_CHUNK_SIZE) {
				return `批量导入数量过多（${v.length}个），单次最多支持${LIMITS.BULK_IMPORT_CHUNK_SIZE}个`;
			}
			return true;
		},
	},
	immediateBackup: {
		required: false,
		type: 'boolean',
		default: true,
	},
	chunkIndex: {
		required: false,
		type: 'number',
		validator: (v) => (Number.isInteger(v) && v >= 1) || 'chunkIndex 必须是大于等于 1 的整数',
	},
	chunkCount: {
		required: false,
		type: 'number',
		validator: (v) => (Number.isInteger(v) && v >= 1) || 'chunkCount 必须是大于等于 1 的整数',
	},
});

/**
 * 備份恢復驗證規則
 */
export const restoreBackupSchema = new Schema({
	backupKey: {
		required: true,
		type: 'string',
		message: '备份键不能为空',
		validator: (v) => {
			if (!/^backup_\d{4}-\d{2}-\d{2}(?:_[\w-]+)?\.(?:json|txt|csv|html)$/.test(v)) {
				return '备份文件名格式不正确，应为 backup_YYYY-MM-DD_HH-MM-SS-mmm-xxxx.(json|txt|csv|html)';
			}
			return true;
		},
	},
	preview: {
		required: false,
		type: 'boolean',
		default: false,
	},
});

/**
 * WebDAV 配置驗證規則
 */
export const webdavConfigSchema = new Schema({
	id: { required: false, type: 'string' },
	name: {
		required: true,
		type: 'string',
		message: '目标名称不能为空',
		transform: (v) => v.trim(),
		validator: (v) => {
			if (v.trim().length > 30) {
				return `目标名称过长，最多支持30个字符（当前：${v.trim().length}）`;
			}
			return true;
		},
	},
	url: {
		required: true,
		type: 'string',
		message: 'WebDAV URL 不能为空',
		validator: (v) => {
			try {
				const u = new URL(v);
				return u.protocol === 'https:' || 'URL 必须使用 HTTPS';
			} catch {
				return 'URL 格式无效';
			}
		},
		transform: (v) => v.replace(/\/+$/, ''),
	},
	username: { required: true, type: 'string', message: '用户名不能为空' },
	password: { required: false, type: 'string', default: '' },
	path: {
		required: false,
		type: 'string',
		default: '/',
		transform: (v) => {
			const p = v.trim().replace(/\/+/g, '/').replace(/\/+$/, '');
			return p.startsWith('/') ? p || '/' : '/' + p;
		},
	},
});

/**
 * S3 配置驗證規則
 */
export const s3ConfigSchema = new Schema({
	id: { required: false, type: 'string' },
	name: {
		required: true,
		type: 'string',
		message: '目标名称不能为空',
		transform: (v) => v.trim(),
		validator: (v) => {
			if (v.trim().length > 30) {
				return `目标名称过长，最多支持30个字符（当前：${v.trim().length}）`;
			}
			return true;
		},
	},
	endpoint: {
		required: true,
		type: 'string',
		message: 'Endpoint 不能为空',
		validator: (v) => {
			try {
				const u = new URL(v);
				return u.protocol === 'https:' || 'URL 必须使用 HTTPS';
			} catch {
				return 'URL 格式无效';
			}
		},
		transform: (v) => v.replace(/\/+$/, ''),
	},
	bucket: { required: true, type: 'string', message: 'Bucket 不能为空' },
	region: { required: false, type: 'string', default: 'auto' },
	accessKeyId: { required: true, type: 'string', message: 'Access Key ID 不能为空' },
	secretAccessKey: { required: false, type: 'string', default: '' },
	prefix: {
		required: false,
		type: 'string',
		default: '',
		transform: (v) => {
			if (!v || !v.trim()) {
				return '';
			}
			const p = v.trim().replace(/\/+/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
			return p ? p + '/' : '';
		},
	},
});

/**
 * OAuth 網盤配置驗證規則
 */
export const cloudDriveConfigSchema = new Schema({
	id: { required: false, type: 'string' },
	name: {
		required: true,
		type: 'string',
		message: '目标名称不能为空',
		transform: (v) => v.trim(),
		validator: (v) => {
			if (v.trim().length > 30) {
				return `目标名称过长，最多支持30个字符（当前：${v.trim().length}）`;
			}
			return true;
		},
	},
	folderPath: {
		required: false,
		type: 'string',
		default: '/2FA-Backups',
		transform: (v) => {
			const normalized = (v || '/2FA-Backups').trim().replace(/\/+/g, '/').replace(/\/+$/, '');
			return normalized.startsWith('/') ? normalized || '/' : '/' + normalized;
		},
		validator: (v) => {
			const normalized = (v || '/2FA-Backups').trim().replace(/\/+/g, '/').replace(/\/+$/, '');
			const finalPath = normalized.startsWith('/') ? normalized || '/' : '/' + normalized;

			if (finalPath.length > 200) {
				return '备份目录过长，最多支持 200 个字符';
			}

			const segments = finalPath.split('/').filter(Boolean);
			if (segments.some((segment) => segment === '.' || segment === '..')) {
				return '备份目录不能包含 "." 或 ".."';
			}

			return true;
		},
	},
});

/**
 * 僅包含目標 ID 的驗證規則
 */
export const destinationIdSchema = new Schema({
	id: { required: true, type: 'string', message: '目标 ID 不能为空' },
});

/**
 * 目標啟用/停用切換驗證規則
 */
export const toggleDestinationSchema = new Schema({
	id: { required: true, type: 'string', message: '目标 ID 不能为空' },
	enabled: { required: true, type: 'boolean', message: '启用状态不能为空' },
});

// ==================== 原有驗證函式 ====================

/**
 * 驗證Base32金鑰格式和安全性
 * @param {string} secret - Base32編碼的金鑰
 * @returns {Object} 驗證結果 {valid: boolean, error?: string, warning?: string}
 */
export function validateBase32(secret) {
	if (!secret || !secret.trim()) {
		return { valid: false, error: '密钥不能为空' };
	}

	const cleanSecret = secret.toUpperCase().trim().replace(/\s/g, '');
	const base32Regex = /^[A-Z2-7]+=*$/;

	if (!base32Regex.test(cleanSecret)) {
		return {
			valid: false,
			error: '密钥格式无效，只能包含字母A-Z和数字2-7（例如：JBSWY3DPEHPK3PXP）',
		};
	}

	// 計算解碼後的位元組長度 (Base32每8個字元編碼5個位元組)
	const paddingCount = (cleanSecret.match(/=/g) || []).length;
	const encodedLength = cleanSecret.length - paddingCount;
	const byteLength = Math.floor((encodedLength * 5) / 8);
	const bitLength = byteLength * 8;

	if (cleanSecret.length < 8) {
		return {
			valid: false,
			error: `密钥长度过短（${cleanSecret.length}字符），至少需要8字符以确保基本安全性`,
		};
	}

	if (bitLength < 80) {
		return {
			valid: true,
			warning: `密钥强度较弱（${bitLength}位），建议使用至少128位（21字符）的密钥以提高安全性`,
		};
	}

	if (bitLength >= 128) {
		return { valid: true }; // 強金鑰，無警告
	}

	return {
		valid: true,
		warning: `密钥强度一般（${bitLength}位），推荐使用128位以上的密钥`,
	};
}

/**
 * 驗證金鑰資料的完整性
 * @param {Object} secretData - 金鑰資料物件
 * @returns {Object} 驗證結果 {valid: boolean, error?: string}
 */
export function validateSecretData(secretData) {
	const { name, secret } = secretData;

	if (!name || !name.trim()) {
		return { valid: false, error: '服务名称不能为空，请输入服务提供商名称（如：GitHub、Google、Microsoft等）' };
	}

	if (name.trim().length > 50) {
		return { valid: false, error: `服务名称"${name.trim()}"过长，最多支持50个字符` };
	}

	if (!secret || !secret.trim()) {
		return { valid: false, error: '密钥不能为空，请输入2FA应用提供的Base32格式密钥' };
	}

	const secretValidation = validateBase32(secret);
	if (!secretValidation.valid) {
		return { valid: false, error: `密钥验证失败：${secretValidation.error}` };
	}

	// 如果有安全警告，也包含在返回結果中
	if (secretValidation.warning) {
		return {
			valid: true,
			warning: `密钥安全提醒：${secretValidation.warning}`,
		};
	}

	return { valid: true };
}

/**
 * 驗證OTP引數的有效性
 * @param {Object} params - OTP引數
 * @param {string} params.type - OTP型別 (TOTP/HOTP)
 * @param {number} params.digits - 驗證碼位數
 * @param {number} params.period - TOTP週期（秒）
 * @param {string} params.algorithm - 雜湊演算法 (SHA1/SHA256/SHA512)
 * @param {number} params.counter - HOTP計數器值
 * @returns {Object} 驗證結果 {valid: boolean, error?: string}
 */
export function validateOTPParams({ type = 'TOTP', digits = 6, period = 30, algorithm = 'SHA1', counter = 0 }) {
	// 驗證OTP型別
	const validTypes = ['TOTP', 'HOTP'];
	const normalizedType = type.toUpperCase();

	if (!validTypes.includes(normalizedType)) {
		return {
			valid: false,
			error: `不支持的OTP类型"${type}"，请选择以下类型之一：TOTP（时间基准）或HOTP（计数器基准）`,
		};
	}

	// 驗證驗證碼位數
	if (![6, 8].includes(digits)) {
		return {
			valid: false,
			error: `验证码位数设置为${digits}位无效，仅支持6位或8位数字验证码`,
		};
	}

	// 驗證TOTP週期
	if (normalizedType === 'TOTP' && ![30, 60, 120].includes(period)) {
		return {
			valid: false,
			error: `TOTP刷新周期设置为${period}秒无效，仅支持30秒、60秒或120秒`,
		};
	}

	// 驗證雜湊演算法
	const validAlgorithms = ['SHA1', 'SHA256', 'SHA512'];
	const normalizedAlgorithm = algorithm.toUpperCase();

	if (!validAlgorithms.includes(normalizedAlgorithm)) {
		return {
			valid: false,
			error: `哈希算法"${algorithm}"不受支持，请选择SHA1、SHA256或SHA512算法`,
		};
	}

	// 驗證HOTP計數器
	if (normalizedType === 'HOTP' && (counter < 0 || !Number.isSafeInteger(counter))) {
		return {
			valid: false,
			error: `HOTP计数器值"${counter}"无效，必须是大于或等于0的安全整数（如：0, 1, 2...）`,
		};
	}

	return { valid: true };
}

/**
 * 建立標準化的金鑰物件
 * @param {Object} data - 金鑰資料
 * @param {string} data.name - 服務名稱
 * @param {string} data.service - 賬戶名稱（可選）
 * @param {string} data.secret - Base32金鑰
 * @param {string} data.type - OTP型別
 * @param {number} data.digits - 驗證碼位數
 * @param {number} data.period - TOTP週期
 * @param {string} data.algorithm - 雜湊演算法
 * @param {number} data.counter - HOTP計數器
 * @param {string} existingId - 現有ID（用於更新）
 * @returns {Object} 標準化的金鑰物件
 */
export function createSecretObject(
	{ name, service, secret, type = 'TOTP', digits = 6, period = 30, algorithm = 'SHA1', counter = 0 },
	existingId = null,
) {
	const normalizedType = type.toUpperCase();

	const secretObject = {
		id: existingId || crypto.randomUUID(),
		name: name.trim(),
		account: service ? service.trim() : '',
		secret: secret.toUpperCase().trim(),
		type: normalizedType,
		digits: parseInt(digits),
		period: parseInt(period),
		algorithm: algorithm.toUpperCase(),
		counter: normalizedType === 'HOTP' ? parseInt(counter) : undefined,
	};

	return secretObject;
}

/**
 * 按服務名稱排序金鑰列表
 * @param {Array} secrets - 金鑰陣列
 * @returns {Array} 排序後的金鑰陣列
 */
export function sortSecretsByName(secrets) {
	return secrets.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
}

/**
 * 檢查金鑰是否重複
 * 只有當服務名+賬戶名+金鑰都相同時才視為重複
 * @param {Array} secrets - 金鑰陣列
 * @param {string} name - 服務名稱
 * @param {string} account - 賬戶名稱
 * @param {string} secret - 金鑰
 * @param {number} excludeIndex - 要排除的索引（用於更新時排除自己）
 * @returns {boolean} 是否存在重複
 */
export function checkDuplicateSecret(secrets, name, account, secret = '', excludeIndex = -1) {
	// 規範化金鑰用於比較（移除空格，轉大寫）
	const normalizedSecret = secret.replace(/\s+/g, '').toUpperCase();

	return secrets.some((s, index) => {
		if (index === excludeIndex) {
			return false;
		}
		const existingSecret = (s.secret || '').replace(/\s+/g, '').toUpperCase();
		// 只有名稱、賬戶、金鑰都相同時才視為重複
		return s.name === name && s.account === account && existingSecret === normalizedSecret;
	});
}
