#!/usr/bin/env node

/**
 * 自動化部署指令碼
 *
 * 功能：
 * 1. 自動生成 Service Worker 版本號
 * 2. 注入版本到環境變數
 * 3. 執行 wrangler 部署
 *
 * 使用方式：
 *   node scripts/deploy.js                  # 使用時間戳版本
 *   node scripts/deploy.js --git            # 使用 git commit 版本
 *   node scripts/deploy.js --package        # 使用 package.json 版本
 *   node scripts/deploy.js --env production # 部署到生產環境
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import {
  extractWorkerName,
  injectAccountId,
  injectCustomDomain,
  injectKvNamespaceId,
  injectWorkerVersion,
} from './deploy-config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const args = process.argv.slice(2);
const versionStrategy = args.includes('--git') ? '--git' :
  args.includes('--package') ? '--package' :
    '';

const envIndex = args.indexOf('--env');
const envName = envIndex !== -1 && args[envIndex + 1] ? args[envIndex + 1] : null;
const envArg = envName ? `--env ${envName}` : '--env=""';

console.log('');
console.log('🚀 ========================================');
console.log('   2FA Manager 自动化部署');
console.log('========================================');
console.log('');
loadLocalEnv();

try {
  const version = generateVersion(versionStrategy);
  const wranglerPath = join(__dirname, '..', 'wrangler.toml');
  const originalConfig = readFileSync(wranglerPath, 'utf-8');

  console.log(`   ✅ 版本号: ${version}`);
  console.log('');

  console.log('📝 Step 2: 注入版本到配置...');

  let modifiedConfig = injectWorkerVersion(originalConfig, version);

  console.log(`   ✅ 已注入版本: ${version}`);
  console.log('');

  // Step 2.5: 自動檢測並繫結已有 KV namespace，防止重複建立
  console.log('🔍 Step 2.5: 检测已有 KV namespace...');
  const workerName = extractWorkerName(modifiedConfig, envName);
  const existingKv = findExistingKvId(workerName, envName);
  if (existingKv) {
    modifiedConfig = injectKvNamespaceId(modifiedConfig, existingKv.id, envName);
    console.log(`   ✅ 复用已有 KV: ${existingKv.title} (${existingKv.id})`);
  } else {
    console.log('   ℹ️ 未检测到已有 KV，将由 Wrangler 自动创建');
  }
  console.log('');

  // Step 2.6: 從本地環境或 .env 中注入 Account ID 和自訂網域（保持公開倉庫乾淨）
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (accountId) {
    modifiedConfig = injectAccountId(modifiedConfig, accountId);
    console.log(`   ✅ 鎖定 Account ID: ${accountId}`);
  }

  const customDomain = process.env.CUSTOM_DOMAIN;
  if (customDomain) {
    modifiedConfig = injectCustomDomain(modifiedConfig, customDomain);
    console.log(`   ✅ 自動綁定自訂網域路由: ${customDomain}`);
  }
  console.log('');

  writeFileSync(wranglerPath, modifiedConfig, 'utf-8');

  console.log('🚀 Step 3: 部署到 Cloudflare Workers...');
  console.log(`   命令: npx wrangler deploy ${envArg}`.trim());
  console.log('');

  try {
    execSync(`npx wrangler deploy ${envArg}`.trim(), {
      stdio: 'inherit',
      encoding: 'utf-8',
    });

    console.log('');
    console.log('✅ ========================================');
    console.log('   部署成功！');
    console.log('========================================');
    console.log('');
    console.log(`📦 版本: ${version}`);
    console.log(`🌐 环境: ${envArg || '生产环境 (production)'}`);
    console.log('');
  } catch (deployError) {
    console.error('');
    console.error('❌ ========================================');
    console.error('   部署失败');
    console.error('========================================');
    console.error('');
    throw deployError;
  } finally {
    console.log('🔄 Step 4: 恢复配置文件...');
    writeFileSync(wranglerPath, originalConfig, 'utf-8');
    console.log('   ✅ 配置已恢复');
    console.log('');
  }
} catch (error) {
  console.error('');
  console.error('❌ 部署流程失败:');
  console.error('   ', error.message);
  console.error('');
  process.exit(1);
}

function generateVersion(versionStrategyArg) {
  console.log('📦 Step 1: 生成 Service Worker 版本号...');
  const versionCmd = `node ${join(__dirname, 'generate-version.js')} ${versionStrategyArg} --verbose`;
  return execSync(versionCmd, { encoding: 'utf-8' }).trim().split('\n')[0];
}

function findExistingKvId(workerName, envName = null) {
  if (!workerName) return null;

  let namespaces;
  try {
    const output = execSync('npx wrangler kv namespace list', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    namespaces = JSON.parse(output);
  } catch {
    return null;
  }
  if (!namespaces.length) return null;

  // 短名對映：開發環境常縮寫為 dev / prod
  const ENV_ALIASES = { development: 'dev', production: 'prod' };
  const envAlias = envName ? (ENV_ALIASES[envName] || envName) : null;

  // 推斷 base 名（去除可能的 env 字尾）：worker "2fa-dev" + envAlias "dev" → base "2fa"
  const stripSuffix = (name, suffix) =>
    suffix && name.endsWith(`-${suffix}`) ? name.slice(0, -(suffix.length + 1)) : name;
  const baseName = envAlias ? stripSuffix(workerName, envAlias) : workerName;

  // 候選 title 列表，越靠前越優先
  const candidates = [];
  if (envName) {
    candidates.push(
      `${workerName}-secrets-kv`,                // 2fa-dev-secrets-kv
      `${workerName}-SECRETS_KV`,
      `${baseName}-secrets-kv-${envAlias}`,      // 2fa-secrets-kv-dev  ← 當前命名
      `${baseName}-secrets-kv-${envName}`,       // 2fa-secrets-kv-development
      `${envAlias}-${baseName}-SECRETS_KV`,
      `${envName}-${baseName}-SECRETS_KV`,
      `${envName}-SECRETS_KV`,                   // development-SECRETS_KV（舊命名）
    );
  } else {
    candidates.push(
      `${workerName}-secrets-kv`,                // 2fa-secrets-kv  ← 當前命名
      `${workerName}-SECRETS_KV`,
      'SECRETS_KV',
      workerName,
    );
  }

  for (const title of candidates) {
    const match = namespaces.find(ns => ns.title === title);
    if (match) return { id: match.id, title: match.title };
  }

  // env 部署只走精確匹配，避免誤把生產 KV 命中給 dev
  if (envName) return null;

  // 頂層部署的 fuzzy 兜底（保持原有相容性）
  const fuzzy =
    namespaces.find(ns => ns.title.includes('SECRETS_KV')) ||
    namespaces.find(ns => ns.title.includes('secrets-kv')) ||
    (namespaces.length === 1 ? namespaces[0] : null);

  return fuzzy ? { id: fuzzy.id, title: fuzzy.title } : null;
}

/**
 * 讀取本地 .env 或 .env.local（若存在，提供本地專用配置，如 ACCOUNT_ID、CUSTOM_DOMAIN）
 */
function loadLocalEnv() {
  const envFiles = ['.env', '.env.local'];
  for (const file of envFiles) {
    const filePath = join(__dirname, '..', file);
    if (existsSync(filePath)) {
      try {
        const content = readFileSync(filePath, 'utf-8');
        for (const line of content.split('\n')) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          const eqIdx = trimmed.indexOf('=');
          if (eqIdx > 0) {
            const key = trimmed.slice(0, eqIdx).trim();
            let val = trimmed.slice(eqIdx + 1).trim();
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
              val = val.slice(1, -1);
            }
            if (!process.env[key]) {
              process.env[key] = val;
            }
          }
        }
      } catch {
        // 忽略讀取異常
      }
    }
  }
}

