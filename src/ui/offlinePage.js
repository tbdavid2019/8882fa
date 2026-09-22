import { dialogIcon } from './dialogIcons.js';
import { getStandaloneHead } from './standalone.js';

/** Complete, self-contained fallback when neither the network nor the page cache is available. */
export function createOfflinePage() {
	return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  ${getStandaloneHead(
		'離線模式 - 888 2FA',
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
    <h1 class="page-title" id="offline-title">暫時無法連線</h1>
    <p class="page-description">目前處於離線模式，頁面暫時無法開啟。</p>
    <p class="page-notice">請檢查網路連線，恢復後重新載入頁面。</p>
    <div class="page-actions"><a class="page-button" href="/">重新載入</a></div>
  </main>
</body>
</html>`;
}
