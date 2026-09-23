/**
 * 匯出模組 - UI 互動
 * 包含模態框顯示/隱藏等 UI 相關功能
 */

/**
 * 獲取匯出 UI 程式碼
 * @returns {string} JavaScript 程式碼
 */
export function getExportUICode() {
	return `
    // ========== 匯出 UI 模組 ==========

    // 匯出所有金鑰 - 顯示格式選擇
    function exportAllSecrets() {
      if (secrets.length === 0) {
        showCenterToast('❌', ((typeof t === 'function' ? t('noSecretsToExport') : null) || 'No secrets available to export'));
        return;
      }
      showExportFormatModal();
    }

    // 顯示匯出格式選擇模態框
    function showExportFormatModal() {
      showModal('exportFormatModal', () => {
        const exportCount = document.getElementById('exportCount');
        exportCount.textContent = secrets.length;
      });
    }

    // 隱藏匯出格式選擇模態框
    function hideExportFormatModal() {
      hideModal('exportFormatModal');
    }

    // 顯示二級格式選擇模態框
    function showSubFormatModal(multiFormatId) {
      const config = subFormatConfigs[multiFormatId];
      if (!config) {
        console.error('未找到格式配置:', multiFormatId);
        return;
      }

      const modal = document.getElementById('subFormatModal');
      const title = document.getElementById('subFormatTitle');
      const optionsContainer = document.getElementById('subFormatOptions');

      title.textContent = config.title;
      optionsContainer.innerHTML = '';

      config.options.forEach(opt => {
        const optionDiv = document.createElement('div');
        optionDiv.className = 'format-option';
        optionDiv.onclick = () => selectSubFormat(opt.id);
        optionDiv.innerHTML =
          '<div class="format-icon">' + opt.icon + '</div>' +
          '<div class="format-info">' +
          '  <div class="format-name">' + opt.name + ' <span class="format-ext">' + opt.ext + '</span></div>' +
          '  <div class="format-desc">' + opt.desc + '</div>' +
          '  <div class="format-compat">' + ((typeof t === 'function' ? t('compatPrefix') : null) || 'Compatible: ') + opt.compat + '</div>' +
          '</div>';
        optionsContainer.appendChild(optionDiv);
      });

      showModal('subFormatModal');
    }

    // 隱藏二級格式選擇模態框
    function hideSubFormatModal() {
      hideModal('subFormatModal');
    }

    // 選擇二級格式
    function selectSubFormat(formatId) {
      hideSubFormatModal();
      hideExportFormatModal();
      selectExportFormat(formatId);
    }

    // 顯示 FreeOTP 匯出模態框
    function showFreeOTPExportModal() {
      showModal('freeotpExportModal', () => {
        const passwordInput = document.getElementById('freeotpExportPassword');
        if (passwordInput) {
          passwordInput.value = '';
          passwordInput.focus();
        }
      });
    }

    // 隱藏 FreeOTP 匯出模態框
    function hideFreeOTPExportModal() {
      hideModal('freeotpExportModal');
    }

    // 顯示 TOTP Authenticator 匯出模態框
    function showTOTPAuthExportModal() {
      showModal('totpAuthExportModal', () => {
        const passwordInput = document.getElementById('totpAuthExportPassword');
        if (passwordInput) {
          passwordInput.value = '';
          passwordInput.focus();
        }
      });
    }

    // 隱藏 TOTP Authenticator 匯出模態框
    function hideTOTPAuthExportModal() {
      hideModal('totpAuthExportModal');
    }

    // 顯示匯出成功提示
    function showExportSuccess(count, format) {
      showCenterToast('✅', ((typeof t === 'function' ? t('exportSuccessWithCount', { count: count, format: format }) : null) || ('Exported ' + count + ' keys (' + format + ')')));
    }
`;
}
