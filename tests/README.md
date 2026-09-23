# 測試套件

## 🎯 快速開始

```bash
# 一次性執行所有測試，適合提交前檢查和 CI
npm test -- --run

# 觀察模式（自動重跑）
npm run test:watch

# 互動式 UI
npm run test:ui

# 生成覆蓋率報告並退出
npm run test:coverage -- --run

# 僅執行主題切換回歸測試
npx vitest run tests/ui/theme-transition.test.js
```

## 📊 測試結果與驗證範圍

測試數量、通過/跳過情況以當次執行輸出為準；覆蓋率以 `npm run test:coverage -- --run` 生成的報告為準。本文不維護固定的覆蓋率百分比，也不把歷史測試結果作為當前狀態。

部分測試包含耗時上限斷言，用於在測試環境中發現明顯退化。它們不是生產環境延遲、瀏覽器幀率或可用性承諾；評估效能時應記錄裝置、執行環境、輸入規模及實際測量結果。

Vitest 預設使用 Node 環境。前端測試會執行生成指令碼、構造模擬 DOM 或檢查生成的 HTML/CSS；通過這些測試不等於已經完成真實瀏覽器的動畫、攝像頭、PWA 安裝或第三方雲服務驗收。

## 🔑 功能與迴歸覆蓋

以下列出主要場景及對應測試入口；完整清單以測試目錄為準。

| 範圍             | 主要驗證內容                                                                    | 測試入口                                                                                                                                                                                                                                                                                                           |
| ---------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| OTP 演算法       | RFC 6238 的 SHA1/SHA256/SHA512 向量、RFC 4226 HOTP 向量、Base32、引數和週期邊界 | [generator.test.js](otp/generator.test.js)                                                                                                                                                                                                                                                                         |
| 資料加密         | AES-GCM 往返、錯誤金鑰、篡改、IV 隨機性、中文和加密配置缺失                     | [encryption.test.js](utils/encryption.test.js)                                                                                                                                                                                                                                                                     |
| 認證             | 密碼雜湊、JWT 與 Cookie；真實認證模組的設定、登入、重新整理、登出和限流整合     | [auth.test.js](utils/auth.test.js)、[auth.integration.test.js](utils/auth.integration.test.js)                                                                                                                                                                                                                     |
| 校驗、響應與安全 | Base32/OTP 引數、標準響應、同源檢查、CORS 和安全頭                              | [validation.test.js](utils/validation.test.js)、[response.test.js](utils/response.test.js)、[security.test.js](utils/security.test.js)                                                                                                                                                                             |
| 請求限流         | 預設滑動視窗、固定視窗相容路徑、視窗邊界、客戶端識別、拒絕響應和 KV 錯誤處理    | [rateLimit.test.js](utils/rateLimit.test.js)、[rateLimitSlidingWindow.test.js](utils/rateLimitSlidingWindow.test.js)                                                                                                                                                                                               |
| 金鑰與 HOTP      | CRUD、批次匯入、計數器推進與衝突、離線同步約束                                  | [secrets.test.js](api/secrets.test.js)、[hotp-counter.test.js](api/hotp-counter.test.js)、[hotp-offline-sync-contract.test.js](scripts/hotp-offline-sync-contract.test.js)                                                                                                                                         |
| 備份與恢復       | 事件觸發、併發合併、補償備份、加密、保留數量與備份格式                          | [backup.test.js](utils/backup.test.js)、[backup.test.js](api/backup.test.js)、[backup-format.test.js](utils/backup-format.test.js)                                                                                                                                                                                 |
| 雲同步           | WebDAV/S3/OneDrive/Google Drive 配置與請求行為、OAuth、編輯觸發同步             | [api/](api/)、[utils/](utils/)、[edit-triggers-sync.test.js](integration/edit-triggers-sync.test.js)                                                                                                                                                                                                               |
| 匯入匯出         | 格式識別、CSV 欄位轉義、URI/HOTP 引數往返、Unicode 二維碼與遷移預覽             | [import-code.test.js](scripts/import-code.test.js)、[uri-export-roundtrip.test.js](ui/uri-export-roundtrip.test.js)、[qr-text-encoding.test.js](ui/qr-text-encoding.test.js)                                                                                                                                       |
| 前端互動         | 鍵盤導航、服務分組、偏好自動儲存、主題連續反向切換與視口篩選                    | [card-keyboard-navigation.test.js](scripts/card-keyboard-navigation.test.js)、[smart-aggregation-rendering.integration.test.js](scripts/smart-aggregation-rendering.integration.test.js)、[preferences-autosave.test.js](ui/preferences-autosave.test.js)、[theme-transition.test.js](ui/theme-transition.test.js) |
| OTP 頁面與排程   | 時間校準、批次重新整理、動效清理、複製、公開 TOTP 過期處理和 HOTP 固定計數器    | [otp-time-sync.test.js](scripts/otp-time-sync.test.js)、[otp-promotion-scheduler.test.js](scripts/otp-promotion-scheduler.test.js)、[quick-otp.test.js](ui/quick-otp.test.js)                                                                                                                                      |
| PWA 與指令碼輸出 | 離線主頁回退、佇列保留、生成指令碼可解析性                                      | [serviceworker-offline.test.js](ui/serviceworker-offline.test.js)、[hotp-offline-sync-contract.test.js](scripts/hotp-offline-sync-contract.test.js)、[emitted-scripts-parse.test.js](scripts/emitted-scripts-parse.test.js)                                                                                        |
| 國際化 (i18n)    | 多語言字典完整性、瀏覽器語言解析、DOM 動態翻譯、日期與字串排序                  | [i18n.test.js](scripts/i18n.test.js)                                                                                                                                                                                                                                                                               |
| 部署與構建       | 部署配置、釋出構建                                                              | [deploy-config.test.js](scripts/deploy-config.test.js)、[build-release-code.test.js](scripts/build-release-code.test.js)                                                                                                                                                                                           |
| 日誌與監控       | 日誌過濾、脫敏、請求記錄、計時和錯誤監控                                        | [logger.test.js](utils/logger.test.js)、[monitoring.test.js](utils/monitoring.test.js)                                                                                                                                                                                                                             |

