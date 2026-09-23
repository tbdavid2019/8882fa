/**
 * 模組懶載入器
 * 實現按需載入大型功能模組，最佳化首次載入效能
 *
 * 可延遲載入的模組：
 * - import 模組（src/ui/scripts/import/index.js 入口）- 匯入功能
 * - export.js - 匯出功能
 * - backup.js - 備份管理
 * - qrcode.js - 二維碼生成
 * - tools.js + 工具模組 - 工具集
 */

/**
 * 獲取模組載入器程式碼
 * @returns {string} JavaScript 程式碼
 */
export function getModuleLoaderCode() {
	return `
    // ========== 模組懶載入系統 ==========

    // 模組載入狀態
    const moduleLoadState = {
      import: { loaded: false, loading: false, code: null },
      export: { loaded: false, loading: false, code: null },
      backup: { loaded: false, loading: false, code: null },
      qrcode: { loaded: false, loading: false, code: null },
      tools: { loaded: false, loading: false, code: null },
      googleMigration: { loaded: false, loading: false, code: null }
    };

    /**
     * 載入模組
     * @param {string} moduleName - 模組名稱
     * @returns {Promise<void>}
     */
    async function loadModule(moduleName) {
      // 如果已載入，直接返回
      if (moduleLoadState[moduleName].loaded) {
        console.log(\`✅ 模块 \${moduleName} 已加载\`);
        return;
      }

      // 如果正在載入，等待載入完成
      if (moduleLoadState[moduleName].loading) {
        console.log(\`⏳ 模块 \${moduleName} 正在加载中...\`);
        // 輪詢等待載入完成（最多5秒）
        const startTime = Date.now();
        while (moduleLoadState[moduleName].loading && Date.now() - startTime < 5000) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        if (moduleLoadState[moduleName].loaded) {
          return;
        } else {
          throw new Error(\`Module \${moduleName} load timed out\`);
        }
      }

      // 開始載入
      moduleLoadState[moduleName].loading = true;
      console.log(\`📦 开始加载模块: \${moduleName}\`);

      try {
        // 顯示載入提示
        const modName = getModuleDisplayName(moduleName);
        const loadingMsg = (typeof t === 'function' ? t('moduleLoadingToast', { module: modName }) : null) || ('Loading ' + modName + '...');
        showLoadingToast(loadingMsg);

        // 從伺服器獲取模組程式碼
        const response = await authenticatedFetch(\`/modules/\${moduleName}.js\`);

        if (!response.ok) {
          throw new Error(\`Failed to load module: \${response.statusText}\`);
        }

        const code = await response.text();

        // 執行模組程式碼（注入到全域性作用域）
        const script = document.createElement('script');
        script.textContent = code;
        document.head.appendChild(script);

        // 標記為已載入
        moduleLoadState[moduleName].loaded = true;
        moduleLoadState[moduleName].code = code;

        console.log(\`✅ 模块 \${moduleName} 加载成功\`);
        hideLoadingToast();

      } catch (error) {
        console.error(\`❌ 加载模块 \${moduleName} 失败:\`, error);
        moduleLoadState[moduleName].loading = false;
        hideLoadingToast();
        const failMsg = (typeof t === 'function' ? t('moduleLoadFailed', { error: error.message }) : null) || ('Failed to load module: ' + error.message);
        showCenterToast('❌', failMsg);
        throw error;
      } finally {
        moduleLoadState[moduleName].loading = false;
      }
    }

    /**
     * 獲取模組顯示名稱
     * @param {string} moduleName - 模組名稱
     * @returns {string} 顯示名稱
     */
    function getModuleDisplayName(moduleName) {
      const _t = typeof t === 'function' ? t : (k) => null;
      const displayNames = {
        import: _t('moduleDisplayNameImport') || 'Import',
        export: _t('moduleDisplayNameExport') || 'Export',
        backup: _t('moduleDisplayNameBackup') || 'Backup & Restore',
        qrcode: _t('moduleDisplayNameQrcode') || 'QR Code',
        tools: _t('moduleDisplayNameTools') || 'Tools',
        googleMigration: _t('moduleDisplayNameGoogleMigration') || 'Google Migration'
      };
      return displayNames[moduleName] || moduleName;
    }

    /**
     * 顯示載入Toast
     * @param {string} message - 提示訊息
     */
    function showLoadingToast(message) {
      let toast = document.getElementById('loadingToast');
      if (!toast) {
        toast = document.createElement('div');
        toast.id = 'loadingToast';
        toast.className = 'dialog-toast';
        toast.setAttribute('role', 'status');
        const spinner = document.createElement('div');
        spinner.className = 'dialog-spinner';
        spinner.setAttribute('aria-hidden', 'true');
        toast.appendChild(spinner);

        const text = document.createElement('span');
        text.textContent = message;
        toast.appendChild(text);

        document.body.appendChild(toast);
      } else {
        toast.querySelector('span').textContent = message;
        toast.style.display = 'flex';
      }
    }

    /**
     * 隱藏載入Toast
     */
    function hideLoadingToast() {
      const toast = document.getElementById('loadingToast');
      if (toast) {
        toast.style.display = 'none';
      }
    }

    // ========== 懶載入包裝函式 ==========

    /**
     * 建立懶載入包裝函式
     * @param {string} moduleName - 模組名稱
     * @param {string} functionName - 函式名稱
     * @param {boolean} returnsValue - 是否返回值
     * @returns {Function} 包裝後的函式
     */
    function createLazyWrapper(moduleName, functionName, returnsValue = false) {
      // 建立包裝函式
      const wrapper = async function(...args) {
        try {
          // 首次呼叫時載入模組
          await loadModule(moduleName);

          // 檢查函式是否已載入
          if (typeof window[functionName] === 'function' && window[functionName] !== wrapper) {
            // 呼叫實際的函式
            const result = window[functionName](...args);
            if (returnsValue) {
              return result;
            }
          } else {
            throw new Error(\`Function \${functionName} not found in module \${moduleName}\`);
          }
        } catch (error) {
          console.error(\`Failed to call \${functionName}:\`, error);
          const failMsg = (typeof t === 'function' ? t('moduleLoadFailed', { error: error.message }) : null) || ('Failed to load function: ' + error.message);
          showCenterToast('❌', failMsg);
        }
      };

      return wrapper;
    }

    // 匯入功能懶載入
    window.showImportModal = createLazyWrapper('import', 'showImportModal');
    window.hideImportModal = createLazyWrapper('import', 'hideImportModal');
    window.handleImportFile = createLazyWrapper('import', 'handleImportFile');
    window.autoPreviewImport = createLazyWrapper('import', 'autoPreviewImport');
    window.previewImport = createLazyWrapper('import', 'previewImport');
    window.executeImport = createLazyWrapper('import', 'executeImport');

    // 匯出功能懶載入
    window.exportAllSecrets = createLazyWrapper('export', 'exportAllSecrets');
    window.selectExportFormat = createLazyWrapper('export', 'selectExportFormat');
    window.showExportFormatModal = createLazyWrapper('export', 'showExportFormatModal');
    window.hideExportFormatModal = createLazyWrapper('export', 'hideExportFormatModal');

    // 備份管理懶載入
    window.loadBackupList = createLazyWrapper('backup', 'loadBackupList');
    window.loadMoreBackupList = createLazyWrapper('backup', 'loadMoreBackupList');
    window.showRestoreModal = createLazyWrapper('backup', 'showRestoreModal');
    window.hideRestoreModal = createLazyWrapper('backup', 'hideRestoreModal');
    window.selectBackupFromDropdown = createLazyWrapper('backup', 'selectBackupFromDropdown');
    window.exportSelectedBackup = createLazyWrapper('backup', 'exportSelectedBackup');
    window.selectBackupExportFormat = createLazyWrapper('backup', 'selectBackupExportFormat');
    window.showBackupExportFormatModal = createLazyWrapper('backup', 'showBackupExportFormatModal');
    window.hideBackupExportFormatModal = createLazyWrapper('backup', 'hideBackupExportFormatModal');

    // 工具集懶載入
    // 注意：showToolsModal 和 hideToolsModal 在 ui.js 核心模組中，不需要懶載入
    // 只有具體的工具函式需要懶載入
    window.showQRScanAndDecode = createLazyWrapper('tools', 'showQRScanAndDecode');
    window.showQRGenerateTool = createLazyWrapper('tools', 'showQRGenerateTool');
    window.showBase32Tool = createLazyWrapper('tools', 'showBase32Tool');
    window.showTimestampTool = createLazyWrapper('tools', 'showTimestampTool');
    window.showKeyCheckTool = createLazyWrapper('tools', 'showKeyCheckTool');
    window.showKeyGeneratorTool = createLazyWrapper('tools', 'showKeyGeneratorTool');
    window.showWebdavTool = createLazyWrapper('tools', 'showWebdavTool');
    window.showS3Tool = createLazyWrapper('tools', 'showS3Tool');
    window.showOneDriveTool = createLazyWrapper('tools', 'showOneDriveTool');
    window.showGoogleDriveTool = createLazyWrapper('tools', 'showGoogleDriveTool');
    window.showWebdavModal = createLazyWrapper('tools', 'showWebdavModal');
    window.showS3Modal = createLazyWrapper('tools', 'showS3Modal');
    window.showOneDriveModal = createLazyWrapper('tools', 'showOneDriveModal');
    window.showGoogleDriveModal = createLazyWrapper('tools', 'showGoogleDriveModal');

    // 二維碼功能懶載入
    window.showSecretQRCode = createLazyWrapper('qrcode', 'showSecretQRCode');
    window.showQRScanner = createLazyWrapper('qrcode', 'showQRScanner');
    window.hideQRScanner = createLazyWrapper('qrcode', 'hideQRScanner');
    window.stopQRScanner = createLazyWrapper('qrcode', 'stopQRScanner');
    window.showQRCode = createLazyWrapper('qrcode', 'showQRCode');

    // Google 遷移功能懶載入
    window.processGoogleMigration = createLazyWrapper('googleMigration', 'processGoogleMigration');
    window.showExportToGoogleModal = createLazyWrapper('googleMigration', 'showExportToGoogleModal');
    window.closeExportToGoogleModal = createLazyWrapper('googleMigration', 'closeExportToGoogleModal');
    window.selectAllExportSecrets = createLazyWrapper('googleMigration', 'selectAllExportSecrets');
    window.generateExportQRCodes = createLazyWrapper('googleMigration', 'generateExportQRCodes');
    window.showExportQRCodePage = createLazyWrapper('googleMigration', 'showExportQRCodePage');
    window.closeExportQRCodeModal = createLazyWrapper('googleMigration', 'closeExportQRCodeModal');
    window.showGoogleMigrationPreview = createLazyWrapper('googleMigration', 'showGoogleMigrationPreview');
    window.closeMigrationPreview = createLazyWrapper('googleMigration', 'closeMigrationPreview');
    window.confirmGoogleMigration = createLazyWrapper('googleMigration', 'confirmGoogleMigration');
    window.showImportResultModal = createLazyWrapper('googleMigration', 'showImportResultModal');
    window.closeImportResultModal = createLazyWrapper('googleMigration', 'closeImportResultModal');

    console.log('📦 模块懒加载系统已初始化');
  `;
}
