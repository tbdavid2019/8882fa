/**
 * S3 配置 API 端點
 * 提供多目標 S3 相容儲存配置的 CRUD 操作、啟用/停用切換和連線測試
 *
 * 所有寫操作介面使用 checkRateLimit + RATE_LIMIT_PRESETS.sensitive
 */

import { getS3Configs, saveS3SingleConfig, deleteS3SingleConfig, getS3Status, testS3Connection } from '../utils/s3.js';
import { getLogger } from '../utils/logger.js';
import { checkRateLimit, getClientIdentifier, createRateLimitResponse, RATE_LIMIT_PRESETS } from '../utils/rateLimit.js';
import { createJsonResponse, createErrorResponse } from '../utils/response.js';
import { validateRequest, s3ConfigSchema, toggleDestinationSchema } from '../utils/validation.js';

const MAX_ALLOWED = 5;

/**
 * 獲取所有 S3 配置
 * secretAccessKey 欄位返回空字串，附加 hasSecretKey 標記
 * 同時返回各目標的推送狀態
 */
export async function handleGetS3Configs(request, env) {
	const logger = getLogger(env);

	try {
		const configs = await getS3Configs(env);

		const destinations = await Promise.all(
			configs.map(async (c) => {
				const status = await getS3Status(env, c.id);
				return {
					id: c.id,
					name: c.name,
					enabled: c.enabled,
					config: {
						endpoint: c.endpoint,
						bucket: c.bucket,
						region: c.region || 'auto',
						accessKeyId: c.accessKeyId,
						secretAccessKey: '',
						hasSecretKey: !!(c.secretAccessKey && c.secretAccessKey.length > 0),
						prefix: c.prefix || '',
					},
					status: {
						lastSuccess: status.lastSuccess || null,
						lastError: status.lastError || null,
					},
					createdAt: c.createdAt,
				};
			}),
		);

		return createJsonResponse(
			{
				destinations,
				count: destinations.length,
				maxAllowed: MAX_ALLOWED,
			},
			200,
			request,
		);
	} catch (error) {
		logger.error('获取 S3 配置失败', { error: error.message }, error);
		return createErrorResponse('获取配置失败', error.message, 500, request);
	}
}

/**
 * 儲存 S3 配置（新增或更新）
 * body 含 id 時更新，不含 id 時新增
 * secretAccessKey 為空時保留已儲存的金鑰
 */
export async function handleSaveS3Config(request, env) {
	const logger = getLogger(env);

	try {
		const clientIP = getClientIdentifier(request, 'ip');
		const rateLimitInfo = await checkRateLimit(clientIP, env, RATE_LIMIT_PRESETS.sensitive);

		if (!rateLimitInfo.allowed) {
			return createRateLimitResponse(rateLimitInfo, request);
		}

		const body = await validateRequest(s3ConfigSchema)(request);
		if (body instanceof Response) {
			return body;
		}

		// secretAccessKey 為空時保留舊金鑰
		if (!body.secretAccessKey) {
			if (body.id) {
				const configs = await getS3Configs(env);
				const existing = configs.find((c) => c.id === body.id);
				if (existing && existing.secretAccessKey) {
					body.secretAccessKey = existing.secretAccessKey;
				} else {
					return createErrorResponse('请求验证失败', 'Secret Access Key 不能为空（无已保存的配置）', 400, request);
				}
			} else {
				return createErrorResponse('请求验证失败', '首次配置时 Secret Access Key 不能为空', 400, request);
			}
		}

		const result = await saveS3SingleConfig(env, body);

		if (!result.success) {
			return createErrorResponse('保存配置失败', result.error, 400, request);
		}

		logger.info('S3 配置已保存', {
			id: result.id,
			name: body.name,
			endpoint: body.endpoint,
			bucket: body.bucket,
			encrypted: result.encrypted,
		});

		const response = {
			success: true,
			message: 'S3 配置已保存',
			id: result.id,
			encrypted: result.encrypted,
		};

		if (result.warning) {
			response.warning = result.warning;
		}

		return createJsonResponse(response, 200, request);
	} catch (error) {
		logger.error('保存 S3 配置失败', { error: error.message }, error);
		return createErrorResponse('保存配置失败', error.message, 500, request);
	}
}

