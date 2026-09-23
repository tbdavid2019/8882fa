/**
 * CRUD 操作處理器 - 金鑰的建立、讀取、更新、刪除
 *
 * 包含功能:
 * - handleGetSecrets: 獲取所有金鑰列表
 * - handleAddSecret: 新增新金鑰
 * - handleUpdateSecret: 更新現有金鑰
 * - handleDeleteSecret: 刪除金鑰 (帶 Rate Limiting)
 */

import { saveSecretsToKV, getAllSecrets } from './shared.js';
import { deleteHOTPCounterState, generateHOTPGenerationHash } from './counter-state.js';
import { getLogger } from '../../utils/logger.js';
import { PerformanceTimer } from '../../utils/logger.js';
import { getMonitoring, ErrorSeverity } from '../../utils/monitoring.js';
import { validateRequest, addSecretSchema, checkDuplicateSecret, validateBase32 } from '../../utils/validation.js';
import { createJsonResponse, createErrorResponse, createSuccessResponse } from '../../utils/response.js';
import { checkRateLimit, getClientIdentifier, createRateLimitResponse, RATE_LIMIT_PRESETS } from '../../utils/rateLimit.js';
import {
	ValidationError,
	NotFoundError,
	ConflictError,
	StorageError,
	CryptoError,
	ConfigurationError,
	ErrorFactory,
	errorToResponse,
	logError,
} from '../../utils/errors.js';

/**
 * 獲取所有金鑰列表
 *
 * @param {Object} env - Cloudflare Workers 環境物件
 * @returns {Response} 金鑰列表響應
 */
export async function handleGetSecrets(env) {
	const logger = getLogger(env);
	const timer = new PerformanceTimer('GetSecrets', logger);

	try {
		const secrets = await getAllSecrets(env);
		timer.checkpoint('Fetched, decrypted, and overlaid');

		timer.end({ count: secrets.length });

		return createJsonResponse(secrets);
	} catch (error) {
		timer.cancel();

		// 如果是已知的錯誤型別，記錄並轉換
		if (
			error instanceof StorageError ||
			error instanceof CryptoError ||
			error instanceof ValidationError ||
			error instanceof ConfigurationError
		) {
			logError(error, logger, { operation: 'handleGetSecrets' });
			getMonitoring(env).getErrorMonitor().captureError(error, { operation: 'handleGetSecrets' }, ErrorSeverity.ERROR);
			return errorToResponse(error);
		}

		// 未知錯誤
		logger.error('获取密钥列表失败', { operation: 'handleGetSecrets' }, error);
		getMonitoring(env).getErrorMonitor().captureError(error, { operation: 'handleGetSecrets' }, ErrorSeverity.ERROR);
		return createErrorResponse('获取密钥列表失败', `从存储中获取密钥时发生错误: ${error.message}`, 500);
	}
}

/**
 * 新增新金鑰
 *
 * @param {Request} request - HTTP 請求物件
 * @param {Object} env - Cloudflare Workers 環境物件
 * @param {Object} [ctx] - Cloudflare Workers 執行上下文
 * @returns {Response} 新增結果響應
 */
export async function handleAddSecret(request, env, ctx) {
	const logger = getLogger(env);

	try {
		// 🔍 使用驗證中介軟體解析和驗證請求
		const secretData = await validateRequest(addSecretSchema)(request);
		if (secretData instanceof Response) {
			return secretData;
		} // 驗證失敗

		// 獲取現有金鑰
		const existingSecrets = await getAllSecrets(env);

		// 檢查重複（服務名+賬戶+金鑰都相同才視為重複）
		const isDuplicate = checkDuplicateSecret(existingSecrets, secretData.name, secretData.account, secretData.secret);

		if (isDuplicate) {
			throw new ConflictError(`服务"${secretData.name}"${secretData.account ? ` (账户: ${secretData.account})` : ''} 已存在`, {
				operation: 'addSecret',
				name: secretData.name,
				account: secretData.account,
			});
		}

		// 建立金鑰物件（資料已經通過驗證和轉換）
		const newSecret = {
			id: crypto.randomUUID(),
			name: secretData.name,
			account: secretData.account,
			secret: secretData.secret,
			type: secretData.type,
			digits: secretData.digits,
			period: secretData.period,
			algorithm: secretData.algorithm,
			counter: secretData.type === 'HOTP' ? secretData.counter : undefined,
		};

		existingSecrets.push(newSecret);

		// 儲存到 KV (自動加密、排序、觸發備份)
		await saveSecretsToKV(env, existingSecrets, 'secret-added', {}, ctx);

		logger.info('密钥添加成功', {
			operation: 'handleAddSecret',
			secretId: newSecret.id,
			name: newSecret.name,
		});

		// 檢查是否有金鑰強度警告
		const validation = validateBase32(secretData.secret);
		const responseData = {
			success: true,
			message: validation.warning ? `⚠️ 密钥添加成功，但${validation.warning}` : '密钥添加成功',
			data: { secret: newSecret },
		};

		if (validation.warning) {
			responseData.data.warning = validation.warning;
		}

		return createJsonResponse(responseData, 201, request);
	} catch (error) {
		// 如果是已知的錯誤型別，記錄並轉換
		if (
			error instanceof ConflictError ||
			error instanceof ValidationError ||
			error instanceof StorageError ||
			error instanceof CryptoError ||
			error instanceof ConfigurationError
		) {
			logError(error, logger, { operation: 'handleAddSecret' });
			getMonitoring(env).getErrorMonitor().captureError(error, { operation: 'handleAddSecret' }, ErrorSeverity.WARNING);
			return errorToResponse(error, request);
		}

		// 未知錯誤
		logger.error('添加密钥失败', { operation: 'handleAddSecret', errorMessage: error.message }, error);
		getMonitoring(env).getErrorMonitor().captureError(error, { operation: 'handleAddSecret' }, ErrorSeverity.ERROR);
		return createErrorResponse('添加密钥失败', `添加密钥时发生内部错误`, 500, request);
	}
}

