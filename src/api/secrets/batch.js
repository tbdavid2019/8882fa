/**
 * 批次匯入處理器 - 批次新增金鑰
 *
 * 包含功能:
 * - handleBatchAddSecrets: 批次匯入金鑰（帶 Rate Limiting）
 */

import { saveSecretsToKV, getAllSecrets } from './shared.js';
import { getLogger } from '../../utils/logger.js';
import { validateRequest, batchImportSchema, addSecretSchema, checkDuplicateSecret } from '../../utils/validation.js';
import { createJsonResponse, createErrorResponse } from '../../utils/response.js';
import { checkRateLimit, getClientIdentifier, createRateLimitResponse, RATE_LIMIT_PRESETS } from '../../utils/rateLimit.js';
import { ValidationError, StorageError, CryptoError, ConfigurationError, errorToResponse, logError } from '../../utils/errors.js';
import { LIMITS } from '../../utils/constants.js';

/**
 * 批次新增金鑰 (帶 Rate Limiting)
 *
 * 處理流程:
 * 1. Rate limiting 檢查（防止批次操作濫用）
 * 2. 驗證輸入資料格式
 * 3. 逐個驗證和建立金鑰物件
 * 4. 檢查重複
 * 5. 一次性儲存所有成功的金鑰
 * 6. 返回詳細的成功/失敗統計
 *
 * @param {Request} request - HTTP 請求物件
 * @param {Object} env - Cloudflare Workers 環境物件
 * @param {Object} [ctx] - Cloudflare Workers 執行上下文
 * @returns {Response} 批次匯入結果響應
 */
export async function handleBatchAddSecrets(request, env, ctx) {
	const logger = getLogger(env);

	try {
		// 🛡️ Rate Limiting: 防止批次操作濫用
		const clientIP = getClientIdentifier(request, 'ip');
		const rateLimitInfo = await checkRateLimit(clientIP, env, RATE_LIMIT_PRESETS.bulk);

		if (!rateLimitInfo.allowed) {
			logger.warn('批量添加速率限制超出', {
				clientIP,
				limit: rateLimitInfo.limit,
				resetAt: rateLimitInfo.resetAt,
			});
			return createRateLimitResponse(rateLimitInfo);
		}

		// 🔍 使用驗證中介軟體解析和驗證請求（僅驗證頂層結構）
		const data = await validateRequest(batchImportSchema)(request);
		if (data instanceof Response) {
			return data;
		} // 驗證失敗

		const { secrets, immediateBackup, chunkIndex, chunkCount } = data;
		// 只有"滿片 + 非末片 + 存在後續片"才被承認為中間片，用來跳過即時備份。
		// 滿片尺寸來自 LIMITS.BULK_IMPORT_CHUNK_SIZE，前端分片和本校驗都以它為準，
		// 防止客戶端通過小尺寸 + 偽造 chunkCount 繞過事件驅動備份。
		const isIntermediateChunk =
			Number.isInteger(chunkIndex) &&
			Number.isInteger(chunkCount) &&
			chunkCount > 1 &&
			chunkIndex >= 1 &&
			chunkIndex < chunkCount &&
			secrets.length === LIMITS.BULK_IMPORT_CHUNK_SIZE;

		// 獲取包含HOTP sidecar有效計數器的現有金鑰列表
		const existingSecrets = await getAllSecrets(env);

		const results = [];
		let successCount = 0;
		let failCount = 0;

		// 批次處理所有金鑰（逐個驗證）
		for (let i = 0; i < secrets.length; i++) {
			const secretData = secrets[i];

			try {
				// 驗證單個金鑰資料
				const validation = addSecretSchema.validate(secretData);
				if (!validation.valid) {
					results.push({
						index: i,
						success: false,
						error: validation.errors.join('; '),
					});
					failCount++;
					continue;
				}

				const validated = validation.data;

				// 檢查是否已存在完全相同的金鑰（服務名+賬戶+金鑰都相同）
				if (checkDuplicateSecret(existingSecrets, validated.name, validated.account, validated.secret)) {
					results.push({
						index: i,
						success: false,
						error: `服务"${validated.name}"${validated.account ? `的账户"${validated.account}"` : ''}密钥已存在`,
					});
					failCount++;
					continue;
				}

				// 建立新金鑰物件（資料已經通過驗證和規範化）
				const newSecret = {
					id: crypto.randomUUID(),
					name: validated.name,
					account: validated.account,
					secret: validated.secret,
					type: validated.type,
					digits: validated.digits,
					period: validated.period,
					algorithm: validated.algorithm,
					counter: validated.type === 'HOTP' ? validated.counter : undefined,
				};

				// 新增到現有列表
				existingSecrets.push(newSecret);
				results.push({
					index: i,
					success: true,
					secret: newSecret,
				});
				successCount++;
			} catch (error) {
				results.push({
					index: i,
					success: false,
					error: error.message,
				});
				failCount++;
			}
		}

		// 一次性儲存所有金鑰到KV儲存（自動排序）
		// 🔄 事件驅動備份策略：
		//   - 中間片 (isIntermediateChunk)：skipBackup 生效，event 備份被跳過，靠末片或 cron 兜底
		//   - 非中間片：始終同步備份（immediate: true），保持歷史契約——批次匯入返回前備份已落盤
		//     immediateBackup 客戶端標誌目前僅用於驅動前端分片的最後一片判定，服務端不單獨使用
		await saveSecretsToKV(env, existingSecrets, 'batch-import', { immediate: !isIntermediateChunk, skipBackup: isIntermediateChunk }, ctx);

		logger.info('✅ 批量导入完成', {
			successCount,
			failCount,
			totalCount: secrets.length,
			immediateBackup: immediateBackup === true,
			chunkIndex: Number.isInteger(chunkIndex) ? chunkIndex : null,
			chunkCount: Number.isInteger(chunkCount) ? chunkCount : null,
			isIntermediateChunk,
		});

		return createJsonResponse(
			{
				success: true,
				message: `批量导入完成: 成功 ${successCount} 个, 失败 ${failCount} 个`,
				successCount,
				failCount,
				totalCount: secrets.length,
				results,
			},
			200,
			request,
		);
	} catch (error) {
		// 如果是已知的錯誤型別，記錄並轉換
		if (
			error instanceof ValidationError ||
			error instanceof StorageError ||
			error instanceof CryptoError ||
			error instanceof ConfigurationError
		) {
			logError(error, logger, { operation: 'handleBatchAddSecrets' });
			return errorToResponse(error, request);
		}

		// 未知錯誤
		logger.error(
			'批量导入失败',
			{
				errorMessage: error.message,
			},
			error,
		);
		return createErrorResponse('批量导入失败', `批量导入密钥时发生内部错误：${error.message}`, 500, request);
	}
}
