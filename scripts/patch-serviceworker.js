#!/usr/bin/env node

/**
 * Service Worker 自動版本管理補丁指令碼
 * 修改 serviceworker.js 以支援動態版本注入
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const swPath = join(__dirname, '..', 'src', 'ui', 'serviceworker.js');

console.log('📝 正在修补 Service Worker...');

// 讀取原始檔案
let content = readFileSync(swPath, 'utf-8');

// 修補 1: 修改函式簽名以接收 env 引數
content = content.replace(
  /export function createServiceWorker\(\) \{/,
  'export function createServiceWorker(env = {}) {'
);

// 修補 2: 在函式開頭新增版本管理邏輯
const versionLogic = `  // 🚀 自動版本管理：從環境變數讀取版本號
  // 支援多種版本策略：
  // 1. env.SW_VERSION - 構建時注入的版本號（推薦）
  // 2. env.BUILD_TIMESTAMP - 構建時間戳
  // 3. 'v1' - 預設版本（後備）
  const version = env.SW_VERSION || env.BUILD_TIMESTAMP || 'v1';

  // 生成快取名稱
  const CACHE_NAME = \`2fa-cache-\${version}\`;
  const RUNTIME_CACHE = \`2fa-runtime-\${version}\`;

`;

content = content.replace(
  /(export function createServiceWorker\(env = \{\}\) \{\s*)(const swScript = `)/,
  `$1${versionLogic}$2`
);

// 修補 3: 更新 Service Worker 內部的版本資訊
content = content.replace(
  /const CACHE_NAME = '2fa-v1';/,
  "const CACHE_NAME = '${CACHE_NAME}';"
);

content = content.replace(
  /const RUNTIME_CACHE = '2fa-runtime-v1';/,
  "const RUNTIME_CACHE = '${RUNTIME_CACHE}';"
);

// 修補 4: 新增版本常量和日誌
content = content.replace(
  /(const STORE_NAME = 'pending-operations';)/,
  `const SW_VERSION = '\${version}';\n$1\n\n// 版本信息（用于调试）\nconsole.log('[SW] Service Worker 版本:', SW_VERSION);\nconsole.log('[SW] 缓存名称:', CACHE_NAME);`
);

// 修補 5: 更新 JSDoc 註釋
content = content.replace(
  / \* 版本: 1\.0\.0/,
  ` * 版本: \${version}\n * 生成时间: \${new Date().toISOString()}\n *\n * ⚡ 自动版本管理：\n * - 每次部署自动更新缓存版本\n * - 自动清理旧版本缓存\n * - 无需手动维护版本号`
);

// 寫回檔案
writeFileSync(swPath, content, 'utf-8');

console.log('✅ Service Worker 修补完成！');
console.log('   - 支持动态版本管理');
console.log('   - 自动清理旧缓存');
console.log('   - 版本号从环境变量注入');
