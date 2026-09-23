/**
 * 全域性狀態模組
 * 全域性變數定義
 */

/**
 * 獲取 State 相關程式碼
 * @returns {string} State JavaScript 程式碼
 */
export function getStateCode() {
	return `    let secrets = [];
    let scanStream = null;
    let scannerCanvas = null;
    let scannerContext = null;
    let isScanning = false;
    let scanInterval = null;
    let editingId = null;
    let otpIntervals = {};
    let currentOTPAuthURL = '';
    let debugMode = false;
    let currentSearchQuery = '';
    let filteredSecrets = [];
    let secretLoadGeneration = 0;
    let secretRenderGeneration = 0;
    let saveQueue = Promise.resolve(); // 保存操作队列，确保串行执行避免并发覆盖
    // authToken 已移除 - 現在使用 HttpOnly Cookie

`;
}