/**
 * 更新現有金鑰
 *
 * @param {Request} request - HTTP 請求物件
 * @param {Object} env - Cloudflare Workers 環境物件
 * @param {Object} [ctx] - Cloudflare Workers 執行上下文
 * @returns {Response} 更新結果響應
 */
export async function handleUpdateSecret(request, env, ctx) {
	const logger = getLogger(env);

	try {
		const url = new URL(request.url);
		const secretId = url.pathname.split('/').pop();

		// 🔍 使用驗證中介軟體解析和驗證請求
		const secretData = await validateRequest(addSecretSchema)(request);
		if (secretData instanceof Response) {
			return secretData;
		} // 驗證失敗

		// 獲取現有金鑰
		const existingSecrets = await getAllSecrets(env);

		// 查詢要更新的金鑰
		const secretIndex = existingSecrets.findIndex((s) => s.id === secretId);
		if (secretIndex === -1) {
			throw ErrorFactory.secretNotFound(secretId, {
				operation: 'updateSecret',
			});
		}

		// 檢查是否與其他金鑰重複（排除自己，服務名+賬戶+金鑰都相同才視為重複）
		const isDuplicate = checkDuplicateSecret(existingSecrets, secretData.name, secretData.account, secretData.secret, secretIndex);

		if (isDuplicate) {
			throw new ConflictError(`服务"${secretData.name}"${secretData.account ? ` (账户: ${secretData.account})` : ''} 已被其他密钥使用`, {
				operation: 'updateSecret',
				name: secretData.name,
				account: secretData.account,
			});
		}

		const existingSecret = existingSecrets[secretIndex];
		const existingWasHOTP = String(existingSecret.type || '').toUpperCase() === 'HOTP';
		const sameHOTPGeneration =
			existingWasHOTP &&
			secretData.type === 'HOTP' &&
			(await generateHOTPGenerationHash(existingSecret)) === (await generateHOTPGenerationHash(secretData));
		const existingCounter = Number.isSafeInteger(existingSecret.counter) && existingSecret.counter >= 0 ? existingSecret.counter : 0;
		if (sameHOTPGeneration && secretData.counter < existingCounter) {
			throw new ConflictError('HOTP计数器已推进，不能通过编辑操作降低计数器', {
				operation: 'updateSecret',
				secretId,
				requestedCounter: secretData.counter,
				currentCounter: existingCounter,
			});
		}
		const updatedCounter = secretData.type === 'HOTP' ? secretData.counter : undefined;

		// 檢測內容是否實際發生變化（資料已經通過驗證和規範化）
		const contentChanged =
			existingSecret.name !== secretData.name ||
			existingSecret.account !== secretData.account ||
			existingSecret.secret !== secretData.secret ||
			existingSecret.type !== secretData.type ||
			existingSecret.digits !== secretData.digits ||
			existingSecret.period !== secretData.period ||
			existingSecret.algorithm !== secretData.algorithm ||
			(secretData.type === 'HOTP' && existingSecret.counter !== updatedCounter);

		// 更新金鑰物件
		const updatedSecret = {
			id: secretId, // 保留原 ID
			name: secretData.name,
			account: secretData.account,
			secret: secretData.secret,
			type: secretData.type,
			digits: secretData.digits,
			period: secretData.period,
			algorithm: secretData.algorithm,
			counter: updatedCounter,
			...(secretData.type === 'HOTP' && {
				hotpCounterNamespace: sameHOTPGeneration ? existingSecret.hotpCounterNamespace : crypto.randomUUID(),
			}),
		};

		existingSecrets[secretIndex] = updatedSecret;

		// A fresh namespace becomes active only with this base write. Keep the old
		// sidecar so a failed/interrupted write or an old request cannot lose state.
		await saveSecretsToKV(env, existingSecrets, 'secret-updated', {}, ctx);

		logger.info('密钥更新成功', {
			operation: 'handleUpdateSecret',
			secretId: updatedSecret.id,
			name: updatedSecret.name,
			contentChanged,
		});

		return createSuccessResponse({ secret: updatedSecret }, '密钥更新成功', request);
	} catch (error) {
		// 如果是已知的錯誤型別，記錄並轉換
		if (
			error instanceof NotFoundError ||
			error instanceof ConflictError ||
			error instanceof ValidationError ||
			error instanceof StorageError ||
			error instanceof CryptoError ||
			error instanceof ConfigurationError
		) {
			logError(error, logger, { operation: 'handleUpdateSecret' });
			getMonitoring(env).getErrorMonitor().captureError(error, { operation: 'handleUpdateSecret' }, ErrorSeverity.WARNING);
			return errorToResponse(error, request);
		}

		// 未知錯誤
		logger.error('更新密钥失败', { operation: 'handleUpdateSecret', errorMessage: error.message }, error);
		getMonitoring(env).getErrorMonitor().captureError(error, { operation: 'handleUpdateSecret' }, ErrorSeverity.ERROR);
		return createErrorResponse('更新密钥失败', `更新密钥时发生内部错误`, 500, request);
	}
}

