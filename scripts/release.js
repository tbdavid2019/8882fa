#!/usr/bin/env node

/**
 * 發版指令碼 - 一條命令完成版本號同步、提交和打 tag
 *
 * 版本號唯一資料來源是 package.json，其餘位置由本指令碼同步：
 *   - src/utils/version.js  (APP_VERSION，前端 footer 和新版本檢測依賴)
 *   - README.md / README_EN.md  (版本徽章)
 *
 * 使用方式：
 *   npm run release:date                    # 依臺北日期產生 YYYY.M.D 版本
 *   node scripts/release.js 2026.9.23       # 指定日期版本
 *   node scripts/release.js --sync          # 同步 package.json 版本到其他位置
 *
 * 發版流程：
 *   1. 檢查 tag 未存在、版本相關檔案無未提交修改（其他檔案如 wrangler.toml 允許 dirty）
 *   2. 執行全量測試（--skip-tests 跳過）
 *   3. bump package.json + package-lock.json
 *   4. 同步 version.js 和 README 徽章
 *   5. 執行版本一致性測試自檢
 *   6. git commit + git tag v{YYYY.MM.DD}
 *   7. 提示手動 push（不自動 push）
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

/** 版本號寫入的所有位置（新增位置時在此登記，並同步更新 tests/utils/version.test.js 的一致性校驗） */
const SYNC_TARGETS = [
	{
		file: 'src/utils/version.js',
		pattern: /(APP_VERSION = ')\d+\.\d+\.\d+(')/,
		replacement: (v) => `$1${v}$2`,
	},
	{
		file: 'README.md',
		pattern: /(badge\/version-)\d+\.\d+\.\d+(-blue)/,
		replacement: (v) => `$1${formatDisplayVersion(v)}$2`,
	},
	{
		file: 'README_EN.md',
		pattern: /(badge\/version-)\d+\.\d+\.\d+(-blue)/,
		replacement: (v) => `$1${formatDisplayVersion(v)}$2`,
	},
];

/** 發版 commit 包含的全部檔案 */
const RELEASE_FILES = ['package.json', 'package-lock.json', 'CHANGELOG.md', ...SYNC_TARGETS.map((t) => t.file)];

function run(cmd, options = {}) {
	return execSync(cmd, { cwd: ROOT, encoding: 'utf-8', ...options });
}

function readPackageVersion() {
	return JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8')).version;
}

function normalizeDateVersion(version) {
	const match = String(version).match(/^(\d{4})\.(\d{1,2})\.(\d{1,2})$/);
	if (!match) return null;
	const [, year, monthText, dayText] = match;
	const month = Number(monthText);
	const day = Number(dayText);
	const date = new Date(Date.UTC(Number(year), month - 1, day));
	if (date.getUTCFullYear() !== Number(year) || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
	return `${year}.${month}.${day}`;
}

function getTaipeiDateVersion() {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone: 'Asia/Taipei', year: 'numeric', month: 'numeric', day: 'numeric',
	}).formatToParts(new Date());
	const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
	return normalizeDateVersion(`${values.year}.${values.month}.${values.day}`);
}

function formatDisplayVersion(version) {
	const normalized = normalizeDateVersion(version);
	if (!normalized) return String(version);
	const [year, month, day] = normalized.split('.');
	return `${year}.${month.padStart(2, '0')}.${day.padStart(2, '0')}`;
}

/** 將版本號同步到 SYNC_TARGETS 中的所有檔案，任一檔案匹配失敗則報錯退出 */
function syncVersion(version) {
	let failed = false;
	for (const { file, pattern, replacement } of SYNC_TARGETS) {
		const path = join(ROOT, file);
		const content = readFileSync(path, 'utf-8');
		const globalPattern = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);
		if (!globalPattern.test(content)) {
			console.error(`❌ ${file}: 未匹配到版本號模式 ${pattern}，請檢查檔案內容或更新 SYNC_TARGETS`);
			failed = true;
			continue;
		}
		globalPattern.lastIndex = 0;
		const updated = content.replace(globalPattern, replacement(version));
		if (updated === content) {
			console.log(`✓  ${file} 已是 ${version}`);
		} else {
			writeFileSync(path, updated);
			console.log(`✅ ${file} → ${version}`);
		}
	}
	if (failed) {
		process.exit(1);
	}
}

