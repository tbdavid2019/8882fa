/**
 * 金鑰檢查器工具模組
 */

/**
 * 獲取金鑰檢查器工具程式碼
 * @returns {string} 金鑰檢查器工具 JavaScript 程式碼
 */
export function getKeyCheckerToolCode() {
	return `
    // ==================== 金鑰檢查器 ====================

    function showKeyCheckModal() {
      showModal('keyCheckModal', () => {
        document.getElementById('keyCheckInput').value = '';
        document.getElementById('keyCheckResult').style.display = 'none';
      });
    }

    function hideKeyCheckModal() {
      hideModal('keyCheckModal');
    }

    function checkSecret() {
      const secret = document.getElementById('keyCheckInput').value.trim().toUpperCase();
      if (!secret) {
        showCenterToast('❌', (typeof t === 'function' ? t('keyCheckerEnterKey') : null) || 'Please enter a key to check');
        return;
      }

      const result = validateSecretFormat(secret);
      displayCheckResult(result);
    }

    function validateSecretFormat(secret) {
      const result = {
        isValid: false,
        length: secret.length,
        lengthValid: false,
        charsetValid: false,
        paddingValid: false,
        suggestions: []
      };

      // 檢查長度
      result.lengthValid = secret.length >= 8;
      if (!result.lengthValid) {
        result.suggestions.push((typeof t === 'function' ? t('keyCheckerLengthSuggestion') : null) || 'Key length must be at least 8 characters');
      }

      // 檢查字元集
      const base32Regex = /^[A-Z2-7]+=*$/;
      result.charsetValid = base32Regex.test(secret);
      if (!result.charsetValid) {
        result.suggestions.push((typeof t === 'function' ? t('keyCheckerCharsetSuggestion') : null) || 'Can only contain characters A-Z and 2-7');
      }

      // 檢查填充
      const withoutPadding = secret.replace(/=+$/, '');
      const paddingLength = secret.length - withoutPadding.length;
      result.paddingValid = paddingLength === 0 || paddingLength <= 6;
      if (!result.paddingValid) {
        result.suggestions.push((typeof t === 'function' ? t('keyCheckerPaddingSuggestion') : null) || 'Padding characters (=) cannot exceed 6');
      }

      // 檢查長度是否為8的倍數（考慮填充）
      const totalLength = withoutPadding.length + paddingLength;
      if (totalLength % 8 !== 0) {
        result.suggestions.push((typeof t === 'function' ? t('keyCheckerMultipleSuggestion') : null) || 'Total length after padding must be a multiple of 8');
      }

      // 整體有效性
      result.isValid = result.lengthValid && result.charsetValid && result.paddingValid;

      return result;
    }

    function displayCheckResult(result) {
      const resultDiv = document.getElementById('checkResultContent');
      const resultSection = document.getElementById('keyCheckResult');

      const validText = result.isValid ? ((typeof t === 'function' ? t('keyCheckerValid') : null) || 'Secret is valid') : ((typeof t === 'function' ? t('keyCheckerInvalid') : null) || 'Secret is invalid');
      const lengthReqText = result.lengthValid ? ((typeof t === 'function' ? t('keyCheckerMeetsReq') : null) || '(Meets requirements)') : ((typeof t === 'function' ? t('keyCheckerNotMeetsReq') : null) || '(Does not meet requirements)');
      const charsetText = result.charsetValid ? ((typeof t === 'function' ? t('keyCheckerBase32Ok') : null) || 'Compliant with Base32 specification') : ((typeof t === 'function' ? t('keyCheckerBase32Bad') : null) || 'Contains illegal characters');
      const paddingText = result.paddingValid ? ((typeof t === 'function' ? t('keyCheckerPaddingOk') : null) || 'Padding correct') : ((typeof t === 'function' ? t('keyCheckerPaddingBad') : null) || 'Padding incorrect');
      const lengthLabel = (typeof t === 'function' ? t('keyCheckerLengthLabel') : null) || 'Length:';
      const charsetLabel = (typeof t === 'function' ? t('keyCheckerCharsetLabel') : null) || 'Charset:';
      const paddingLabel = (typeof t === 'function' ? t('keyCheckerPaddingLabel') : null) || 'Padding:';
      const charsText = (typeof t === 'function' ? t('keyCheckerChars', { length: result.length }) : null) || (result.length + ' chars');

      let html = '<div style="display: flex; align-items: center; margin-bottom: 15px;">' +
        '<span style="font-size: var(--dialog-section-size); margin-right: 10px;">' + dialogIcon(result.isValid ? 'check' : 'error') + '</span>' +
        '<span style="font-size: var(--dialog-section-size); font-weight: 600; color: ' + (result.isValid ? 'var(--dialog-success)' : 'var(--dialog-danger)') + ';">' + validText + '</span>' +
        '</div>' +
        '<div style="margin-bottom: 15px;">' +
        '<div style="display: flex; justify-content: space-between; margin-bottom: 8px;">' +
        '<span style="font-weight: 600;">' + lengthLabel + '</span>' +
        '<span style="color: ' + (result.lengthValid ? 'var(--dialog-success)' : 'var(--dialog-danger)') + ';">' + charsText + ' ' + lengthReqText + '</span>' +
        '</div>' +
        '<div style="display: flex; justify-content: space-between; margin-bottom: 8px;">' +
        '<span style="font-weight: 600;">' + charsetLabel + '</span>' +
        '<span style="color: ' + (result.charsetValid ? 'var(--dialog-success)' : 'var(--dialog-danger)') + ';">' + charsetText + '</span>' +
        '</div>' +
        '<div style="display: flex; justify-content: space-between;">' +
        '<span style="font-weight: 600;">' + paddingLabel + '</span>' +
        '<span style="color: ' + (result.paddingValid ? 'var(--dialog-success)' : 'var(--dialog-danger)') + ';">' + paddingText + '</span>' +
        '</div>' +
        '</div>';

      if (!result.isValid && result.suggestions.length > 0) {
        const suggestionsTitle = (typeof t === 'function' ? t('keyCheckerSuggestionsTitle') : null) || 'Suggestions:';
        html += '<div style="margin-top: 15px; padding: 10px; background: var(--dialog-warning-bg); border-radius: 6px;">' +
          '<div style="font-weight: 600; margin-bottom: 8px; color: var(--dialog-warning);">' + suggestionsTitle + '</div>' +
          '<div style="font-size: var(--dialog-caption-size); color: var(--dialog-warning);">' +
          result.suggestions.map(suggestion => '• ' + suggestion).join('<br>') +
          '</div>' +
          '</div>';
      }

      resultDiv.innerHTML = html;
      resultSection.style.display = 'block';
    }


`;
}
