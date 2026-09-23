/**
 * 金鑰生成器工具模組
 */

/**
 * 獲取金鑰生成器工具程式碼
 * @returns {string} 金鑰生成器工具 JavaScript 程式碼
 */
export function getKeyGeneratorToolCode() {
	return `
    // ==================== 金鑰生成器 ====================

    let currentKeyLength = 16;

    function showKeyGeneratorModal() {
      showModal('keyGeneratorModal', () => {
        // 設定預設長度
        setKeyLength(16);

        // 隱藏結果區域
        document.getElementById('keyResultSection').style.display = 'none';
      });
    }

    function hideKeyGeneratorModal() {
      hideModal('keyGeneratorModal');
    }

    function setKeyLength(length) {
      currentKeyLength = length;

      // 更新按鈕狀態 - 使用CSS類而不是內聯樣式
      const buttons = ['length16Btn', 'length26Btn', 'length32Btn'];
      const lengths = [16, 26, 32];

      buttons.forEach((btnId, index) => {
        const btn = document.getElementById(btnId);
        if (length === lengths[index]) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
    }

    function generateKey() {
      const key = generateRandomBase32Key(currentKeyLength);
      document.getElementById('generatedKeyText').textContent = key;
      document.getElementById('keyResultSection').style.display = 'block';
      showCenterToast('✅', (typeof t === 'function' ? t('keyGenSuccess') : null) || 'Secret generated successfully');
    }

    function generateRandomBase32Key(length) {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
      let result = '';
      for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    }

    async function copyGeneratedKey() {
      const key = document.getElementById('generatedKeyText').textContent;
      if (!key) {
        showCenterToast('❌', (typeof t === 'function' ? t('base32NoContentToCopy') : null) || 'No secret to copy');
        return;
      }

      try {
        await navigator.clipboard.writeText(key);
        showCenterToast('✅', (typeof t === 'function' ? t('keyGenCopied') : null) || 'Secret copied to clipboard');
      } catch (error) {
        showCenterToast('❌', (typeof t === 'function' ? t('copyFailed') : null) || 'Copy failed');
      }
    }

`;
}
