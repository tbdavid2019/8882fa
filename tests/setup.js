/**
 * Vitest 測試環境設定
 * 為 Node.js 環境提供 Web Crypto API polyfill
 */

import { webcrypto } from 'node:crypto';
import { TextEncoder, TextDecoder } from 'node:util';

// 將 Node.js 的 webcrypto 掛載到全域性物件
// 在 Node.js 19+ 中，crypto 已經可用，但我們需要確保它正確配置
// 注意：globalThis.crypto 在某些 Node.js 版本中是隻讀的，需要使用 defineProperty
try {
  if (!globalThis.crypto || !globalThis.crypto.subtle) {
    Object.defineProperty(globalThis, 'crypto', {
      value: webcrypto,
      writable: true,
      configurable: true
    });
  }
} catch {
  // 如果已經有 crypto 物件且不可配置，則忽略
  console.warn('Warning: crypto object already exists and is not configurable');
}

// 新增 btoa 和 atob（Base64 編碼/解碼）
// 這些函式在瀏覽器和 Workers 中可用，但在 Node.js 中需要 polyfill
if (typeof globalThis.btoa === 'undefined') {
  globalThis.btoa = (str) => {
    return Buffer.from(str, 'binary').toString('base64');
  };
}

if (typeof globalThis.atob === 'undefined') {
  globalThis.atob = (str) => {
    return Buffer.from(str, 'base64').toString('binary');
  };
}

// 新增 TextEncoder 和 TextDecoder（如果不存在）
// Node.js 18+ 已經提供這些，但為了相容性還是確保全域性可用
if (typeof globalThis.TextEncoder === 'undefined') {
  globalThis.TextEncoder = TextEncoder;
  globalThis.TextDecoder = TextDecoder;
}

// 新增 performance.now()（如果不存在）
// Node.js 16+ 已經有 performance，但確保可用
if (typeof globalThis.performance === 'undefined' || typeof globalThis.performance.now === 'undefined') {
  globalThis.performance = globalThis.performance || {};
  globalThis.performance.now = () => {
    const [seconds, nanoseconds] = process.hrtime();
    return seconds * 1000 + nanoseconds / 1000000;
  };
}

console.log('✅ Vitest setup complete - Web Crypto API ready');

