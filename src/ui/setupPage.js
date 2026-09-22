/**
 * 首次设置页面模块
 * 用于用户首次访问时设置管理员密码
 */

import { getSetupStyles } from './styles/setup.js';
import { dialogIcon } from './dialogIcons.js';
import { LOCALES } from './locales/index.js';

/**
 * 创建首次设置页面
 * @returns {Response} HTML响应
 */
export async function createSetupPage() {
	const setupLocales = {};
	for (const lang of ['en', 'zh-TW', 'zh-CN']) {
		setupLocales[lang] = {};
		for (const [k, v] of Object.entries(LOCALES[lang] || {})) {
			if (k.startsWith('setup')) {
				setupLocales[lang][k] = v;
			}
		}
	}

	const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>Initial Setup - 888 2FA Key Manager</title>

  <script>
    (function() {
      const themeMedia = window.matchMedia('(prefers-color-scheme: dark)');
      function applySetupTheme() {
        let theme = 'auto';
        try { theme = localStorage.getItem('theme') || 'auto'; } catch (e) { /* Use the system preference. */ }
        const dataTheme = (theme === 'dark' || (theme === 'auto' && themeMedia.matches)) ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', dataTheme);
      }
      applySetupTheme();
      if (themeMedia.addEventListener) themeMedia.addEventListener('change', applySetupTheme);
      else if (themeMedia.addListener) themeMedia.addListener(applySetupTheme);
      window.addEventListener('storage', function(event) {
        if (event.key === 'theme' || event.key === null) applySetupTheme();
      });
    })();
  </script>

  <style>
    ${getSetupStyles()}
  </style>
</head>
<body>
  <main class="setup-container">
    <div class="setup-header">
      <div class="setup-header-top">
        <div class="setup-icon" aria-hidden="true">${dialogIcon('lock')}</div>
        <div class="setup-lang-selector">
          <select id="setupLangSelect" class="setup-lang-select" aria-label="Language / 語言" onchange="changeSetupLanguage(this.value)">
            <option value="en" selected>English</option>
            <option value="zh-TW">繁體中文</option>
            <option value="zh-CN">简体中文</option>
          </select>
        </div>
      </div>
      <h1 class="setup-title" id="setupTitle">Set Admin Password</h1>
      <p class="setup-description" id="setupDescription">
        First time using 888 2FA, please set your master password.
      </p>
    </div>

    <div class="security-notice">
      <strong id="secNoticeTitle">Keep your password safe</strong>
      <span id="secNoticeDesc">Please set a strong password and save it securely. It is your only credential to manage your keys.</span>
    </div>

    <div id="insecureWarning" class="insecure-warning" style="display: none;">
      <strong id="insecureTitle">Currently Accessing via HTTP</strong>
      <span id="insecureDesc">Browsers cannot persist login sessions over HTTP. You will be asked for your password repeatedly after setup. Please change http:// to https:// in your address bar and reload.</span>
    </div>

    <div id="errorMessage" class="error-message" role="alert"></div>
    <div id="successMessage" class="success-message" role="status"></div>

    <form id="setupForm" onsubmit="handleSetup(event)">
      <div class="form-group">
        <label class="form-label" for="password" id="passwordLabel">Set Password</label>
        <div class="password-input-wrapper">
          <input
            type="password"
            id="password"
            class="form-input"
            placeholder="Enter password"
            autocomplete="new-password"
            aria-describedby="passwordRequirements"
            required
            oninput="checkPasswordStrength()"
          >
          <button type="button" class="toggle-password" id="togglePasswordBtn" onclick="togglePasswordVisibility('password')" title="Show password" aria-label="Show password" aria-controls="password" aria-pressed="false">
            ${dialogIcon('eye')}
          </button>
        </div>
        <div class="password-strength" id="passwordStrength" aria-hidden="true">
          <div class="password-strength-bar" id="passwordStrengthBar"></div>
        </div>
        <div class="password-requirements" id="passwordRequirements">
          <strong id="reqTitle">Password requirements:</strong>
          <ul>
            <li id="reqMinLength">At least 8 characters</li>
            <li id="reqUppercase">Contains uppercase letter (A-Z)</li>
            <li id="reqLowercase">Contains lowercase letter (a-z)</li>
            <li id="reqNumber">Contains number (0-9)</li>
            <li id="reqSpecial">Contains special character (e.g. !@#$%^&*)</li>
          </ul>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label" for="confirmPassword" id="confirmPasswordLabel">Confirm Password</label>
        <div class="password-input-wrapper">
          <input
            type="password"
            id="confirmPassword"
            class="form-input"
            placeholder="Re-enter password"
            autocomplete="new-password"
            required
          >
          <button type="button" class="toggle-password" id="toggleConfirmPasswordBtn" onclick="togglePasswordVisibility('confirmPassword')" title="Show password" aria-label="Show password" aria-controls="confirmPassword" aria-pressed="false">
            ${dialogIcon('eye')}
          </button>
        </div>
      </div>

      <button type="submit" class="submit-button" id="submitButton">
        Complete Setup
      </button>
    </form>
  </main>

  <script>
    const I18N = ${JSON.stringify(setupLocales)};
    let currentLang = 'en';

    function t(key) {
      return (I18N[currentLang] && I18N[currentLang][key]) || (I18N['en'] && I18N['en'][key]) || (I18N['zh-TW'] && I18N['zh-TW'][key]) || key;
    }

    function applySetupLanguage(lang) {
      currentLang = lang;
      document.documentElement.lang = lang;
      const select = document.getElementById('setupLangSelect');
      if (select) select.value = lang;

      document.title = t('setupPageTitle');
      const title = document.getElementById('setupTitle');
      if (title) title.textContent = t('setupHeaderTitle');
      const desc = document.getElementById('setupDescription');
      if (desc) desc.textContent = t('setupHeaderDesc');

      const secTitle = document.getElementById('secNoticeTitle');
      if (secTitle) secTitle.textContent = t('setupSecurityNoticeTitle');
      const secDesc = document.getElementById('secNoticeDesc');
      if (secDesc) secDesc.textContent = t('setupSecurityNoticeDesc');

      const insecTitle = document.getElementById('insecureTitle');
      if (insecTitle) insecTitle.textContent = t('setupInsecureTitle');
      const insecDesc = document.getElementById('insecureDesc');
      if (insecDesc) insecDesc.textContent = t('setupInsecureDesc');

      const passLabel = document.getElementById('passwordLabel');
      if (passLabel) passLabel.textContent = t('setupPasswordLabel');
      const passInput = document.getElementById('password');
      if (passInput) passInput.placeholder = t('setupPasswordPlaceholder');

      const reqTitle = document.getElementById('reqTitle');
      if (reqTitle) reqTitle.textContent = t('setupRequirementsTitle');
      const reqMin = document.getElementById('reqMinLength');
      if (reqMin) reqMin.textContent = t('setupReqMinLength');
      const reqUpper = document.getElementById('reqUppercase');
      if (reqUpper) reqUpper.textContent = t('setupReqUppercase');
      const reqLower = document.getElementById('reqLowercase');
      if (reqLower) reqLower.textContent = t('setupReqLowercase');
      const reqNum = document.getElementById('reqNumber');
      if (reqNum) reqNum.textContent = t('setupReqNumber');
      const reqSpec = document.getElementById('reqSpecial');
      if (reqSpec) reqSpec.textContent = t('setupReqSpecial');

      const confLabel = document.getElementById('confirmPasswordLabel');
      if (confLabel) confLabel.textContent = t('setupConfirmPasswordLabel');
      const confInput = document.getElementById('confirmPassword');
      if (confInput) confInput.placeholder = t('setupConfirmPasswordPlaceholder');

      const submitBtn = document.getElementById('submitButton');
      if (submitBtn && !submitBtn.disabled) submitBtn.textContent = t('setupSubmitBtn');

      updatePasswordButtonLabels('password', document.getElementById('togglePasswordBtn'));
      updatePasswordButtonLabels('confirmPassword', document.getElementById('toggleConfirmPasswordBtn'));
    }

    function updatePasswordButtonLabels(inputId, btn) {
      if (!btn) return;
      const input = document.getElementById(inputId);
      const isVisible = input && input.type === 'text';
      const label = isVisible ? t('setupHidePassword') : t('setupShowPassword');
      buttonAria(btn, isVisible, label);
    }

    function buttonAria(btn, isVisible, label) {
      btn.setAttribute('aria-pressed', String(isVisible));
      btn.setAttribute('aria-label', label);
      btn.title = label;
    }

    function changeSetupLanguage(lang) {
      if (!I18N[lang]) return;
      try {
        localStorage.setItem('language', lang);
      } catch (e) {}
      applySetupLanguage(lang);
    }

    (function initLang() {
      let lang = 'en';
      try {
        const saved = localStorage.getItem('language');
        if (saved && I18N[saved]) {
          lang = saved;
        } else {
          const langs = (Array.isArray(navigator.languages) && navigator.languages.length > 0)
            ? navigator.languages
            : [navigator.language || navigator.userLanguage || 'en'];
          for (const l of langs) {
            if (!l) continue;
            const lower = String(l).toLowerCase();
            if (lower.startsWith('en')) {
              lang = 'en';
              break;
            }
            if (lower.startsWith('zh-tw') || lower.startsWith('zh-hk') || lower.startsWith('zh-mo') || lower.includes('hant') || lower === 'zh') {
              lang = 'zh-TW';
              break;
            }
            if (lower.startsWith('zh-cn') || lower.startsWith('zh-sg') || lower.includes('hans')) {
              lang = 'zh-CN';
              break;
            }
          }
        }
      } catch (e) {}
      applySetupLanguage(lang);
    })();

    // 检测不安全上下文：HTTP 下浏览器无法保存 Secure Cookie，登录状态无法保持
    (function() {
      let insecure;
      if (typeof window.isSecureContext === 'boolean') {
        insecure = !window.isSecureContext;
      } else {
        const localHosts = ['localhost', '127.0.0.1', '[::1]'];
        insecure = location.protocol === 'http:' && !localHosts.includes(location.hostname);
      }
      if (insecure) {
        document.getElementById('insecureWarning').style.display = 'block';
      }
    })();

    // 切换密码可见性
    function togglePasswordVisibility(inputId) {
      const input = document.getElementById(inputId);
      const button = input.nextElementSibling;

      const visible = input.type === 'password';
      input.type = visible ? 'text' : 'password';
      button.innerHTML = visible ? '${dialogIcon('eye-off')}' : '${dialogIcon('eye')}';
      const label = visible ? t('setupHidePassword') : t('setupShowPassword');
      buttonAria(button, visible, label);
    }

    // 检查密码强度
    function checkPasswordStrength() {
      const password = document.getElementById('password').value;
      const strengthBar = document.getElementById('passwordStrengthBar');

      let strength = 0;

      // 检查长度
      if (password.length >= 8) strength++;
      if (password.length >= 12) strength++;

      // 检查复杂性
      if (/[a-z]/.test(password)) strength++;
      if (/[A-Z]/.test(password)) strength++;
      if (/[0-9]/.test(password)) strength++;
      if (/[^A-Za-z0-9]/.test(password)) strength++;

      // 更新进度条
      strengthBar.className = 'password-strength-bar';
      if (strength <= 2) {
        strengthBar.classList.add('strength-weak');
      } else if (strength <= 4) {
        strengthBar.classList.add('strength-medium');
      } else {
        strengthBar.classList.add('strength-strong');
      }
    }

    // 显示错误消息
    function showError(message) {
      const errorDiv = document.getElementById('errorMessage');
      errorDiv.textContent = message;
      errorDiv.style.display = 'block';

      // 5秒后自动隐藏
      setTimeout(() => {
        errorDiv.style.display = 'none';
      }, 5000);
    }

    // 显示成功消息
    function showSuccess(message) {
      const successDiv = document.getElementById('successMessage');
      successDiv.textContent = message;
      successDiv.style.display = 'block';
    }

    // 处理表单提交
    async function handleSetup(event) {
      event.preventDefault();

      const password = document.getElementById('password').value;
      const confirmPassword = document.getElementById('confirmPassword').value;
      const submitButton = document.getElementById('submitButton');

      // 验证密码
      if (password !== confirmPassword) {
        showError(t('setupErrMismatch'));
        return;
      }

      // 验证密码强度
      if (password.length < 8) {
        showError(t('setupErrLength'));
        return;
      }

      if (!/[A-Z]/.test(password)) {
        showError(t('setupErrUppercase'));
        return;
      }

      if (!/[a-z]/.test(password)) {
        showError(t('setupErrLowercase'));
        return;
      }

      if (!/[0-9]/.test(password)) {
        showError(t('setupErrNumber'));
        return;
      }

      if (!/[^A-Za-z0-9]/.test(password)) {
        showError(t('setupErrSpecial'));
        return;
      }

      // 禁用按钮，显示加载状态
      submitButton.disabled = true;
      submitButton.innerHTML = '<span class="loading-spinner"></span>' + t('setupSubmitting');

      try {
        const response = await fetch('/api/setup', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            password: password,
            confirmPassword: confirmPassword
          })
        });

        const data = await response.json();

        if (response.ok) {
          showSuccess(data.message || t('setupSuccess'));

          // 2秒后跳转到主页
          setTimeout(() => {
            window.location.href = '/';
          }, 2000);
        } else {
          showError(data.message || t('setupErrFailed'));
          submitButton.disabled = false;
          submitButton.textContent = t('setupSubmitBtn');
        }
      } catch (error) {
        console.error('设置失败:', error);
        showError(t('setupErrNetwork'));
        submitButton.disabled = false;
        submitButton.textContent = t('setupSubmitBtn');
      }
    }
  </script>
</body>
</html>`;

	return new Response(html, {
		headers: {
			'Content-Type': 'text/html; charset=utf-8',
			'Cache-Control': 'no-cache, no-store, must-revalidate',
			Pragma: 'no-cache',
			Expires: '0',
		},
	});
}
