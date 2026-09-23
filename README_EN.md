# 🔐 888 2FA

A fast, modern, and privacy-first Two-Factor Authentication (2FA) manager powered by Cloudflare Workers. Free edge deployment, global acceleration, comprehensive PWA offline capabilities, and instant WebAuthn / Passkey biometric sign-in.

**[繁體中文](README.md) · [English](README_EN.md)**

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
