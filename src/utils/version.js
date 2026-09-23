/**
 * 應用版本工具
 * APP_VERSION 必須與 package.json 的 version 保持一致（tests/utils/version.test.js 強制校驗），
 * 發版時與 package.json、git tag 一起更新
 */

export const APP_VERSION = '2026.9.23';

export function formatVersionForDisplay(version) {
	const match = String(version).match(/^(\d{4})\.(\d{1,2})\.(\d{1,2})$/);
	if (!match) {
		return `v${version}`;
	}
	return `v${match[1]}.${match[2].padStart(2, '0')}.${match[3].padStart(2, '0')}`;
}

/**
 * 比較兩個語義化版本號（支援 "v" 字首）
 * @param {string} a - 版本號，如 "1.5.0" 或 "v1.5.0"
 * @param {string} b - 版本號
 * @returns {number} a > b 返回 1，a < b 返回 -1，相等返回 0
 */
export function compareVersions(a, b) {
	const parse = (v) =>
		String(v)
			.trim()
			.replace(/^v/i, '')
			.split('.')
			.map((n) => parseInt(n, 10) || 0);
	const pa = parse(a);
	const pb = parse(b);
	const len = Math.max(pa.length, pb.length);
	for (let i = 0; i < len; i++) {
		const x = pa[i] || 0;
		const y = pb[i] || 0;
		if (x > y) {
			return 1;
		}
		if (x < y) {
			return -1;
		}
	}
	return 0;
}
