/**
 * PWA Manifest 生成模組
 * 提供 Web App Manifest 用於支援 PWA 安裝和 WebAPK
 */

import { BRAND_SVG, createBrandAssetResponse } from './assets/brandAssets.js';

/**
 * 生成 Web App Manifest
 * @param {Request} request - HTTP 請求物件（用於獲取主機名和語系偏好）
 * @returns {Response} Manifest JSON 響應
 */
export function createManifest(request) {
	const url = new URL(request.url);
	const baseUrl = `${url.protocol}//${url.host}`;

	const acceptLang = request.headers ? (request.headers.get('accept-language') || '').toLowerCase() : '';
	const isZh = acceptLang.includes('zh');

	const manifest = {
		name: isZh ? '888 2FA - 兩步驟驗證金鑰管理器' : '888 2FA - Two-Factor Authentication Manager',
		short_name: '888 2FA',
		description: isZh
			? '安全、零知識的兩步驟驗證 (2FA) 金鑰管理器，支援 TOTP 與 HOTP 驗證碼生成'
			: 'Secure, zero-knowledge two-factor authentication (2FA) manager supporting TOTP and HOTP code generation',
		start_url: '/',
		display: 'standalone',
		background_color: '#0F172A',
		theme_color: '#2563EB',
		orientation: 'portrait-primary',
		scope: '/',

		icons: [
			{
				src: `${baseUrl}/favicon.svg`,
				sizes: 'any',
				type: 'image/svg+xml',
				purpose: 'any',
			},
			{
				src: `${baseUrl}/icon-192.png`,
				sizes: '192x192',
				type: 'image/png',
				purpose: 'any',
			},
			{
				src: `${baseUrl}/icon-512.png`,
				sizes: '512x512',
				type: 'image/png',
				purpose: 'any',
			},
			{
				src: `${baseUrl}/icon-192.png`,
				sizes: '192x192',
				type: 'image/png',
				purpose: 'maskable',
			},
			{
				src: `${baseUrl}/icon-512.png`,
				sizes: '512x512',
				type: 'image/png',
				purpose: 'maskable',
			},
		],

		screenshots: [
			{
				src: `${baseUrl}/og-image.jpg`,
				sizes: '1200x630',
				type: 'image/jpeg',
				form_factor: 'wide',
				label: '888 2FA Two-Factor Authenticator',
			},
		],

		categories: ['productivity', 'utilities', 'security'],

		shortcuts: [
			{
				name: isZh ? '新增金鑰' : 'Add Key',
				short_name: isZh ? '新增' : 'Add',
				description: isZh ? '快速新增 2FA 金鑰' : 'Quickly add a 2FA key',
				url: '/?action=add',
			},
			{
				name: isZh ? '掃描 QR Code' : 'Scan QR Code',
				short_name: isZh ? '掃描' : 'Scan',
				description: isZh ? '掃描 QR Code 新增金鑰' : 'Scan QR Code to add key',
				url: '/?action=scan',
			},
		],

		related_applications: [],
		prefer_related_applications: false,

		display_override: ['standalone', 'minimal-ui'],

		protocol_handlers: [
			{
				protocol: 'web+otpauth',
				url: '/?otpauth=%s',
			},
		],
	};

	return new Response(JSON.stringify(manifest, null, 2), {
		status: 200,
		headers: {
			'Content-Type': 'application/manifest+json',
			'Cache-Control': 'public, max-age=3600',
			'Access-Control-Allow-Origin': '*',
		},
	});
}

/**
 * 生成預設圖示
 * @param {number} size - 圖示大小
 * @returns {Response} 圖示響應
 */
export function createDefaultIcon(size = 192) {
	if (size <= 32) {
		return createBrandAssetResponse('favicon-32');
	}
	if (size <= 192) {
		return createBrandAssetResponse('icon-192');
	}
	if (size > 192) {
		return createBrandAssetResponse('icon-512');
	}
	return new Response(BRAND_SVG, {
		status: 200,
		headers: {
			'Content-Type': 'image/svg+xml; charset=utf-8',
			'Cache-Control': 'public, max-age=86400',
			'Access-Control-Allow-Origin': '*',
		},
	});
}
