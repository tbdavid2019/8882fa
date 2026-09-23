/**
 * 2FA OTP Generator - Cloudflare Worker
 * 重構後的主入口檔案
 *
 * 功能模組：
 * - router/handler.js - 路由處理
 * - api/secrets/ - 金鑰管理API（模組化：shared/crud/batch/backup/restore/otp）
 * - otp/generator.js - OTP生成
 * - ui/page.js - 頁面渲染
 * - utils/ - 工具函式
 *
 * 🔒 安全特性：所有2FA金鑰使用 AES-GCM 256位加密儲存
 * 📊 監控特性：結構化日誌、錯誤追蹤、效能監控
 */

import { handleRequest, handleCORS } from './router/handler.js';
import { getAllSecrets } from './api/secrets/shared.js';
import { getLogger, createRequestLogger, PerformanceTimer } from './utils/logger.js';
import { getMonitoring, ErrorSeverity } from './utils/monitoring.js';
import { pushToAllWebDAV } from './utils/webdav.js';
import { pushToAllS3 } from './utils/s3.js';
import { pushToAllOneDrive } from './utils/onedrive.js';
import { pushToAllGoogleDrive } from './utils/gdrive.js';
import { deleteBackupRecord, listAllBackupKeys, putBackupRecord } from './utils/backup-index.js';
import { resolveConfiguredBackupFormat, sanitizeMaxBackups } from './utils/backup.js';
import { createBackupEntry, isValidBackupKey, parseBackupTimeFromKey } from './utils/backup-format.js';
import { generateDataHash, getPendingDataHash, isPendingDataHashFresh, saveDataHash } from './utils/data-hash.js';

export { generateDataHash, saveDataHash } from './utils/data-hash.js';

/**
 * 檢查資料是否發生變化
 * @param {Object} env - 環境變數物件
 * @param {Array} currentSecrets - 當前金鑰資料
 * @returns {Promise<boolean>} 資料是否發生變化
 */
async function _hasDataChanged(env, currentSecrets) {
	const logger = getLogger(env);

	try {
		// 計算當前資料的雜湊值（使用 SHA-256）
		const currentHash = await generateDataHash(currentSecrets, env);

		// 獲取上次備份時的資料雜湊值
		const lastHash = await env.SECRETS_KV.get('last_backup_hash');

		logger.info('数据变化检测开始', {
			currentHashPreview: currentHash.substring(0, 16) + '...',
			lastHashPreview: lastHash ? lastHash.substring(0, 16) + '...' : 'null',
			currentSecretCount: currentSecrets.length,
		});

		// 如果沒有上次的雜湊值，說明是第一次備份，應該執行備份
		if (!lastHash) {
			logger.info('首次备份检测', {
				reason: '没有找到上次备份的哈希值',
			});
			return true;
		}

		// 比較雜湊值
		const hasChanged = currentHash !== lastHash;

		logger.info('哈希值比较完成', {
			hasChanged,
			currentHash: currentHash.substring(0, 16) + '...',
			lastHash: lastHash.substring(0, 16) + '...',
		});

		// 如果資料沒有變化，但金鑰數量不同，也認為有變化
		if (!hasChanged && currentSecrets.length > 0) {
			// 獲取最新備份的金鑰數量進行比較
			try {
				const list = await env.SECRETS_KV.list();
				const backupKeys = list.keys.filter((key) => isValidBackupKey(key.name));
				if (backupKeys.length > 0) {
					backupKeys.sort((a, b) => b.name.localeCompare(a.name));
					const latestBackup = backupKeys[0];
					const latestBackupCount = Number.parseInt(latestBackup.metadata?.count, 10);

					if (Number.isInteger(latestBackupCount) && latestBackupCount !== currentSecrets.length) {
						logger.info('密钥数量发生变化', {
							currentCount: currentSecrets.length,
							lastBackupCount: latestBackupCount,
							difference: currentSecrets.length - latestBackupCount,
						});
						return true;
					} else if (Number.isInteger(latestBackupCount)) {
						logger.debug('密钥数量未变化', {
							currentCount: currentSecrets.length,
							lastBackupCount: latestBackupCount,
						});
					}
				}
			} catch (error) {
				logger.warn('检查密钥数量变化失败', {}, error);
			}
		}

		const finalResult = hasChanged;
		logger.info('数据变化检测完成', {
			result: finalResult ? '需要备份' : '跳过备份',
			hasChanged,
			secretCount: currentSecrets.length,
		});

		return finalResult;
	} catch (error) {
		logger.error('检查数据变化失败', {}, error);
		// 如果檢查失敗，預設認為資料已變化，執行備份
		return true;
	}
}

