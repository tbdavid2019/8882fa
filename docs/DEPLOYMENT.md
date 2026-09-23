# 🚀 部署指南 (Deployment Guide)

本檔案提供完整的部屬與配置教學，涵蓋兩種部署方式：

- **[一鍵部署](#一鍵部署)** — 點選按鈕即可完成，適合大多數使用者
- **[命令列部署](#命令列部署)** — 適合開發者或需要自訂設定的使用者

---

## 🔒 開源安全與本地配置隔離機制

本專案為公開開源儲存庫（Public Repo）。為保障個人資訊安全與程式碼純淨：

- **`wrangler.toml`** 保持純淨通用配置，絕不寫死任何個人的 Cloudflare `account_id` 或私人自訂網域。
- **提供範本**：
  - `wrangler.toml.template`：完整的 Cloudflare Workers 配置範本與引數說明。
  - `.env.example`：本地部署環境變數範本。
- **本地部署自動化**：
  複製 `.env.example` 為 `.env`（已列入 `.gitignore`，絕不上傳 GitHub）。執行 `npm run deploy` 時，部署指令碼會自動讀取 `.env` 並動態套用 `CLOUDFLARE_ACCOUNT_ID` 與 `CUSTOM_DOMAIN`，部署完成後立即無條件還原乾淨的 `wrangler.toml`。

---

## 一鍵部署

**部署時間**：約 5 分鐘

### 第 1 步：部署 Worker

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/tbdavid2019/8882fa)

1. 點選上方部署按鈕，使用 GitHub 登入並授權
2. 登入 Cloudflare 帳戶，點選 **Deploy** 等待部署完成
3. 記下您的 Worker URL（如 `https://8882fa-xxxx.workers.dev`）

> 專案 `wrangler.toml` 已宣告 `SECRETS_KV`，Wrangler 會在首次部署時自動建立所需 KV 並在後續部署中複用，無需手動建立。  
> 若您在 Cloudflare Dashboard 中設定 Git 自動建置，**部署指令請使用 `npm run deploy`，不要直接寫 `npx wrangler deploy`**，以保留版本注入與自訂網域繫結流程。

### 第 2 步：（強烈建議）設定加密金鑰

設定 `ENCRYPTION_KEY` 後，金鑰資料將使用 AES-GCM 256 位元高強度加密儲存。

1. 產生加密金鑰（任選一種方式）：

   ```bash
   openssl rand -base64 32
   # 或
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```

   無命令列環境時，也可以在瀏覽器按 `F12` 開啟主控臺（Console）執行：

   ```javascript
   btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
   ```

2. 在 Cloudflare Dashboard 中開啟您的 Worker → **Settings** → **Variables and Secrets** → **Add**：
   - **Type**: `Secret`
   - **Variable name**: `ENCRYPTION_KEY`
   - **Value**: 貼上剛才產生的金鑰
   - 點選 **Save and deploy**

⚠️ **重要**：`ENCRYPTION_KEY` 是解密資料的唯一主金鑰，Cloudflare 儲存後不會再次顯示原值。請立即將其儲存到密碼管理器——**若遺失將無法恢復已加密的資料**。

### 第 3 步：設定管理密碼與 Passkey

訪問您的 Worker URL，首次訪問會自動引導至 `/setup` 設定頁面：

1. 設定管理密碼（至少 8 位，包含大小寫字母、數字與特殊符號）
2. 確認密碼後點選「完成設定」，自動登入進入主頁
3. 登入後可在頂部安全橫幅點選「立即啟用 Passkey」，繫結 Touch ID / Face ID 快速免密登入

✅ 部署完成，可以開始管理您的 2FA 金鑰與安裝 PWA 了！

---

## 命令列部署

**適合物件**：熟悉命令列，本機已安裝 [Node.js](https://nodejs.org/)（LTS 版本）和 [Git](https://git-scm.com/)。

### 步驟 1：複製專案並安裝依賴

```bash
git clone https://github.com/tbdavid2019/8882fa.git
cd 8882fa
npm install
```

### 步驟 2：登入 Cloudflare

```bash
npx wrangler login
```

瀏覽器會自動開啟授權頁面，點選 **Allow** 完成授權。

### 步驟 3：設定本地部署環境變數（保護隱私）

複製範本檔案 `.env.example` 為 `.env`：

```bash
cp .env.example .env
```

編輯 `.env` 檔案（此檔案已被 `.gitignore` 排除，絕不會被推送到 GitHub）：

```bash
# Cloudflare 帳戶 ID（多帳號環境下可自動鎖定目標帳號）
CLOUDFLARE_ACCOUNT_ID=你的_cloudflare_account_id

# 自訂網域（可選：自動繫結並預熱自訂網域，消除 403 路由空窗）
CUSTOM_DOMAIN=2fa.yourdomain.com
```

### 步驟 4：建立 KV 名稱空間（若由指令碼自動處理可跳過）

若是首次部署，`npm run deploy` 會自動偵測並建立；若需手動建立可執行：

```bash
npx wrangler kv namespace create SECRETS_KV            # 生產環境
npx wrangler kv namespace create SECRETS_KV --preview  # 預覽環境
```

如需手動固定 KV ID，可參考 `wrangler.toml.template` 於 `wrangler.toml` 填寫。

### 步驟 5：（強烈建議）設定加密金鑰

```bash
# 1. 產生 256 位元加密金鑰
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# 2. 設定為 Cloudflare Secret
npx wrangler secret put ENCRYPTION_KEY
```

### 步驟 6：執行部署

```bash
npm run deploy
```

部署指令碼流程：

1. 自動生成 Service Worker 版本號（時間戳）
2. 讀取本地 `.env`，動態注入版本、`CUSTOM_DOMAIN` 路由與 `CLOUDFLARE_ACCOUNT_ID`
3. 執行 `wrangler deploy` 發布
4. 部署完畢後**自動還原 `wrangler.toml`**，確保本地 Git 工作區保持乾淨

部署完成後訪問終端輸出的 URL 或您的自訂網域，即可完成初始設定。

---

## 自訂網域與 403 路由問題說明

### 為什麼會出現 403 錯誤？

當 Cloudflare Worker 發布新版本時，若 Worker 設定檔未宣告自訂網域的路由觸發器，Cloudflare 邊緣節點在切換版本期間可能會產生數秒至數分鐘的路由空窗（Routing Propagation Gap），導致存取自訂網域時回傳 403 Forbidden。

### 解決方案

在本地 `.env` 中設定：

```bash
CUSTOM_DOMAIN=2fa.yourdomain.com
```

每次執行 `npm run deploy` 時，指令碼會於記憶體中動態將自訂網域宣告進部署設定：

```toml
routes = [
  { pattern = "2fa.yourdomain.com", custom_domain = true }
]
```

這樣 Cloudflare 在部署當下就會以原子操作繫結邊緣網域路由，徹底杜絕 403 斷層，同時公開的 `wrangler.toml` 依然維持乾淨。

---

## 環境配置

### 環境變數（Variables / Secrets）

| 變數名稱                     | 必需 | 說明                                           | 產生方法 / 來源                                                               |
| ---------------------------- | ---- | ---------------------------------------------- | ----------------------------------------------------------------------------- |
| `ENCRYPTION_KEY`             | 建議 | AES-GCM 256 位元加密金鑰                       | `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `ONEDRIVE_CLIENT_ID`         | 選填 | OneDrive OAuth 使用者端 ID                     | Microsoft Entra 應用程式註冊                                                  |
| `ONEDRIVE_CLIENT_SECRET`     | 選填 | OneDrive OAuth 使用者端密碼                    | Microsoft Entra 應用程式註冊                                                  |
| `GOOGLE_DRIVE_CLIENT_ID`     | 選填 | Google Drive OAuth 使用者端 ID                 | Google Cloud Console                                                          |
| `GOOGLE_DRIVE_CLIENT_SECRET` | 選填 | Google Drive OAuth 使用者端密碼                | Google Cloud Console                                                          |
| `OAUTH_REDIRECT_BASE_URL`    | 選填 | OAuth 回呼基礎網址；使用自訂網域時建議顯式設定 | 例如 `https://2fa.yourdomain.com`                                             |

如需啟用雲端硬碟備份，設定完成後請參考 [網盤備份配置指南](CLOUD_DRIVE_SETUP.md)。

### KV 名稱空間

| Binding      | 用途                                         | 必需 | 儲存鍵值                                                                 |
| ------------ | -------------------------------------------- | ---- | ------------------------------------------------------------------------ |
| `SECRETS_KV` | 儲存 2FA 金鑰、備份、密碼雜湊與 Passkey 憑證 | ✅   | `secrets`, `user_password`, `webauthn_*`, `backup_*`, `last_backup_hash` |

---

## 升級指南

> ⚠️ **升級前請先備份資料**：透過應用程式內「批次匯出」或「還原設定 → 匯出備份」將資料匯出儲存。  
> 正常升級**請勿**刪除 Worker 或 KV 名稱空間，已設定的 Secrets（含 `ENCRYPTION_KEY`）會繼續保留。

### 版本更新

升級步驟：

```bash
git pull origin main
npm install
npm run deploy
```

升級過程不會影響現有 Worker 資料庫或金鑰。如果您已設定過 `ENCRYPTION_KEY`，升級時無需重複輸入。

---

## 常見問題與故障排查

### 1. 忘記管理密碼

刪除 KV 中的密碼雜湊即可重新設定（不影響已儲存的 2FA 金鑰）：

- **Dashboard 方式**：進入 **Workers & Pages** → **KV** → 選擇您的名稱空間 → 刪除 `user_password` 鍵。
- **命令列方式**：
  ```bash
  npx wrangler kv key delete "user_password" --namespace-id=你的_kv_id
  ```
  重新整理頁面後即可進入初始化設定頁面。

### 2. 出現 Error 1101 或服務未配置

檢查 Worker **Settings** → **Bindings** 中是否存在名稱完全相符且區分大小寫的 `SECRETS_KV` 繫結。

### 3. PWA 無法安裝

- 確保透過 HTTPS 訪問（Cloudflare 預設提供 HTTPS）。
- 確認 Service Worker 註冊成功（可在開發者工具 F12 → **Application** → **Service Workers** 檢查）。

---

## 相關檔案

- [架構設計檔案](ARCHITECTURE.md)
- [PWA 離線使用指南](PWA_GUIDE.md)
- [雲端硬碟備份教學](CLOUD_DRIVE_SETUP.md)
- [API 參考手冊](API_REFERENCE.md)
