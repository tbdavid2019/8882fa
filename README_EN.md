# 🔐 888 2FA (8882fa)

A two-factor authentication key management system built on Cloudflare Workers. Free to deploy, globally accelerated, with PWA offline support.

![Version](https://img.shields.io/badge/version-1.9.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Platform](https://img.shields.io/badge/platform-Cloudflare%20Workers-orange)

**[繁體中文](README_TC.md)** · **[简体中文](README.md)**

**Key Features:** TOTP/HOTP code auto-generation · QR code scanning/image recognition/paste screenshot/drag & drop image to add keys · AES-GCM 256-bit encrypted storage · Bulk import from Google Authenticator, Aegis, 2FAS, Bitwarden, etc. · Multi-format export (TXT/JSON/CSV/HTML/Google migration QR codes) · Auto backup & restore · WebDAV/S3/OneDrive/Google Drive remote backup sync · Security/sync/preference settings · Multi-language support (Traditional Chinese / Simplified Chinese / English, with auto-detection) · Light/dark/follow-system themes · Fluent 2-inspired responsive UI

## 📸 Screenshots

|                    Desktop                     |                    Tablet                    |                    Mobile                    |
| :--------------------------------------------: | :------------------------------------------: | :------------------------------------------: |
| ![Desktop](docs/images/screenshot-desktop.png) | ![Tablet](docs/images/screenshot-tablet.png) | ![Mobile](docs/images/screenshot-mobile.png) |

## 🚀 Quick Deployment

### One-Click Deploy (Recommended)

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/tbdavid2019/8882fa)

> One-click deploy is recommended. All users should upgrade in-place via the **Sync Upstream** workflow. Do not upgrade by deleting the Worker, deleting the repository, or reinstalling.

1. Click the button above, log in with GitHub and authorize
2. Log in to your Cloudflare account, click **Deploy** and wait for deployment to complete (KV storage is created automatically)
3. Open the Workers URL provided by Cloudflare, **set your admin password** and start using

> Git auto-build uses the `wrangler.toml` from the repository directly. The current config explicitly declares `SECRETS_KV`, and Wrangler will automatically create the required KV on first deploy and continue reusing the resource bound to the current Worker on subsequent deploys.
> If you manually configure Git build commands in the Cloudflare Dashboard, **use `npm run deploy` as the deploy command, not `npx wrangler deploy` directly**, to preserve the version injection flow and stay consistent with the repository's default deploy entry.

#### Recommended: Enable Data Encryption

After deployment, add a Secret `ENCRYPTION_KEY` in **Cloudflare Dashboard → Worker → Settings → Variables**:

```bash
# Generate encryption key (choose one)
openssl rand -base64 32
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

> `ENCRYPTION_KEY` is the master key for decrypting existing data. **Recommended to set up**, provided you immediately save the original value to a password manager, offline backup, or other secure location.
>
> If you cannot ensure the original value is saved, **it's better to not set it at all than to set it and lose it**:
>
> - Once set: Secret list, auto backups, and WebDAV/S3/OneDrive/Google Drive credentials are all encrypted
> - If lost: Cloudflare will not show the original value again; existing encrypted data and encrypted backups cannot be read or restored
> - Current behavior: When encrypted data is detected but `ENCRYPTION_KEY` is missing, the system locks reads and writes to prevent accidental overwriting of old data

#### Version Updates

This repository (`tbdavid2019/8882fa`) is maintained independently.

> ⚠️ **Always back up your data before upgrading**: Before performing a version update, export your current data via **Bulk Export** or **Restore Config → Export Backup** to prevent data loss in case of unexpected issues.

To update:

1. Pull the latest code locally: `git pull origin main`
2. Deploy: `npm run deploy`, or push to your GitHub repository to trigger automatic Cloudflare deployment.

Upgrades do not affect existing Workers, KV bindings, or Secrets. **If you've already set `ENCRYPTION_KEY`, you don't need to re-enter it.**

## 📖 User Guide

### Adding Keys

Click the **➕** floating button in the bottom right:

- **Scan QR Code** — Camera scan of 2FA QR codes, auto-fill
- **Select Image** — Upload a QR code screenshot, auto-recognize
- **Paste Screenshot** — Ctrl+V to paste QR code screenshots from clipboard (great for PC users without cameras)
- **Drag & Drop Image** — Drag QR code images directly into the dialog, auto-recognize
- **Manual Add** — Enter service name and Base32 secret (expand advanced settings to adjust digits/period/algorithm)

### Daily Use

- **Copy Code**: Click the code digits directly
- **Manage Keys**: Click **⋯** on the top right of a card → View QR Code / Copy URI / Copy page link / Edit / Delete
- **Search**: Real-time search by service name or account name in the top search bar
- **Smart grouping**: Automatically group related services and multiple accounts, with an option to switch back to a flat list
- **Sort**: Sort by add time or name
- **Theme**: Floating action button → **Settings → Preferences → Theme Mode**, then choose light, dark, or follow system

### Bulk Import

Click the floating button → **📥 Bulk Import**, supports file import or text paste.

**Compatible Formats:**

| Source                 | Format                                     |
| ---------------------- | ------------------------------------------ |
| Universal              | `otpauth://` URI text (TXT), CSV, HTML     |
| Google Authenticator   | Migration QR code (`otpauth-migration://`) |
| Aegis                  | JSON export file                           |
| 2FAS                   | `.2fas` export file                        |
| Bitwarden              | JSON or Authenticator CSV export           |
| LastPass Authenticator | JSON export file                           |
| andOTP                 | JSON export file                           |
| Ente Auth              | Export file                                |

### Bulk Export

