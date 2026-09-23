/**
 * 結構化日誌系統
 * 提供統一的日誌記錄、錯誤追蹤和效能監控
 *
 * 日誌級別: DEBUG < INFO < WARN < ERROR < FATAL
 * 支援上下文資訊、使用者標識、效能指標
 */

import { APP_VERSION } from './version.js';

/**
 * 日誌級別列舉
 */
export const LogLevel = {
	DEBUG: 0,
	INFO: 1,
	WARN: 2,
	ERROR: 3,
	FATAL: 4,
};

/**
 * 日誌級別名稱對映
 */
const LogLevelNames = {
	[LogLevel.DEBUG]: 'DEBUG',
	[LogLevel.INFO]: 'INFO',
	[LogLevel.WARN]: 'WARN',
	[LogLevel.ERROR]: 'ERROR',
	[LogLevel.FATAL]: 'FATAL',
};

/**
 * 校驗是否為合法的 LogLevel 列舉值（整數 0-4）
 * @private
 */
function isValidLogLevel(level) {
	return Number.isInteger(level) && level >= LogLevel.DEBUG && level <= LogLevel.FATAL;
}

/**
 * 日誌級別圖示
 */
const LogLevelIcons = {
	[LogLevel.DEBUG]: '🔍',
	[LogLevel.INFO]: 'ℹ️',
	[LogLevel.WARN]: '⚠️',
	[LogLevel.ERROR]: '❌',
	[LogLevel.FATAL]: '💀',
};

/**
 * Logger 類 - 結構化日誌記錄器
 */
class Logger {
	constructor(options = {}) {
		// 校驗為合法的 LogLevel 列舉值：保留 DEBUG（值為 0，|| 會把它吞成 INFO），
		// 同時拒絕 NaN / 小數 / 越界值（如 5 會連 FATAL 一起遮蔽，-1 會放開全部日誌）
		this.minLevel = isValidLogLevel(options.minLevel) ? options.minLevel : LogLevel.INFO;
		this.environment = options.environment || 'development';
		this.serviceName = options.serviceName || '2fa';
		this.version = options.version || APP_VERSION;
		this.enableConsole = options.enableConsole !== false;
		this.enableRemote = options.enableRemote || false;
		this.remoteEndpoint = options.remoteEndpoint || null;
		this.context = options.context || {};
	}

	/**
	 * 格式化日誌訊息
	 * @private
	 */
	_formatMessage(level, message, data = {}, error = null) {
		const timestamp = new Date().toISOString();
		const levelName = LogLevelNames[level];
		const icon = LogLevelIcons[level];

		const logEntry = {
			timestamp,
			level: levelName,
			service: this.serviceName,
			version: this.version,
			environment: this.environment,
			message,
			...this.context,
			...data,
		};

		// 新增錯誤資訊
		if (error) {
			logEntry.error = {
				name: error.name,
				message: error.message,
				stack: error.stack,
				cause: error.cause,
			};
		}

		// 新增請求資訊（如果存在）
		if (data.request) {
			const req = data.request;
			logEntry.request = {
				method: req.method,
				url: req.url,
				headers: this._sanitizeHeaders(req.headers),
				cf: req.cf, // Cloudflare 特有資訊
			};
			delete logEntry.request; // 從頂層移除
		}

		return { logEntry, icon, levelName };
	}

	/**
	 * 清理敏感頭資訊
	 * @private
	 */
	_sanitizeHeaders(headers) {
		const sanitized = {};
		const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];

		if (headers && headers.forEach) {
			headers.forEach((value, key) => {
				const lowerKey = key.toLowerCase();
				if (sensitiveHeaders.includes(lowerKey)) {
					sanitized[key] = '***REDACTED***';
				} else {
					sanitized[key] = value;
				}
			});
		}

