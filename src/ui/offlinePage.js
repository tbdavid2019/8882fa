import { dialogIcon } from './dialogIcons.js';
import { getStandaloneHead } from './standalone.js';

/** Complete, self-contained fallback when neither the network nor the page cache is available. */
export function createOfflinePage() {
	return `<!DOCTYPE html>
<html lang="en">
<head>
  ${getStandaloneHead(
		'Offline Mode - 888 2FA',
		`
    .offline-page { text-align: center; }
    .offline-page .page-icon { justify-content: center; color: var(--page-warning); }
    .offline-page .page-actions { justify-content: center; }
  `,
	)}
</head>
<body>
  <main class="standalone-card offline-page" aria-labelledby="offline-title">
    <div class="page-icon">${dialogIcon('cloud')}</div>
    <h1 class="page-title" id="offline-title">No Internet Connection</h1>
    <p class="page-description" id="offline-desc">You are currently offline. This page is temporarily unavailable.</p>
    <p class="page-notice" id="offline-notice">Please check your network connection and reload the page once connected.</p>
    <div class="page-actions"><a class="page-button" id="offline-reload" href="/">Reload</a></div>
  </main>
  <script>
    (function() {
      try {
        var lang = localStorage.getItem('language') || '';
        if (!lang) {
          var nav = (navigator.languages && navigator.languages[0]) || navigator.language || '';
          lang = nav.toLowerCase();
        }
        if (lang.indexOf('tw') !== -1 || lang.indexOf('hk') !== -1 || lang.indexOf('mo') !== -1 || lang.indexOf('hant') !== -1) {
          document.documentElement.lang = 'zh-TW';
          document.title = '離線模式 - 888 2FA';
          var t = document.getElementById('offline-title'); if (t) t.textContent = '暫時無法連線';
          var d = document.getElementById('offline-desc'); if (d) d.textContent = '目前處於離線模式，頁面暫時無法開啟。';
          var n = document.getElementById('offline-notice'); if (n) n.textContent = '請檢查網路連線，恢復後重新載入頁面。';
          var b = document.getElementById('offline-reload'); if (b) b.textContent = '重新載入';
        } else if (lang.indexOf('cn') !== -1 || lang.indexOf('sg') !== -1 || lang.indexOf('hans') !== -1) {
          document.documentElement.lang = 'zh-CN';
          document.title = '离线模式 - 888 2FA';
          var t2 = document.getElementById('offline-title'); if (t2) t2.textContent = '暂时无法连接';
          var d2 = document.getElementById('offline-desc'); if (d2) d2.textContent = '目前处于离线模式，页面暂时无法打开。';
          var n2 = document.getElementById('offline-notice'); if (n2) n2.textContent = '请检查网络连接，恢复后重新加载页面。';
          var b2 = document.getElementById('offline-reload'); if (b2) b2.textContent = '重新加载';
        }
      } catch (e) {}
    })();
  </script>
</body>
</html>`;
}
