/**
 * 路由處理器模組
 * 負責解析請求並分發到對應的處理函式
 */

// API 處理器
import {
	handleGetSecrets,
	handleAddSecret,
	handleUpdateSecret,
	handleDeleteSecret,
	handleAdvanceHOTPCounter,
	handleCompactHOTPCounters,
	handleGenerateOTP,
	handleBatchAddSecrets,
	handleBackupSecrets,
	handleGetBackups,
	handleRestoreBackup,
	handleExportBackup,
	handleExportSecrets,
} from '../api/secrets/index.js';
import { handleFaviconProxy } from '../api/favicon.js';
import {
	handleGetWebDAVConfigs,
	handleSaveWebDAVConfig,
	handleTestWebDAV,
	handleDeleteWebDAVConfig,
	handleToggleWebDAV,
} from '../api/webdav.js';
import { handleGetS3Configs, handleSaveS3Config, handleTestS3, handleDeleteS3Config, handleToggleS3 } from '../api/s3.js';
import {
	handleDeleteOneDriveConfig,
	handleGetOneDriveConfigs,
	handleOneDriveOAuthCallback,
	handleSaveOneDriveConfig,
	handleStartOneDriveOAuth,
	handleToggleOneDrive,
} from '../api/onedrive.js';
import {
	handleDeleteGoogleDriveConfig,
	handleGetGoogleDriveConfigs,
	handleGoogleDriveOAuthCallback,
	handleSaveGoogleDriveConfig,
	handleStartGoogleDriveOAuth,
	handleToggleGoogleDrive,
} from '../api/gdrive.js';
import { handleChangePassword } from '../api/password.js';
import { handleGetSettings, handleSaveSettings } from '../api/settings.js';
import { handleGetTime } from '../api/time.js';
import {
	handleWebAuthnRegisterOptions,
	handleWebAuthnRegister,
	handleWebAuthnLoginOptions,
	handleWebAuthnLogin,
	handleWebAuthnListCredentials,
	handleWebAuthnDeleteCredential,
} from '../api/webauthn.js';

// UI 頁面生成器
import { createMainPage } from '../ui/page.js';
import { createSetupPage } from '../ui/setupPage.js';
import { createManifest } from '../ui/manifest.js';
import { createBrandAssetResponse } from '../ui/assets/brandAssets.js';
import { createFontAssetResponse, createMapleMonoCjkStylesheet } from '../ui/assets/fontAssets.js';
import { createServiceWorker } from '../ui/serviceworker.js';
import { getModuleCode } from '../ui/scripts/index.js';

// 工具函式
import { createErrorResponse } from '../utils/response.js';
import {
	verifyAuthWithDetails,
	requiresAuth,
	createUnauthorizedResponse,
	handleLogin,
	handleLogout,
	handleRefreshToken,
	checkIfSetupRequired,
	handleFirstTimeSetup,
} from '../utils/auth.js';
import { createPreflightResponse } from '../utils/security.js';
import { getLogger } from '../utils/logger.js';

/**
 * 處理HTTP請求的主要函式
 * @param {Request} request - HTTP請求物件
 * @param {Object} env - 環境變數物件，包含KV儲存
 * @param {Object} [ctx] - Cloudflare Workers 執行上下文
 * @returns {Response} HTTP響應
 */
