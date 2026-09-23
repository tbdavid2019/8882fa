/**
 * 統一錯誤分類系統
 * 提供一致的錯誤處理和響應格式
 */

/**
 * 應用基礎錯誤類
 * 所有自定義錯誤的基類
 */
export class AppError extends Error {
	/**
	 * @param {string} message - 錯誤訊息（使用者友好）
	 * @param {number} statusCode - HTTP 狀態碼
	 * @param {Object} details - 額外的錯誤詳情（可選）
	 * @param {boolean} isOperational - 是否為可操作的錯誤（vs 程式錯誤）
	 */
	constructor(message, statusCode = 500, details = {}, isOperational = true) {
		super(message);

		// 維護正確的堆疊跟蹤（V8引擎）
		Error.captureStackTrace(this, this.constructor);

		this.name = this.constructor.name;
		this.statusCode = statusCode;
		this.details = details;
		this.isOperational = isOperational; // 區分可恢復的業務錯誤 vs 程式bug
		this.timestamp = new Date().toISOString();
	}

	/**
	 * 轉換為 HTTP 響應格式
	 */
	toJSON() {
		return {
			error: this.name,
			message: this.message,
			statusCode: this.statusCode,
			details: this.details,
			timestamp: this.timestamp,
		};
	}
}

/**
 * 認證錯誤 (401 Unauthorized)
 * 用於：未認證、Token失效、密碼錯誤等
 */
export class AuthenticationError extends AppError {
	constructor(message = '认证失败', details = {}) {
		super(message, 401, details);
	}
}

/**
 * 授權錯誤 (403 Forbidden)
 * 用於：許可權不足、禁止訪問等
 */
export class AuthorizationError extends AppError {
	constructor(message = '权限不足', details = {}) {
		super(message, 403, details);
	}
}

/**
 * 驗證錯誤 (400 Bad Request)
 * 用於：輸入驗證失敗、格式錯誤、引數缺失等
 */
export class ValidationError extends AppError {
	constructor(message = '数据验证失败', details = {}) {
		super(message, 400, details);
	}
}

/**
 * 資源未找到錯誤 (404 Not Found)
 * 用於：請求的資源不存在
 */
export class NotFoundError extends AppError {
	constructor(resource = '资源', details = {}) {
		super(`${resource}不存在`, 404, details);
	}
}

/**
 * 衝突錯誤 (409 Conflict)
 * 用於：資源已存在、狀態衝突等
 */
export class ConflictError extends AppError {
	constructor(message = '资源冲突', details = {}) {
		super(message, 409, details);
	}
}

/**
 * 速率限制錯誤 (429 Too Many Requests)
 * 用於：請求頻率超限
 */
export class RateLimitError extends AppError {
	constructor(message = '请求过于频繁', details = {}) {
		super(message, 429, details);
	}
}

/**
 * 加密/解密錯誤 (500 Internal Server Error)
 * 用於：加密、解密、簽名等操作失敗
 */
export class CryptoError extends AppError {
	constructor(message = '加密操作失败', details = {}) {
		super(message, 500, details);
	}
}

/**
 * 資料庫/儲存錯誤 (500 Internal Server Error)
 * 用於：KV儲存、資料庫操作失敗
 */
export class StorageError extends AppError {
	constructor(message = '存储操作失败', details = {}) {
		super(message, 500, details);
	}
}

/**
 * 配置錯誤 (500 Internal Server Error)
 * 用於：缺少必需的配置、配置格式錯誤
 * 注意：這是程式錯誤，不是操作錯誤
 */
export class ConfigurationError extends AppError {
	constructor(message = '配置错误', details = {}) {
		super(message, 500, details, false); // isOperational = false
	}
}

/**
 * 外部服務錯誤 (502 Bad Gateway / 503 Service Unavailable)
 * 用於：第三方API呼叫失敗、外部服務不可用
 */
export class ExternalServiceError extends AppError {
	constructor(message = '外部服务错误', statusCode = 502, details = {}) {
		super(message, statusCode, details);
	}
}

/**
 * 業務邏輯錯誤 (400 Bad Request)
 * 用於：不符合業務規則的操作
 */
export class BusinessLogicError extends AppError {
	constructor(message = '操作不符合业务规则', details = {}) {
		super(message, 400, details);
	}
}

/**
 * 判斷錯誤是否為可操作的（業務錯誤）
 * @param {Error} error
 * @returns {boolean}
 */
