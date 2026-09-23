/**
 * 錯誤監控和追蹤系統
 * 自定義錯誤追蹤、效能監控
 */

import { getLogger } from './logger.js';
import { APP_VERSION } from './version.js';

/**
 * 錯誤嚴重程度級別
 */
export const ErrorSeverity = {
	DEBUG: 'debug',
	INFO: 'info',
	WARNING: 'warning',
	ERROR: 'error',
	FATAL: 'fatal',
};

/**
 * 監控配置類
 */
class MonitoringConfig {
	constructor(options = {}) {
		// 效能監控配置
		this.enablePerformanceMonitoring = options.enablePerformanceMonitoring !== false;
		// 顯式校驗數值：既保留合法的 0（耗時 > 0ms 的請求均視為慢請求），又讓 NaN / 負數 / 非數字回退預設值
		this.slowRequestThreshold =
			Number.isFinite(options.slowRequestThreshold) && options.slowRequestThreshold >= 0 ? options.slowRequestThreshold : 3000; // 3秒

		// 自定義配置
		this.environment = options.environment || 'production';
		this.serviceName = options.serviceName || '2fa';
		this.version = options.version || APP_VERSION;
	}
}

/**
 * 錯誤監控類
 */
class ErrorMonitor {
	constructor(config, env = null) {
		this.config = config;
		this.logger = getLogger(env);
	}

	/**
	 * 捕獲錯誤
	 */
	captureError(error, context = {}, severity = ErrorSeverity.ERROR) {
		// 記錄到日誌
		this.logger.error(
			'Error captured',
			{
				errorName: error.name,
				errorMessage: error.message,
				severity,
				...context,
			},
			error,
		);

		return {
			errorId: this._generateErrorId(),
			error: {
				name: error.name,
				message: error.message,
				stack: error.stack,
			},
			context,
			severity,
			timestamp: new Date().toISOString(),
		};
	}

	/**
	 * 捕獲異常訊息（非 Error 物件）
	 */
	captureMessage(message, level = ErrorSeverity.INFO, context = {}) {
		this.logger.info('Message captured', {
			message,
			level,
			...context,
		});
	}

	/**
	 * 生成唯一的錯誤 ID
	 * @private
	 */
	_generateErrorId() {
		return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
	}

	/**
	 * 新增麵包屑（使用者操作軌跡）
	 */
	addBreadcrumb(message, category = 'default', data = {}) {
		this.logger.debug('Breadcrumb', {
			message,
			category,
			...data,
		});
	}
}

/**
 * 效能監控類
 */
class PerformanceMonitor {
	constructor(config, env = null) {
		this.config = config;
		this.logger = getLogger(env);
		this.metrics = new Map();
	}