export async function handleRequest(request, env, ctx) {
	const url = new URL(request.url);
	const method = request.method;
	const pathname = url.pathname;
	const logger = getLogger(env);

	try {
		// 時間校準介面必須在設定和認證檢查前處理，確保無需訪問 KV。
		if (pathname === '/api/time') {
			if (method === 'GET') {
				return handleGetTime(request);
			}
			const response = createErrorResponse('方法不允许', `不支持的HTTP方法: ${method}`, 405, request);
			response.headers.set('Allow', 'GET');
			return response;
		}

		// 🔧 首次設定路由（不需要認證）
		if (pathname === '/setup') {
			// 檢查是否需要首次設定
			const setupRequired = await checkIfSetupRequired(env);
			if (!setupRequired) {
				// 已完成設定，重定向到首頁
				return Response.redirect(new URL('/', request.url).toString(), 302);
			}
			return await createSetupPage();
		}

		// 🔧 首次設定 API（不需要認證）
		if (pathname === '/api/setup' && method === 'POST') {
			return await handleFirstTimeSetup(request, env);
		}

		// 檢查是否需要首次設定
		const setupRequired = await checkIfSetupRequired(env);
		if (setupRequired && pathname === '/') {
			// 需要首次設定，重定向到設定頁面
			return Response.redirect(new URL('/setup', request.url).toString(), 302);
		}

		// 🔐 檢查是否需要身份驗證（使用詳細驗證以支援自動續期）
		let authDetails = null;
		if (requiresAuth(pathname)) {
			authDetails = await verifyAuthWithDetails(request, env);

			if (!authDetails || !authDetails.valid) {
				// 檢查是否未配置 KV 儲存
				if (!env.SECRETS_KV) {
					return createErrorResponse('服务未配置', '服务器未配置 KV 存储。请联系管理员配置 SECRETS_KV。', 503, request);
				}

				// 檢查是否未設定密碼
				const storedPasswordHash = await env.SECRETS_KV.get('user_password');
				if (!storedPasswordHash) {
					return createErrorResponse('未设置密码', '请访问 /setup 进行首次设置。', 503, request);
				}

				return createUnauthorizedResponse(null, request);
			}

			// 📊 記錄認證詳情（用於自動續期）
			request.authDetails = authDetails;
		}

		// 靜態路由處理
		if (pathname === '/' || pathname === '') {
			return await createMainPage();
		}

		// PWA Manifest
		if (pathname === '/manifest.json') {
			return createManifest(request);
		}

		// Service Worker
		if (pathname === '/sw.js') {
			return createServiceWorker(env);
		}

		// Favicon & PWA Icons & Open Graph Assets
		if (pathname === '/fonts/maple-mono-regular.woff2') {
			return createFontAssetResponse('regular');
		}
		if (pathname === '/fonts/maple-mono-bold.woff2') {
			return createFontAssetResponse('bold');
		}
		if (pathname === '/fonts/maple-mono-cjk.css') {
			return createMapleMonoCjkStylesheet();
		}
		if (pathname.startsWith('/fonts/cjk/')) {
			return createFontAssetResponse(pathname.slice('/fonts/'.length));
		}
		if (pathname === '/favicon.svg') {
			return createBrandAssetResponse('svg');
		}
		if (pathname === '/favicon-32x32.png') {
			return createBrandAssetResponse('favicon-32');
		}
		if (pathname === '/favicon-16x16.png') {
			return createBrandAssetResponse('favicon-16');
		}
		if (pathname === '/favicon.ico') {
			return createBrandAssetResponse('favicon-ico');
		}
		if (pathname === '/apple-touch-icon.png' || pathname === '/apple-touch-icon-precomposed.png') {
			return createBrandAssetResponse('apple-touch-icon');
		}
		if (pathname === '/icon-192.png') {
			return createBrandAssetResponse('icon-192');
		}
		if (pathname === '/icon-512.png') {
			return createBrandAssetResponse('icon-512');
		}
		if (pathname === '/og-image.jpg' || pathname === '/og-image.png') {
			return createBrandAssetResponse('og-image');
		}

		// 懶載入模組路由（需要認證）
		if (pathname.startsWith('/modules/')) {
			const moduleName = pathname.substring(9).replace('.js', ''); // 去掉 '/modules/' 和 '.js'
			const allowedModules = ['import', 'export', 'backup', 'qrcode', 'tools', 'googleMigration'];

			if (!allowedModules.includes(moduleName)) {
				return createErrorResponse('模块未找到', `不存在的模块: ${moduleName}`, 404, request);
			}

			try {
				const moduleCode = getModuleCode(moduleName);
				// 生產啟用長快取（wrangler.toml 頂層 [vars] 預設 ENVIRONMENT=production）。
				// 本地 hostname 兜底：即便使用者跳過 `--env development` 直接跑 `wrangler dev`，
				// localhost 場景也不應拿到長快取，防止改程式碼時模組仍命中舊版本
				const isLocalHost = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '0.0.0.0';
				const isProd = !isLocalHost && env?.ENVIRONMENT === 'production';
				return new Response(moduleCode, {
					headers: {
						'Content-Type': 'application/javascript; charset=utf-8',
						'Cache-Control': isProd ? 'public, max-age=3600' : 'no-cache, no-store, must-revalidate',
						'Access-Control-Allow-Origin': '*',
					},
				});
			} catch (error) {
				logger.error(`加载模块 ${moduleName} 失败`, { errorMessage: error.message }, error);
				return createErrorResponse('模块加载失败', error.message, 500, request);
			}
		}

		// 登入路由
		if (pathname === '/api/login' && method === 'POST') {
			return await handleLogin(request, env);
		}

		// 退出登入路由
		if (pathname === '/api/logout' && method === 'POST') {
			return await handleLogout(request, env);
		}

		// Token 重新整理路由
		if (pathname === '/api/refresh-token' && method === 'POST') {
			return await handleRefreshToken(request, env);
		}

		// API路由處理
		if (pathname.startsWith('/api/')) {
			const response = await handleApiRequest(pathname, method, request, env, ctx);

			// 🔄 自動續期：如果 Token 剩餘時間 < 7天，在響應頭中新增標記
			if (request.authDetails && request.authDetails.needsRefresh) {
				const newResponse = new Response(response.body, response);
				newResponse.headers.set('X-Token-Refresh-Needed', 'true');
				newResponse.headers.set('X-Token-Remaining-Days', request.authDetails.remainingDays.toFixed(2));

				logger.info('Token 即将过期，建议客户端刷新', {
					remainingDays: request.authDetails.remainingDays.toFixed(2),
				});

				return newResponse;
			}

			return response;
		}

		// OTP生成路由（支援高階引數）
		// 處理 /otp（顯示使用說明）
		if (pathname === '/otp') {
			return await handleGenerateOTP('', request);
		}

		// 處理 /otp/{secret}（生成OTP）
		if (pathname.startsWith('/otp/')) {
			// 解碼以正確處理 URL 編碼的字元（如 Base32 padding '=' → '%3D'）
			let secret;
			try {
				secret = decodeURIComponent(pathname.substring(5));
			} catch {
				secret = pathname.substring(5); // 解碼失敗則用原值，由後續 validateBase32 報錯
			}
			return await handleGenerateOTP(secret, request);
		}

		// 404處理
		return createErrorResponse('页面未找到', '请求的页面不存在', 404, request);
	} catch (error) {
		logger.error(
			'请求处理失败',
			{
				method,
				pathname,
				errorMessage: error.message,
			},
			error,
		);
		return createErrorResponse('服务器错误', '请求处理失败，请稍后重试', 500, request);
	}
}