/**
 * 刪除金鑰 (帶 Rate Limiting)
 *
 * @param {Request} request - HTTP 請求物件
 * @param {Object} env - Cloudflare Workers 環境物件
 * @param {Object} [ctx] - Cloudflare Workers 執行上下文
 * @returns {Response} 刪除結果響應
 */
export async function handleDeleteSecret(request, env, ctx) {
	const logger = getLogger(env);

	try {
		// Rate Limiting: 敏感操作限流
		const clientIP = getClientIdentifier(request, 'ip');
		const rateLimitInfo = await checkRateLimit(clientIP, env, RATE_LIMIT_PRESETS.sensitive);

		if (!rateLimitInfo.allowed) {
			logger.warn('删除密钥被限流', { clientIP, operation: 'handleDeleteSecret' });
			return createRateLimitResponse(rateLimitInfo);
		}

		const url = new URL(request.url);
		const secretId = url.pathname.split('/').pop();

		// 獲取現有金鑰
		const existingSecrets = await getAllSecrets(env);

		// 查詢要刪除的金鑰
		const secretIndex = existingSecrets.findIndex((s) => s.id === secretId);
		if (secretIndex === -1) {
			// Without the deleted object we cannot identify its namespace safely.
			// Unreferenced sidecars remain inactive, as with generation changes.
			throw ErrorFactory.secretNotFound(secretId, {
				operation: 'deleteSecret',
			});
		}

		const deletedSecret = existingSecrets[secretIndex];
		existingSecrets.splice(secretIndex, 1);

		// 儲存到 KV (自動加密、排序、觸發備份)
		await saveSecretsToKV(env, existingSecrets, 'secret-deleted', {}, ctx);
		await deleteHOTPCounterState(env, deletedSecret);

		logger.info('密钥删除成功', {
			operation: 'handleDeleteSecret',
			secretId: deletedSecret.id,
			name: deletedSecret.name,
		});

		return createSuccessResponse({ id: secretId }, '密钥删除成功');
	} catch (error) {
		// 如果是已知的錯誤型別，記錄並轉換
		if (
			error instanceof NotFoundError ||
			error instanceof ValidationError ||
			error instanceof StorageError ||
			error instanceof CryptoError ||
			error instanceof ConfigurationError
		) {
			logError(error, logger, { operation: 'handleDeleteSecret' });
			getMonitoring(env).getErrorMonitor().captureError(error, { operation: 'handleDeleteSecret' }, ErrorSeverity.WARNING);
			return errorToResponse(error);
		}

		// 未知錯誤
		logger.error('删除密钥失败', { operation: 'handleDeleteSecret', errorMessage: error.message }, error);
		getMonitoring(env).getErrorMonitor().captureError(error, { operation: 'handleDeleteSecret' }, ErrorSeverity.ERROR);
		return createErrorResponse('删除密钥失败', `删除密钥操作时发生内部错误`, 500);
	}
}