		return sanitized;
	}

	/**
	 * 輸出日誌到控制台
	 * @private
	 */
	_logToConsole(level, icon, levelName, message, logEntry) {
		if (!this.enableConsole) {
			return;
		}

		const consoleMessage = `${icon} [${levelName}] ${message}`;

		switch (level) {
			case LogLevel.DEBUG:
				console.debug(consoleMessage, logEntry);
				break;
			case LogLevel.INFO:
				console.log(consoleMessage, logEntry);
				break;
			case LogLevel.WARN:
				console.warn(consoleMessage, logEntry);
				break;
			case LogLevel.ERROR:
			case LogLevel.FATAL:
				console.error(consoleMessage, logEntry);
				break;
			default:
				console.log(consoleMessage, logEntry);
		}
	}

	/**
	 * 傳送日誌到遠端服務（非同步，不阻塞）
	 * @private
	 */
	async _logToRemote(logEntry) {
		if (!this.enableRemote || !this.remoteEndpoint) {
			return;
		}

		try {
			// 非阻塞傳送，不等待響應
			fetch(this.remoteEndpoint, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(logEntry),
			}).catch((err) => {
				// 靜默失敗，避免日誌系統本身產生錯誤
				console.warn('Failed to send log to remote:', err.message);
			});
		} catch {
			// 靜默失敗
		}
	}

	/**
	 * 記錄日誌的通用方法
	 * @private
	 */
	_log(level, message, data = {}, error = null) {
		// 檢查日誌級別
		if (level < this.minLevel) {
			return;
		}

		const { logEntry, icon, levelName } = this._formatMessage(level, message, data, error);

		// 輸出到控制台
		this._logToConsole(level, icon, levelName, message, logEntry);

		// 傳送到遠端（非阻塞）
		this._logToRemote(logEntry);

		return logEntry;
	}

	/**
	 * DEBUG 級別日誌
	 */
	debug(message, data = {}) {
		return this._log(LogLevel.DEBUG, message, data);
	}

	/**
	 * INFO 級別日誌
	 */
	info(message, data = {}) {
		return this._log(LogLevel.INFO, message, data);
	}

	/**
	 * WARN 級別日誌
	 */
	warn(message, data = {}, error = null) {
		return this._log(LogLevel.WARN, message, data, error);
	}

	/**
	 * ERROR 級別日誌
	 */
	error(message, data = {}, error = null) {
		return this._log(LogLevel.ERROR, message, data, error);
	}

	/**
	 * FATAL 級別日誌（嚴重錯誤）
	 */
	fatal(message, data = {}, error = null) {
		return this._log(LogLevel.FATAL, message, data, error);
	}

	/**
	 * 建立子 Logger（帶上下文）
	 */
	child(context = {}) {
		return new Logger({
			minLevel: this.minLevel,
			environment: this.environment,
			serviceName: this.serviceName,
			version: this.version,
			enableConsole: this.enableConsole,
			enableRemote: this.enableRemote,
			remoteEndpoint: this.remoteEndpoint,
			context: { ...this.context, ...context },
		});
	}

	/**
	 * 設定最小日誌級別（非法值忽略，避免靜默遮蔽或放開全部日誌）
	 */
	setMinLevel(level) {
		if (isValidLogLevel(level)) {
			this.minLevel = level;
		}
	}

	/**
	 * 啟用/停用遠端日誌
	 */
	setRemoteLogging(enabled, endpoint = null) {
		this.enableRemote = enabled;
		if (endpoint) {
			this.remoteEndpoint = endpoint;
		}
	}
}

/**
 * 建立預設 Logger 例項
 */
let defaultLogger = null;
let defaultLoggerConfigured = false; // 單例是否已用執行時 env 完成配置

/**
 * 根據環境變數解析 Logger 配置
 * @private
 */
function resolveLoggerOptions(env) {
	// LOG_LEVEL 無效時回落到環境預設（生產 INFO / 開發 DEBUG）
	const levelFromEnv = env?.LOG_LEVEL ? LogLevel[env.LOG_LEVEL.toUpperCase()] : undefined;
	const minLevel = levelFromEnv ?? (env?.ENVIRONMENT === 'production' ? LogLevel.INFO : LogLevel.DEBUG);

	return {
		minLevel,
		environment: env?.ENVIRONMENT || 'development',
		serviceName: '2fa',
		version: APP_VERSION,
		enableConsole: true,
		enableRemote: env?.LOG_REMOTE_ENDPOINT ? true : false,
		remoteEndpoint: env?.LOG_REMOTE_ENDPOINT || null,
	};
}

/**
 * 獲取預設 Logger 例項
 *
 * 模組載入階段可能已有無 env 的呼叫先建立了單例（如各模組頂層程式碼），
 * 因此首次攜帶 env 的呼叫會就地更新單例配置——不替換例項，
 * 保證已持有該 logger 引用的物件（如 ErrorMonitor）同樣拿到正確的 LOG_LEVEL。
 */
export function getLogger(env = null) {
	if (!defaultLogger) {
		defaultLogger = new Logger(resolveLoggerOptions(env));
		defaultLoggerConfigured = Boolean(env);
	} else if (env && !defaultLoggerConfigured) {
		const options = resolveLoggerOptions(env);
		defaultLogger.minLevel = options.minLevel;
		defaultLogger.environment = options.environment;
		defaultLogger.enableRemote = options.enableRemote;
		defaultLogger.remoteEndpoint = options.remoteEndpoint;
		defaultLoggerConfigured = true;
	}
	return defaultLogger;
}