/**
 * 刪除 S3 配置
 * 通過 query param id 指定要刪除的目標
 */
export async function handleDeleteS3Config(request, env) {
	const logger = getLogger(env);

	try {
		const clientIP = getClientIdentifier(request, 'ip');
		const rateLimitInfo = await checkRateLimit(clientIP, env, RATE_LIMIT_PRESETS.sensitive);

		if (!rateLimitInfo.allowed) {
			return createRateLimitResponse(rateLimitInfo, request);
		}

		const url = new URL(request.url);
		const id = url.searchParams.get('id');

		if (!id) {
			return createErrorResponse('请求验证失败', '缺少目标 ID', 400, request);
		}

		const result = await deleteS3SingleConfig(env, id);

		if (!result.success) {
			return createErrorResponse('删除配置失败', result.error, 404, request);
		}

		logger.info('S3 配置已删除', { id });

		return createJsonResponse(
			{
				success: true,
				message: 'S3 配置已删除',
			},
			200,
			request,
		);
	} catch (error) {
		logger.error('删除 S3 配置失败', { error: error.message }, error);
		return createErrorResponse('删除配置失败', error.message, 500, request);
	}
}

/**
 * 測試 S3 連線
 * secretAccessKey 為空時從已儲存的配置中讀取（需提供 id）
 */
export async function handleTestS3(request, env) {
	const logger = getLogger(env);

	try {
		const clientIP = getClientIdentifier(request, 'ip');
		const rateLimitInfo = await checkRateLimit(clientIP, env, RATE_LIMIT_PRESETS.sensitive);

		if (!rateLimitInfo.allowed) {
			return createRateLimitResponse(rateLimitInfo, request);
		}

		const body = await validateRequest(s3ConfigSchema)(request);
		if (body instanceof Response) {
			return body;
		}

		// secretAccessKey 為空時從 KV 讀取已儲存的金鑰
		if (!body.secretAccessKey) {
			if (body.id) {
				const configs = await getS3Configs(env);
				const existing = configs.find((c) => c.id === body.id);
				if (existing && existing.secretAccessKey) {
					body.secretAccessKey = existing.secretAccessKey;
				} else {
					return createErrorResponse('请求验证失败', 'Secret Access Key 不能为空（无已保存的配置）', 400, request);
				}
			} else {
				return createErrorResponse('请求验证失败', 'Secret Access Key 不能为空', 400, request);
			}
		}

		logger.info('开始测试 S3 连接', { endpoint: body.endpoint, bucket: body.bucket });
		const result = await testS3Connection(body);

		if (result.success) {
			logger.info('S3 连接测试成功');
		} else {
			logger.warn('S3 连接测试失败', { message: result.message });
		}

		return createJsonResponse(result, result.success ? 200 : 400, request);
	} catch (error) {
		logger.error('测试 S3 连接失败', { error: error.message }, error);
		return createErrorResponse('测试连接失败', error.message, 500, request);
	}
}

/**
 * 啟用/停用 S3 目標
 */
export async function handleToggleS3(request, env) {
	const logger = getLogger(env);

	try {
		const clientIP = getClientIdentifier(request, 'ip');
		const rateLimitInfo = await checkRateLimit(clientIP, env, RATE_LIMIT_PRESETS.sensitive);

		if (!rateLimitInfo.allowed) {
			return createRateLimitResponse(rateLimitInfo, request);
		}

		const body = await validateRequest(toggleDestinationSchema)(request);
		if (body instanceof Response) {
			return body;
		}

		const result = await saveS3SingleConfig(env, { id: body.id, enabled: body.enabled });

		if (!result.success) {
			return createErrorResponse('操作失败', result.error, 404, request);
		}

		logger.info('S3 目标状态已更新', { id: body.id, enabled: body.enabled });

		return createJsonResponse(
			{
				success: true,
				message: body.enabled ? '已启用' : '已禁用',
			},
			200,
			request,
		);
	} catch (error) {
		logger.error('切换 S3 目标状态失败', { error: error.message }, error);
		return createErrorResponse('操作失败', error.message, 500, request);
	}
}
