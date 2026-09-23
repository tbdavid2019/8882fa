/**
 * Auth.js 整合測試
 *
 * 測試完整的身份驗證流程，包括：
 * - 首次設定流程
 * - 登入流程
 * - Token重新整理流程
 * - 認證中介軟體
 * - Rate Limiting整合
 * - Cookie和Authorization Header處理
 *
 * 目標覆蓋率：70%+
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  verifyAuth,
  handleLogin,
  handleLogout,
  handleRefreshToken,
  checkIfSetupRequired,
  handleFirstTimeSetup,
  requiresAuth,
  createUnauthorizedResponse
} from '../../src/utils/auth.js';

// ==================== Mock KV Storage ====================

/**
 * 模擬 Cloudflare KV 儲存
 */
class MockKV {
  constructor() {
    this.store = new Map();
  }

  async get(key, type = 'text') {
    const value = this.store.get(key);
    if (!value) {
      return null;
    }

    if (type === 'json') {
      try {
        return JSON.parse(value);
      } catch {
        return null;
      }
    }
    return value;
  }

  async put(key, value, options = {}) {
    this.store.set(key, value);
  }

  async delete(key) {
    this.store.delete(key);
  }

  async list(options = {}) {
    const keys = Array.from(this.store.keys())
      .filter(key => {
        if (options.prefix) {
          return key.startsWith(options.prefix);
        }
        return true;
      })
      .map(name => ({ name }));

    return {
      keys,
      list_complete: true,
      cursor: null
    };
  }

  clear() {
    this.store.clear();
  }
}

// ==================== 測試輔助函式 ====================

/**
 * 建立 Mock Request
 */
function createMockRequest({
  method = 'GET',
  pathname = '/',
  headers = {},
  body = null,
  cookies = {}
} = {}) {
  const url = `https://example.com${pathname}`;
  const requestHeaders = new Headers({
    'Host': 'example.com',
    'Origin': 'https://example.com',
    ...headers
  });

  // Add cookies
  if (Object.keys(cookies).length > 0) {
    const cookieString = Object.entries(cookies)
      .map(([key, value]) => `${key}=${value}`)
      .join('; ');
    requestHeaders.set('Cookie', cookieString);
  }

  const init = {
    method,
    headers: requestHeaders
  };

  if (body && (method === 'POST' || method === 'PUT')) {
    init.body = JSON.stringify(body);
    requestHeaders.set('Content-Type', 'application/json');
  }

  return new Request(url, init);
}

/**
 * 建立 Mock Environment
 */
function createMockEnv(kvStore = null) {
  return {
    SECRETS_KV: kvStore || new MockKV(),
    LOG_LEVEL: 'ERROR' // 減少測試日誌噪音
  };
}

/**
 * 從 Response 中提取 JSON body
 */
