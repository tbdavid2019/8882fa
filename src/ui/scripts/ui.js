/**
 * UI 互動模組
 * 包含 Toast 提示、主題切換、模態框管理、滾動控制等 UI 互動功能
 */

/**
 * 獲取 UI 互動相關程式碼
 * @returns {string} UI JavaScript 程式碼
 */
export function getUICode() {
	return `    // ========== UI 互動模組 ==========

    // Browsers can retain :focus-visible when a keyboard-focused button is
    // clicked again. Track input changes without blurring the current control.
    document.addEventListener('pointerdown', function() {
      document.documentElement.setAttribute('data-card-input', 'pointer');
    }, true);
    document.addEventListener('keydown', function(event) {
      if (!event.ctrlKey && !event.metaKey && !event.altKey) {
        document.documentElement.removeAttribute('data-card-input');
      }
    }, true);

    // Toast 提示相關變數
    let toastTimeout = null;
    let isToastVisible = false;
    let lastToastTime = 0;

    // 顯示中間提示
    function showCenterToast(icon, message) {
      const now = Date.now();

      // 防止過於頻繁的toast呼叫（至少間隔100ms）
      if (now - lastToastTime < 100) {
        return;
      }
      lastToastTime = now;
      const toast = document.getElementById('centerToast');
      const iconElement = toast.querySelector('.toast-icon');
      const messageElement = toast.querySelector('.toast-message');

      // 如果當前有toast正在顯示，先清除之前的定時器
      if (toastTimeout) {
        clearTimeout(toastTimeout);
        toastTimeout = null;
      }

      // 更新內容
      const feedbackIcon = icon === '✅' ? 'check' : icon === '❌' ? 'error' : icon === '⚠️' ? 'warning' : 'info';
      iconElement.innerHTML = dialogIcon(feedbackIcon);
      messageElement.textContent = message;

      // 如果toast已經顯示，先隱藏再顯示，確保動畫效果
      if (isToastVisible) {
        toast.classList.remove('show');
        // 等待隱藏動畫完成後再顯示新的toast
        setTimeout(() => {
          toast.classList.add('show');
          isToastVisible = true;

          // 設定新的定時器
          toastTimeout = setTimeout(() => {
            toast.classList.remove('show');
            isToastVisible = false;
            toastTimeout = null;
          }, 2000);
        }, 125); // 等待隐藏动画的一半时间 (0.25s / 2)
      } else {
        // 直接顯示toast
        toast.classList.add('show');
        isToastVisible = true;

        // 設定定時器
        toastTimeout = setTimeout(() => {
          toast.classList.remove('show');
          isToastVisible = false;
          toastTimeout = null;
        }, 2000);
      }
    }

    // Keep a single active change so an older cleanup cannot interrupt a newer fade.
    let themeChange = null;

    // 應用主題（支援過渡動畫）
    function applyTheme(theme, withTransition = false) {
      const root = document.documentElement;
      const nextTheme = theme === 'dark' || (theme !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches)
        ? 'dark' : 'light';
      if (nextTheme === (themeChange ? themeChange.theme : root.getAttribute('data-theme'))) {
        updateQuickThemeToggle(nextTheme);
        return;
      }

      const animate = withTransition && !document.hidden && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      // Only visible cards and group headings need a fade. Offscreen transitions
      // otherwise keep style/paint work running throughout the transition.
      // Read bounds BEFORE removing existing transition styles. A layout read
      // between removal and reapplication would finish the old fade immediately,
      // making a rapid reversal jump to the previous target color first.
      const surfaces = animate ? Array.from(document.querySelectorAll('.secret-card, .service-group-header')).filter(surface => {
        const rect = surface.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0 &&
          rect.top < window.innerHeight && rect.left < window.innerWidth;
      }) : [];

      const previous = themeChange;
      themeChange = null;
      if (previous) {
        if (previous.timer !== null) clearTimeout(previous.timer);
        if (previous.frame !== null) cancelAnimationFrame(previous.frame);
        previous.surfaces.forEach(surface => surface.classList.remove('theme-viewport-transition'));
      }
      root.classList.remove('theme-transition', 'theme-instant');
      surfaces.forEach(surface => surface.classList.add('theme-viewport-transition'));
      const change = { theme: nextTheme, timer: null, frame: null, surfaces };
      themeChange = change;
      const finish = () => {
        if (themeChange !== change) return;
        themeChange = null;
        surfaces.forEach(surface => surface.classList.remove('theme-viewport-transition'));
        root.classList.remove('theme-transition', 'theme-instant');
      };
      const afterPaint = (callback) => {
        change.frame = requestAnimationFrame(() => {
          if (themeChange !== change) return;
          change.frame = requestAnimationFrame(() => {
            change.frame = null;
            if (themeChange === change) callback();
          });
        });
      };

      root.classList.add(animate ? 'theme-transition' : 'theme-instant');
      root.setAttribute('data-theme', nextTheme);
      updateQuickThemeToggle(nextTheme);
      // Start cleanup after styles have painted, with a small margin over 180ms.
      afterPaint(() => {
        if (animate) change.timer = setTimeout(finish, 220);
        else finish();
      });
    }

    function updateQuickThemeToggle(theme) {
      const button = document.getElementById('quickThemeToggle');
      if (!button) return;
      const isDark = theme === 'dark';
      button.setAttribute('data-current-theme', isDark ? 'dark' : 'light');
      const labelKey = isDark ? 'themeLight' : 'themeDark';
      const label = document.getElementById('quickThemeLabel');
      if (label) {
        label.setAttribute('data-i18n', labelKey);
        label.textContent = typeof t === 'function' ? t(labelKey) : labelKey;
      }
      button.setAttribute('data-i18n-title', labelKey);
      button.setAttribute('title', typeof t === 'function' ? t(labelKey) : labelKey);
      button.setAttribute('data-i18n-aria-label', labelKey);
      button.setAttribute('aria-label', typeof t === 'function' ? t(labelKey) : labelKey);
      const icon = document.getElementById('quickThemeIcon');
      if (icon) {
        icon.innerHTML = isDark
          ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"></path></svg>'
          : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6.5 6.5 0 0 0 8.268 8.268c.344-.215.825-.003.803.401"></path></svg>';
      }
    }

    function toggleQuickTheme() {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
      localStorage.setItem('theme', nextTheme);
      document.querySelectorAll('input[name="settingsTheme"]').forEach(radio => {
        radio.checked = radio.value === nextTheme;
      });
      applyTheme(nextTheme, true);
    }

    function initTheme() {
      // 主題已在 head 內聯指令碼中應用，這裡僅監聽系統主題變化
      updateQuickThemeToggle(document.documentElement.getAttribute('data-theme'));
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        const currentTheme = localStorage.getItem('theme') || 'auto';
        if (currentTheme === 'auto') {
          applyTheme('auto', true);
        }
      });
    }

    // 模態框管理
    function hideQRModal() {
      const modal = document.getElementById('qrModal');
      if (!modal || !modal.classList.contains('show')) return;
      modal.classList.remove('show');
      setTimeout(() => modal.style.display = 'none', 300);
      enableBodyScroll();
    }

    function showAddModal() {
      showModal('secretModal', () => {
        editingId = null;
        document.getElementById('modalTitle').textContent = (typeof t === 'function' ? t('addSecretTitle') : null) || 'Add Key';
        document.getElementById('submitBtn').textContent = (typeof t === 'function' ? t('save') : null) || 'Save';
        document.getElementById('secretForm').reset();
        document.getElementById('secretId').value = '';
      });
    }

    // 隱藏新增/編輯金鑰模態框
    function hideSecretModal() {
      const modal = document.getElementById('secretModal');
      if (!modal || !modal.classList.contains('show')) return;
      modal.classList.remove('show');
      setTimeout(() => modal.style.display = 'none', 300);
      enableBodyScroll();
    }

    // 實用工具相關函式
    function showToolsModal() {
      showModal('toolsModal');
    }

    function hideToolsModal() {
      hideModal('toolsModal');
    }

    // 設定模態框相關函式
    function showSettingsModal() {
      showModal('settingsModal', () => {
        // 重置到第一個標籤頁
        switchSettingsTab('security');
      });
    }

    function hideSettingsModal() {
      hideModal('settingsModal');
    }

    // 摺疊式選單控制函式
    function toggleActionMenu() {
      // 剛剛結束拖拽時忽略本次點選，避免拖完立刻彈選單
      if (fabDragJustHappened) return;
      const mainBtn = document.getElementById('mainActionBtn');
      const submenu = document.getElementById('actionSubmenu');
      const overlay = document.getElementById('menuOverlay');

      const isActive = mainBtn.classList.contains('active');

      if (isActive) {
        closeActionMenu();
      } else {
        openActionMenu();
      }
    }

    function openActionMenu() {
      const mainBtn = document.getElementById('mainActionBtn');
      const submenu = document.getElementById('actionSubmenu');
      const overlay = document.getElementById('menuOverlay');

      mainBtn.classList.add('active');
      mainBtn.setAttribute('aria-expanded', 'true');
      submenu.classList.add('show');
      overlay.classList.add('show');

      // 根據 FAB 當前位置調整子選單展開方向，避免溢位視口
      updateSubmenuDirection();

      // 防止點選事件冒泡
      if (typeof event !== 'undefined' && event && typeof event.stopPropagation === 'function') {
        event.stopPropagation();
      }
    }

    function closeActionMenu() {
      const mainBtn = document.getElementById('mainActionBtn');
      const submenu = document.getElementById('actionSubmenu');
      const overlay = document.getElementById('menuOverlay');

      mainBtn.classList.remove('active');
      mainBtn.setAttribute('aria-expanded', 'false');
      submenu.classList.remove('show');
      overlay.classList.remove('show');
    }

    // 進階選項切換函式
    function toggleAdvancedOptions() {
      const checkbox = document.getElementById('showAdvanced');
      const options = document.getElementById('advancedOptions');

      if (checkbox.checked) {
        options.style.display = 'block';
        updateAdvancedOptionsForType(); // 根据当前类型调整UI
      } else {
        options.style.display = 'none';
      }
    }

    // 根據OTP型別更新進階選項UI
    function updateAdvancedOptionsForType() {
      const typeSelect = document.getElementById('secretType');
      const digitsGroup = document.getElementById('digitsGroup');
      const periodGroup = document.getElementById('periodGroup');
      const algorithmGroup = document.getElementById('algorithmGroup');
      const counterRow = document.getElementById('counterRow');
      const advancedInfo = document.getElementById('advancedInfo');
      const digitsSelect = document.getElementById('secretDigits');
      const periodSelect = document.getElementById('secretPeriod');
      const algorithmSelect = document.getElementById('secretAlgorithm');

      const selectedType = typeSelect.value;

      switch (selectedType) {
        case 'HOTP':
          // HOTP: 顯示位數、演算法、計數器，隱藏週期
          digitsGroup.style.display = 'block';
          periodGroup.style.display = 'none';
          algorithmGroup.style.display = 'block';
          counterRow.style.display = 'block';
          advancedInfo.textContent = (typeof t === 'function' ? t('secretAdvancedHotpHelp') : null) || 'HOTP uses a counter basis; counter increments automatically after each generation';
          break;

        case 'TOTP':
        default:
          // TOTP: 顯示位數、週期、演算法，隱藏計數器
          digitsGroup.style.display = 'block';
          periodGroup.style.display = 'block';
          algorithmGroup.style.display = 'block';
          counterRow.style.display = 'none';
          advancedInfo.textContent = (typeof t === 'function' ? t('secretAdvancedHelp') : null) || 'Most 2FA apps use default settings: TOTP, 6 digits, 30s, SHA1 algorithm';
          break;
      }
    }

    // ESC鍵關閉選單
    document.addEventListener('keydown', function(event) {
      if (event.key === 'Escape') {
        closeActionMenu();
      }
    });

    // ========== FAB 拖拽：右下角"+"按鈕可拖動並記住位置 ==========
    const FAB_POSITION_STORAGE_KEY = '2fa-fab-position';
    let fabDragJustHappened = false;

    function loadFABPosition() {
      try {
        const raw = localStorage.getItem(FAB_POSITION_STORAGE_KEY);
        if (!raw) return null;
        const pos = JSON.parse(raw);
        if (pos && Number.isFinite(pos.x) && Number.isFinite(pos.y)) return pos;
      } catch (e) {}
      return null;
    }

    function saveFABPosition(x, y) {
      try {
        localStorage.setItem(FAB_POSITION_STORAGE_KEY, JSON.stringify({ x: x, y: y }));
      } catch (e) {}
    }

    function clampFABPosition(x, y, w, h) {
      const margin = 8;
      const vw = window.innerWidth || document.documentElement.clientWidth;
      const vh = window.innerHeight || document.documentElement.clientHeight;
      const maxX = Math.max(margin, vw - w - margin);
      const maxY = Math.max(margin, vh - h - margin);
      const clampedX = Math.min(Math.max(x, margin), maxX);
      const clampedY = Math.min(Math.max(y, margin), maxY);
      const headerControls = document.querySelector('.search-action-row');
      if (headerControls) {
        const controlsRect = headerControls.getBoundingClientRect();
        const overlapsHeader =
          clampedX < controlsRect.right + margin &&
          clampedX + w > controlsRect.left - margin &&
          clampedY < controlsRect.bottom + margin &&
          clampedY + h > controlsRect.top - margin;
        if (overlapsHeader) {
          // Move only as far as needed to clear the controls; never reset to the bottom.
          const candidates = [
            { x: clampedX, y: controlsRect.bottom + margin },
            { x: clampedX, y: controlsRect.top - h - margin },
            { x: controlsRect.left - w - margin, y: clampedY },
            { x: controlsRect.right + margin, y: clampedY }
          ].filter(pos => pos.x >= margin && pos.x <= maxX && pos.y >= margin && pos.y <= maxY);
          if (candidates.length) {
            return candidates.reduce((nearest, pos) =>
              Math.hypot(pos.x - clampedX, pos.y - clampedY) < Math.hypot(nearest.x - clampedX, nearest.y - clampedY)
                ? pos : nearest
            );
          }
        }
      }
      return {
        x: clampedX,
        y: clampedY
      };
    }

    function applyFABPosition(x, y) {
      const fab = document.querySelector('.action-menu-float');
      if (!fab) return null;
      const w = fab.offsetWidth || 48;
      const h = fab.offsetHeight || 48;
      const c = clampFABPosition(x, y, w, h);
      fab.style.left = c.x + 'px';
      fab.style.top = c.y + 'px';
      fab.style.right = 'auto';
      fab.style.bottom = 'auto';
      return c;
    }

    // 根據 FAB 位置自適應子選單展開方向（上/下、左/右）
    function updateSubmenuDirection() {
      const fab = document.querySelector('.action-menu-float');
      const submenu = document.getElementById('actionSubmenu');
      if (!fab || !submenu) return;
      const fabRect = fab.getBoundingClientRect();
      const submenuW = submenu.offsetWidth || 180;
      const submenuH = submenu.offsetHeight || 350;
      const gap = 12;

      // 垂直方向：上方空間足夠時向上展開（保持預設行為），否則向下
      if (fabRect.top >= submenuH + gap) {
        submenu.style.top = 'auto';
        submenu.style.bottom = (fabRect.height + gap) + 'px';
      } else {
        submenu.style.bottom = 'auto';
        submenu.style.top = (fabRect.height + gap) + 'px';
      }

      // 水平方向：預設右對齊；FAB 偏左導致溢位時改為左對齊
      if (fabRect.right >= submenuW + 4) {
        submenu.style.right = '0';
        submenu.style.left = 'auto';
      } else {
        submenu.style.right = 'auto';
        submenu.style.left = '0';
      }
    }

    function initFABDrag() {
      const fab = document.querySelector('.action-menu-float');
      const btn = document.getElementById('mainActionBtn');
      if (!fab || !btn) return;

      // 移除預注入的 FOUC 防閃 style（用了 !important，會勝過下方的 inline style）
      const initStyle = document.getElementById('fab-init-position');
      if (initStyle && initStyle.parentNode) {
        initStyle.parentNode.removeChild(initStyle);
      }

      // 還原上次儲存的位置
      const saved = loadFABPosition();
      if (saved) {
        const restored = applyFABPosition(saved.x, saved.y);
        if (restored && (restored.x !== saved.x || restored.y !== saved.y)) {
          saveFABPosition(restored.x, restored.y);
        }
      }

      let dragging = false;
      let moved = false;
      let startPx = 0;
      let startPy = 0;
      let startFx = 0;
      let startFy = 0;
      const DRAG_THRESHOLD = 5;
      let dragClickSuppressTimer = null;

      function getPoint(e) {
        if (e.touches && e.touches[0]) return e.touches[0];
        if (e.changedTouches && e.changedTouches[0]) return e.changedTouches[0];
        return e;
      }

      function onDown(e) {
        if (e.button !== undefined && e.button !== 0) return;
        const p = getPoint(e);
        const rect = fab.getBoundingClientRect();
        dragging = true;
        moved = false;
        startPx = p.clientX;
        startPy = p.clientY;
        startFx = rect.left;
        startFy = rect.top;
        fab.classList.add('dragging');
      }

      function onMove(e) {
        if (!dragging) return;
        const p = getPoint(e);
        const dx = p.clientX - startPx;
        const dy = p.clientY - startPy;
        if (!moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
        if (!moved) {
          moved = true;
          // 一旦判定為拖動，關閉已展開的選單
          const submenu = document.getElementById('actionSubmenu');
          if (submenu && submenu.classList.contains('show')) {
            closeActionMenu();
          }
        }
        if (e.cancelable) e.preventDefault();
        applyFABPosition(startFx + dx, startFy + dy);
      }

      function onUp(e) {
        if (!dragging) return;
        dragging = false;
        fab.classList.remove('dragging');
        if (moved) {
          const rect = fab.getBoundingClientRect();
          saveFABPosition(rect.left, rect.top);
          // 觸控結束時阻止瀏覽器合成 click，避免拖完立刻彈選單
          if (e && e.cancelable && e.type && e.type.indexOf('touch') === 0) {
            e.preventDefault();
          }
          // 對滑鼠場景：通過下方 capture-phase click 守衛攔截即將到來的 click
          fabDragJustHappened = true;
          // 500ms 兜底超時，避免標誌位被卡住
          if (dragClickSuppressTimer) clearTimeout(dragClickSuppressTimer);
          dragClickSuppressTimer = setTimeout(function() {
            fabDragJustHappened = false;
            dragClickSuppressTimer = null;
          }, 500);
        }
      }

      btn.addEventListener('mousedown', onDown);
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);

      btn.addEventListener('touchstart', onDown, { passive: true });
      document.addEventListener('touchmove', onMove, { passive: false });
      document.addEventListener('touchend', onUp);
      document.addEventListener('touchcancel', onUp);

      // capture-phase 攔截拖拽結束後第一個 click，保證不會誤觸選單
      document.addEventListener('click', function(e) {
        if (!fabDragJustHappened || !fab.contains(e.target)) {
          return;
        }
        fabDragJustHappened = false;
        if (dragClickSuppressTimer) {
          clearTimeout(dragClickSuppressTimer);
          dragClickSuppressTimer = null;
        }
        e.stopPropagation();
        e.preventDefault();
      }, true);

      // 視窗尺寸變化時重新約束位置，並把約束後的座標寫回 storage，
      // 保證下次進入顯示的位置與上次可見狀態一致
      window.addEventListener('resize', function() {
        if (fab.style.left || fab.style.top) {
          const rect = fab.getBoundingClientRect();
          const next = applyFABPosition(rect.left, rect.top);
          if (next) saveFABPosition(next.x, next.y);
        }
      });
    }
`;
}
