/**
 * Service Worker 生成模組
 * 提供離線支援和快取管理
 */

import { createOfflinePage } from './offlinePage.js';

/**
 * 生成 Service Worker 指令碼
 * @returns {Response} Service Worker JavaScript 響應
 */
export function createServiceWorker(env = {}) {
	const embeddedBuildVersion = typeof globalThis.__BUILD_SW_VERSION__ === 'string' ? globalThis.__BUILD_SW_VERSION__ : '';
	// 🚀 自動版本管理：從環境變數讀取版本號
	// 支援多種版本策略：
	// 1. env.SW_VERSION - 構建時注入的版本號（推薦）
	// 2. env.BUILD_TIMESTAMP - 構建時間戳
	// 3. __BUILD_SW_VERSION__ - 單檔案 release 構建時內嵌的版本號
	// 4. 'v1' - 預設版本（後備）
	const version = env.SW_VERSION || env.BUILD_TIMESTAMP || embeddedBuildVersion || 'v1';

	// 生成快取名稱
	const CACHE_NAME = `2fa-cache-${version}`;
	const RUNTIME_CACHE = `2fa-runtime-${version}`;

	const swScript = `
/**
 * 2FA - Service Worker
 * 版本: ${version}
 * 生成时间: ${new Date().toISOString()}
 *
 * ⚡ 自动版本管理：
 * - 每次部署自动更新缓存版本
 * - 自动清理旧版本缓存
 * - 无需手动维护版本号
 * 提供离线支持和资源缓存
 */

const CACHE_NAME = '${CACHE_NAME}';
const RUNTIME_CACHE = '${RUNTIME_CACHE}';
const DB_NAME = '2fa-offline-db';
const DB_VERSION = 1;
const SW_VERSION = '${version}';
const STORE_NAME = 'pending-operations';
const OFFLINE_PAGE = ${JSON.stringify(createOfflinePage())};
let syncPendingOperationsPromise = null;

// 版本資訊（用於除錯）
console.log('[SW] Service Worker 版本:', SW_VERSION);
console.log('[SW] 缓存名称:', CACHE_NAME);

// 需要快取的靜態資源
const STATIC_RESOURCES = [
  '/',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/fonts/maple-mono-regular.woff2',
  '/fonts/maple-mono-bold.woff2',
  '/fonts/maple-mono-cjk.css'
  // 注意：API 請求不快取，因為需要即時資料
];

// 外部 CDN 資源（Service Worker 會自動快取）
const CDN_RESOURCES = [
  'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js'
];

// ==================== IndexedDB 操作 ====================

/**
 * 開啟 IndexedDB 資料庫
 * @returns {Promise<IDBDatabase>}
 */
function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('[SW] IndexedDB 打开失败:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      console.log('[SW] IndexedDB 打开成功');
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      console.log('[SW] IndexedDB 升级中...');
      const db = event.target.result;

      // 建立物件儲存（如果不存在）
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        objectStore.createIndex('timestamp', 'timestamp', { unique: false });
        objectStore.createIndex('type', 'type', { unique: false });
        console.log('[SW] IndexedDB 对象存储已创建');
      }
    };
  });
}

/**
 * 儲存待同步操作到 IndexedDB
 * @param {Object} operation - 操作物件
 * @returns {Promise<string>} 操作ID
 */
async function saveOperation(operation) {
  try {
    const db = await openDatabase();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    // 生成唯一ID
    operation.id = operation.id || \`op-\${Date.now()}-\${Math.random().toString(36).substr(2, 9)}\`;
    operation.timestamp = operation.timestamp || Date.now();
    operation.retryCount = operation.retryCount || 0;
    operation.status = 'pending';

    await new Promise((resolve, reject) => {
      const request = store.put(operation);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    console.log('[SW] 操作已保存到 IndexedDB:', operation.id, operation.type);
    return operation.id;
  } catch (error) {
    console.error('[SW] 保存操作到 IndexedDB 失败:', error);
    throw error;
  }
}

/**
 * 獲取所有待同步操作
 * @returns {Promise<Array>}
 */
async function getPendingOperations() {
  try {
    const db = await openDatabase();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('timestamp');

    return new Promise((resolve, reject) => {
      const request = index.getAll();
      request.onsuccess = () => {
        const operations = request.result.filter(op => op.status === 'pending');
        console.log(\`[SW] 获取到 \${operations.length} 个待同步操作\`);
        resolve(operations);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('[SW] 获取待同步操作失败:', error);
    return [];
  }
}

/**
 * 刪除已同步操作
 * @param {string} operationId - 操作ID
 * @returns {Promise<void>}
 */
async function deleteOperation(operationId) {
  try {
    const db = await openDatabase();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    await new Promise((resolve, reject) => {
      const request = store.delete(operationId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    console.log('[SW] 操作已从 IndexedDB 删除:', operationId);
  } catch (error) {
    console.error('[SW] 删除操作失败:', error);
    throw error;
  }
}

/**
 * 更新操作狀態
 * @param {string} operationId - 操作ID
 * @param {Object} updates - 更新資料
 * @returns {Promise<void>}
 */
async function updateOperation(operationId, updates) {
  try {
    const db = await openDatabase();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const operation = await new Promise((resolve, reject) => {
      const request = store.get(operationId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    if (operation) {
      Object.assign(operation, updates);
      await new Promise((resolve, reject) => {
        const request = store.put(operation);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
      console.log('[SW] 操作已更新:', operationId);
    }
  } catch (error) {
    console.error('[SW] 更新操作失败:', error);
    throw error;
  }
}

/**
 * 獲取待同步運算元量
 * @returns {Promise<number>}
 */
async function getPendingOperationsCount() {
  try {
    const operations = await getPendingOperations();
    return operations.length;
  } catch (error) {
    console.error('[SW] 获取待同步操作数量失败:', error);
    return 0;
  }
}

/**
 * Service Worker 安裝事件
 * 預快取靜態資源
 */
self.addEventListener('install', event => {
  console.log('[SW] 正在安装 Service Worker...');
  
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] 预缓存静态资源...');
      // 只快取靜態資源，CDN 資源在首次請求時按需快取
      return cache.addAll(STATIC_RESOURCES).catch(err => {
        console.warn('[SW] 预缓存静态资源部分失败:', err);
        // 即使失敗也繼續，不影響 Service Worker 安裝
        return Promise.resolve();
      });
    }).then(() => {
      console.log('[SW] Service Worker 安装完成');
      console.log('[SW] CDN 资源将在首次请求时自动缓存（使用 CORS 模式）');
      // 立即啟用，不等待
      return self.skipWaiting();
    }).catch(err => {
      console.error('[SW] Service Worker 安装失败:', err);
    })
  );
});

/**
 * Service Worker 啟用事件
 * 清理舊快取
 */
self.addEventListener('activate', event => {
  console.log('[SW] 正在激活 Service Worker...');
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(cacheName => {
            // 刪除舊版本快取
            return cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE;
          })
          .map(cacheName => {
            console.log('[SW] 删除旧缓存:', cacheName);
            return caches.delete(cacheName);
          })
      );
    }).then(() => {
      console.log('[SW] Service Worker 激活完成');
      // 立即控制所有頁面
      return self.clients.claim();
    })
  );
});

/**
 * Service Worker Fetch 事件
 * 實現快取策略和離線佇列
 */
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Favicon 代理請求：快取優先策略（在 API 請求之前處理）
  if (url.pathname.startsWith('/api/favicon/')) {
    event.respondWith(
      caches.match(request).then(cachedResponse => {
        if (cachedResponse) {
          console.log('[SW] Favicon 从缓存返回:', url.pathname);
          return cachedResponse;
        }

        // 快取未命中，從網路獲取
        console.log('[SW] Favicon 从网络获取:', url.pathname);
        return fetch(request).then(response => {
          // 只快取成功的響應
          if (response && response.ok) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(request, responseToCache);
              console.log('[SW] Favicon 已缓存:', url.pathname);
            });
          }
          return response;
        }).catch(err => {
          console.error('[SW] Favicon 加载失败:', url.pathname, err);
          // 返回空響應，觸發 img onerror
          return new Response('', {
            status: 404,
            statusText: 'Not Found',
            headers: { 'Content-Type': 'text/plain' }
          });
        });
      })
    );
    return;
  }

  // API 請求：網路優先，失敗時儲存到離線佇列
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(async err => {
        console.error('[SW] API 请求失败:', url.pathname, err);

        // 只有修改資料的請求才儲存到離線佇列（POST、PUT、DELETE）
        const method = request.method.toUpperCase();
        if (method === 'POST' || method === 'PUT' || method === 'DELETE') {
          try {
            // 讀取請求體
            const requestClone = request.clone();
            let requestBody = null;

            try {
              requestBody = await requestClone.json();
            } catch (jsonError) {
              console.warn('[SW] 无法解析请求体为 JSON:', jsonError);
              requestBody = await requestClone.text();
            }

            // 確定操作型別
            let operationType = 'UNKNOWN';
            if (method === 'POST' && url.pathname === '/api/secrets') {
              operationType = 'ADD';
            } else if (method === 'POST' && url.pathname === '/api/secrets/batch') {
              operationType = 'BATCH_ADD';
            } else if (method === 'PUT' && url.pathname.startsWith('/api/secrets/')) {
              operationType = 'UPDATE';
            } else if (method === 'DELETE' && url.pathname.startsWith('/api/secrets/')) {
              operationType = 'DELETE';
            }

            if (operationType === 'UNKNOWN') {
              return new Response(
                JSON.stringify({
                  error: 'Offline Unavailable',
                  detail: 'This request requires an active connection and cannot be queued offline.',
                  offline: true,
                  queued: false
                }),
                {
                  status: 503,
                  statusText: 'Service Unavailable',
                  headers: { 'Content-Type': 'application/json' }
                }
              );
            }

            // 儲存到 IndexedDB
            const operation = {
              type: operationType,
              url: url.pathname,
              method: method,
              data: requestBody,
              headers: {
                'Content-Type': request.headers.get('Content-Type') || 'application/json'
              }
            };

            const operationId = await saveOperation(operation);
            console.log('[SW] 离线操作已保存，等待同步:', operationId, operationType);

            // 註冊 Background Sync
            try {
              await self.registration.sync.register('sync-operations');
              console.log('[SW] Background Sync 已注册');
            } catch (syncError) {
              console.warn('[SW] Background Sync 注册失败:', syncError);
            }

            // 通知前端操作已排隊
            return new Response(
              JSON.stringify({
                success: true,
                queued: true,
                operationId: operationId,
                message: 'You are currently offline. Operation saved and will sync automatically once connected.',
                offline: true
              }),
              {
                status: 202, // Accepted
                statusText: 'Accepted - Queued for sync',
                headers: { 'Content-Type': 'application/json' }
              }
            );
          } catch (saveError) {
            console.error('[SW] 保存离线操作失败:', saveError);
            // 如果儲存失敗，返回標準錯誤
            return new Response(
              JSON.stringify({
                error: 'Network connection failed',
                detail: 'Unable to connect to server, and failed to save offline operation.',
                offline: true
              }),
              {
                status: 503,
                statusText: 'Service Unavailable',
                headers: { 'Content-Type': 'application/json' }
              }
            );
          }
        }

        // GET 請求失敗時返回標準錯誤（不儲存到佇列）
        return new Response(
          JSON.stringify({
            error: 'Network connection failed',
            detail: 'Unable to connect to server, please check your network connection.',
            offline: true
          }),
          {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'application/json' }
          }
        );
      })
    );
    return;
  }
  
  // 主頁和動態內容：網路優先，離線時使用快取（Network First）
  // 這確保使用者總是看到最新版本，只有在離線時才使用快取
  if (url.pathname === '/' || url.pathname === '') {
    event.respondWith(
      fetch(request, { redirect: 'follow' })
        .then(response => {
          // 網路請求成功，更新快取
          if (response && response.status === 200) {
            console.log('[SW] 从网络获取并更新缓存:', url.pathname);
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(request, responseToCache);
            });
          }
          return response;
        })
        .catch(err => {
          // 網路請求失敗（離線），嘗試使用快取
          console.log('[SW] 网络请求失败，使用缓存:', url.pathname, err.message);
          return caches.match(request).then(cachedResponse => {
            if (cachedResponse) {
              console.log('[SW] 从缓存返回（离线模式）:', url.pathname);
              return cachedResponse;
            }
            // 快取也沒有，返回離線頁面提示
            return new Response(
              OFFLINE_PAGE,
              {
                status: 503,
                statusText: 'Service Unavailable',
                headers: { 'Content-Type': 'text/html; charset=utf-8' }
              }
            );
          });
        })
    );
    return;
  }
  
  // 外部資源（CDN 庫、favicon、logo等）
  if (url.origin !== location.origin) {
    // 只快取我們指定的 CDN 資源（jsQR 和 qrcode-generator）
    const isCDNLibrary = CDN_RESOURCES.some(cdn => url.href.startsWith(cdn));
    
    if (isCDNLibrary) {
      // CDN 庫：快取優先策略（使用 CORS 模式）
      event.respondWith(
        caches.match(request).then(cachedResponse => {
          if (cachedResponse) {
            console.log('[SW] CDN 资源从缓存返回:', url.href);
            // 後臺更新策略（stale-while-revalidate）
            fetch(request, { mode: 'cors', redirect: 'follow' }).then(response => {
              if (response && response.status === 200) {
                caches.open(CACHE_NAME).then(cache => {
                  cache.put(request, response);
                  console.log('[SW] CDN 资源已更新缓存:', url.href);
                });
              }
            }).catch(() => {
              // 後臺更新失敗，不影響
            });
            return cachedResponse;
          }
          
          // 快取未命中，從網路獲取（使用 CORS 模式）
          console.log('[SW] CDN 资源从网络获取:', url.href);
          return fetch(request, { mode: 'cors', redirect: 'follow' }).then(response => {
            // 只快取成功的 CORS 響應
            if (response && response.status === 200 && response.type === 'cors') {
              const responseToCache = response.clone();
              caches.open(CACHE_NAME).then(cache => {
                cache.put(request, responseToCache);
                console.log('[SW] CDN 资源已缓存（CORS 模式）:', url.href);
              });
            }
            return response;
          }).catch(err => {
            console.error('[SW] CDN 资源加载失败:', url.href, err);
            // 如果網路失敗，嘗試再次從快取獲取（防止競態條件）
            return caches.match(request).then(cached => {
              if (cached) {
                console.log('[SW] 从缓存降级返回:', url.href);
                return cached;
              }
              throw err;
            });
          });
        })
      );
    } else {
      // 其他外部資源（favicon、logo等）：直接透傳，不快取
      // 這樣可以避免 CORS 錯誤和不必要的快取
      event.respondWith(
        fetch(request, { redirect: 'follow' }).catch(() => {
          // 載入失敗時靜默處理，返回空響應
          // 避免控制台錯誤日誌
          return new Response('', {
            status: 404,
            statusText: 'Not Found'
          });
        })
      );
    }
    return;
  }
  
  // 其他請求：網路優先
  event.respondWith(
    fetch(request, { redirect: 'follow' }).catch(err => {
      console.error('[SW] 请求失败:', url.pathname, err);
      // 返回離線頁面或錯誤資訊
      return new Response('Offline mode: unable to access this resource', {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    })
  );
});

/**
 * 處理推送通知（未來功能）
 */
self.addEventListener('push', event => {
  console.log('[SW] 收到推送通知');
  
  if (!event.data) {
    console.warn('[SW] 推送通知无数据');
    return;
  }
  
  const data = event.data.json();
  const title = data.title || '2FA';
  const options = {
    body: data.body || 'You have a new notification',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200],
    data: data.data || {},
    actions: data.actions || []
  };
  
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

/**
 * 處理通知點選（未來功能）
 */
self.addEventListener('notificationclick', event => {
  console.log('[SW] 通知被点击');
  event.notification.close();
  
  event.waitUntil(
    clients.openWindow('/')
  );
});

/**
 * 處理後臺同步
 * 網路恢復時自動同步離線操作
 */
self.addEventListener('sync', event => {
  console.log('[SW] 后台同步事件触发:', event.tag);

  if (event.tag === 'sync-operations') {
    event.waitUntil(syncPendingOperations().then(result => {
      // Background Sync 以 Promise 拒絕判斷是否需要稍後重試。
      if (result && result.deferredCount > 0) {
        throw new Error('Network unavailable, offline operations pending retry');
      }
    }));
  }
});

/**
 * 同步所有待處理的離線操作
 * @returns {Promise<Object|undefined>} 本批同步結果，包含等待網路恢復的數量
 */
function syncPendingOperations() {
  if (syncPendingOperationsPromise) return syncPendingOperationsPromise;

  const operation = performPendingOperationSync();
  syncPendingOperationsPromise = operation;
  operation.then(
    () => {
      if (syncPendingOperationsPromise === operation) syncPendingOperationsPromise = null;
    },
    () => {
      if (syncPendingOperationsPromise === operation) syncPendingOperationsPromise = null;
    }
  );
  return operation;
}

async function performPendingOperationSync() {
  try {
    console.log('[SW] 开始同步离线操作...');
    const operations = await getPendingOperations();

    if (operations.length === 0) {
      console.log('[SW] 没有待同步的操作');
      return;
    }

    console.log(\`[SW] 找到 \${operations.length} 个待同步操作\`);

    // 按時間戳順序同步
    operations.sort((a, b) => a.timestamp - b.timestamp);

    let successCount = 0;
    let failCount = 0;
    let deferredCount = 0;

    for (const operation of operations) {
      if (self.navigator && self.navigator.onLine === false) {
        deferredCount = operations.length - successCount - failCount;
        break;
      }

      try {
        console.log('[SW] 正在同步操作:', operation.id, operation.type);

        // 構建請求
        const requestOptions = {
          method: operation.method,
          headers: operation.headers || { 'Content-Type': 'application/json' },
          credentials: 'include' // 包含认证 Cookie
        };

        // 新增請求體（如果有）
        if (operation.data && (operation.method === 'POST' || operation.method === 'PUT')) {
          requestOptions.body = typeof operation.data === 'string'
            ? operation.data
            : JSON.stringify(operation.data);
        }

        // 傳送請求
        let response;
        try {
          response = await fetch(operation.url, requestOptions);
        } catch (error) {
          // onLine 不能保證伺服器可達。傳輸失敗不消耗 HTTP 重試額度，
          // 並停止本批，避免掉線後繼續請求後面的操作。
          console.warn('[SW] 网络请求未完成，保留操作等待重试:', operation.id, error);
          deferredCount = operations.length - successCount - failCount;
          break;
        }

        if (response.ok) {
          // 同步成功，刪除操作
          await deleteOperation(operation.id);
          successCount++;
          console.log('[SW] 操作同步成功:', operation.id, operation.type);

          // 通知前端同步成功
          await notifyClients({
            type: 'SYNC_SUCCESS',
            operationId: operation.id,
            operationType: operation.type,
            operationUrl: operation.url
          });
        } else {
          // 同步失敗，增加重試計數
          const newRetryCount = (operation.retryCount || 0) + 1;

          if (newRetryCount >= 5) {
            // 超過最大重試次數，標記為失敗
            await updateOperation(operation.id, {
              status: 'failed',
              retryCount: newRetryCount,
              lastError: \`HTTP \${response.status}: \${response.statusText}\`
            });
            failCount++;
            console.error('[SW] 操作同步失败（超过最大重试次数）:', operation.id);

            // 通知前端同步失敗
            await notifyClients({
              type: 'SYNC_FAILED',
              operationId: operation.id,
              operationType: operation.type,
              operationUrl: operation.url,
              error: \`HTTP \${response.status}\`
            });
          } else {
            // 更新重試計數
            await updateOperation(operation.id, {
              retryCount: newRetryCount,
              lastError: \`HTTP \${response.status}: \${response.statusText}\`
            });
            failCount++;
            console.warn('[SW] 操作同步失败，将重试:', operation.id, \`(\${newRetryCount}/5)\`);
          }
        }
      } catch (error) {
        // 請求構建或本地儲存異常（fetch 傳輸錯誤已在上方單獨處理）
        console.error('[SW] 同步操作时出错:', operation.id, error);
        const newRetryCount = (operation.retryCount || 0) + 1;

        if (newRetryCount >= 5) {
          await updateOperation(operation.id, {
            status: 'failed',
            retryCount: newRetryCount,
            lastError: error.message
          });
          failCount++;
          await notifyClients({
            type: 'SYNC_FAILED',
            operationId: operation.id,
            operationType: operation.type,
            operationUrl: operation.url,
            error: error.message
          });
        } else {
          await updateOperation(operation.id, {
            retryCount: newRetryCount,
            lastError: error.message
          });
          failCount++;
        }
      }
    }

    console.log(\`[SW] 同步完成: 成功 \${successCount} 个, 失败 \${failCount} 个\`);

    // 通知前端同步完成
    const result = {
      type: 'SYNC_COMPLETE',
      successCount,
      failCount,
      deferredCount,
      totalCount: operations.length
    };
    await notifyClients(result);
    return result;

  } catch (error) {
    console.error('[SW] 同步离线操作失败:', error);
  }
}

/**
 * 通知所有客戶端
 * @param {Object} message - 訊息物件
 * @returns {Promise<void>}
 */
async function notifyClients(message) {
  try {
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach(client => {
      client.postMessage(message);
    });
    console.log('[SW] 已通知', clients.length, '个客户端:', message.type);
  } catch (error) {
    console.error('[SW] 通知客户端失败:', error);
  }
}

/**
 * 訊息處理
 * 允許頁面與 Service Worker 通訊
 */
self.addEventListener('message', event => {
  console.log('[SW] 收到消息:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            console.log('[SW] 清除缓存:', cacheName);
            return caches.delete(cacheName);
          })
        );
      }).then(() => {
        console.log('[SW] 所有缓存已清除');
        event.ports[0].postMessage({ success: true });
      })
    );
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }

  if (event.data && event.data.type === 'SYNC_OPERATIONS') {
    event.waitUntil(syncPendingOperations());
  }
});

console.log('[SW] Service Worker 脚本已加载');
`;

	return new Response(swScript, {
		status: 200,
		headers: {
			'Content-Type': 'application/javascript; charset=utf-8',
			'Cache-Control': 'no-cache, no-store, must-revalidate',
			'Service-Worker-Allowed': '/',
			'Access-Control-Allow-Origin': '*',
		},
	});
}