`auth.test.js` 包含認證函式副本的單元測試；驗證生產模組的整合行為時，應同時檢視直接匯入實現的 `auth.integration.test.js`。

## 📁 測試檔案結構

```text
tests/
├── api/          # 金鑰、備份、設定及雲同步 API
├── integration/  # 跨模組整合場景
├── otp/          # TOTP/HOTP 演算法與測試向量
├── router/       # 路由和認證邊界
├── scripts/      # 前端指令碼、排程、匯入匯出和互動
├── ui/           # 頁面生成、樣式、PWA 與迴歸測試
├── utils/        # 加密、認證、備份、限流等工具
├── fixtures/     # 匯入匯出和同步測試樣例
└── setup.js      # Vitest 公共測試環境
```

## 📈 覆蓋率詳情

覆蓋率報告生成在 `coverage/` 目錄，可用瀏覽器開啟 `coverage/index.html`。當前 [vitest.config.js](../vitest.config.js) 使用 V8 provider，統計 `src/**/*.js`，排除 `src/ui/**`、`src/worker.js` 和測試檔案。因此報告中的覆蓋率不代表頁面互動或 Worker 入口已經完整驗證。

## 💡 編寫和維護測試

1. 在對應目錄建立 `.test.js` 檔案，使用 Vitest 的 `describe` 和 `it`。
2. 優先執行實際模組或生成指令碼，圍繞使用者可觀察的行為和明確失敗條件編寫斷言。
3. 使用虛擬金鑰、模擬儲存和請求替身；第三方實連驗證另行記錄環境與範圍。
4. 新增或修復功能時先執行相關測試，再按影響範圍執行完整套件。

後續繼續補充真實瀏覽器端到端覆蓋，併為 OTP 批次重新整理、主題切換和大規模匯入匯出保留可重複的效能測量。

## 📚 參考

- [開發指南](../docs/DEVELOPMENT.md)
- [Vitest 文件](https://vitest.dev/)
- [RFC 6238 - TOTP](https://tools.ietf.org/html/rfc6238)
- [RFC 4226 - HOTP](https://tools.ietf.org/html/rfc4226)
