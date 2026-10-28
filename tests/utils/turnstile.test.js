import { describe, it, expect, vi, afterEach } from 'vitest';
import {
	signHmacSha256,
	timingSafeEqualHex,
	createTurnstileClearanceCookie,
	verifyTurnstileClearanceCookie,
	verifyTurnstileToken,
	verifyTurnstileAccess,
	TURNSTILE_CLEARANCE_COOKIE,
} from '../../src/utils/turnstile.js';

describe('Turnstile Security & Verification Service', () => {
	const mockSecret = '0x4AAAAAAEvqf_c5mhEOQxVqIasfqUddfKU';

	describe('signHmacSha256 & timingSafeEqualHex', () => {
		it('應該能正確計算並驗證 HMAC-SHA256 簽名', async () => {
			const message = 'cleared:1700000000';
			const sig1 = await signHmacSha256(mockSecret, message);
			const sig2 = await signHmacSha256(mockSecret, message);
			expect(sig1).toBe(sig2);
			expect(sig1.length).toBe(64);
			expect(timingSafeEqualHex(sig1, sig2)).toBe(true);
			expect(timingSafeEqualHex(sig1, sig2.replace(/.$/, '0'))).toBe(false);
		});

		it('字串長度不同時 timingSafeEqualHex 應返回 false', () => {
			expect(timingSafeEqualHex('abc', 'abcd')).toBe(false);
			expect(timingSafeEqualHex(null, 'abc')).toBe(false);
		});
	});

	describe('createTurnstileClearanceCookie & verifyTurnstileClearanceCookie', () => {
		it('應該簽發格式正確且可驗證的通關 Cookie', async () => {
			const cookieHeader = await createTurnstileClearanceCookie({
				secretKey: mockSecret,
				maxAgeSeconds: 3600,
			});

			expect(cookieHeader).toContain(`${TURNSTILE_CLEARANCE_COOKIE}=`);
			expect(cookieHeader).toContain('Path=/');
			expect(cookieHeader).toContain('Max-Age=3600');
			expect(cookieHeader).toContain('SameSite=Lax');
			expect(cookieHeader).toContain('Secure');
			expect(cookieHeader).not.toContain('HttpOnly'); // 允許前端 JavaScript 讀取實現零打擾

			// 提取 cookie 值並模擬 Request
			const cookieVal = cookieHeader.split(';')[0].split('=')[1];
			const req = new Request('https://2fa.david888.com/api/login', {
				headers: {
					Cookie: `${TURNSTILE_CLEARANCE_COOKIE}=${cookieVal}`,
				},
			});

			const isValid = await verifyTurnstileClearanceCookie({
				request: req,
				secretKey: mockSecret,
			});
			expect(isValid).toBe(true);
		});

		it('簽名遭竄改時應拒絕', async () => {
			const req = new Request('https://2fa.david888.com/api/login', {
				headers: {
					Cookie: `${TURNSTILE_CLEARANCE_COOKIE}=1700000000.badbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadb`,
				},
			});

			const isValid = await verifyTurnstileClearanceCookie({
				request: req,
				secretKey: mockSecret,
			});
			expect(isValid).toBe(false);
		});

		it('已過期之通關 Cookie 應拒絕', async () => {
			const oldTimestamp = Math.floor(Date.now() / 1000) - 10000;
			const sig = await signHmacSha256(mockSecret, `cleared:${oldTimestamp}`);
			const req = new Request('https://2fa.david888.com/api/login', {
				headers: {
					Cookie: `${TURNSTILE_CLEARANCE_COOKIE}=${oldTimestamp}.${sig}`,
				},
			});

			const isValid = await verifyTurnstileClearanceCookie({
				request: req,
				secretKey: mockSecret,
				maxAgeSeconds: 7200,
			});
			expect(isValid).toBe(false);
		});
	});

	describe('verifyTurnstileToken (Siteverify)', () => {
		const originalFetch = globalThis.fetch;

		afterEach(() => {
			globalThis.fetch = originalFetch;
		});

		it('Cloudflare 驗證成功時應返回 success: true', async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				status: 200,
				json: async () => ({ success: true }),
			});

			const res = await verifyTurnstileToken({
				token: 'valid_token_123',
				secret: mockSecret,
			});
			expect(res.success).toBe(true);
		});

		it('Cloudflare 驗證失敗時應返回 success: false 與錯誤碼', async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				status: 200,
				json: async () => ({ success: false, 'error-codes': ['invalid-input-response'] }),
			});

			const res = await verifyTurnstileToken({
				token: 'invalid_token_123',
				secret: mockSecret,
			});
			expect(res.success).toBe(false);
			expect(res.errorCodes).toContain('invalid-input-response');
		});

		it('Fail-Open 降階：當 Cloudflare 網路中斷或拋出異常時應自動放行', async () => {
			globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network connection timeout'));

			const res = await verifyTurnstileToken({
				token: 'dummy_token',
				secret: mockSecret,
				failOpen: true,
			});
			expect(res.success).toBe(true);
			expect(res.bypassed).toBe(true);
			expect(res.reason).toBe('upstream_error_fail_open');
		});

		it('Fail-Open 降階：當 Cloudflare 返回 502/503 上游服務異常時應自動放行', async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: false,
				status: 502,
			});

			const res = await verifyTurnstileToken({
				token: 'dummy_token',
				secret: mockSecret,
				failOpen: true,
			});
			expect(res.success).toBe(true);
			expect(res.bypassed).toBe(true);
			expect(res.reason).toBe('upstream_5xx_fail_open');
		});
	});

	describe('verifyTurnstileAccess (整合守衛)', () => {
		const originalFetch = globalThis.fetch;

		afterEach(() => {
			globalThis.fetch = originalFetch;
		});

		it('若未設定 TURNSTILE_SECRET，應無感放行', async () => {
			const req = new Request('https://2fa.david888.com/api/login');
			const access = await verifyTurnstileAccess({
				request: req,
				env: {},
			});
			expect(access.ok).toBe(true);
			expect(access.bypassed).toBe(true);
		});

		it('快速通道：若帶有有效通關 Cookie，無需呼叫 Siteverify 直接放行', async () => {
			const cookieHeader = await createTurnstileClearanceCookie({ secretKey: mockSecret });
			const cookieVal = cookieHeader.split(';')[0].split('=')[1];
			const req = new Request('https://2fa.david888.com/api/login', {
				headers: {
					Cookie: `${TURNSTILE_CLEARANCE_COOKIE}=${cookieVal}`,
				},
			});

			const fetchSpy = vi.fn();
			globalThis.fetch = fetchSpy;

			const access = await verifyTurnstileAccess({
				request: req,
				env: { TURNSTILE_SECRET: mockSecret },
			});

			expect(access.ok).toBe(true);
			expect(access.cleared).toBe(true);
			expect(fetchSpy).not.toHaveBeenCalled();
		});

		it('無通關 Cookie 且無 Token 時，應拒絕存取並提示驗證要求', async () => {
			const req = new Request('https://2fa.david888.com/api/login');
			const access = await verifyTurnstileAccess({
				request: req,
				env: { TURNSTILE_SECRET: mockSecret },
			});

			expect(access.ok).toBe(false);
			expect(access.error).toContain('Turnstile verification required');
		});

		it('傳入合法 Token 時驗證通過，並標記 shouldSetClearance: true', async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				status: 200,
				json: async () => ({ success: true }),
			});

			const req = new Request('https://2fa.david888.com/api/login', {
				headers: {
					'cf-turnstile-response': 'valid_token_xyz',
				},
			});

			const access = await verifyTurnstileAccess({
				request: req,
				env: { TURNSTILE_SECRET: mockSecret },
			});

			expect(access.ok).toBe(true);
			expect(access.shouldSetClearance).toBe(true);
		});
	});
});
