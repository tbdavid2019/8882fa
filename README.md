# 🔐 888 2FA

基於 Cloudflare Workers 的極速、現代化兩步驟驗證（2FA）金鑰管理系統。免費部署、全球邊緣加速、完整 PWA 離線支援與 WebAuthn / Passkey 生物辨識快速登入。

**[繁體中文](#-888-2fa) · [English](#-888-2fa-english)**

[![Version](https://img.shields.io/badge/version-1.9.1-blue.svg)](CHANGELOG.md)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-green.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Cloudflare%20Workers-orange.svg)](https://workers.cloudflare.com/)

> 💖 **致敬與感謝**：本專案基於原作者 [wuzf](https://github.com/wuzf) 的優秀開源專案 [wuzf/2fa](https://github.com/wuzf/2fa) 進行深度演進與功能拓展。由衷感謝原作者的開源貢獻與架構設計！

---

## 🌟 888 2FA 核心亮點

- 🛡️ **WebAuthn / Passkey / Touch ID 邊緣免密登入**：
  在 Cloudflare Workers 邊緣運行時以**純 Web Crypto API 零外部依賴**實作 FIDO2 密鑰認證。支援 Apple Touch ID / Face ID、Windows Hello、Android 生物辨識與 YubiKey 實體金鑰一鍵登入，並可在「系統設定」隨時管理與綁定多台裝置通行密鑰。
- 📱 **原生級 PWA 離線體驗與智慧安裝提示**：
  支援完整 PWA 離線運作，即使完全斷網亦可在本機即時計算 TOTP / HOTP 驗證碼；內建智慧浮動安裝提示條（Chromium / Android 一鍵調用原生安裝、iOS Safari 加入主畫面指引、獨立視窗 Standalone 模式自動適配）。
- 🎨 **全新 888 品牌識別與 100/100 SEO & Open Graph**：
  具現代深藍漸層與科技質感的 888 專屬鎖頭圖標，自動輸出向量 SVG、高解析 Favicon (32x32 / 16x16)、Apple Touch Icon (180x180) 以及 1200x630 社群分享封面圖（`/og-image.jpg`），並完整支援 Schema.org JSON-LD 結構化資料。
- ☁️ **全能雲端備份與多端同步**：
  支援 WebDAV（Nextcloud、Synology、堅果雲等）、Amazon S3 相容儲存（Cloudflare R2、AWS S3、MinIO）、Microsoft OneDrive 與 Google Drive 自動背景推播與還原。
- ⏱️ **極致精確的客戶端時間校準 (`/api/time`)**：
  內建輕量無狀態時間同步端點，自動修正使用者裝置時鐘偏差，徹底解決本機時間不準造成驗證碼失效的問題。
- 🔒 **端到端軍規級安全保護**：
  支援 AES-GCM 256 位元金鑰儲存加密；防暴力破解滑動視窗限流（Rate Limiting）；登入憑證採用 HttpOnly、SameSite=Strict 安全 Cookie，具備背景自動靜默續期機制。
- 🔄 **主流驗證器無縫遷移與多格式匯入匯出**：
  支援 Google Authenticator 轉移 QR Code 掃描與產生，相容 Aegis、2FAS、Bitwarden、FreeOTP，支援 JSON、CSV、TXT、HTML（可選內嵌或不含 QR Code）備份檔。

---

## 📸 介面預覽

|                  桌面端介面                   |                  平板端介面                  |                  行動端介面                  |
| :-------------------------------------------: | :------------------------------------------: | :------------------------------------------: |
| ![桌面端](docs/images/screenshot-desktop.png) | ![平板端](docs/images/screenshot-tablet.png) | ![手機端](docs/images/screenshot-mobile.png) |

---

## 🚀 快速部署到 Cloudflare Workers

### 方式一：一鍵部署（推薦）

點擊下方按鈕將專案一鍵自動部署至您的 Cloudflare 帳戶：

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/tbdavid2019/8882fa)

1. 點選按鈕，授權使用 GitHub 帳號登入。
2. 登入 Cloudflare 帳戶，點選 **Deploy** 等待自動建立 Worker 與 `SECRETS_KV` 儲存空間。
3. 開啟 Cloudflare 提供的網址（如 `https://8882fa.your-subdomain.workers.dev`），**設定主管理密碼**即可開始使用！

> 💡 **提示**：若在 Cloudflare Dashboard 中設定 Git 自動建置，請將部署指令設定為 `npm run deploy`，以確保 Service Worker 版本自動注入。

---

### 方式二：本機指令手動部署

```bash
# 1. 複製儲存庫
git clone https://github.com/tbdavid2019/8882fa.git
cd 8882fa

# 2. 安裝相依套件
npm install

# 3. 本機開發除錯
npm run dev

# 4. 部署至 Cloudflare Workers
npm run deploy
```

---

### 推薦安全設定：啟用主資料加密金鑰

強烈建議在 **Cloudflare Dashboard → Workers → 您的 8882fa Worker → Settings → Variables** 中新增環境變數密鑰 `ENCRYPTION_KEY`：

```bash
# 產生 256-bit 高強度 Base64 加密密鑰（任選一種）
openssl rand -base64 32
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

> ⚠️ **重要提醒**：請務必將此密鑰妥善保存於離線安全密碼庫中。設定後，金鑰庫、雲端同步備份與憑證均會以 AES-GCM 256 位元加密；若遺失此密鑰，舊有加密資料將無法復原。

---

## 🔑 通行密鑰 (Passkey / Touch ID) 設定指引

1. 以主密碼登入後，點擊右下角浮動選單中的 **設定**（齒輪圖示）。
2. 在 **安全性** 面板中找到 **通行密鑰與 Touch ID**。
3. 點選 **新增通行密鑰**，為當前裝置命名（例如 `MacBook Pro Touch ID` 或 `iPhone Face ID`）。
4. 依瀏覽器提示進行指紋或臉部辨識，完成綁定。
5. 下次造訪時，在登入視窗直接點選 **使用 Touch ID / 通行密鑰登入**，無須手動輸入主密碼即可瞬間解鎖！

---

## 📄 開源授權

本專案採用 **[GNU Affero General Public License v3.0 (AGPL-3.0)](LICENSE)** 授權開源。

```text
Copyright (C) 2026 tbdavid2019 <https://github.com/tbdavid2019>
Portions Copyright (C) 2024 wuzf <https://github.com/wuzf>
```

---

---

# 🔐 888 2FA (English)

A fast, modern, and privacy-first Two-Factor Authentication (2FA) manager powered by Cloudflare Workers. Free edge deployment, global acceleration, comprehensive PWA offline capabilities, and instant WebAuthn / Passkey biometric sign-in.

[![Version](https://img.shields.io/badge/version-1.9.1-blue.svg)](CHANGELOG.md)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-green.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Cloudflare%20Workers-orange.svg)](https://workers.cloudflare.com/)

> 💖 **Acknowledgements**: This project is built upon the wonderful foundation of [wuzf/2fa](https://github.com/wuzf/2fa) by [wuzf](https://github.com/wuzf). Deepest gratitude to the original author for the outstanding design and open-source contribution!

---

## 🌟 Key Features

- 🛡️ **WebAuthn / Passkey / Touch ID Biometric Sign-in**:
  Native zero-dependency FIDO2 authentication running directly on Cloudflare Workers edge using Web Crypto API. Sign in seamlessly with Apple Touch ID, Face ID, Windows Hello, Android Biometrics, or YubiKey hardware keys. Manage multiple registered devices under Settings.
- 📱 **Native-Grade PWA & Smart Install Banner**:
  Full Progressive Web App offline support. Generates TOTP/HOTP verification codes locally even when offline. Includes an intelligent install banner (Chromium/Android one-click prompt, iOS Safari "Add to Home Screen" instructions, and automatic concealment in standalone mode).
- 🎨 **888 Brand Identity & 100/100 SEO / Open Graph**:
  Modern deep blue gradient with 888 padlock icon. Generates scalable vector SVG, crisp 32x32 & 16x16 Favicons, Apple Touch Icon (180x180), high-res PWA icons, and 1200x630 social cards (`/og-image.jpg`) with schema.org JSON-LD structured metadata.
- ☁️ **Multi-Cloud Backup & Real-Time Sync**:
  Automatic push and restore across WebDAV (Nextcloud, Synology), S3-compatible storage (Cloudflare R2, AWS S3, MinIO), Microsoft OneDrive, and Google Drive.
- ⏱️ **Precision Server Time Calibration (`/api/time`)**:
  Zero-latency stateless time sync endpoint automatically offsets device clock discrepancies, eliminating OTP code invalidation caused by inaccurate system clocks.
- 🔒 **End-to-End Security & Hardened Privacy**:
  Zero-knowledge client-side AES-GCM 256-bit encryption for keys and backups; sliding-window rate limiting against brute force; secure HttpOnly SameSite=Strict Cookie JWT sessions with automatic silent renewal.
- 🔄 **Universal Migration & Multi-Format Import/Export**:
  Import and export Google Authenticator migration QR codes, Aegis, 2FAS, Bitwarden, and FreeOTP. Supports HTML (with or without embedded QR codes), JSON, CSV, and plain TXT.

---

## 📸 Interface Preview

|                   Desktop UI                   |                  Tablet UI                   |                  Mobile UI                   |
| :--------------------------------------------: | :------------------------------------------: | :------------------------------------------: |
| ![Desktop](docs/images/screenshot-desktop.png) | ![Tablet](docs/images/screenshot-tablet.png) | ![Mobile](docs/images/screenshot-mobile.png) |

---

## 🚀 Quick Deployment to Cloudflare Workers

### Option 1: One-Click Deploy (Recommended)

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/tbdavid2019/8882fa)

1. Click the deploy button and authorize with GitHub.
2. Sign in to Cloudflare and click **Deploy**. KV storage (`SECRETS_KV`) will be initialized automatically.
3. Open your deployed Worker URL, set your master password, and start securing your accounts!

---

### Option 2: Local CLI Deployment

```bash
# 1. Clone repository
git clone https://github.com/tbdavid2019/8882fa.git
cd 8882fa

# 2. Install dependencies
npm install

# 3. Local development
npm run dev

# 4. Deploy to Cloudflare Workers
npm run deploy
```

---

### Recommended: Enable Master Data Encryption

Add secret variable `ENCRYPTION_KEY` in **Cloudflare Dashboard → Workers → Your 8882fa Worker → Settings → Variables**:

```bash
# Generate 256-bit Base64 secret key
openssl rand -base64 32
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

---

## 🔑 Passkey & Touch ID Enrollment

1. Sign in with your master password, then open **Settings** (gear icon) in the floating action menu.
2. In the **Security** tab, locate **Passkeys & Touch ID**.
3. Click **Add Passkey** and provide a friendly name (e.g. `MacBook Pro Touch ID` or `iPhone Face ID`).
4. Follow your browser's prompt to verify your biometric fingerprint or face.
5. On subsequent visits, click **Sign in with Touch ID / Passkey** on the login modal to log in instantly!

---

## 📄 License

This project is licensed under the **[GNU Affero General Public License v3.0 (AGPL-3.0)](LICENSE)**.

```text
Copyright (C) 2026 tbdavid2019 <https://github.com/tbdavid2019>
Portions Copyright (C) 2024 wuzf <https://github.com/wuzf>
```