	/**
	 * 開始效能追蹤
	 */
	startTrace(name, context = {}) {
		if (!this.config.enablePerformanceMonitoring) {
			return null;
		}

		const traceId = `${name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

		const trace = {
			id: traceId,
			name,
			startTime: Date.now(),
			context,
			spans: [],
		};

		this.metrics.set(traceId, trace);

		this.logger.debug('⏱️ Trace started', {
			traceId,
			name,
			...context,
		});

		return traceId;
	}

	/**
	 * 新增 Span（子追蹤）
	 */
	addSpan(traceId, spanName, duration = null) {
		const trace = this.metrics.get(traceId);
		if (!trace) {
			return;
		}

		const span = {
			name: spanName,
			timestamp: Date.now(),
			duration: duration || Date.now() - trace.startTime,
		};

		trace.spans.push(span);

		this.logger.debug('⏱️ Span added', {
			traceId,
			spanName,
			duration: span.duration,
		});
	}

	/**
	 * 結束效能追蹤
	 */
	endTrace(traceId, metadata = {}) {
		const trace = this.metrics.get(traceId);
		if (!trace) {
			return null;
		}

		const duration = Date.now() - trace.startTime;
		const result = {
			...trace,
			duration,
			endTime: Date.now(),
			metadata,
		};

		// 檢查是否為慢請求
		const isSlow = duration > this.config.slowRequestThreshold;

		if (isSlow) {
			this.logger.warn('🐌 Slow trace detected', {
				traceId,
				name: trace.name,
				duration,
				threshold: this.config.slowRequestThreshold,
				spans: trace.spans,
				...metadata,
			});
		} else {
			this.logger.info('⏱️ Trace completed', {
				traceId,
				name: trace.name,
				duration,
				spanCount: trace.spans.length,
				...metadata,
			});
		}

		// 清理
		this.metrics.delete(traceId);

		return result;
	}

	/**
	 * 記錄自定義指標
	 */
	recordMetric(name, value, unit = 'ms', tags = {}) {
		this.logger.info('📊 Metric recorded', {
			name,
			value,
			unit,
			...tags,
		});

		// 可以傳送到監控系統（如 Prometheus、DataDog）
		// 這裡只記錄到日誌
	}

	/**
	 * 獲取當前活躍的追蹤數量
	 */
	getActiveTracesCount() {
		return this.metrics.size;
	}
}

/**
 * 統一的監控管理器
 */
class MonitoringManager {
	constructor(config, env = null) {
		this.config = config;
		this.errorMonitor = new ErrorMonitor(config, env);
		this.performanceMonitor = new PerformanceMonitor(config, env);
		this.logger = getLogger(env);
	}

	/**
	 * 初始化監控系統
	 */
	async initialize() {
		this.logger.info('🚀 Initializing monitoring system', {
			performanceEnabled: this.config.enablePerformanceMonitoring,
			environment: this.config.environment,
		});
	}

	/**
	 * 獲取錯誤監控器
	 */
	getErrorMonitor() {
		return this.errorMonitor;
	}

	/**
	 * 獲取效能監控器
	 */
	getPerformanceMonitor() {
		return this.performanceMonitor;
	}

	/**
	 * 建立監控中介軟體（用於 Worker）
	 */
	createMiddleware() {
		return async (request, env, ctx, next) => {
			const traceId = this.performanceMonitor.startTrace(`${request.method} ${new URL(request.url).pathname}`, {
				method: request.method,
				url: request.url,
			});

			try {
				// 執行請求處理
				const response = await next(request, env, ctx);

				// 記錄效能
				this.performanceMonitor.endTrace(traceId, {
					status: response?.status,
					success: true,
				});

				return response;
			} catch (error) {
				// 捕獲錯誤
				const errorInfo = this.errorMonitor.captureError(
					error,
					{
						method: request.method,
						url: request.url,
						traceId,
					},
					ErrorSeverity.ERROR,
				);

				// 記錄失敗的追蹤
				this.performanceMonitor.endTrace(traceId, {
					success: false,
					errorId: errorInfo.errorId,
				});

				// 重新丟擲錯誤
				throw error;
			}
		};
	}
}

/**
 * 預設監控例項
 */
let defaultMonitoring = null;
let defaultMonitoringConfigured = false; // 單例是否已用執行時 env 完成配置

/**
 * 根據環境變數解析監控配置
 * @private
 */
function resolveMonitoringOptions(env) {
	return {
		enablePerformanceMonitoring: env?.ENABLE_PERFORMANCE_MONITORING !== 'false',
		slowRequestThreshold: parseInt(env?.SLOW_REQUEST_THRESHOLD ?? '3000'),
		environment: env?.ENVIRONMENT || 'production',
		serviceName: '2fa',
		version: env?.VERSION || APP_VERSION,
	};
}

/**
 * 獲取預設監控例項
 *
 * 與 getLogger 同理：單例可能先被無 env 的快捷方法呼叫建立，
 * 因此首次攜帶 env 的呼叫會就地更新 config，
 * 保證已持有該 config 引用的 ErrorMonitor / PerformanceMonitor 同樣生效。
 */
export function getMonitoring(env = null) {
	if (!defaultMonitoring) {
		defaultMonitoring = new MonitoringManager(new MonitoringConfig(resolveMonitoringOptions(env)), env);
		defaultMonitoringConfigured = Boolean(env);
	} else if (env && !defaultMonitoringConfigured) {
		Object.assign(defaultMonitoring.config, new MonitoringConfig(resolveMonitoringOptions(env)));
		// 內部監控器持有的 logger 也可能是無 env 建立的單例，一併觸發其配置更新
		getLogger(env);
		defaultMonitoringConfigured = true;
	}

	return defaultMonitoring;
}

/**
 * 重置預設監控例項（主要用於測試）
 */
export function resetMonitoring() {
	defaultMonitoring = null;
	defaultMonitoringConfigured = false;
}

/**
 * 快捷方法
 */
export const monitoring = {
	/**
	 * 捕獲錯誤
	 */
	captureError: (error, context, severity) => {
		return getMonitoring().getErrorMonitor().captureError(error, context, severity);
	},

	/**
	 * 捕獲訊息
	 */
	captureMessage: (message, level, context) => {
		return getMonitoring().getErrorMonitor().captureMessage(message, level, context);
	},

	/**
	 * 新增麵包屑
	 */
	addBreadcrumb: (message, category, data) => {
		return getMonitoring().getErrorMonitor().addBreadcrumb(message, category, data);
	},

	/**
	 * 開始效能追蹤
	 */
	startTrace: (name, context) => {
		return getMonitoring().getPerformanceMonitor().startTrace(name, context);
	},

	/**
	 * 結束效能追蹤
	 */
	endTrace: (traceId, metadata) => {
		return getMonitoring().getPerformanceMonitor().endTrace(traceId, metadata);
	},

	/**
	 * 記錄指標
	 */
	recordMetric: (name, value, unit, tags) => {
		return getMonitoring().getPerformanceMonitor().recordMetric(name, value, unit, tags);
	},
};

/**
 * 匯出類和配置
 */
export { MonitoringConfig, MonitoringManager, ErrorMonitor, PerformanceMonitor };

/**
 * 使用示例：
 *
 * // 初始化監控
 * const monitoring = getMonitoring(env);
 * await monitoring.initialize();
 *
 * // 捕獲錯誤
 * try {
 *   // ... 操作 ...
 * } catch (error) {
 *   monitoring.getErrorMonitor().captureError(error, {
 *     operation: 'addSecret',
 *     userId: '123'
 *   });
 * }
 *
 * // 效能追蹤
 * const traceId = monitoring.getPerformanceMonitor().startTrace('DatabaseQuery');
 * // ... 執行查詢 ...
 * monitoring.getPerformanceMonitor().endTrace(traceId, { rows: 10 });
 *
 * // 麵包屑
 * monitoring.getErrorMonitor().addBreadcrumb('User clicked button', 'user-action', {
 *   buttonId: 'add-secret'
 * });
 */
