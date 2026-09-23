/**
 * 版本顯示與新版本檢測模組
 * 頁面底部顯示當前版本號，並定期檢查 GitHub 倉庫是否釋出了新版本（tag）
 */

import { APP_VERSION } from '../../utils/version.js';

const GITHUB_REPO = 'tbdavid2019/8882fa';
// 檢查結果快取 24 小時，避免頻繁請求 GitHub API（匿名限額 60 次/小時/IP）
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * 獲取版本檢測程式碼
 * @returns {string} 版本檢測 JavaScript 程式碼
 */
export function getVersionCheckCode() {
	return `// ==================== 版本顯示與新版本檢測 ====================

    window.APP_VERSION = '${APP_VERSION}';

    // 與 src/utils/version.js 的 compareVersions 邏輯一致。
    // 不能用 compareVersions.toString() 內聯：esbuild 打包會往函式體注入 __name() 輔助呼叫，瀏覽器端沒有該函式
    function compareVersions(a, b) {
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

    /**
     * 檢查 GitHub 倉庫是否有新版本 tag，有則在 footer 顯示提示
     */
    async function checkForNewVersion() {
      const CACHE_KEY = '2fa-version-check';
      const now = Date.now();

      let latest = null;
      try {
        const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
        if (cached && typeof cached.latest === 'string' && now - cached.checkedAt < ${CHECK_INTERVAL_MS}) {
          latest = cached.latest;
        }
      } catch (e) {
        // 快取損壞，忽略
      }

      if (!latest) {
        try {
          const response = await fetch('https://api.github.com/repos/${GITHUB_REPO}/tags?per_page=10', {
            headers: { Accept: 'application/vnd.github+json' },
          });
          if (!response.ok) return;
          const tags = await response.json();
          if (!Array.isArray(tags) || tags.length === 0) return;
          // 取語義化版本最大的 tag（API 返回順序不保證按版本排列）
          latest = tags
            .map((t) => t.name)
            .filter((name) => /^v?\\d+(\\.\\d+)*$/.test(name))
            .sort(compareVersions)
            .pop();
          if (!latest) return;
          try {
            localStorage.setItem(CACHE_KEY, JSON.stringify({ latest, checkedAt: now }));
          } catch (e) {
            // 儲存失敗不影響本次提示
          }
        } catch (e) {
          // 網路失敗（離線、被牆、限額）靜默降級
          return;
        }
      }

      if (compareVersions(latest, window.APP_VERSION) > 0) {
        const badge = document.getElementById('footerUpdateBadge');
        if (badge) {
          const verStr = latest.startsWith('v') ? latest : 'v' + latest;
          badge.textContent = (typeof t === 'function' ? t('newVersionBadge', { version: verStr }) : null) || ('🆕 New version ' + verStr);
          badge.style.display = '';
        }
      }
    }

    // 延遲執行，避免與首屏載入競爭
    window.addEventListener('load', () => {
      setTimeout(checkForNewVersion, 3000);
    });
`;
}