Click the floating button → **📤 Bulk Export**, supports TXT, JSON, CSV, HTML formats, as well as generating **Google Authenticator migration QR codes** (can be scanned to import directly).
Standard TXT / JSON / CSV / HTML exports prefer the unified backend format while online, and automatically fall back to a compatible local export when offline or when the request body is too large.

### Backup & Restore

The system backs up automatically (triggered on data changes + daily scheduled check), keeping the latest 100 backups (adjustable in settings).
New backup files follow **Settings → Default Export Format**. Remote auto-backups use the same extension (`txt`, `json`, `csv`, or `html`).

Click the floating button → **🔄 Restore Config** to view backup list, preview content, restore, or export; you can also upload a `backup_*.(txt|json|csv|html)` file downloaded from WebDAV/S3/OneDrive/Google Drive to preview and restore it.

#### Remote Backup

Supports syncing backups to remote storage, automatically pushing on data changes, with multiple backup targets configurable:

- **WebDAV** — Supports standard WebDAV protocol cloud drives or self-hosted services (⚠️ Does not support Cloudflare-proxied services like Nutstore/jianguoyun, which trigger 520 loop errors)
- **S3-Compatible Storage** — Supports AWS S3, Cloudflare R2, MinIO, Alibaba Cloud OSS, and other S3-compatible services
- **OneDrive** — After Microsoft OAuth authorization, backups are written into a subfolder inside the app-specific OneDrive folder
- **Google Drive** — After Google OAuth authorization, backups are written into the configured Google Drive folder

Add and manage remote backup targets in **Settings → Sync Settings**.

Remote backups store the same backup content generated by the app. If `ENCRYPTION_KEY` was configured when the backup was created, the remote file is encrypted ciphertext too; restoring it requires keeping the same `ENCRYPTION_KEY` in the Worker.

Detailed setup steps: [Cloud Drive Setup](docs/CLOUD_DRIVE_SETUP.md) (currently Chinese).

### Settings

Click the floating button → **⚙️ Settings**:

- **Change Password** — Change the admin password
- **Theme Mode** — Choose light, dark, or follow system
- **Code Transition Animation** — Disable animations or choose flow, flip, or spotlight
- **Login Validity** — Customize JWT expiration time
- **Default Export Format** — Controls the default export choice and the extension used for newly created backups and remote auto-backups
- **Backup Retention Count** — Adjust auto backup retention count
- **Remote Backup** — Configure WebDAV/S3/OneDrive/Google Drive backup targets
- **Sign Out** — One-click clear of the current session cookie and local cache; still works locally when the server is unreachable

### Install as Mobile App (PWA)

- **iOS**: Open in Safari → Share button → Add to Home Screen
- **Android**: Open in Chrome → Menu (⋮) → Add to Home Screen

After installation, use it like a native app in full screen with offline access support.

## 🔒 Security

- **Password**: PBKDF2-SHA256 (100,000 iterations) salted hash, JWT stored in HttpOnly + Secure + SameSite=Strict cookies
- **Data Encryption**: With `ENCRYPTION_KEY` configured, all secrets, backups, and WebDAV/S3/OneDrive/Google Drive credentials are encrypted with AES-GCM 256-bit; make sure to save the original key — encrypted data cannot be decrypted if lost
- **Transport**: HTTPS throughout, TLS 1.2+
- **Privacy**: OTP generated client-side, no usage data collected, fully open source
- **Login Validity**: Default 30 days, customizable in settings, auto-renewed on active use (auto-extended when < 7 days remaining)

## 🔗 Public OTP API

Generate verification codes directly via URL without logging in:

```
https://your-worker.workers.dev/otp/YOUR_SECRET_KEY
https://your-worker.workers.dev/otp/YOUR_SECRET_KEY?digits=8&period=60
https://your-worker.workers.dev/otp/YOUR_SECRET_KEY?type=hotp&counter=5
```

Parameters: `type` (totp/hotp), `digits` (6/8), `period` (30/60/120), `algorithm` (sha1/sha256/sha512), `counter` (for HOTP)

TOTP pages show both the current and next codes, each available to copy, and update in place when the period ends. HOTP pages use the counter specified in the link; copying does not advance it.

## 📚 More Documentation

| Document                                       | Description                                   |
| ---------------------------------------------- | --------------------------------------------- |
| [Deployment Guide](docs/DEPLOYMENT.md)         | Manual deployment, KV config, Secrets         |
| [Cloud Drive Setup](docs/CLOUD_DRIVE_SETUP.md) | OneDrive / Google Drive setup steps (Chinese) |
| [API Reference](docs/API_REFERENCE.md)         | Complete API endpoint documentation           |
| [Architecture](docs/ARCHITECTURE.md)           | System architecture & technical design        |
| [Development Guide](docs/DEVELOPMENT.md)       | Local development, testing, code style        |
| [PWA Guide](docs/PWA_GUIDE.md)                 | PWA installation & offline features           |

## 🤝 Contributing

Welcome to submit [Issues](https://github.com/tbdavid2019/8882fa/issues) and [Pull Requests](https://github.com/tbdavid2019/8882fa/pulls). For development details, see the [Development Guide](docs/DEVELOPMENT.md).

## 📄 License

[MIT License](LICENSE)

## 🌟 Star History

<p align="center">
  <a href="https://github.com/tbdavid2019/8882fa/tree/star-history">
    <img alt="Star History Chart" src="https://raw.githubusercontent.com/tbdavid2019/8882fa/refs/heads/star-history/star-history.svg" />
  </a>
</p>

---

<div align="center">

**If this project helps you, please give it a ⭐**

Made with ❤️ by [tbdavid2019](https://github.com/tbdavid2019) (originally based on [wuzf/2fa](https://github.com/wuzf/2fa))

</div>