/**
 * 重置預設 Logger（主要用於測試）
 */
export function resetLogger() {
	defaultLogger = null;
	defaultLoggerConfigured = false;
}

/**
 * 快捷日誌方法
 */
export const log = {
	debug: (message, data) => getLogger().debug(message, data),
	info: (message, data) => getLogger().info(message, data),
	warn: (message, data, error) => getLogger().warn(message, data, error),
	error: (message, data, error) => getLogger().error(message, data, error),
	fatal: (message, data, error) => getLogger().fatal(message, data, error),
};

/**
 * 效能計時器
 */
export class PerformanceTimer {
	constructor(name, logger = null) {
		this.name = name;
		this.logger = logger || getLogger();
		this.startTime = Date.now();
		this.checkpoints = [];
	}

	/**
	 * 新增檢查點
	 */
	checkpoint(label) {
		const elapsed = Date.now() - this.startTime;
		this.checkpoints.push({ label, elapsed });
		this.logger.debug(`⏱️ [${this.name}] Checkpoint: ${label}`, { elapsed });
		return elapsed;
	}

	/**
	 * 結束計時並記錄
	 */
	end(data = {}) {
		const totalTime = Date.now() - this.startTime;

		this.logger.info(`⏱️ [${this.name}] Completed`, {
			duration: totalTime,
			checkpoints: this.checkpoints,
			...data,
		});

		return {
			name: this.name,
			duration: totalTime,
			checkpoints: this.checkpoints,
		};
	}

	/**
	 * 取消計時（不記錄）
	 */
	cancel() {
		this.logger.debug(`⏱️ [${this.name}] Cancelled`);
	}
}

/**
 * 請求日誌中介軟體
 * 自動記錄 HTTP 請求和響應
 */
PerformanceTimer.prototype.getDuration = function getDuration() {
	return Date.now() - this.startTime;
};

export function createRequestLogger(logger = null) {
	const log = logger || getLogger();

	return {
		/**
		 * 記錄請求開始
		 */
		logRequest(request, _env = {}) {
			const timer = new PerformanceTimer(`Request ${request.method} ${new URL(request.url).pathname}`, log);

			log.info('📥 Incoming request', {
				method: request.method,
				url: request.url,
				headers: this._sanitizeHeaders(request.headers),
				cf: request.cf,
				userAgent: request.headers.get('user-agent'),
			});

			return timer;
		},

		/**
		 * 記錄響應
		 */
		logResponse(timer, response, error = null) {
			const responseData = {
				status: response?.status,
				statusText: response?.statusText,
				headers: response?.headers ? Object.fromEntries(response.headers) : {},
			};

			if (error) {
				log.error('📤 Request failed', responseData, error);
			} else if (response?.status >= 500) {
				log.error('📤 Server error', responseData);
			} else if (response?.status >= 400) {
				log.warn('📤 Client error', responseData);
			} else {
				log.info('📤 Response sent', responseData);
			}

			if (timer) {
				timer.end(responseData);
			}
		},

		_sanitizeHeaders(headers) {
			const sanitized = {};
			const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];

			if (headers && headers.forEach) {
				headers.forEach((value, key) => {
					const lowerKey = key.toLowerCase();
					if (sensitiveHeaders.includes(lowerKey)) {
						sanitized[key] = '***REDACTED***';
					} else {
						sanitized[key] = value;
					}
				});
			}

			return sanitized;
		},
	};
}

/**
 * 匯出 Logger 類
 */
export { Logger };

/**
 * 使用示例：
 *
 * // 基礎使用
 * import { getLogger } from './utils/logger.js';
 * const logger = getLogger(env);
 * logger.info('User logged in', { userId: '123' });
 *
 * // 子 Logger（帶上下文）
 * const apiLogger = logger.child({ module: 'api' });
 * apiLogger.error('API failed', { endpoint: '/secrets' }, error);
 *
 * // 效能計時
 * const timer = new PerformanceTimer('Database Query', logger);
 * timer.checkpoint('Connected');
 * // ... 執行操作 ...
 * timer.checkpoint('Query executed');
 * timer.end({ rows: 10 });
 *
 * // 請求日誌
 * const requestLogger = createRequestLogger(logger);
 * const timer = requestLogger.logRequest(request, env);
 * // ... 處理請求 ...
 * requestLogger.logResponse(timer, response);
 */
