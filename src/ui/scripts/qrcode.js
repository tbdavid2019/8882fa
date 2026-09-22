/**
 * 二维码模块
 * 包含所有二维码生成、扫描和处理功能
 */

/**
 * 获取二维码相关代码
 * @returns {string} 二维码 JavaScript 代码
 */
export function getQRCodeCode() {
	return `    // ========== 二维码功能模块 ==========

    // 连续扫描模式状态
    let continuousScanMode = false;
    let continuousScanCount = 0;

    // 切换连续扫描模式
    function toggleContinuousScan() {
      const toggle = document.getElementById('continuousScanToggle');
      continuousScanMode = toggle.checked;

      // 更新计数器显示
      const counter = document.getElementById('scanCounter');
      if (continuousScanMode) {
        counter.style.display = 'block';
      } else {
        counter.style.display = 'none';
        continuousScanCount = 0;
        document.getElementById('scanCountNum').textContent = '0';
      }

      console.log('连续扫描模式:', continuousScanMode ? '开启' : '关闭');
    }

    // 更新扫描计数
    function updateScanCount() {
      continuousScanCount++;
      document.getElementById('scanCountNum').textContent = continuousScanCount;
    }

    // 显示二维码
    function showQRCode(secretId) {
      console.log('showQRCode called with secretId:', secretId);
      const secret = secrets.find(s => s.id === secretId);
      if (!secret) {
        console.log('Secret not found for id:', secretId);
        return;
      }
      console.log('Found secret:', secret.name);

      const serviceName = secret.name.trim();
      const accountName = secret.account ? secret.account.trim() : '';

      let label;
      if (accountName) {
        label = encodeURIComponent(serviceName) + ':' + encodeURIComponent(accountName);
      } else {
        label = encodeURIComponent(serviceName);
      }

      // 根据类型构建不同的参数
      const type = secret.type || 'TOTP';
      let params;

      switch (type.toUpperCase()) {
        case 'HOTP':
          params = new URLSearchParams({
            secret: secret.secret.toUpperCase(),
            issuer: serviceName,
            algorithm: secret.algorithm || 'SHA1',
            digits: (secret.digits || 6).toString(),
            counter: (secret.counter || 0).toString()
          });
          break;
        case 'TOTP':
        default:
          params = new URLSearchParams({
            secret: secret.secret.toUpperCase(),
            issuer: serviceName,
            algorithm: secret.algorithm || 'SHA1',
            digits: (secret.digits || 6).toString(),
            period: (secret.period || 30).toString()
          });
          break;
      }

      // 根据类型选择正确的scheme
      const scheme = type.toUpperCase() === 'HOTP' ? 'hotp' : 'totp';
      currentOTPAuthURL = 'otpauth://' + scheme + '/' + label + '?' + params.toString();

      document.getElementById('qrTitle').textContent = secret.name + ' ' + ((typeof t === 'function' ? t('qrCode') : null) || 'QR Code');
      document.getElementById('qrSubtitle').textContent = secret.account ?
        ((typeof t === 'function' ? t('qrModalSubtitleAccount', { account: secret.account }) : null) || ('Account: ' + secret.account)) :
        ((typeof t === 'function' ? t('qrModalSubtitleDefault') : null) || 'Scan this QR code to import into other 2FA apps');

      generateQRCodeForModal(currentOTPAuthURL);
      const modal = document.getElementById('qrModal');
      modal.style.display = 'flex';
      setTimeout(() => modal.classList.add('show'), 10);
      disableBodyScroll();
    }

    // 为模态框生成二维码
    async function generateQRCodeForModal(text) {
      const container = document.querySelector('.qr-code-container');
      container.innerHTML = '';

      // 显示加载状态
      const loadingDiv = document.createElement('div');
      loadingDiv.className = 'dialog-qr-state';
      loadingDiv.setAttribute('role', 'status');
      loadingDiv.textContent = (typeof t === 'function' ? t('generatingQrCode') : null) || 'Generating QR code...';
      container.appendChild(loadingDiv);

      try {
        let qrDataURL = null;
        let generationMethod = 'unknown';

        console.log('开始生成二维码（客户端）...');

        // 使用客户端本地生成二维码（隐私安全）
        qrDataURL = await generateQRCodeDataURL(text, {
          width: 200,
          height: 200
        });
        generationMethod = 'client_local';

        // 创建图片元素
        const img = document.createElement('img');
        img.src = qrDataURL;
        img.alt = (typeof t === 'function' ? t('qrCodeAlt') : null) || '2FA QR Code';
        img.className = 'qr-code';
        img.style.cssText =
          'width: 200px;' +
          'height: 200px;' +
          'display: block;' +
          'margin: 0 auto;' +
          'border-radius: 8px;' +
          'background: white;';

        img.onload = function() {
          container.innerHTML = '';
          container.appendChild(img);
          console.log('二维码显示成功 - 生成方式:', generationMethod);
        };

        img.onerror = function() {
          console.error('二维码显示失败');
          container.innerHTML =
            '<div class="dialog-qr-state dialog-qr-error" role="status">' +
            dialogIcon('error') +
            '<strong>' + ((typeof t === 'function' ? t('qrCodeDisplayFailedTitle') : null) || 'QR Code Display Failed') + '</strong>' +
            '<span>' + ((typeof t === 'function' ? t('qrCodeDisplayFailedHint') : null) || 'Please close and retry') + '</span>' +
            '</div>';
        };

      } catch (error) {
        console.error('二维码生成过程发生错误:', error);
        container.innerHTML =
          '<div class="dialog-qr-state dialog-qr-error" role="status">' +
          dialogIcon('error') +
          '<strong>' + ((typeof t === 'function' ? t('qrCodeGenerationFailedTitle') : null) || 'QR Code Generation Failed') + '</strong>' +
          '<span>' + escapeHTML(error.message || ((typeof t === 'function' ? t('retry') : null) || 'Please try again later')) + '</span>' +
          '</div>';
      }
    }

    // 显示二维码扫描器
    function showQRScanner() {
      // 后台预加载 jsQR；用户在 UI 上等待相机权限/选图过程时即可下载完成
      if (typeof ensureJsQR === 'function') {
        ensureJsQR().catch(() => {/* 失败时下游 typeof jsQR 检查会兜底提示 */});
      }
      const modal = document.getElementById('qrScanModal');
      modal.style.display = 'flex';
      setTimeout(() => modal.classList.add('show'), 10);
      initScanModalDragPaste();

      // 重置连续扫描状态
      continuousScanMode = false;
      continuousScanCount = 0;
      const toggle = document.getElementById('continuousScanToggle');
      if (toggle) toggle.checked = false;
      const counter = document.getElementById('scanCounter');
      if (counter) {
        counter.style.display = 'none';
        document.getElementById('scanCountNum').textContent = '0';
      }

      startQRScanner();
      disableBodyScroll();
    }

    // 隐藏二维码扫描器
    function hideQRScanner() {
      const modal = document.getElementById('qrScanModal');
      if (!modal || !modal.classList.contains('show')) return;
      modal.classList.remove('show');
      setTimeout(() => modal.style.display = 'none', 300);
      stopQRScanner();
      enableBodyScroll();

      // 重置连续扫描状态
      continuousScanMode = false;
      continuousScanCount = 0;
      const toggle = document.getElementById('continuousScanToggle');
      if (toggle) toggle.checked = false;
      const counter = document.getElementById('scanCounter');
      if (counter) {
        counter.style.display = 'none';
        document.getElementById('scanCountNum').textContent = '0';
      }

      // 重置文件输入框，确保下次可以选择同一个文件
      const fileInput = document.getElementById('qrImageInput');
      if (fileInput) {
        fileInput.value = '';
      }
    }

    // 启动二维码扫描器
    async function startQRScanner() {
      const video = document.getElementById('scannerVideo');
      const status = document.getElementById('scannerStatus');
      const error = document.getElementById('scannerError');

      try {
        error.style.display = 'none';
        status.textContent = (typeof t === 'function' ? t('startingCamera') : null) || 'Starting camera...';
        status.style.display = 'block';

        // 检查浏览器支持 - 增强iPad兼容性
        if (!navigator.mediaDevices) {
          // 尝试 polyfill for older browsers
          if (navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia) {
            // 为旧版浏览器创建 polyfill
            navigator.mediaDevices = {};
            navigator.mediaDevices.getUserMedia = function(constraints) {
              const getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
              if (!getUserMedia) {
                return Promise.reject(new Error('getUserMedia is not implemented in this browser'));
              }
              return new Promise((resolve, reject) => {
                getUserMedia.call(navigator, constraints, resolve, reject);
              });
            };
          } else {
            throw new Error((typeof t === 'function' ? t('browserNoCameraSupport') : null) || 'Your browser does not support camera functions, please use a modern browser');
          }
        }

        if (!navigator.mediaDevices.getUserMedia) {
          throw new Error((typeof t === 'function' ? t('browserNoCameraSupport') : null) || 'Your browser does not support camera functions, please use a modern browser');
        }

        // iPad 特殊处理：检查设备类型和权限
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const isIPad = /iPad/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

        console.log('设备检测:', {
          userAgent: navigator.userAgent,
          isIOS,
          isIPad,
          platform: navigator.platform,
          maxTouchPoints: navigator.maxTouchPoints
        });

        // 停止之前的流（如果存在）
        if (scanStream) {
          scanStream.getTracks().forEach(track => track.stop());
          scanStream = null;
        }

        // 尝试不同的摄像头配置 - iPad 优化
        let configs;

        if (isIPad || isIOS) {
          // iPad/iOS 特殊配置
          configs = [
            {
              video: {
                facingMode: 'environment',
                width: { ideal: 640, max: 1280 },  // 降低分辨率要求
                height: { ideal: 480, max: 720 }
              }
            },
            {
              video: {
                facingMode: 'user',
                width: { ideal: 480, max: 640 },
                height: { ideal: 360, max: 480 }
              }
            },
            {
              video: {
                width: { ideal: 640 },
                height: { ideal: 480 }
              }
            },
            {
              video: true  // 最简单的配置
            }
          ];
        } else {
          // 其他设备的标准配置
          configs = [
            {
              video: {
                facingMode: 'environment', // 后置摄像头
                width: { ideal: 1280, max: 1920 },
                height: { ideal: 720, max: 1080 }
              }
            },
            {
              video: {
                facingMode: 'user', // 前置摄像头
                width: { ideal: 640 },
                height: { ideal: 480 }
              }
            },
            {
              video: true // 默认摄像头
            }
          ];
        }

        let stream = null;
        for (let i = 0; i < configs.length; i++) {
          try {
            console.log('尝试摄像头配置:', configs[i]);
            stream = await navigator.mediaDevices.getUserMedia(configs[i]);
            console.log('摄像头配置成功');
            break;
          } catch (e) {
            console.warn('摄像头配置 ' + (i + 1) + ' 失败:', e.message);
            if (i === configs.length - 1) {
              throw e; // 最后一个配置也失败了，抛出错误
            }
          }
        }

        if (!stream) {
          throw new Error((typeof t === 'function' ? t('cameraAccessDenied') : null) || 'Unable to get camera access permission');
        }

        scanStream = stream;
        video.srcObject = scanStream;

        // 等待视频加载并播放
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error((typeof t === 'function' ? t('qrCameraLoadTimeout') : null) || 'Camera load timeout'));
          }, 10000);

          video.onloadedmetadata = () => {
            clearTimeout(timeout);
            video.play()
              .then(() => {
                console.log('摄像头启动成功，分辨率:', video.videoWidth + 'x' + video.videoHeight);
                resolve();
              })
              .catch(reject);
          };

          video.onerror = () => {
            clearTimeout(timeout);
            reject(new Error((typeof t === 'function' ? t('qrCameraPlayFailed') : null) || 'Camera playback failed'));
          };
        });

        status.textContent = '';
        status.style.display = 'none';
        isScanning = true;

        // 创建画布用于分析图像
        if (!scannerCanvas) {
          scannerCanvas = document.createElement('canvas');
          scannerContext = scannerCanvas.getContext('2d');
          console.log('画布创建成功');
        }

        // 延迟开始扫描，确保视频稳定
        setTimeout(() => {
          if (isScanning) {
            console.log('开始二维码扫描循环');
            scanForQRCode();
          }
        }, 500);

      } catch (err) {
        console.error('启动摄像头失败:', err);
        console.error('错误详情:', {
          name: err.name,
          message: err.message,
          userAgent: navigator.userAgent,
          isSecure: location.protocol === 'https:',
          mediaDevicesSupport: !!navigator.mediaDevices,
          getUserMediaSupport: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
        });

        let errorMsg = ((typeof t === 'function' ? t('cameraErrorWithReason', { error: err.message }) : null) || ('Failed to start camera: ' + err.message));

        // iPad 特殊错误处理
        const isIPad = /iPad/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

        if (err.name === 'NotAllowedError') {
          if (isIPad) {
            errorMsg = (typeof t === 'function' ? t('cameraAccessDenied') : null) || 'iPad camera permission denied. Please allow camera access in Safari settings, or tap the "aA" icon in the address bar to allow camera access';
          } else {
            errorMsg = (typeof t === 'function' ? t('cameraAccessDenied') : null) || 'Camera permission denied, please allow camera access in browser settings';
          }
        } else if (err.name === 'NotFoundError') {
          if (isIPad) {
            errorMsg = (typeof t === 'function' ? t('cameraNotFound') : null) || 'No camera device found on iPad. Please allow camera access in system settings';
          } else {
            errorMsg = (typeof t === 'function' ? t('cameraNotFound') : null) || 'No camera device found, please ensure device is connected';
          }
        } else if (err.name === 'NotReadableError') {
          if (isIPad) {
            errorMsg = (typeof t === 'function' ? t('cameraInUse') : null) || 'iPad camera is in use by another application, please close other camera apps and retry';
          } else {
            errorMsg = (typeof t === 'function' ? t('cameraInUse') : null) || 'Camera is in use by another application, please close other camera apps';
          }
        } else if (err.name === 'OverconstrainedError') {
          if (isIPad) {
            errorMsg = (typeof t === 'function' ? t('cameraConfigNotSupported') : null) || 'iPad camera does not support requested config, trying compatibility mode...';
          } else {
            errorMsg = (typeof t === 'function' ? t('cameraConfigNotSupported') : null) || 'Camera does not support requested configuration, please try another device';
          }
        } else if (err.message.includes('getUserMedia is not implemented')) {
          errorMsg = (typeof t === 'function' ? t('browserNoCameraSupport') : null) || 'Your browser version is too old, please update to the latest Safari or Chrome';
        } else if (location.protocol !== 'https:') {
          errorMsg = (typeof t === 'function' ? t('cameraHttpsRequired') : null) || 'Camera function requires HTTPS protocol, please visit via https://';
        }

        showScannerError(errorMsg);
      }
    }

    // 停止二维码扫描器
    function stopQRScanner() {
      isScanning = false;
      if (scanInterval) {
        clearInterval(scanInterval);
        scanInterval = null;
      }
      if (scanStream) {
        scanStream.getTracks().forEach(track => track.stop());
        scanStream = null;
      }
    }

    // 重试启动摄像头
    function retryCamera() {
      document.getElementById('scannerError').style.display = 'none';
      startQRScanner();
    }

    // 显示扫描器错误
    function showScannerError(message) {
      const error = document.getElementById('scannerError');
      const errorMessage = document.getElementById('errorMessage');
      const status = document.getElementById('scannerStatus');

      status.style.display = 'none';
      errorMessage.textContent = message;
      error.style.display = 'block';
    }

    // 扫描二维码
    function scanForQRCode() {
      if (!isScanning) return;

      const video = document.getElementById('scannerVideo');
      const status = document.getElementById('scannerStatus');

      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        try {
          // 设置画布尺寸
          const videoWidth = video.videoWidth;
          const videoHeight = video.videoHeight;

          if (videoWidth > 0 && videoHeight > 0) {
            scannerCanvas.width = videoWidth;
            scannerCanvas.height = videoHeight;

            // 绘制当前帧到画布
            scannerContext.drawImage(video, 0, 0, videoWidth, videoHeight);

            // 获取图像数据
            const imageData = scannerContext.getImageData(0, 0, videoWidth, videoHeight);

            // 尝试解析二维码
            const qrCode = decodeQRCode(imageData);

            if (qrCode) {
              console.log('二维码扫描成功!');
              processScannedQRCode(qrCode);
              return;
            }
          }
        } catch (error) {
          console.error('扫描过程出错:', error);
        }
      } else {
        // 视频还未准备好
        status.textContent = (typeof t === 'function' ? t('startingCamera') : null) || 'Starting camera...';
      }

      // 继续扫描（提高频率到60fps）
      requestAnimationFrame(scanForQRCode);
    }

    // 使用jsQR库进行二维码解码
    function decodeQRCode(imageData) {
      try {
        // 检查jsQR库是否已加载
        if (typeof jsQR === 'undefined') {
          console.warn('jsQR库未加载，无法解析二维码');
          return null;
        }

        // 使用jsQR库进行解析
        const qrResult = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "dontInvert", // 提高性能
        });

        if (qrResult && qrResult.data) {
          console.log('二维码解析成功:', qrResult.data);
          return qrResult.data;
        }

        return null;
      } catch (error) {
        console.error('二维码解析失败:', error);
        return null;
      }
    }

    // 处理扫描到的二维码
    function processScannedQRCode(qrCodeData) {
      try {
        console.log('扫描到二维码:', qrCodeData);

        // 检查是否是 Google Authenticator 迁移格式
        if (qrCodeData.startsWith('otpauth-migration://')) {
          processGoogleMigration(qrCodeData);
          return;
        }

        // 检查是否是有效的 OTP Auth URL
        if (!qrCodeData.startsWith('otpauth://totp/') && !qrCodeData.startsWith('otpauth://hotp/')) {
          showScannerError((typeof t === 'function' ? t('invalid2faQrCode') : null) || 'Not a valid 2FA QR code');
          return;
        }

        // 解析 OTP Auth URL
        const url = new URL(qrCodeData);
        const pathParts = url.pathname.substring(1).split(':');
        const params = new URLSearchParams(url.search);

        // 对URL编码的部分进行解码
        const issuer = decodeURIComponent(params.get('issuer') || (pathParts.length > 1 ? pathParts[0] : ''));
        const account = decodeURIComponent(pathParts.length > 1 ? pathParts[1] : pathParts[0]);
        const secret = params.get('secret');

        // 解析类型和高级参数
        const urlType = url.protocol.replace(':', '').split('//')[1]; // 提取协议后的类型
        let type = 'TOTP';
        if (urlType === 'hotp') {
          type = 'HOTP';
        }

        const digits = parseInt(params.get('digits')) || 6;
        const period = parseInt(params.get('period')) || 30;
        const algorithm = params.get('algorithm') || 'SHA1';
        const counter = parseInt(params.get('counter')) || 0;

        if (!secret) {
          showScannerError((typeof t === 'function' ? t('qrCodeMissingSecret') : null) || 'QR code missing secret key');
          return;
        }

        // 直接保存密钥（不显示编辑界面）
        // 连续扫描模式下不关闭扫描器，在保存成功后继续扫描
        directSaveFromQR(issuer, account, secret, { type, digits, period, algorithm, counter });

      } catch (error) {
        console.error('解析二维码失败:', error);
        showScannerError(((typeof t === 'function' ? t('parseQrCodeFailed', { error: error.message }) : null) || ('Failed to parse QR code: ' + error.message)));
      }
    }

    // 直接保存扫描到的密钥（不显示编辑界面）
    async function directSaveFromQR(issuer, account, secret, options = {}) {
      const newSecret = {
        name: issuer || account || ((typeof t === 'function' ? t('secretUnnamed') : null) || 'Unnamed'),
        account: account || '',
        secret: secret.toUpperCase(),
        type: options.type || 'TOTP',
        digits: options.digits || 6,
        period: options.period || 30,
        algorithm: options.algorithm || 'SHA1',
        counter: options.counter || 0
      };

      try {
        showCenterToast('⏳', (typeof t === 'function' ? t('saving') : null) || 'Saving...');

        const response = await authenticatedFetch('/api/secrets', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(newSecret)
        });

        if (response.ok) {
          const result = await response.json();
          console.log('密钥保存成功:', result);
          showCenterToast('✅', (typeof t === 'function' ? t('secretSavedSuccess', { name: newSecret.name }) : null) || ('Key added successfully: ' + newSecret.name));
          // 刷新密钥列表
          loadSecrets();

          // 连续扫描模式处理
          if (continuousScanMode) {
            // 更新计数
            updateScanCount();
            // 继续扫描（延迟一下让用户看到提示）
            setTimeout(() => {
              if (isScanning && continuousScanMode) {
                console.log('连续扫描模式：继续扫描下一个二维码');
                scanForQRCode();
              }
            }, 800);
          } else {
            // 非连续模式，关闭扫描器
            hideQRScanner();
          }
        } else {
          const errorText = await response.text();
          console.error('保存密钥失败:', response.status, errorText);
          // 解析错误信息，只显示简短提示
          let errorMsg = (typeof t === 'function' ? t('saveFailed') : null) || 'Failed to save';
          try {
            const errorJson = JSON.parse(errorText);
            if (response.status === 409) {
              errorMsg = (typeof t === 'function' ? t('secretAlreadyExists', { name: newSecret.name }) : null) || ('"' + newSecret.name + '" already exists');
            } else {
              errorMsg = errorJson.error || errorJson.message || errorText;
            }
          } catch (e) {
            errorMsg = errorText;
          }
          showCenterToast('❌', errorMsg);
          // 失败时也继续扫描（如果是连续模式）
          if (continuousScanMode && isScanning) {
            setTimeout(() => scanForQRCode(), 1000);
          }
        }
      } catch (error) {
        console.error('保存密钥出错:', error);
        showCenterToast('❌', (typeof t === 'function' ? t('saveFailedWithReason', { error: error.message }) : null) || ('Failed to save: ' + error.message));
        // 出错时也继续扫描（如果是连续模式）
        if (continuousScanMode && isScanning) {
          setTimeout(() => scanForQRCode(), 1000);
        }
      }
    }

    // ========== 通用：从 <img> 解码二维码（双通道分辨率回退）==========
    // 先按接近原始的分辨率尝试（上限 2500px，避免相机大图把内存吃满），失败再
    // 回退到 1000px 缩放后再尝试。Google Authenticator 迁移码这类高密度 QR 在
    // 单遍 1000px 缩放下单模块只剩 3-4 像素，jsQR 解不出来；保留一次高分辨率
    // 尝试可以让稠密码先解出来，同时对手机截图正常 QR 走第一遍即返回。
    async function tryDecodeQRFromImage(img) {
      if (typeof jsQR === 'undefined') {
        try { await ensureJsQR(); } catch (_) {}
      }
      if (typeof jsQR === 'undefined') return null;

      const parseOptions = [
        { inversionAttempts: "dontInvert" },
        { inversionAttempts: "onlyInvert" },
        { inversionAttempts: "attemptBoth" },
        { inversionAttempts: "attemptBoth", margin: 5 }
      ];

      // naturalWidth/Height 优先：避免被 DOM 显示尺寸覆盖；零尺寸/未解码图直接放弃
      const srcW = img.naturalWidth || img.width;
      const srcH = img.naturalHeight || img.height;
      const maxDim = Math.max(srcW, srcH);
      if (!maxDim) return null;
      const passes = [];

      if (maxDim > 2500) {
        const r = 2500 / maxDim;
        passes.push({ w: Math.floor(srcW * r), h: Math.floor(srcH * r), label: 'hi-res' });
      } else {
        passes.push({ w: srcW, h: srcH, label: 'original' });
      }

      if (maxDim > 1000) {
        const r = 1000 / maxDim;
        passes.push({ w: Math.floor(srcW * r), h: Math.floor(srcH * r), label: 'scaled-1000' });
      }

      for (const pass of passes) {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          canvas.width = pass.w;
          canvas.height = pass.h;
          ctx.drawImage(img, 0, 0, pass.w, pass.h);
          const imageData = ctx.getImageData(0, 0, pass.w, pass.h);

          for (const opt of parseOptions) {
            try {
              const result = jsQR(imageData.data, imageData.width, imageData.height, opt);
              if (result && result.data) {
                console.log('二维码解析成功 (' + pass.label + ' ' + pass.w + 'x' + pass.h + '):', opt.inversionAttempts);
                return result.data;
              }
            } catch (e) {
              console.warn('jsQR 调用异常 (' + pass.label + '):', e);
            }
          }
        } catch (canvasError) {
          console.warn('画布渲染异常 (' + pass.label + '):', canvasError);
        }
      }

      console.log('二维码识别失败，已尝试通道:', passes.map(function(p) { return p.label; }).join(', '));
      return null;
    }

    // 上传图片扫描二维码
    function uploadImageForScan() {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = function(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(e) {
          const img = new Image();
          img.onload = async function() {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);

            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

            if (typeof jsQR === 'undefined') {
              try { await ensureJsQR(); } catch (_) {}
            }
            if (typeof jsQR !== 'undefined') {
              const code = jsQR(imageData.data, imageData.width, imageData.height);

              if (code) {
                hideQRScanner();
                processScannedQRCode(code.data);
              } else {
                showCenterToast('❌', (typeof t === 'function' ? t('noQrFoundInImage') : null) || 'No QR code found in image. Please try another image.');
              }
            } else {
              showCenterToast('❌', (typeof t === 'function' ? t('qrLibraryNotLoaded') : null) || 'QR code decoder library is not loaded');
            }
          };
          img.src = e.target.result;
        };
        reader.readAsDataURL(file);
      };
      input.click();
    }

    // 处理图片上传和解析
    function handleImageUpload(event) {
      const file = event.target.files[0];
      if (!file) {
        console.log('没有选择文件');
        return;
      }

      console.log('选择了文件:', file.name, file.type, file.size);

      // 检查文件类型
      if (!file.type.startsWith('image/')) {
        showScannerError((typeof t === 'function' ? t('pleaseSelectImageFile') : null) || 'Please select an image file (JPG, PNG, GIF, WebP, etc.)');
        return;
      }

      // 检查文件大小（限制为10MB）
      if (file.size > 10 * 1024 * 1024) {
        showScannerError((typeof t === 'function' ? t('imageFileTooLarge') : null) || 'Image file is too large. Please select an image smaller than 10MB.');
        return;
      }

      // 显示加载状态
      const status = document.getElementById('scannerStatus');
      const error = document.getElementById('scannerError');
      const originalText = status.textContent;

      status.textContent = (typeof t === 'function' ? t('analyzingImage') : null) || 'Analyzing image...';
      status.style.display = 'block';
      status.style.color = 'var(--dialog-brand)';
      error.style.display = 'none';

      console.log('开始处理图片文件...');

      // 创建 FileReader
      const reader = new FileReader();

      reader.onload = function(e) {
        console.log('FileReader加载完成');

        try {
          // 创建图片元素
          const img = new Image();

          img.onload = async function() {
            console.log('图片加载成功，尺寸:', img.width + 'x' + img.height);

            try {
              // 按需加载 jsQR
              if (typeof jsQR === 'undefined') {
                try { await ensureJsQR(); } catch (_) {}
              }
              if (typeof jsQR === 'undefined') {
                throw new Error((typeof t === 'function' ? t('qrLibraryNotLoaded') : null) || 'QR code decoder library is not loaded, please refresh page');
              }

              // 创建 canvas 来处理图片（实际渲染与多分辨率回退在 helper 里完成）
              status.textContent = (typeof t === 'function' ? t('analyzingImage') : null) || 'Decoding QR code...';
              const qrCode = await tryDecodeQRFromImage(img);

              if (qrCode) {
                status.textContent = 'OK';
                status.style.color = 'var(--dialog-success)';

                console.log('成功解析到二维码:', qrCode);

                // 处理解析到的二维码
                setTimeout(() => {
                  processScannedQRCode(qrCode);
                }, 1000);
              } else {
                console.log('未找到二维码');
                showScannerError((typeof t === 'function' ? t('noQrFoundInImage') : null) || ('No valid QR code found in image\\n\\nPlease ensure:\\n• Image is clear\\n• QR code is fully visible\\n• Contains a valid 2FA QR code'));
              }
            } catch (error) {
              console.error('图片处理失败:', error);
              showScannerError(((typeof t === 'function' ? t('imageProcessingFailed', { error: error.message }) : null) || ('Image processing failed: ' + error.message)));
            }
          };

          img.onerror = function() {
            console.error('图片加载失败');
            showScannerError((typeof t === 'function' ? t('imageLoadFailed') : null) || ('Failed to load image, please choose a valid image file\\nSupported formats: JPG, PNG, GIF, WebP'));
          };

          // 设置图片源
          img.src = e.target.result;

        } catch (error) {
          console.error('图片读取失败:', error);
          showScannerError(((typeof t === 'function' ? t('fileReadFailed') : null) || ('Failed to read image: ' + error.message)));
        }
      };

      reader.onerror = function() {
        console.error('FileReader读取失败');
        showScannerError((typeof t === 'function' ? t('fileReadFailed') : null) || 'Failed to read file, please try again');
      };

      reader.onprogress = function(e) {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          status.textContent = 'Loading image... ' + percent + '%';
        }
      };

      // 读取文件为 data URL
      reader.readAsDataURL(file);

      // 清空文件输入，允许重复选择同一文件
      event.target.value = '';
    }

    // ========== 剪贴板粘贴识别二维码 ==========

    // 从剪贴板读取图片并识别二维码
    async function pasteImageForScan() {
      try {
        const clipboardItems = await navigator.clipboard.read();
        let imageBlob = null;

        for (const item of clipboardItems) {
          const imageType = item.types.find(t => t.startsWith('image/'));
          if (imageType) {
            imageBlob = await item.getType(imageType);
            break;
          }
        }

        if (!imageBlob) {
          showCenterToast('❌', (typeof t === 'function' ? t('clipboardNoImage') : null) || 'No image found in clipboard. Please copy a screenshot or image first.');
          return;
        }

        processImageBlobForScan(imageBlob);
      } catch (error) {
        if (error.name === 'NotAllowedError') {
          showCenterToast('❌', (typeof t === 'function' ? t('clipboardAccessDenied') : null) || 'Please allow browser clipboard access.');
        } else {
          showCenterToast('❌', (typeof t === 'function' ? t('clipboardReadFailed', { error: error.message }) : null) || ('Failed to read clipboard: ' + error.message));
        }
      }
    }

    // 处理图片 Blob 并识别二维码（粘贴/拖拽共用）
    function processImageBlobForScan(blob) {
      const reader = new FileReader();
      reader.onload = function(e) {
        const img = new Image();
        img.onload = async function() {
          if (typeof jsQR === 'undefined') {
            try { await ensureJsQR(); } catch (_) {}
          }
          if (typeof jsQR === 'undefined') {
            showCenterToast('❌', (typeof t === 'function' ? t('qrLibraryNotLoaded') : null) || 'QR code decoder library is not loaded');
            return;
          }

          const qrCode = await tryDecodeQRFromImage(img);

          if (qrCode) {
            processScannedQRCode(qrCode);
          } else {
            showCenterToast('❌', (typeof t === 'function' ? t('noQrFoundInImage') : null) || 'No QR code found in image. Please try another image.');
          }
        };
        img.onerror = function() {
          showCenterToast('❌', (typeof t === 'function' ? t('imageLoadFailed') : null) || 'Failed to load image');
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(blob);
    }

    // ========== 拖拽 + Ctrl+V 事件监听 ==========

    // 初始化扫描模态框的拖拽和粘贴事件
    function initScanModalDragPaste() {
      const modal = document.getElementById('qrScanModal');
      if (!modal || modal.dataset.dragPasteInit) return;
      modal.dataset.dragPasteInit = 'true';

      // 拖拽事件
      modal.addEventListener('dragover', function(e) {
        e.preventDefault();
        e.stopPropagation();
        modal.classList.add('drag-over');
      });

      modal.addEventListener('dragleave', function(e) {
        e.preventDefault();
        e.stopPropagation();
        if (!modal.contains(e.relatedTarget)) {
          modal.classList.remove('drag-over');
        }
      });

      modal.addEventListener('drop', function(e) {
        e.preventDefault();
        e.stopPropagation();
        modal.classList.remove('drag-over');

        const files = e.dataTransfer.files;
        if (files.length > 0 && files[0].type.startsWith('image/')) {
          processImageBlobForScan(files[0]);
        } else {
          showCenterToast('❌', (typeof t === 'function' ? t('pleaseDropImageFile') : null) || 'Please drop an image file here.');
        }
      });
    }

    // Ctrl+V 粘贴事件监听（仅处理扫描模态框）
    document.addEventListener('paste', function(e) {
      const scanModal = document.getElementById('qrScanModal');
      if (!scanModal || !scanModal.classList.contains('show')) return;

      const items = e.clipboardData && e.clipboardData.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const blob = item.getAsFile();
          if (blob) processImageBlobForScan(blob);
          return;
        }
      }
    });
`;
}
