/**
 * Rate Limiting 滑動視窗演算法測試
 * 重點測試視窗邊界攻擊防護
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  checkRateLimit,
  checkRateLimitSlidingWindow,
  resetRateLimit,
  getRateLimitInfo
} from '../../src/utils/rateLimit.js';

// Mock KV 儲存
function createMockKV() {
  const store = new Map();

  return {
    async get(key, type = 'text') {
      const value = store.get(key);
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
    },
    async put(key, value, options = {}) {
      store.set(key, value);
    },
    async delete(key) {
      store.delete(key);
    },
    _store: store // 用於測試檢查
  };
}

// Mock 環境
function createMockEnv() {
  return {
    SECRETS_KV: createMockKV(),
    LOG_LEVEL: 'ERROR' // 減少測試輸出
  };
}

describe('Rate Limiting - 滑动窗口算法', () => {
  let env;

  beforeEach(() => {
    env = createMockEnv();
  });

  describe('基本功能', () => {
    it('应该允许限制内的请求', async () => {
      const result1 = await checkRateLimitSlidingWindow('test-key', env, {
        maxAttempts: 5,
        windowSeconds: 60
      });

      expect(result1.allowed).toBe(true);
      expect(result1.remaining).toBe(4);
      expect(result1.algorithm).toBe('sliding-window');

      const result2 = await checkRateLimitSlidingWindow('test-key', env, {
        maxAttempts: 5,
        windowSeconds: 60
      });

      expect(result2.allowed).toBe(true);
      expect(result2.remaining).toBe(3);
    });

    it('应该拒绝超过限制的请求', async () => {
      const options = { maxAttempts: 3, windowSeconds: 60 };

      // 傳送3個請求（達到限制）
      await checkRateLimitSlidingWindow('test-key', env, options);
      await checkRateLimitSlidingWindow('test-key', env, options);
      await checkRateLimitSlidingWindow('test-key', env, options);

      // 第4個請求應該被拒絕
      const result = await checkRateLimitSlidingWindow('test-key', env, options);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.algorithm).toBe('sliding-window');
    });

    it('应该正确计算 resetAt 时间', async () => {
      const now = Date.now();
      const windowSeconds = 60;

      const result = await checkRateLimitSlidingWindow('test-key', env, {
        maxAttempts: 5,
        windowSeconds
      });

      expect(result.resetAt).toBeGreaterThan(now);
      expect(result.resetAt).toBeLessThanOrEqual(now + windowSeconds * 1000 + 100);
    });
  });

  describe('窗口边界攻击防护（关键测试）', () => {
    it('应该防止窗口边界突发攻击', async () => {
      const options = { maxAttempts: 5, windowSeconds: 2 }; // 2秒視窗，5次限制
      let now = Date.now();

      vi.spyOn(Date, 'now').mockImplementation(() => now);

      try {
        // t=0s: 傳送5個請求（達到限制）
        for (let i = 0; i < 5; i++) {
          const result = await checkRateLimitSlidingWindow('attack-test', env, options);
          expect(result.allowed).toBe(true);
        }

        // t=0s: 第6個請求應該被拒絕
        let result = await checkRateLimitSlidingWindow('attack-test', env, options);
        expect(result.allowed).toBe(false);

        // t=1.0s: 視窗內還有5個請求，仍應拒絕
        now += 1000;
        result = await checkRateLimitSlidingWindow('attack-test', env, options);
        expect(result.allowed).toBe(false);

        // t=2.001s: 所有舊請求剛過期，應該允許新請求
        now += 1001; // 總共2.001秒
        result = await checkRateLimitSlidingWindow('attack-test', env, options);
        expect(result.allowed).toBe(true);

        // 繼續傳送4個請求，填滿視窗（現在視窗內有5個請求）
        for (let i = 0; i < 4; i++) {
          result = await checkRateLimitSlidingWindow('attack-test', env, options);
          expect(result.allowed).toBe(true);
        }

        // 下一個請求應該被拒絕（視窗內已有5個請求）
        result = await checkRateLimitSlidingWindow('attack-test', env, options);
        expect(result.allowed).toBe(false);

      } finally {
        vi.restoreAllMocks();
      }
    });

    it('对比：固定窗口容易受到窗口边界攻击', async () => {
      // 這個測試演示固定視窗的問題
      const options = { maxAttempts: 5, windowSeconds: 2, algorithm: 'fixed-window' };
      const startTime = Date.now();
      let now = startTime;

      vi.spyOn(Date, 'now').mockImplementation(() => now);

      try {
        // t=0s: 傳送5個請求（達到限制）
        for (let i = 0; i < 5; i++) {
          const result = await checkRateLimit('fixed-attack', env, options);
          expect(result.allowed).toBe(true);
        }

        // t=0s: 第6個請求被拒絕
        let result = await checkRateLimit('fixed-attack', env, options);
        expect(result.allowed).toBe(false);

        // t=2.1s: 視窗重置後，立即可以再發5個請求
        now = startTime + 2100; // 新視窗開始
        for (let i = 0; i < 5; i++) {
          result = await checkRateLimit('fixed-attack', env, options);
          expect(result.allowed).toBe(true);
        }

        // 結果：固定視窗允許在極短時間內傳送10個請求（視窗切換時）

      } finally {
        vi.restoreAllMocks();
      }
    });

    it('滑动窗口应该平滑限流，无突发漏洞', async () => {
      const options = { maxAttempts: 5, windowSeconds: 3 };
      let now = Date.now();

      vi.spyOn(Date, 'now').mockImplementation(() => now);

      try {
        // 模擬均勻分佈的請求
        const results = [];

        // 每500ms傳送一個請求，持續4秒
        for (let i = 0; i < 8; i++) {
          const result = await checkRateLimitSlidingWindow('smooth-test', env, options);
          results.push({ time: now, allowed: result.allowed });
          now += 500;
        }

        // 驗證結果
        // t=0.0s: 允許 (1/5)
        // t=0.5s: 允許 (2/5)
        // t=1.0s: 允許 (3/5)
        // t=1.5s: 允許 (4/5)
        // t=2.0s: 允許 (5/5)
        // t=2.5s: 拒絕 (視窗內還有5個)
        // t=3.0s: 允許 (t=0s的請求過期)
        // t=3.5s: 允許 (t=0.5s的請求過期)

        expect(results[0].allowed).toBe(true);
        expect(results[1].allowed).toBe(true);
        expect(results[2].allowed).toBe(true);
        expect(results[3].allowed).toBe(true);
        expect(results[4].allowed).toBe(true);
        expect(results[5].allowed).toBe(false); // 視窗滿
        expect(results[6].allowed).toBe(true);  // 舊請求過期
        expect(results[7].allowed).toBe(true);  // 舊請求過期

      } finally {
        vi.restoreAllMocks();
      }
    });
  });

  describe('时间戳清理和性能', () => {
    it('应该自动清理过期的时间戳', async () => {
      const options = { maxAttempts: 5, windowSeconds: 2 };
      let now = Date.now();

      vi.spyOn(Date, 'now').mockImplementation(() => now);

      try {
        // 傳送5個請求
        for (let i = 0; i < 5; i++) {
          await checkRateLimitSlidingWindow('cleanup-test', env, options);
        }

        // 檢查儲存的資料
        const data1 = await env.SECRETS_KV.get('ratelimit:v2:cleanup-test', 'json');
        expect(data1.timestamps.length).toBe(5);

        // 等待視窗過期
        now += 3000;

        // 傳送新請求
        await checkRateLimitSlidingWindow('cleanup-test', env, options);

        // 舊的時間戳應該被清理
        const data2 = await env.SECRETS_KV.get('ratelimit:v2:cleanup-test', 'json');
        expect(data2.timestamps.length).toBe(1); // 只有新請求

      } finally {
        vi.restoreAllMocks();
      }
    });

    it('应该限制时间戳数组的最大长度', async () => {
      const options = { maxAttempts: 5, windowSeconds: 60 };

      // 傳送大量請求（超過 maxAttempts * 2）
      for (let i = 0; i < 15; i++) {
        await checkRateLimitSlidingWindow('size-test', env, options);
      }

      // 檢查陣列長度
      const data = await env.SECRETS_KV.get('ratelimit:v2:size-test', 'json');
      expect(data.timestamps.length).toBeLessThanOrEqual(20); // maxAttempts * 2 或 20
    });
  });

  describe('getRateLimitInfo', () => {
    it('应该返回滑动窗口的准确信息', async () => {
      const options = { maxAttempts: 5, windowSeconds: 60 };

      // 傳送3個請求
      await checkRateLimitSlidingWindow('info-test', env, options);
      await checkRateLimitSlidingWindow('info-test', env, options);
      await checkRateLimitSlidingWindow('info-test', env, options);

      // 獲取資訊
      const info = await getRateLimitInfo('info-test', env, options);

      expect(info.count).toBe(3);
      expect(info.remaining).toBe(2);
      expect(info.algorithm).toBe('sliding-window');
    });
  });

  describe('resetRateLimit', () => {
    it('应该清理两个版本的数据', async () => {
      // 建立v1和v2資料
      await env.SECRETS_KV.put('ratelimit:reset-test', JSON.stringify({ count: 5 }));
      await env.SECRETS_KV.put('ratelimit:v2:reset-test', JSON.stringify({ timestamps: [Date.now()] }));

      // 重置
      await resetRateLimit('reset-test', env);

      // 驗證清理
      const v1Data = await env.SECRETS_KV.get('ratelimit:reset-test');
      const v2Data = await env.SECRETS_KV.get('ratelimit:v2:reset-test');

      expect(v1Data).toBeNull();
      expect(v2Data).toBeNull();
    });
  });

  describe('算法选择', () => {
    it('默认应该使用滑动窗口', async () => {
      const result = await checkRateLimit('default-test', env, {
        maxAttempts: 5,
        windowSeconds: 60
      });

      expect(result.algorithm).toBe('sliding-window');
    });

    it('应该支持显式选择固定窗口', async () => {
      const result = await checkRateLimit('fixed-test', env, {
        maxAttempts: 5,
        windowSeconds: 60,
        algorithm: 'fixed-window'
      });

      expect(result.algorithm).toBe('fixed-window');
    });
  });
});