/**
 * 清理舊備份檔案（根據使用者設定保留備份數量，預設100個）
 * @param {Object} env - 環境變數物件
 */
async function cleanupOldBackups(env) {
	const logger = getLogger(env);

	// 讀取使用者配置的 maxBackups
	let maxBackups = 100;
	try {
		const raw = await env.SECRETS_KV.get('settings');
		if (raw) {
			const settings = JSON.parse(raw);
			if (settings.maxBackups !== undefined) {
				maxBackups = sanitizeMaxBackups(settings.maxBackups);
			}
		}
	} catch {
		// 讀取失敗使用預設值
	}

	// 0 表示不限制
	if (maxBackups === 0) {
		logger.debug('备份数量不限制（maxBackups=0），跳过清理');
		return;
	}

	try {
		const backupKeys = (await listAllBackupKeys(env)).sort((a, b) => b.name.localeCompare(a.name));

		logger.info('检查备份文件', {
			totalBackups: backupKeys.length,
		});

		if (backupKeys.length <= maxBackups) {
			logger.debug('备份文件数量正常', {
				current: backupKeys.length,
				max: maxBackups,
			});
			return;
		}

		// 按檔名排序（檔名包含日期，最新的在前）
		backupKeys.sort((a, b) => b.name.localeCompare(a.name));

		// 保留最新的備份，刪除其餘的
		const keysToKeep = backupKeys.slice(0, maxBackups);
		const keysToDelete = backupKeys.slice(maxBackups);

		logger.info('开始清理旧备份', {
			toKeep: keysToKeep.length,
			toDelete: keysToDelete.length,
		});

		for (const key of keysToDelete) {
			const deleteResult = await deleteBackupRecord(env, key.name, key.metadata);
			if (!deleteResult?.success) {
				logger.warn('删除旧备份失败', {
					backupKey: key.name,
					deletedBackup: deleteResult?.deletedBackup === true,
					deletedIndex: deleteResult?.deletedIndex === true,
				});
				continue;
			}

			logger.debug('删除旧备份', {
				backupKey: key.name,
			});
		}

		logger.info('清理旧备份完成', {
			deleted: keysToDelete.length,
			remaining: keysToKeep.length,
		});
	} catch (error) {
		logger.error('清理旧备份失败', {}, error);
	}
}

async function hasCommittedBackupSince(env, updatedAt) {
	if (typeof updatedAt !== 'string' || !updatedAt) {
		return false;
	}

	const updatedAtMs = Date.parse(updatedAt);
	if (!Number.isFinite(updatedAtMs)) {
		return false;
	}

	try {
		const backupKeys = await listAllBackupKeys(env);
		if (backupKeys.length === 0) {
			return false;
		}

		const latestBackup = backupKeys[backupKeys.length - 1];
		const skippedInvalidCount = Number.parseInt(latestBackup.metadata?.skippedInvalidCount, 10) || 0;
		const latestBackupCreatedAt = latestBackup.metadata?.created || parseBackupTimeFromKey(latestBackup.name);
		const latestBackupCreatedAtMs = Date.parse(latestBackupCreatedAt);
		return Number.isFinite(latestBackupCreatedAtMs) && latestBackupCreatedAtMs >= updatedAtMs && skippedInvalidCount === 0;
	} catch (error) {
		getLogger(env).warn('检查待完成备份是否已落盘失败', { errorMessage: error.message }, error);
		return false;
	}
}

/**
 * Cloudflare Worker 主入口點
 * @param {Request} request - HTTP請求物件
 * @param {Object} env - 環境變數物件，包含KV儲存等
 * @param {Object} ctx - 執行上下文
 * @returns {Response} HTTP響應
 */