async function getResponseJson(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// ==================== 測試套件 ====================

describe('Auth.js Integration Tests', () => {

  describe('首次设置流程集成', () => {
    let kvStore;
    let env;

    beforeEach(() => {
      kvStore = new MockKV();
      env = createMockEnv(kvStore);
    });

    it('应该检测到需要首次设置', async () => {
      const setupRequired = await checkIfSetupRequired(env);
      expect(setupRequired).toBe(true);
    });

    it('应该完成首次设置并返回JWT token', async () => {
      const password = 'SecurePassword123!';
      const request = createMockRequest({
        method: 'POST',
        pathname: '/api/setup',
        body: { password, confirmPassword: password }
      });

      const response = await handleFirstTimeSetup(request, env);
      expect(response.status).toBe(200);

      const data = await getResponseJson(response);
      expect(data.success).toBe(true);
      expect(data.message).toContain('设置成功');

      // 驗證密碼已儲存到KV
      const storedHash = await kvStore.get('user_password');
      expect(storedHash).toBeDefined();
      expect(storedHash).toContain('$'); // salt$hash格式

      // 驗證 Cookie 頭包含 token
      const setCookieHeader = response.headers.get('Set-Cookie');
      expect(setCookieHeader).toBeDefined();
      expect(setCookieHeader).toContain('auth_token=');

      // 驗證密碼正確 - 通過嘗試登入
      const loginRequest = createMockRequest({
        method: 'POST',
        pathname: '/api/login',
        body: { credential: password }
      });
      const loginResponse = await handleLogin(loginRequest, env);
      expect(loginResponse.status).toBe(200);

      // 驗證不再需要設定
      const setupRequired = await checkIfSetupRequired(env);
      expect(setupRequired).toBe(false);
    });

    it('应该拒绝弱密码', async () => {
      const weakPasswords = [
        'short',           // 太短
        'alllowercase1',   // 缺少大寫
        'ALLUPPERCASE1',   // 缺少小寫
        'NoNumbers!',      // 缺少數字
        'NoSpecial123'     // 缺少特殊字元
      ];

      for (const password of weakPasswords) {
        const request = createMockRequest({
          method: 'POST',
          pathname: '/api/setup',
          body: { password, confirmPassword: password }
        });

        const response = await handleFirstTimeSetup(request, env);
        expect(response.status).toBe(400);

        const data = await getResponseJson(response);
        expect(data).toBeDefined();
        expect(data.error).toBeDefined();
      }
    });

    it('应该在已设置后拒绝重复设置', async () => {
      // 第一次設定
      const password1 = 'FirstPassword123!';
      const request1 = createMockRequest({
        method: 'POST',
        pathname: '/api/setup',
        body: { password: password1, confirmPassword: password1 }
      });
      await handleFirstTimeSetup(request1, env);

      // 嘗試再次設定
      const password2 = 'SecondPassword456!';
      const request2 = createMockRequest({
        method: 'POST',
        pathname: '/api/setup',
        body: { password: password2, confirmPassword: password2 }
      });

      const response2 = await handleFirstTimeSetup(request2, env);
      expect(response2.status).toBeGreaterThanOrEqual(400);

      const data = await getResponseJson(response2);
      expect(data.error).toBeDefined();
    });
  });

  describe('登录流程集成', () => {
    let kvStore;
    let env;
    const testPassword = 'TestPassword123!';

    beforeEach(async () => {
      kvStore = new MockKV();
      env = createMockEnv(kvStore);

      // 預先通過首次設定來配置密碼
      const setupRequest = createMockRequest({
        method: 'POST',
        pathname: '/api/setup',
        body: { password: testPassword, confirmPassword: testPassword }
      });
      await handleFirstTimeSetup(setupRequest, env);
    });

    it('应该使用正确密码成功登录并返回HttpOnly cookie', async () => {
      const request = createMockRequest({
        method: 'POST',
        pathname: '/api/login',
        body: { credential: testPassword }
      });

      const response = await handleLogin(request, env);
      expect(response.status).toBe(200);

      const data = await getResponseJson(response);
      expect(data.success).toBe(true);

      // 驗證 Cookie
      const setCookieHeader = response.headers.get('Set-Cookie');
      expect(setCookieHeader).toBeDefined();
      expect(setCookieHeader).toContain('auth_token=');
      expect(setCookieHeader).toContain('HttpOnly');
      expect(setCookieHeader).toContain('Secure');
      expect(setCookieHeader).toContain('SameSite=Strict');

      // 驗證 token 有效 - 通過使用它訪問受保護資源
      const tokenMatch = setCookieHeader.match(/auth_token=([^;]+)/);
      const token = tokenMatch ? tokenMatch[1] : null;
      expect(token).toBeDefined();

      const authRequest = createMockRequest({
        pathname: '/api/secrets',
        cookies: { auth_token: token }
      });
      const isAuthorized = await verifyAuth(authRequest, env);
      expect(isAuthorized).toBe(true);
    });

    it('应该拒绝错误密码', async () => {
      const wrongPassword = 'WrongPassword123!';
      const request = createMockRequest({
        method: 'POST',
        pathname: '/api/login',
        body: { credential: wrongPassword }
      });

      const response = await handleLogin(request, env);
      expect(response.status).toBe(401);

      const data = await getResponseJson(response);
      expect(data.message).toContain('密码错误');
    });

    it('应该拒绝缺少密码的请求', async () => {
      const request = createMockRequest({
        method: 'POST',
        pathname: '/api/login',
        body: {}
      });

      const response = await handleLogin(request, env);
      expect(response.status).toBe(400);

      const data = await getResponseJson(response);
      expect(data.message).toContain('密码');
    });

    it('应该在多次失败后触发 rate limiting', async () => {
      // 清空 rate limit 計數器
      const clientIP = '127.0.0.1';

      // 嘗試6次錯誤登入（rate limit是5次/分鐘）
      for (let i = 0; i < 6; i++) {
        const request = createMockRequest({
          method: 'POST',
          pathname: '/api/login',
          body: { credential: 'WrongPassword123!' },
          headers: {
            'CF-Connecting-IP': clientIP
          }
        });

        const response = await handleLogin(request, env);

        if (i < 5) {
          // 前5次應該返回401（密碼錯誤）
          expect(response.status).toBe(401);
        } else {
          // 第6次應該被 rate limit 阻止
          expect(response.status).toBe(429);
          const data = await getResponseJson(response);
          expect(data.error).toContain('请求过于频繁');
        }
      }
    });
  });

  describe('认证中间件集成 (verifyAuth)', () => {
    let kvStore;
    let env;
    const testPassword = 'TestPassword123!';
    let validToken;

    beforeEach(async () => {
      kvStore = new MockKV();
      env = createMockEnv(kvStore);

      // 預先通過首次設定來配置密碼
      const setupRequest = createMockRequest({
        method: 'POST',
        pathname: '/api/setup',
        body: { password: testPassword, confirmPassword: testPassword }
      });
      await handleFirstTimeSetup(setupRequest, env);

      // 通過登入獲取有效 token
      const loginRequest = createMockRequest({
        method: 'POST',
        pathname: '/api/login',
        body: { credential: testPassword }
      });
      const loginResponse = await handleLogin(loginRequest, env);
      // 從 Cookie 頭提取 token
      const setCookieHeader = loginResponse.headers.get('Set-Cookie');
      const tokenMatch = setCookieHeader?.match(/auth_token=([^;]+)/);
      validToken = tokenMatch ? tokenMatch[1] : null;
    });

    it('应该接受有效的 Cookie token', async () => {
      const request = createMockRequest({
        pathname: '/api/secrets',
        cookies: { auth_token: validToken }
      });

      const isAuthorized = await verifyAuth(request, env);
      expect(isAuthorized).toBe(true);
    });

    it('应该接受有效的 Authorization header token', async () => {
      const request = createMockRequest({
        pathname: '/api/secrets',
        headers: {
          'Authorization': `Bearer ${validToken}`
        }
      });

      const isAuthorized = await verifyAuth(request, env);
      expect(isAuthorized).toBe(true);
    });

    it('应该拒绝过期或无效的 token', async () => {
      // 使用明顯無效的token格式
      const invalidToken = 'invalid.token.signature';

      const request = createMockRequest({
        pathname: '/api/secrets',
        cookies: { auth_token: invalidToken }
      });

      const isAuthorized = await verifyAuth(request, env);
      expect(isAuthorized).toBe(false);
    });

    it('应该拒绝缺少 token 的请求', async () => {
      const request = createMockRequest({
        pathname: '/api/secrets'
        // No cookies or Authorization header
      });

      const isAuthorized = await verifyAuth(request, env);
      expect(isAuthorized).toBe(false);
    });

    it('应该拒绝格式错误的 token', async () => {
      const malformedTokens = [
        'not-a-jwt',
        'header.payload', // 缺少簽名
        'a.b.c.d', // 太多部分
        '', // 空字串
      ];

      for (const token of malformedTokens) {
        const request = createMockRequest({
          pathname: '/api/secrets',
          cookies: { auth_token: token }
        });

        const isAuthorized = await verifyAuth(request, env);
        expect(isAuthorized).toBe(false);
      }
    });
  });

  describe('Token 刷新流程集成', () => {
    let kvStore;
    let env;
    const testPassword = 'TestPassword123!';
    let validToken;

    beforeEach(async () => {
      kvStore = new MockKV();
      env = createMockEnv(kvStore);

      // 預先通過首次設定來配置密碼
      const setupRequest = createMockRequest({
        method: 'POST',
        pathname: '/api/setup',
        body: { password: testPassword, confirmPassword: testPassword }
      });
      await handleFirstTimeSetup(setupRequest, env);

      // 通過登入獲取有效 token
      const loginRequest = createMockRequest({
        method: 'POST',
        pathname: '/api/login',
        body: { credential: testPassword }
      });
      const loginResponse = await handleLogin(loginRequest, env);
      // 從 Cookie 頭提取 token
      const setCookieHeader = loginResponse.headers.get('Set-Cookie');
      const tokenMatch = setCookieHeader?.match(/auth_token=([^;]+)/);
      validToken = tokenMatch ? tokenMatch[1] : null;
    });

    it('应该使用有效 token 刷新并获得新 token', async () => {
      const request = createMockRequest({
        method: 'POST',
        pathname: '/api/refresh-token',
        cookies: { auth_token: validToken }
      });

      const response = await handleRefreshToken(request, env);
      expect(response.status).toBe(200);

      const data = await getResponseJson(response);
      expect(data.success).toBe(true);
      expect(data.token).toBeDefined();
      expect(data.token).not.toBe(validToken); // 新token應該不同

      // 驗證新 token 有效 - 通過使用它訪問受保護資源
      const authRequest = createMockRequest({
        pathname: '/api/secrets',
        cookies: { auth_token: data.token }
      });
      const isAuthorized = await verifyAuth(authRequest, env);
      expect(isAuthorized).toBe(true);
    });

    it('应该拒绝无效 token 的刷新', async () => {
      // 使用無效token
      const invalidToken = 'invalid.token.here';

      const request = createMockRequest({
        method: 'POST',
        pathname: '/api/refresh-token',
        cookies: { auth_token: invalidToken }
      });

      const response = await handleRefreshToken(request, env);
      expect(response.status).toBe(401);

      const data = await getResponseJson(response);
      expect(data.message).toContain('JWT');
    });

    it('应该拒绝缺少 token 的刷新请求', async () => {
      const request = createMockRequest({
        method: 'POST',
        pathname: '/api/refresh-token'
        // No token
      });

      const response = await handleRefreshToken(request, env);
      expect(response.status).toBe(401);

      const data = await getResponseJson(response);
      expect(data.message).toContain('认证');
    });

    it('应该刷新后的 token 包含新的过期时间', async () => {
      const request = createMockRequest({
        method: 'POST',
        pathname: '/api/refresh-token',
        cookies: { auth_token: validToken }
      });

      const response = await handleRefreshToken(request, env);
      const data = await getResponseJson(response);
      const newToken = data.token;

      // 解析新 token 的過期時間
      const parts = newToken.split('.');
      const payload = JSON.parse(atob(parts[1]));

      // 驗證新的過期時間應該在未來
      const expiryTime = payload.exp * 1000; // 轉為毫秒
      const now = Date.now();
      expect(expiryTime).toBeGreaterThan(now);

      // 驗證過期時間約為30天后
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
      const timeDiff = expiryTime - now;
      expect(timeDiff).toBeGreaterThan(thirtyDaysMs * 0.9); // 至少27天
      expect(timeDiff).toBeLessThan(thirtyDaysMs * 1.1); // 最多33天
    });
  });

  describe('退出登录流程集成', () => {
    it('同源退出请求应该清除认证 Cookie', async () => {
      const request = createMockRequest({
        method: 'POST',
        pathname: '/api/logout',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'Sec-Fetch-Site': 'same-origin'
        }
      });
      const env = createMockEnv();

      const response = await handleLogout(request, env);
      const data = await getResponseJson(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(response.headers.get('Set-Cookie')).toContain('auth_token=');
      expect(response.headers.get('Set-Cookie')).toContain('Max-Age=0');
    });

    it('缺少同源 AJAX 标记的退出请求应该被拒绝', async () => {
      const request = createMockRequest({
        method: 'POST',
        pathname: '/api/logout'
      });
      const env = createMockEnv();

      const response = await handleLogout(request, env);

      expect(response.status).toBe(403);
      expect(response.headers.get('Set-Cookie')).toBeNull();
    });

    it('未配置 KV 时仍应允许退出登录（限流降级为放行）', async () => {
      const request = createMockRequest({
        method: 'POST',
        pathname: '/api/logout',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'Sec-Fetch-Site': 'same-origin'
        }
      });

      // env 未傳 / SECRETS_KV 未繫結時，限流應跳過而不是拋錯
      const response = await handleLogout(request, {});

      expect(response.status).toBe(200);
      expect(response.headers.get('Set-Cookie')).toContain('Max-Age=0');
    });
  });

  describe('路由认证集成 (requiresAuth)', () => {
    it('应该正确识别公开路由', () => {
      const publicRoutes = [
        '/',
        '/api/login',
        '/api/logout',
        '/api/refresh-token',
        '/api/setup',
        '/setup',
        '/manifest.json',
        '/sw.js',
        '/icon-192.png',
        '/icon-512.png',
        '/otp',
        '/otp/JBSWY3DPEHPK3PXP'
      ];

      for (const route of publicRoutes) {
        expect(requiresAuth(route)).toBe(false);
      }
    });

    it('应该正确识别受保护路由', () => {
      const protectedRoutes = [
        '/api/secrets',
        '/api/secrets/123',
        '/api/secrets/batch',
        '/api/backup',
        '/api/backup/restore',
        '/api/backup/export/backup-123',
        '/admin',
        '/settings'
      ];

      for (const route of protectedRoutes) {
        expect(requiresAuth(route)).toBe(true);
      }
    });
  });

  describe('未授权响应集成 (createUnauthorizedResponse)', () => {
    it('应该返回标准的401响应', async () => {
      const request = createMockRequest({ pathname: '/api/secrets' });
      const response = createUnauthorizedResponse(null, request);

      expect(response.status).toBe(401);

      const data = await getResponseJson(response);
      expect(data.error).toContain('身份验证失败');
    });

    it('应该支持自定义错误消息', async () => {
      const customMessage = '自定义认证错误';
      const request = createMockRequest({ pathname: '/api/secrets' });
      const response = createUnauthorizedResponse(customMessage, request);

      expect(response.status).toBe(401);

      const data = await getResponseJson(response);
      expect(data.error).toContain('身份验证失败');
      expect(data.message).toBe(customMessage);
    });

    it('应该包含安全响应头', () => {
      const request = createMockRequest({ pathname: '/api/secrets' });
      const response = createUnauthorizedResponse(null, request);

      // 驗證 CORS headers
      expect(response.headers.get('Access-Control-Allow-Origin')).toBeDefined();
      expect(response.headers.get('Access-Control-Allow-Methods')).toBeDefined();

      // 驗證內容型別
      expect(response.headers.get('Content-Type')).toContain('application/json');
    });
  });

  describe('完整认证流程端到端测试', () => {
    let kvStore;
    let env;
    const testPassword = 'EndToEndTest123!';

    beforeEach(() => {
      kvStore = new MockKV();
      env = createMockEnv(kvStore);
    });

    it('完整流程：首次设置 → 登录 → 访问受保护资源 → 刷新token', async () => {
      // Step 1: 首次設定
      const setupRequest = createMockRequest({
        method: 'POST',
        pathname: '/api/setup',
        body: { password: testPassword, confirmPassword: testPassword }
      });

      const setupResponse = await handleFirstTimeSetup(setupRequest, env);
      expect(setupResponse.status).toBe(200);

      // Step 2: 登入
      const loginRequest = createMockRequest({
        method: 'POST',
        pathname: '/api/login',
        body: { credential: testPassword }
      });

      const loginResponse = await handleLogin(loginRequest, env);
      expect(loginResponse.status).toBe(200);

      const setCookieHeader = loginResponse.headers.get('Set-Cookie');
      const tokenMatch = setCookieHeader?.match(/auth_token=([^;]+)/);
      const token = tokenMatch ? tokenMatch[1] : null;
      expect(token).toBeDefined();

      // Step 3: 使用 token 訪問受保護資源
      const authRequest = createMockRequest({
        pathname: '/api/secrets',
        cookies: { auth_token: token }
      });

      const isAuthorized = await verifyAuth(authRequest, env);
      expect(isAuthorized).toBe(true);

      // Step 4: 重新整理 token
      const refreshRequest = createMockRequest({
        method: 'POST',
        pathname: '/api/refresh-token',
        cookies: { auth_token: token }
      });

      const refreshResponse = await handleRefreshToken(refreshRequest, env);
      expect(refreshResponse.status).toBe(200);

      const refreshData = await getResponseJson(refreshResponse);
      const newToken = refreshData.token;

      // Step 5: 使用新 token 訪問受保護資源
      const newAuthRequest = createMockRequest({
        pathname: '/api/secrets',
        cookies: { auth_token: newToken }
      });

      const isStillAuthorized = await verifyAuth(newAuthRequest, env);
      expect(isStillAuthorized).toBe(true);
    });

    it('完整流程：登录失败 → Rate Limiting → 等待 → 成功登录', async () => {
      // 預先通過首次設定來配置密碼
      const setupRequest = createMockRequest({
        method: 'POST',
        pathname: '/api/setup',
        body: { password: testPassword, confirmPassword: testPassword }
      });
      await handleFirstTimeSetup(setupRequest, env);

      const clientIP = '192.168.1.100';

      // Step 1: 連續5次錯誤登入
      for (let i = 0; i < 5; i++) {
        const request = createMockRequest({
          method: 'POST',
          pathname: '/api/login',
          body: { credential: 'WrongPassword123!' },
          headers: { 'CF-Connecting-IP': clientIP }
        });

        const response = await handleLogin(request, env);
        expect(response.status).toBe(401);
      }

      // Step 2: 第6次應該被 rate limit
      const rateLimitedRequest = createMockRequest({
        method: 'POST',
        pathname: '/api/login',
        body: { credential: testPassword },
        headers: { 'CF-Connecting-IP': clientIP }
      });

      const rateLimitedResponse = await handleLogin(rateLimitedRequest, env);
      expect(rateLimitedResponse.status).toBe(429);

      // Step 3: 清空 rate limit 計數器（模擬時間過去）
      // 清理兩個版本的 rate limit 資料（固定視窗和滑動視窗）
      await kvStore.delete(`ratelimit:${clientIP}`);      // v1 固定視窗
      await kvStore.delete(`ratelimit:v2:${clientIP}`);   // v2 滑動視窗

      // Step 4: 使用正確密碼登入
      const successRequest = createMockRequest({
        method: 'POST',
        pathname: '/api/login',
        body: { credential: testPassword },
        headers: { 'CF-Connecting-IP': clientIP }
      });

      const successResponse = await handleLogin(successRequest, env);
      expect(successResponse.status).toBe(200);

      const data = await getResponseJson(successResponse);
      expect(data.success).toBe(true);
      expect(data.token).toBeDefined();
    });
  });

  describe('边界条件和错误处理', () => {
    let kvStore;
    let env;

    beforeEach(() => {
      kvStore = new MockKV();
      env = createMockEnv(kvStore);
    });

    it('应该处理KV存储失败', async () => {
      // 模擬KV儲存失敗
      const mockEnv = {
        SECRETS_KV: {
          get: vi.fn().mockRejectedValue(new Error('KV Storage Error'))
        },
        LOG_LEVEL: 'ERROR'
      };

      // checkIfSetupRequired應該安全處理KV失敗
      let isSetupRequired;
      try {
        isSetupRequired = await checkIfSetupRequired(mockEnv);
      } catch {
        // 如果丟擲錯誤，這也是可以接受的行為
        isSetupRequired = true;
      }

      // 應該假設需要設定（安全預設）或丟擲錯誤
      expect(isSetupRequired).toBe(true);
    });

    it('应该处理密码哈希验证失败', async () => {
      // 儲存一個無效的雜湊格式
      await kvStore.put('user_password', 'invalid-hash-format');

      const request = createMockRequest({
        method: 'POST',
        pathname: '/api/login',
        body: { credential: 'AnyPassword123!' }
      });

      const response = await handleLogin(request, env);
      // 無效雜湊格式會導致驗證失敗，返回401或500
      expect([401, 500]).toContain(response.status);
    });

    it('应该处理JWT验证中的各种异常', async () => {
      // 先設定有效密碼
      const setupRequest = createMockRequest({
        method: 'POST',
        pathname: '/api/setup',
        body: { password: 'ValidPassword123!', confirmPassword: 'ValidPassword123!' }
      });
      await handleFirstTimeSetup(setupRequest, env);

      const invalidTokens = [
        null,
        undefined,
        '',
        'not.a.jwt',
        'a.b', // 缺少部分
      ];

      for (const token of invalidTokens) {
        const request = createMockRequest({
          pathname: '/api/secrets',
          cookies: { auth_token: token || '' }
        });

        const isAuthorized = await verifyAuth(request, env);
        expect(isAuthorized).toBe(false);
      }
    });

    it('应该处理JSON解析错误', async () => {
      const request = new Request('https://example.com/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid-json{{'
      });

      const response = await handleLogin(request, env);
      // JSON解析錯誤可能返回400或500
      expect([400, 500]).toContain(response.status);

      const data = await getResponseJson(response);
      expect(data.error).toBeDefined();
    });

    it('handleFirstTimeSetup 应该在 KV 未绑定时返回明确提示', async () => {
      const envWithoutKV = { LOG_LEVEL: 'ERROR' };
      const request = createMockRequest({
        method: 'POST',
        pathname: '/api/setup',
        body: { password: 'ValidPassword123!', confirmPassword: 'ValidPassword123!' }
      });

      const response = await handleFirstTimeSetup(request, envWithoutKV);
      expect(response.status).toBe(500);

      const data = await getResponseJson(response);
      expect(data.message).toContain('KV 存储未绑定');
    });

    it('handleFirstTimeSetup 在请求体为 null 时不应误报为 KV 未绑定', async () => {
      // 傳送無 body 的請求，解構會拋 TypeError，但 KV 已繫結，不應誤判
      const request = new Request('https://example.com/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'null'
      });

      const response = await handleFirstTimeSetup(request, env);
      expect(response.status).toBe(500);

      const data = await getResponseJson(response);
      // 不應包含 KV 相關的錯誤提示
      expect(data.message).not.toContain('KV 存储未绑定');
    });

    it('handleFirstTimeSetup 未知错误不应暴露 error.message 细节', async () => {
      // 用 null body 觸發 TypeError 類的未知錯誤
      const request = new Request('https://example.com/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'null'
      });

      const response = await handleFirstTimeSetup(request, env);
      expect(response.status).toBe(500);

      const data = await getResponseJson(response);
      // 錯誤訊息應該是通用的，不包含內部實現細節
      expect(data.message).toBe('处理设置请求时发生错误');
    });
  });
});
