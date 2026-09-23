/**
 * 二維碼解析工具模組
 */

/**
 * 獲取二維碼解析工具程式碼
 * @returns {string} 二維碼解析工具 JavaScript 程式碼
 */
export function getQRDecodeToolCode() {
	return `    // ==================== 二維碼解析工具 ====================

    let decodeStream = null;
    let decodeInterval = null;
    let isDecodeScanning = false;

    function showQRDecodeModal() {
      showModal('qrDecodeModal', () => {
        document.getElementById('decodeScannerContainer').style.display = 'none';
        document.getElementById('decodeResultSection').style.display = 'none';
        document.getElementById('decodeQRSection').style.display = 'none';
      });
      initDecodeModalDragPaste();
    }

    function hideQRDecodeModal() {
      hideModal('qrDecodeModal', () => {
        stopDecodeScanner();
      });
    }

    function startQRDecodeScanner() {
      const container = document.getElementById('decodeScannerContainer');
      const status = document.getElementById('decodeScannerStatus');
      const error = document.getElementById('decodeScannerError');

      container.style.display = 'block';
      error.style.display = 'none';
      status.textContent = (typeof t === 'function' ? t('qrCameraStarting') : null) || 'Starting camera...';
      status.style.display = 'block';

      startDecodeCamera();
    }

    async function startDecodeCamera() {
      const video = document.getElementById('decodeScannerVideo');
      const status = document.getElementById('decodeScannerStatus');
      const error = document.getElementById('decodeScannerError');
      const errorMessage = document.getElementById('decodeErrorMessage');

      try {
        // 檢查瀏覽器支援 - 增強iPad相容性
        if (!navigator.mediaDevices) {
          // 嘗試 polyfill for older browsers
          if (navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia) {
            // 為舊版瀏覽器建立 polyfill
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
            throw new Error((typeof t === 'function' ? t('qrBrowserNoCamera') : null) || 'Your browser does not support camera access. Please use a modern browser.');
          }
        }

        if (!navigator.mediaDevices.getUserMedia) {
          throw new Error((typeof t === 'function' ? t('qrBrowserNoCamera') : null) || 'Your browser does not support camera access. Please use a modern browser.');
        }

        // iPad 特殊處理：檢查裝置型別和許可權
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const isIPad = /iPad/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

        console.log('Device detection:', {
          userAgent: navigator.userAgent,
          isIOS,
          isIPad,
          hasMediaDevices: !!navigator.mediaDevices,
          hasGetUserMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
        });

        // 嘗試多種配置以提高在不同裝置上的相容性
        const configs = [
          // 針對移動裝置的配置（iPad/iPhone最佳化）
          {
            video: {
              facingMode: { ideal: 'environment' },
              width: { min: 320, ideal: 720, max: 1280 },
              height: { min: 240, ideal: 720, max: 1280 }
            }
          },
          // 降級配置1：降低解析度
          {
            video: {
              facingMode: 'environment',
              width: { ideal: 640, max: 1280 },
              height: { ideal: 480, max: 720 }
            }
          },
          // 降級配置2：只要後置攝像頭
          {
            video: { facingMode: 'environment' }
          },
          // 降級配置3：前置攝像頭（某些iPad可能預設只有前置或識別為前置）
          {
            video: { facingMode: 'user' }
          },
          // 最低配置：任意可用攝像頭
          {
            video: true
          }
        ];

        let stream = null;
        for (let i = 0; i < configs.length; i++) {
          try {
            console.log('Trying camera config:', i + 1);
            stream = await navigator.mediaDevices.getUserMedia(configs[i]);
            console.log('Camera started successfully with config:', i + 1);
            break;
          } catch (e) {
            if (i === configs.length - 1) {
              throw e;
            }
          }
        }

        if (!stream) {
          throw new Error((typeof t === 'function' ? t('qrCameraPermDenied') : null) || 'Unable to access camera');
        }

        decodeStream = stream;
        video.srcObject = decodeStream;

        // 等待影片載入並播放
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error((typeof t === 'function' ? t('qrCameraLoadTimeout') : null) || 'Camera loading timed out'));
          }, 10000);

          video.onloadedmetadata = () => {
            clearTimeout(timeout);
            video.play()
              .then(resolve)
              .catch(reject);
          };

          video.onerror = () => {
            clearTimeout(timeout);
            reject(new Error((typeof t === 'function' ? t('qrCameraPlayFailed') : null) || 'Camera playback failed'));
          };
        });

        status.textContent = '';
        status.style.display = 'none';
        isDecodeScanning = true;

        // 開始掃描
        setTimeout(() => {
          if (isDecodeScanning) {
            scanForDecodeQRCode();
          }
        }, 500);

      } catch (err) {
        let errorMsg = ((typeof t === 'function' ? t('qrCameraStartFailed', { error: err.message }) : null) || ('Camera failed to start: ' + err.message));

        if (err.name === 'NotAllowedError') {
          errorMsg = (typeof t === 'function' ? t('qrCameraPermDenied') : null) || 'Camera access denied. Please allow camera access in browser settings.';
        } else if (err.name === 'NotFoundError') {
          errorMsg = (typeof t === 'function' ? t('qrCameraNotFound') : null) || 'No camera found. Please ensure your device camera is connected.';
        } else if (err.name === 'NotReadableError') {
          errorMsg = (typeof t === 'function' ? t('qrCameraInUse') : null) || 'Camera is in use by another application. Please close other camera apps.';
        } else if (err.name === 'OverconstrainedError') {
          errorMsg = (typeof t === 'function' ? t('qrCameraNotSupported') : null) || 'Camera does not support the requested configuration. Please try another device.';
        }

        errorMessage.textContent = errorMsg;
        error.style.display = 'block';
        status.style.display = 'none';
      }
    }

    function stopDecodeScanner() {
      isDecodeScanning = false;
      if (decodeInterval) {
        clearInterval(decodeInterval);
        decodeInterval = null;
      }
      if (decodeStream) {
        decodeStream.getTracks().forEach(track => track.stop());
        decodeStream = null;
      }
    }

    function retryDecodeCamera() {
      document.getElementById('decodeScannerError').style.display = 'none';
      startDecodeCamera();
    }

    function scanForDecodeQRCode() {
      if (!isDecodeScanning) return;

      const video = document.getElementById('decodeScannerVideo');
      const status = document.getElementById('decodeScannerStatus');

      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');

          const videoWidth = video.videoWidth;
          const videoHeight = video.videoHeight;

          if (videoWidth > 0 && videoHeight > 0) {
            canvas.width = videoWidth;
            canvas.height = videoHeight;

            ctx.drawImage(video, 0, 0, videoWidth, videoHeight);

            const imageData = ctx.getImageData(0, 0, videoWidth, videoHeight);
            const qrCode = decodeQRCode(imageData);

            if (qrCode) {
              console.log('二维码解析成功:', qrCode);
              processDecodeResult(qrCode);
              return;
            }
          }
        } catch (error) {
          console.error('扫描过程出错:', error);
        }
      }

      requestAnimationFrame(scanForDecodeQRCode);
    }

    function processDecodeResult(qrCodeData) {
      // 停止掃描
      stopDecodeScanner();
      document.getElementById('decodeScannerContainer').style.display = 'none';

      // 顯示結果
      const resultContent = document.getElementById('decodeResultContent');
      const resultSection = document.getElementById('decodeResultSection');

      resultContent.textContent = qrCodeData;
      resultSection.style.display = 'block';

      showCenterToast('✅', (typeof t === 'function' ? t('qrDecodeSuccess') : null) || 'QR code decoded successfully');
    }

    function uploadImageForDecode() {
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
                processDecodeResult(code.data);
              } else {
                showCenterToast('❌', (typeof t === 'function' ? t('qrNotFoundInImage') : null) || 'No QR code found in the image. Please try another image.');
              }
            } else {
              showCenterToast('❌', (typeof t === 'function' ? t('qrLibNotLoaded') : null) || 'QR code decoding library not loaded');
            }
          };
          img.src = e.target.result;
        };
        reader.readAsDataURL(file);
      };
      input.click();
    }

    async function copyDecodeResult() {
      const content = document.getElementById('decodeResultContent').textContent;
      if (!content) {
        showCenterToast('❌', (typeof t === 'function' ? t('qrNoContentToCopy') : null) || 'No content to copy');
        return;
      }

      try {
        await navigator.clipboard.writeText(content);
        showCenterToast('✅', (typeof t === 'function' ? t('qrContentCopied') : null) || 'Content copied to clipboard');
      } catch (error) {
        showCenterToast('❌', (typeof t === 'function' ? t('qrCopyFailed') : null) || 'Copy failed');
      }
    }

    async function generateDecodeQRCode() {
      const content = document.getElementById('decodeResultContent').textContent;
      if (!content) {
        showCenterToast('❌', (typeof t === 'function' ? t('qrNoContentToGenerate') : null) || 'Please enter content to generate QR code');
        return;
      }

      const qrImage = document.getElementById('decodeQRCode');

      try {
        let qrDataURL = null;
        let generationMethod = 'unknown';

        // 使用客戶端本地生成二維碼（隱私安全）
        qrDataURL = await generateQRCodeDataURL(content, {
          width: 200,
          height: 200
        });
        generationMethod = 'client_local';

        qrImage.src = qrDataURL;
        qrImage.onload = function() {
          document.getElementById('decodeQRSection').style.display = 'block';
        };
        qrImage.onerror = function() {
          showCenterToast('❌', (typeof t === 'function' ? t('qrGenerateFailed', { error: '' }) : null) || 'QR code generation failed');
        };

      } catch (error) {
        console.error('QR code generation error:', error);
        showCenterToast('❌', ((typeof t === 'function' ? t('qrGenerateFailed', { error: error.message }) : null) || ('Failed to generate QR code: ' + error.message)));
      }
    }

    // ========== 剪貼簿貼上識別二維碼（解析工具） ==========

    async function pasteImageForDecode() {
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
          showCenterToast('❌', (typeof t === 'function' ? t('qrClipboardNoImage') : null) || 'No image in clipboard. Please take a screenshot or copy an image first.');
          return;
        }

        processImageBlobForDecode(imageBlob);
      } catch (error) {
        if (error.name === 'NotAllowedError') {
          showCenterToast('❌', (typeof t === 'function' ? t('qrClipboardPermission') : null) || 'Please allow browser clipboard access');
        } else {
          showCenterToast('❌', ((typeof t === 'function' ? t('qrClipboardReadFailed', { error: error.message }) : null) || ('Failed to read clipboard: ' + error.message)));
        }
      }
    }

    function processImageBlobForDecode(blob) {
      const reader = new FileReader();
      reader.onload = function(e) {
        const img = new Image();
        img.onload = async function() {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');

          let { width, height } = img;
          const maxSize = 1000;
          if (width > maxSize || height > maxSize) {
            const ratio = Math.min(maxSize / width, maxSize / height);
            width = Math.floor(width * ratio);
            height = Math.floor(height * ratio);
          }

          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);

          const imageData = ctx.getImageData(0, 0, width, height);

          if (typeof jsQR === 'undefined') {
            try { await ensureJsQR(); } catch (_) {}
          }
          if (typeof jsQR === 'undefined') {
            showCenterToast('❌', (typeof t === 'function' ? t('qrLibNotLoaded') : null) || 'QR code decoding library not loaded');
            return;
          }

          const parseOptions = [
            { inversionAttempts: "dontInvert" },
            { inversionAttempts: "onlyInvert" },
            { inversionAttempts: "attemptBoth" }
          ];

          let qrCode = null;
          for (const opt of parseOptions) {
            const result = jsQR(imageData.data, imageData.width, imageData.height, opt);
            if (result && result.data) {
              qrCode = result.data;
              break;
            }
          }

          if (qrCode) {
            processDecodeResult(qrCode);
          } else {
            showCenterToast('❌', (typeof t === 'function' ? t('qrNotFoundInImage') : null) || 'No QR code found in the image. Please try another image.');
          }
        };
        img.onerror = function() {
          showCenterToast('❌', (typeof t === 'function' ? t('qrImageLoadFailed') : null) || 'Failed to load image');
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(blob);
    }

    // 初始化解析模態框的拖拽和貼上事件
    function initDecodeModalDragPaste() {
      const modal = document.getElementById('qrDecodeModal');
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
          processImageBlobForDecode(files[0]);
        } else {
          showCenterToast('❌', (typeof t === 'function' ? t('qrDropImageOnly') : null) || 'Please drop an image file');
        }
      });

      // Ctrl+V 貼上事件（僅處理解析工具模態框）
      document.addEventListener('paste', function(e) {
        if (!modal.classList.contains('show')) return;

        const items = e.clipboardData && e.clipboardData.items;
        if (!items) return;

        for (const item of items) {
          if (item.type.startsWith('image/')) {
            e.preventDefault();
            const blob = item.getAsFile();
            if (blob) processImageBlobForDecode(blob);
            return;
          }
        }
      });
    }

`;
}