function main() {
	const args = process.argv.slice(2);
	const skipTests = args.includes('--skip-tests');
	const positional = args.filter((a) => !a.startsWith('--'));

	// --sync 模式：僅把 package.json 的版本同步到其他位置
	if (args.includes('--sync')) {
		const version = readPackageVersion();
		console.log(`🔄 同步版本號 ${version}（資料來源: package.json）\n`);
		syncVersion(version);
		return;
	}

	const type = positional[0];
	if (!type || (type !== 'date' && !normalizeDateVersion(type))) {
		console.error('用法: node scripts/release.js <date|YYYY.M.D> [--skip-tests]');
		console.error('      node scripts/release.js --sync');
		process.exit(1);
	}

	const currentVersion = readPackageVersion();
	const newVersion = type === 'date' ? getTaipeiDateVersion() : normalizeDateVersion(type);
	const displayVersion = formatDisplayVersion(newVersion);
	const tag = `v${displayVersion}`;
	const releaseDate = displayVersion.replaceAll('.', '-');
	const changelogHeading = `## [${tag}] - ${releaseDate}`;
	const changelog = readFileSync(join(ROOT, 'CHANGELOG.md'), 'utf-8');
	if (!changelog.includes(changelogHeading)) {
		console.error(`❌ CHANGELOG.md 必須先包含標題: ${changelogHeading}`);
		process.exit(1);
	}

	console.log(`\n🚀 日期版本: ${currentVersion} → ${newVersion} (${tag})\n`);

	// 1. tag 不能已存在
	if (run(`git tag -l ${tag}`).trim()) {
		console.error(`❌ tag ${tag} 已存在，請檢查版本號`);
		process.exit(1);
	}

	// 2. 版本相關檔案必須乾淨，避免發版 commit 混入無關修改
	//    （其他檔案如 wrangler.toml 允許有本地修改，僅提示）
	const dirty = run('git status --porcelain')
		.split('\n')
		.filter(Boolean)
		.map((line) => line.slice(3).trim());
	const dirtyReleaseFiles = dirty.filter((f) => RELEASE_FILES.includes(f) && f !== 'CHANGELOG.md');
	if (dirtyReleaseFiles.length > 0) {
		console.error(`❌ 以下版本相關檔案有未提交修改，請先提交或還原:\n   ${dirtyReleaseFiles.join('\n   ')}`);
		process.exit(1);
	}
	const dirtyOthers = dirty.filter((f) => !RELEASE_FILES.includes(f));
	if (dirtyOthers.length > 0) {
		console.warn(`⚠️  工作區存在其他未提交修改（不會包含在發版 commit 中）:\n   ${dirtyOthers.join('\n   ')}\n`);
	}

	// 3. 全量測試
	if (skipTests) {
		console.warn('⚠️  已跳過測試 (--skip-tests)\n');
	} else {
		console.log('🧪 執行全量測試...\n');
		run('npx vitest run', { stdio: 'inherit' });
	}

	// 4. bump package.json（僅替換頂層 version 欄位），並同步 package-lock.json
	const pkgPath = join(ROOT, 'package.json');
	const pkgContent = readFileSync(pkgPath, 'utf-8');
	writeFileSync(pkgPath, pkgContent.replace(/("version":\s*")\d+\.\d+\.\d+(")/, `$1${newVersion}$2`));
	console.log(`✅ package.json → ${newVersion}`);
	run('npm install --package-lock-only --ignore-scripts', { stdio: 'ignore' });
	console.log(`✅ package-lock.json → ${newVersion}`);

	// 5. 同步其餘位置
	syncVersion(newVersion);

	// 6. 版本一致性自檢（tests/utils/version.test.js 校驗 APP_VERSION 和 README 徽章）
	console.log('\n🔍 版本一致性自檢...\n');
	run('npx vitest run tests/utils/version.test.js', { stdio: 'inherit' });

	// 7. 提交併打 tag（commit message 符合 Conventional Commits，通過 husky commit-msg 校驗）
	run(`git add ${RELEASE_FILES.join(' ')}`);
	run(`git commit -m "chore(release): bump version to ${newVersion}"`, { stdio: 'inherit' });
	run(`git tag ${tag}`);

	console.log(`\n✅ 發版完成: ${tag}（commit + tag 均已建立）`);
	console.log('\n📤 請推送以釋出（使用者端新版本檢測依賴遠端 tag）:');
	console.log('\n   git push && git push --tags\n');
}

main();