/**
 * 處理API請求
 * @param {string} pathname - 請求路徑
 * @param {string} method - HTTP方法
 * @param {Request} request - HTTP請求物件
 * @param {Object} env - 環境變數物件
 * @param {Object} [ctx] - Cloudflare Workers 執行上下文
 * @returns {Response} HTTP響應
 */
async function handleApiRequest(pathname, method, request, env, ctx) {
	// 金鑰管理API
	if (pathname === '/api/secrets') {
		switch (method) {
			case 'GET':
				return handleGetSecrets(env);
			case 'POST':
				return handleAddSecret(request, env, ctx);
			default:
				return createErrorResponse('方法不允许', `不支持的HTTP方法: ${method}`, 405, request);
		}
	}

	// 批次匯入API（必須在 /api/secrets/{id} 之前匹配）
	if (pathname === '/api/secrets/batch') {
		if (method === 'POST') {
			return handleBatchAddSecrets(request, env, ctx);
		}
		return createErrorResponse('方法不允许', `不支持的HTTP方法: ${method}`, 405, request);
	}

	// 單個金鑰操作API
	if (pathname === '/api/secrets/export') {
		if (method === 'POST') {
			return handleExportSecrets(request, env);
		}
		return createErrorResponse('方法不允许', `不支持的HTTP方法: ${method}`, 405, request);
	}

	// 回滾舊版本前顯式壓實HOTP sidecar（受統一API認證保護）
	if (pathname === '/api/secrets/counters/compact') {
		if (method === 'POST') {
			return handleCompactHOTPCounters(request, env, ctx);
		}
		return createErrorResponse('方法不允许', `不支持的HTTP方法: ${method}`, 405, request);
	}

	// HOTP 計數器遞增API（必須在 /api/secrets/{id} 之前匹配）
	if (/^\/api\/secrets\/[^/]+\/counter$/.test(pathname)) {
		if (method === 'POST') {
			return handleAdvanceHOTPCounter(request, env, ctx);
		}
		return createErrorResponse('方法不允许', `不支持的HTTP方法: ${method}`, 405, request);
	}

	if (pathname.startsWith('/api/secrets/')) {
		const secretId = pathname.substring('/api/secrets/'.length);
		if (!secretId) {
			return createErrorResponse('无效路径', '缺少密钥ID', 400, request);
		}

		switch (method) {
			case 'PUT':
				return handleUpdateSecret(request, env, ctx);
			case 'DELETE':
				return handleDeleteSecret(request, env, ctx);
			default:
				return createErrorResponse('方法不允许', `不支持的HTTP方法: ${method}`, 405, request);
		}
	}

	// 備份管理API
	if (pathname === '/api/backup') {
		switch (method) {
			case 'POST':
				return handleBackupSecrets(request, env, ctx);
			case 'GET':
				return handleGetBackups(request, env, ctx);
			default:
				return createErrorResponse('方法不允许', `不支持的HTTP方法: ${method}`, 405, request);
		}
	}

	// 恢復備份API
	if (pathname === '/api/backup/restore') {
		if (method === 'POST') {
			return handleRestoreBackup(request, env, ctx);
		}
		return createErrorResponse('方法不允许', `不支持的HTTP方法: ${method}`, 405, request);
	}

	// 匯出備份API
	if (pathname.startsWith('/api/backup/export/')) {
		if (method === 'GET') {
			const backupKey = pathname.replace('/api/backup/export/', '');
			return handleExportBackup(request, env, backupKey);
		}
		return createErrorResponse('方法不允许', `不支持的HTTP方法: ${method}`, 405, request);
	}

	// 修改密碼 API
	if (pathname === '/api/change-password') {
		if (method === 'POST') {
			return handleChangePassword(request, env);
		}
		return createErrorResponse('方法不允许', `不支持的HTTP方法: ${method}`, 405, request);
	}

	// 系統設定 API
	if (pathname === '/api/settings') {
		switch (method) {
			case 'GET':
				return handleGetSettings(request, env);
			case 'POST':
				return handleSaveSettings(request, env);
			default:
				return createErrorResponse('方法不允许', `不支持的HTTP方法: ${method}`, 405, request);
		}
	}

	// WebDAV 配置 API
	if (pathname === '/api/webdav/config') {
		switch (method) {
			case 'GET':
				return handleGetWebDAVConfigs(request, env);
			case 'POST':
				return handleSaveWebDAVConfig(request, env);
			case 'DELETE':
				return handleDeleteWebDAVConfig(request, env);
			default:
				return createErrorResponse('方法不允许', `不支持的HTTP方法: ${method}`, 405, request);
		}
	}
	if (pathname === '/api/webdav/test') {
		if (method === 'POST') {
			return handleTestWebDAV(request, env);
		}
		return createErrorResponse('方法不允许', `不支持的HTTP方法: ${method}`, 405, request);
	}
	if (pathname === '/api/webdav/toggle') {
		if (method === 'POST') {
			return handleToggleWebDAV(request, env);
		}
		return createErrorResponse('方法不允许', `不支持的HTTP方法: ${method}`, 405, request);
	}

	// S3 配置 API
	if (pathname === '/api/s3/config') {
		switch (method) {
			case 'GET':
				return handleGetS3Configs(request, env);
			case 'POST':
				return handleSaveS3Config(request, env);
			case 'DELETE':
				return handleDeleteS3Config(request, env);
			default:
				return createErrorResponse('方法不允许', `不支持的HTTP方法: ${method}`, 405, request);
		}
	}
	if (pathname === '/api/s3/test') {
		if (method === 'POST') {
			return handleTestS3(request, env);
		}
		return createErrorResponse('方法不允许', `不支持的HTTP方法: ${method}`, 405, request);
	}
	if (pathname === '/api/s3/toggle') {
		if (method === 'POST') {
			return handleToggleS3(request, env);
		}
		return createErrorResponse('方法不允许', `不支持的HTTP方法: ${method}`, 405, request);
	}

	// OneDrive 配置 API
	if (pathname === '/api/onedrive/config') {
		switch (method) {
			case 'GET':
				return handleGetOneDriveConfigs(request, env);
			case 'POST':
				return handleSaveOneDriveConfig(request, env);
			case 'DELETE':
				return handleDeleteOneDriveConfig(request, env);
			default:
				return createErrorResponse('方法不允许', `不支持的HTTP方法: ${method}`, 405, request);
		}
	}
	if (pathname === '/api/onedrive/toggle') {
		if (method === 'POST') {
			return handleToggleOneDrive(request, env);
		}
		return createErrorResponse('方法不允许', `不支持的HTTP方法: ${method}`, 405, request);
	}
	if (pathname === '/api/onedrive/oauth/start') {
		if (method === 'POST') {
			return handleStartOneDriveOAuth(request, env);
		}
		return createErrorResponse('方法不允许', `不支持的HTTP方法: ${method}`, 405, request);
	}
	if (pathname === '/api/onedrive/oauth/callback') {
		if (method === 'GET') {
			return handleOneDriveOAuthCallback(request, env);
		}
		return createErrorResponse('方法不允许', `不支持的HTTP方法: ${method}`, 405, request);
	}

	// Google Drive 配置 API
	if (pathname === '/api/gdrive/config') {
		switch (method) {
			case 'GET':
				return handleGetGoogleDriveConfigs(request, env);
			case 'POST':
				return handleSaveGoogleDriveConfig(request, env);
			case 'DELETE':
				return handleDeleteGoogleDriveConfig(request, env);
			default:
				return createErrorResponse('方法不允许', `不支持的HTTP方法: ${method}`, 405, request);
		}
	}
	if (pathname === '/api/gdrive/toggle') {
		if (method === 'POST') {
			return handleToggleGoogleDrive(request, env);
		}
		return createErrorResponse('方法不允许', `不支持的HTTP方法: ${method}`, 405, request);
	}
	if (pathname === '/api/gdrive/oauth/start') {
		if (method === 'POST') {
			return handleStartGoogleDriveOAuth(request, env);
		}
		return createErrorResponse('方法不允许', `不支持的HTTP方法: ${method}`, 405, request);
	}
	if (pathname === '/api/gdrive/oauth/callback') {
		if (method === 'GET') {
			return handleGoogleDriveOAuthCallback(request, env);
		}
		return createErrorResponse('方法不允许', `不支持的HTTP方法: ${method}`, 405, request);
	}

	// WebAuthn / Passkey API
	if (pathname === '/api/webauthn/login-options') {
		if (method === 'GET') {
			return handleWebAuthnLoginOptions(request, env);
		}
		return createErrorResponse('方法不允许', `不支持的HTTP方法: ${method}`, 405, request);
	}
	if (pathname === '/api/webauthn/login') {
		if (method === 'POST') {
			return handleWebAuthnLogin(request, env);
		}
		return createErrorResponse('方法不允许', `不支持的HTTP方法: ${method}`, 405, request);
	}
	if (pathname === '/api/webauthn/register-options') {
		if (method === 'GET') {
			return handleWebAuthnRegisterOptions(request, env);
		}
		return createErrorResponse('方法不允许', `不支持的HTTP方法: ${method}`, 405, request);
	}
	if (pathname === '/api/webauthn/register') {
		if (method === 'POST') {
			return handleWebAuthnRegister(request, env);
		}
		return createErrorResponse('方法不允许', `不支持的HTTP方法: ${method}`, 405, request);
	}
	if (pathname === '/api/webauthn/credentials') {
		if (method === 'GET') {
			return handleWebAuthnListCredentials(request, env);
		}
		return createErrorResponse('方法不允许', `不支持的HTTP方法: ${method}`, 405, request);
	}
	if (pathname.startsWith('/api/webauthn/credentials/')) {
		const credId = pathname.substring('/api/webauthn/credentials/'.length);
		if (!credId) {
			return createErrorResponse('无效路径', '缺少凭据ID', 400, request);
		}
		if (method === 'DELETE') {
			return handleWebAuthnDeleteCredential(request, env, credId);
		}
		return createErrorResponse('方法不允许', `不支持的HTTP方法: ${method}`, 405, request);
	}

	// Favicon 代理 API（不需要認證，公開訪問）
	if (pathname.startsWith('/api/favicon/')) {
		if (method === 'GET') {
			const domain = pathname.replace('/api/favicon/', '');
			return handleFaviconProxy(request, env, domain);
		}
		return createErrorResponse('方法不允许', `不支持的HTTP方法: ${method}`, 405, request);
	}

	// 未知API路徑
	return createErrorResponse('API未找到', '请求的API端点不存在', 404, request);
}

/**
 * 處理CORS預檢請求
 * @param {Request} request - HTTP請求物件
 * @returns {Response|null} CORS響應或 null
 */
export function handleCORS(request) {
	return createPreflightResponse(request);
}
