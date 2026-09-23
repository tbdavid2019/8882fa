# 更新日誌 (Changelog)

本專案遵循語義化與日期版本規範，記錄 **888 2FA** 的所有重要功能更新、安全性改進與錯誤修復。

---

## [v1.9.1] - 2026-09-23

### 變更 (Changed)

- 手機主畫面改為搜尋欄獨立一列，語系、主題與排序控制改用精簡圖示操作。
- 語系選單與深淺色切換移至主畫面，支援鍵盤及觸控操作。
- 主題配色採用 Pantone Mocha Mousse／Relaxed Elegance 暖中性色方向。
- 主介面採用自託管 Maple Mono 與 Maple Mono CN 字型子集。

---

## [v2026.09.23] - 2026-09-23

### 新增 (Added)

- **WebAuthn / Passkey / Touch ID 生物辨識與通行密鑰登入**：
  - 依照 FIDO2 標準，在 Cloudflare Workers 邊緣運行時使用純 Web Crypto API 實作零依賴 Passkey 認證模組。
  - 後端支援挑戰碼防重放攻擊（One-time Challenge with TTL）、ASN.1 DER 轉 64 位元 IEEE P1363 簽名轉換、P-256 (ES256) 密碼學邊緣驗證。
  - 登入視窗新增「使用 Touch ID / 通行密鑰登入」按鈕，支援 Apple Touch ID / Face ID、Windows Hello、Android 生物辨識與實體 FIDO2 安全金鑰。
  - 系統設定「安全性」面板新增「通行密鑰與 Touch ID」管理專區，支援一對多憑證命名、註冊綁定與隨時刪除。
- **PWA (Progressive Web App) 浮動安裝提示與全離線強化**：
  - 新增現代質感浮動安裝橫幅（`#pwaInstallBanner`），於 Chromium / Android 智慧攔截並提供原生一鍵安裝體驗。
  - 針對 iOS Safari 自動切換為視覺化「分享 ➔ 加入主畫面」圖文引導。
  - 支援 PWA 獨立視窗（Standalone）模式自動偵測隱藏，並具備 7 天關閉防打擾本機記憶機制。
- **SEO & Open Graph 品牌形象升級**：
  - 導入專屬「888 元素科技鎖頭」高解析圖標與 1200x630 社群分享封面圖（`/og-image.jpg`）。
  - 補齊完整的 `og:image`, `og:url`, `og:site_name`, `og:locale` (`en_US`, `zh_TW`, `zh_CN`) 與 `twitter:card` (`summary_large_image`)。
  - 置入符合作業標準的 Canonical 網址、無障礙 `<h1 class="sr-only">` 以及 Schema.org `WebApplication` JSON-LD 結構化資料。
- **單元測試擴充**：
  - 新增 `tests/api/webauthn.test.js`，全面覆蓋 Base64URL 編解碼、DER 簽名轉換、CBOR 解碼、Attestation 解析及真實 Web Crypto ECDSA 驗證流程（全套 77 個測試檔、1,534 項測試全數綠燈）。

### 變更 (Changed)

- **開源授權協議升級**：
  - 正式將專案授權條款升級為 **GNU Affero General Public License v3.0 (AGPL-3.0)**，保護網路服務開源自由與社群貢獻。
- **文件規範調整**：
  - 重構 `README.md`，全面採用**繁體中文**與**英文**雙語結構，移除簡體中文版 Readme。
  - 特別感謝原作者 [wuzf](https://github.com/wuzf) 的架構設計與開放源碼貢獻。

---

## [v2026.09.22] - 2026-09-22

### 新增 (Added)

- **多雲端遠端備份同步系統**：
  - 支援 WebDAV（Nextcloud、Synology、堅果雲等）自動增量備份與驗證。
  - 支援 Amazon S3 相容物件儲存（Cloudflare R2、AWS S3、MinIO、Backblaze B2）自動推播。
  - 支援 Microsoft OneDrive 與 Google Drive OAuth 整合備份。
- **極致精確的客戶端時間校準 (`/api/time`)**：
  - 提供輕量無狀態時間同步端點，客戶端自動偵測並補償本機時鐘偏差，解決裝置時鐘不準導致 OTP 驗證碼失效的問題。

### 變更 (Changed)

- **全域語言純淨化與體驗升級**：
  - 系統預設語言設定為 English，繁體中文（`zh-TW`）遵循台灣在地正體中文用語標準。
  - 登入會話全面採用安全 HttpOnly SameSite=Strict Cookie 儲存 JWT，並具備背景自動靜默續期機制。

### 安全性 (Security)

- 強化 AES-GCM 256 位元資料加密儲存機制。
- 引進防暴力破解滑動視窗速率限制（Rate Limiting）。