export function isOperationalError(error) {
	if (error instanceof AppError) {
		return error.isOperational;
	}
	return false;
}

/**
 * 從錯誤物件建立標準響應
 * @param {Error} error - 錯誤物件
 * @param {Request} request - 請求物件（可選）
 * @returns {Response} HTTP響應
 */
export function errorToResponse(error, _request = null) {
	// 匯入 response 工具
	// 注意：為避免迴圈依賴，這裡內聯實現
	const getSecurityHeaders = () => {
		return {
			'Content-Type': 'application/json',
			'X-Content-Type-Options': 'nosniff',
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type, Authorization',
		};
	};

	if (error instanceof AppError) {
		return new Response(JSON.stringify(error.toJSON()), {
			status: error.statusCode,
			headers: getSecurityHeaders(),
		});
	}

	// 未知錯誤 - 不暴露內部細節
	return new Response(
		JSON.stringify({
			error: 'InternalServerError',
			message: '服务器内部错误',
			statusCode: 500,
			timestamp: new Date().toISOString(),
		}),
		{
			status: 500,
			headers: getSecurityHeaders(),
		},
	);
}

/**
 * 錯誤日誌記錄輔助函式
 * @param {Error} error
 * @param {Object} logger - 日誌記錄器
 * @param {Object} context - 上下文資訊
 */
export function logError(error, logger, context = {}) {
	const errorInfo = {
		name: error.name,
		message: error.message,
		stack: error.stack,
		...context,
	};

	if (error instanceof AppError) {
		errorInfo.statusCode = error.statusCode;
		errorInfo.details = error.details;
		errorInfo.isOperational = error.isOperational;

		if (error.isOperational) {
			// 操作錯誤（業務錯誤）- 使用 warn 級別
			logger.warn(error.message, errorInfo);
		} else {
			// 程式錯誤 - 使用 error 級別
			logger.error(error.message, errorInfo, error);
		}
	} else {
		// 未知錯誤 - 使用 error 級別
		logger.error('未捕获的错误', errorInfo, error);
	}
}

/**
 * 錯誤工廠函式 - 用於快速建立常見錯誤
 */
export const ErrorFactory = {
	/**
	 * JWT相關錯誤
	 */
	jwtExpired: (details = {}) => new AuthenticationError('JWT已过期，请重新登录', details),

	jwtInvalid: (details = {}) => new AuthenticationError('JWT无效', details),

	jwtMissing: (details = {}) => new AuthenticationError('未提供认证凭证', details),

	/**
	 * 密碼相關錯誤
	 */
	passwordWeak: (message, details = {}) => new ValidationError(message, details),

	passwordIncorrect: (details = {}) => new AuthenticationError('密码错误', details),

	/**
	 * 資源相關錯誤
	 */
	secretNotFound: (id, details = {}) => new NotFoundError('密钥', { secretId: id, ...details }),

	backupNotFound: (key, details = {}) => new NotFoundError('备份文件', { backupKey: key, ...details }),

	/**
	 * 加密相關錯誤
	 */
	encryptionFailed: (details = {}) => new CryptoError('数据加密失败', details),

	decryptionFailed: (details = {}) => new CryptoError('数据解密失败', details),

	/**
	 * 速率限制錯誤
	 */
	rateLimitExceeded: (limit, resetAt, details = {}) =>
		new RateLimitError('请求过于频繁，请稍后再试', {
			limit,
			resetAt,
			...details,
		}),

	/**
	 * 配置錯誤
	 */
	missingConfig: (configName, details = {}) => new ConfigurationError(`缺少必需的配置: ${configName}`, details),

	/**
	 * 儲存錯誤
	 */
	storageFailed: (operation, details = {}) => new StorageError(`存储操作失败: ${operation}`, details),
};

/**
 * 使用示例：
 *
 * // 基本使用
 * throw new ValidationError('密碼長度不足', { minLength: 8 });
 *
 * // 使用工廠函式
 * throw ErrorFactory.jwtExpired({ token: 'abc123' });
 *
 * // 錯誤處理
 * try {
 *   // ... 操作
 * } catch (error) {
 *   if (error instanceof AuthenticationError) {
 *     // 處理認證錯誤
 *   }
 *   return errorToResponse(error, request);
 * }
 *
 * // 錯誤日誌
 * logError(error, logger, { operation: 'login', userId: 123 });
 */