export default {
	async fetch(request, env, ctx) {
		// 初始化日誌和監控
		const logger = getLogger(env);
		const requestLogger = createRequestLogger(logger);
		const monitoring = getMonitoring(env);

		// 初始化監控系統（僅首次）
		if (!monitoring._initialized) {
			await monitoring.initialize().catch((err) => {
				logger.warn('Failed to initialize monitoring', {}, err);
			});
			monitoring._initialized = true;
		}

		// 開始請求追蹤
		const timer = requestLogger.logRequest(request, env);
		const traceId = monitoring.getPerformanceMonitor().startTrace(`${request.method} ${new URL(request.url).pathname}`, {
			method: request.method,
			url: request.url,
			userAgent: request.headers.get('user-agent'),
			cf: request.cf,
		});

		try {
			// 處理CORS預檢請求
			const corsResponse = handleCORS(request);
			if (corsResponse) {
				monitoring.getPerformanceMonitor().endTrace(traceId, {
					type: 'cors-preflight',
					status: corsResponse.status,
				});
				return corsResponse;
			}

			// 處理實際請求
			const response = await handleRequest(request, env, ctx);

			// 記錄響應
			requestLogger.logResponse(timer, response);
			monitoring.getPerformanceMonitor().endTrace(traceId, {
				status: response.status,
				success: response.status < 400,
			});

			return response;
		} catch (error) {
			// 捕獲並記錄錯誤
			logger.error(
				'Request handling failed',
				{
					method: request.method,
					url: request.url,
					traceId,
				},
				error,
			);

			// 傳送到錯誤監控
			const errorInfo = monitoring.getErrorMonitor().captureError(
				error,
				{
					method: request.method,
					url: request.url,
					traceId,
					userAgent: request.headers.get('user-agent'),
				},
				ErrorSeverity.ERROR,
			);

			// 記錄失敗的追蹤
			requestLogger.logResponse(timer, null, error);
			monitoring.getPerformanceMonitor().endTrace(traceId, {
				success: false,
				errorId: errorInfo.errorId,
			});

			// 返回錯誤響應
			return new Response(
				JSON.stringify({
					error: '服务器错误',
					message: '请求处理失败，请稍后重试',
					errorId: errorInfo.errorId,
					timestamp: new Date().toISOString(),
				}),
				{
					status: 500,
					headers: {
						'Content-Type': 'application/json',
						'X-Error-Id': errorInfo.errorId,
					},
				},
			);
		}
	},

	/**
	 * 定時任務處理函式
	 * 定時自動備份金鑰（僅在資料發生變化時執行）
	 * @param {Object} event - 定時事件物件
	 * @param {Object} env - 環境變數物件
	 * @param {Object} ctx - 執行上下文
	 */
	async scheduled(event, env, ctx) {
		const logger = getLogger(env);
		const timer = new PerformanceTimer('ScheduledBackup', logger);

		// 早於任何 KV 讀取捕獲時間戳：此時刻之前 stage 的 pending hash 必然對應"不晚於我們即將備份的資料"，
		// 傳給 saveDataHash 以便清理分片匯入等場景下殘留的 pending。
		const backupStartedAt = Date.now();

		try {
			logger.info('定时备份任务开始', {
				scheduledTime: new Date().toISOString(),
				cron: event.cron || 'manual',
			});

			// 獲取所有金鑰
			const secrets = await getAllSecrets(env);
			logger.info('获取密钥完成', {
				secretCount: secrets ? secrets.length : 0,
			});

			// 輸出前幾個金鑰的詳細資訊用於除錯
			if (secrets && secrets.length > 0) {
				const sampleSecrets = secrets.slice(0, 3).map((s) => ({
					id: s.id,
					name: s.name,
					account: s.account,
					type: s.type,
					hasUpdatedAt: !!s.updatedAt,
				}));
				logger.debug('密钥样本信息', { sampleSecrets });
			}

			if (!secrets || secrets.length === 0) {
				logger.info('没有密钥需要备份，任务结束');
				return;
			}

			// 強制檢查資料變化（增強除錯）
			logger.info('开始数据变化检测');
			timer.checkpoint('检测开始');

			const currentHash = await generateDataHash(secrets, env);
			const [lastHash, pendingHashEntry] = await Promise.all([env.SECRETS_KV.get('last_backup_hash'), getPendingDataHash(env)]);
			const hasFreshPendingHash = isPendingDataHashFresh(pendingHashEntry) && pendingHashEntry.hash === currentHash;
			const pendingHashHasCommittedBackup = hasFreshPendingHash ? await hasCommittedBackupSince(env, pendingHashEntry.updatedAt) : false;

			logger.info('详细数据变化检测', {
				currentHashPreview: currentHash.substring(0, 16) + '...',
				lastHashPreview: lastHash ? lastHash.substring(0, 16) + '...' : 'null',
				pendingHashPreview: pendingHashEntry?.hash ? pendingHashEntry.hash.substring(0, 16) + '...' : 'null',
				pendingHashHasCommittedBackup,
				secretCount: secrets.length,
			});

			const dataChangedState = !lastHash || currentHash !== lastHash;

			// 如果雜湊值不存在或不匹配，強制執行備份
			const dataChanged = !lastHash || currentHash !== lastHash;
			logger.info('数据变化检测结果', {
				changed: dataChangedState,
				reason: !lastHash ? '首次备份' : dataChanged ? '数据已变化' : '数据未变化',
			});

			if (!dataChanged || pendingHashHasCommittedBackup) {
				logger.info('数据未变化，跳过备份', {
					tip: pendingHashHasCommittedBackup
						? '检测到已有同一批数据的备份记录，跳过本次定时补偿'
						: '如果修改了密钥但未触发备份，请检查 saveDataHash 调用',
				});
				timer.end({ skipped: true });
				return;
			}

			if (hasFreshPendingHash) {
				logger.info('发现待完成备份哈希，但尚未确认已有备份落盘，继续执行定时备份兜底');
			}

			logger.info('检测到数据变化，开始创建备份');
			timer.checkpoint('开始备份');
			const backupFormat = await resolveConfiguredBackupFormat(env, logger);
			const backupEntry = await createBackupEntry(secrets, env, {
				format: backupFormat,
				reason: 'scheduled',
				strict: false,
			});
			const { backupKey, backupContent, encrypted: isEncrypted, format: storedFormat, count: storedCount, metadata } = backupEntry;

			if (isEncrypted) {
				logger.info('备份数据已加密', {
					backupKey,
					encrypted: true,
					format: storedFormat,
				});
			} else {
				logger.warn('备份数据以明文保存', {
					backupKey,
					reason: '未配置 ENCRYPTION_KEY',
					format: storedFormat,
				});
			}
			if (backupEntry.skippedInvalidCount > 0) {
				logger.warn('自动备份已跳过无效密钥', {
					backupKey,
					skippedInvalidCount: backupEntry.skippedInvalidCount,
				});
			}

			// 儲存備份到KV
			await putBackupRecord(env, backupKey, backupContent, metadata);
			timer.checkpoint('备份已保存');

			// WebDAV 自動推送（使用 waitUntil 確保 Worker 不會在推送完成前退出）
			ctx.waitUntil(pushToAllWebDAV(backupKey, backupContent, env));

			// S3 自動推送
			ctx.waitUntil(pushToAllS3(backupKey, backupContent, env));

			// OneDrive 自動推送
			ctx.waitUntil(pushToAllOneDrive(backupKey, backupContent, env));

			// Google Drive 自動推送
			ctx.waitUntil(pushToAllGoogleDrive(backupKey, backupContent, env));

			logger.info('自动备份完成', {
				backupKey,
				secretCount: storedCount,
				encrypted: isEncrypted,
				format: storedFormat,
			});

			// 儲存當前資料的雜湊值
			logger.debug('更新数据哈希值');
			await saveDataHash(env, secrets, {
				reason: 'scheduled',
				skippedInvalidCount: backupEntry.skippedInvalidCount,
				backupStartedAt,
			});
			timer.checkpoint('哈希已更新');

			// 清理舊備份（根據使用者設定保留數量）
			logger.debug('清理旧备份文件');
			await cleanupOldBackups(env);
			timer.checkpoint('清理完成');

			const duration = timer.end({
				success: true,
				backupKey,
				secretCount: storedCount,
			});

			logger.info('定时备份任务执行完成', {
				duration,
				backupKey,
			});
		} catch (error) {
			logger.error(
				'定时备份任务执行失败',
				{
					duration: timer.getDuration(),
				},
				error,
			);
			timer.end({ success: false, error: error.message });
		}
	},
};
