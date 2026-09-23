# ☁️ 網盤備份配置指南

本文件用於配置：

- `OneDrive` 遠端備份
- `Google Drive` 遠端備份

本文件面向“自己部署，自己使用”的場景。

> 如果你不打算使用 `OneDrive` / `Google Drive` 備份，可以直接跳過本文件。

目標是兩件事：

1. 讓你一步一步完成一次性的 OAuth 平臺配置
2. 讓你後續只需要點“儲存並授權”，授權成功後目標會自動啟用，立即開始同步

> 📷 **關於文中截圖**
>
> 為了截圖更具通用性，`Google Cloud Console` 和 `Microsoft Entra` 兩處控制台均切換到英文介面後擷取。如果你使用的是中文介面，選單位置完全一致，只是文字顯示為中文；每一步操作下方都同時標註了中英文按鈕名稱，按任一種語言查詢都可以。

---

## 一、先理解為什麼要分兩步

這個功能分成兩層：

> 雖然是你自己部署、自己使用，但流程仍然分成兩步：
>
> 1. 先完成一次性的 OAuth 應用初始化；
> 2. 再回到站內點選“儲存並授權”繫結你自己的網盤帳號。授權成功後目標會自動啟用，後續備份自動同步。
>
> 也就是說，這份文件裡的平臺配置步驟仍然需要做一次，不能直接跳到授權按鈕。

### 1. 首次做一次配置

你需要：

- 去 Google / Microsoft 控制台建立授權應用
- 拿到 `客戶端 ID` 和 `客戶端金鑰`
- 填回 Cloudflare Worker

這一步只做一次。

原因是：

- 當前專案不會把 `CLIENT_SECRET` 內建在倉庫裡
- OAuth 回撥地址還需要和你自己的部署域名對應起來

### 2. 後續日常使用

完成上面的一次性配置後，你平時只需要：

1. 開啟 `設定 -> 同步設定`
2. 進入 `OneDrive 同步` 或 `Google Drive 同步`
3. 填一個目標名稱
4. 點選 `儲存並授權`
5. 登入自己的網盤並同意授權
6. 授權成功後目標會自動啟用並立即開始同步（如需暫停，在列表裡把開關關掉即可）

也就是說：

- **複雜操作只在首次初始化時做一次**
- **後續使用應該儘量像“繫結登入 + 開關控制”一樣簡單**

---

## 二、開始前先準備好這幾個東西

### 1. 你的應用訪問地址

例如：

```text
https://your-app.workers.dev
```

或者：

```text
https://2fa.example.com
```

後面會用到兩個回撥地址：

```text
https://你的應用地址/api/gdrive/oauth/callback
https://你的應用地址/api/onedrive/oauth/callback
```

### 2. Cloudflare 中要配置的變數名

你最終需要配置這 4 個 Secret：

```text
ONEDRIVE_CLIENT_ID
ONEDRIVE_CLIENT_SECRET
GOOGLE_DRIVE_CLIENT_ID
GOOGLE_DRIVE_CLIENT_SECRET
```

可選再加 1 個普通變數：

```text
OAUTH_REDIRECT_BASE_URL
```

它的作用是：

- 如果不填，程式預設使用當前訪問域名
- 如果你綁定了自定義域名，建議顯式填寫

例如：

```text
https://2fa.example.com
```

---

## 三、Google Drive 配置步驟

下面這部分完全按中英文對照寫。

### 第 1 步：開啟 Google Cloud Console

訪問：

https://console.cloud.google.com/

登入後會看到歡迎頁，頂部欄顯示的就是當前的專案。

![Google Cloud Console 歡迎頁](./images/cloud-drive-setup/gdrive-01-console-welcome.png)

### 第 2 步：建立一個新專案

點選頁面頂部的專案選擇框（標註位置 1），在彈出的對話方塊中點選右上角：

```text
新建專案 / New project
```

![專案選擇器 - 新建專案](./images/cloud-drive-setup/gdrive-02-project-picker.png)

專案名稱建議填寫：

```text
2FA Backup Google Drive
```

建立完成後，確認頂部顯示的當前專案就是它。

### 第 3 步：啟用 Google Drive API

左上角開啟選單，進入：

```text
API 和服務 -> 庫 / APIs & Services -> Library
```

搜尋 `Google Drive API`，開啟產品詳情頁後點擊藍色的：

```text
啟用 / Enable
```

按鈕。

![啟用 Google Drive API](./images/cloud-drive-setup/gdrive-03-enable-drive-api.png)

> ⚠️ **這一步不能跳過。** 只建立 OAuth 憑據但沒啟用 Drive API 的話，授權能成功但呼叫 Drive 介面時會報錯：
>
> ```text
> Google Drive 授權已儲存，但自動連線測試失敗：Google Drive API 尚未啟用。
> 請到 Google Cloud Console 中啟用 Google Drive API 後再重試。
> ```

啟用成功後頁面會跳到 `API/Service Details`，狀態顯示為 `Enabled`，按鈕變成 `Disable API`，就說明 Drive API 已經對你當前的 Google Cloud 專案生效了：

![Drive API 已啟用成功](./images/cloud-drive-setup/gdrive-03b-drive-api-enabled.png)

### 第 4 步：進入 OAuth 配置區域（Google Auth Platform）

左側選單進入：

```text
Google Auth Platform
```

> 最新版控制台把 `品牌塑造`、`目標物件`、`資料訪問` 等步驟整合成一個名叫 **Project configuration** 的一次性向導，實質上還是同一件事，只是步驟被串成了連續的 4 步（App Information → Audience → Contact Information → Finish）。

如果還沒有初始化過，你會看到一個醒目的提示 `Google Auth Platform not configured yet`，點選 `Get started` 開始配置。

![Google Auth Platform 概覽頁](./images/cloud-drive-setup/gdrive-04-auth-platform-overview.png)

左側的選單項依次是：

- `概覽 / Overview`
- `品牌塑造 / Branding`
- `目標物件 / Audience`
- `客戶端 / Clients`
- `資料訪問 / Data Access`

這些就是後面需要輪流開啟的頁面。

### 第 5 步：配置“品牌塑造”（App Information）

在嚮導第 1 步裡按頁面提示填寫：

- **應用名稱 / App name**：`2FA Backup Google Drive`
- **使用者支援郵箱 / User support email**：選你自己的郵箱

填完後點擊 `Next`。

![嚮導第 1 步：App Information](./images/cloud-drive-setup/gdrive-05-branding-app-info.png)

### 第 6 步：配置“目標物件”（Audience）

進入嚮導第 2 步。選擇：

```text
外部 / External
```

原因：

- 個人 Gmail 賬號可以使用
- 這是個人自部署、自用場景下最合適的使用者型別

![嚮導第 2 步：Audience 選 External](./images/cloud-drive-setup/gdrive-06-audience.png)

### 第 6.5 步：把應用切到“正式版 / In production”（**必做**）

> ⚠️ **這一步是必做的，不是可選項。** wizard 完成後預設釋出狀態是 `Testing`。在 `Testing` 狀態下，只有你手動加入「測試使用者 / Test users」名單裡的郵箱能完成授權；其它 Google 帳號（包括你自己，如果沒加入名單）都會被 Google 直接攔下，頁面會顯示：
>
> ```text
> Access blocked: <你的域名> has not completed the Google verification process
> Error 403: access_denied
> ```

wizard 關閉後，回到左側選單點選 `Audience / 目標物件` 開啟它本身的頁面（這是獨立頁面，不是 wizard 裡的那一步）。你會看到：

- `Publishing status / 釋出狀態` ＝ `Testing`
- 右側一個藍色的 `Publish app / 釋出應用` 按鈕

![Audience 頁面：Publishing status = Testing](./images/cloud-drive-setup/gdrive-06b-audience-publishing-testing.png)

點選 `Publish app`，彈出 `Push to production? / 推送到正式版？` 確認框，直接點 `Confirm / 確認`：

![Push to production 確認彈窗](./images/cloud-drive-setup/gdrive-06c-publish-confirm.png)

確認後，`Publishing status` 會切成 `In production`，按鈕變成 `Back to testing`：

![Publishing status 已變成 In production](./images/cloud-drive-setup/gdrive-06d-audience-in-production.png)

> **個人自用 + 只請求 `drive.file` / `userinfo.email` / `userinfo.profile` 這 3 個範圍時：**
>
> - 不需要提交 Google 官方驗證（verification）。
> - 第一次授權時可能會看到“未驗證應用 / App not verified”的中間頁；點左下角 `高階 / Advanced → 前往 <你的應用名>（不安全）/ Go to <app name> (unsafe)` 繼續即可。
> - 該路徑完全夠用於自部署、自己給自己授權的場景，不會影響 refresh token 的長期有效性。

> **如果你出於特殊原因必須停留在 `Testing`：** 需要手動把自己的 Google 郵箱加入 `Test users`：
>
> 1. 在 `Audience` 頁面找到 `測試使用者 / Test users`
> 2. 點選 `新增使用者 / Add users`
> 3. 輸入你自己的 Google 郵箱後儲存
>
> 否則授權就會拋 `access_denied`。但自用場景下首選仍是 `Publish app → In production`，不必留在 Testing。

### 第 7 步：配置“資料訪問”（Data Access / Scopes）

嚮導結束後左側進入：

```text
資料訪問 / Data Access
```

頁面主表格分成 `非敏感範圍`、`敏感範圍`、`受限範圍` 三塊，預設為空：

![Data Access 主頁面](./images/cloud-drive-setup/gdrive-07-data-access.png)

點選右上角的：

```text
新增或移除範圍 / Add or remove scopes
```

在彈出的 `Update selected scopes` 對話方塊裡把這 3 個範圍加進去：

```text
https://www.googleapis.com/auth/drive.file
https://www.googleapis.com/auth/userinfo.email
https://www.googleapis.com/auth/userinfo.profile
```

對話方塊裡可以用過濾器搜尋，也可以拉到最下面的 `Manually add scopes` 文本框中直接貼上以上 3 條 URL。

![Scopes 選擇對話方塊](./images/cloud-drive-setup/gdrive-07b-scopes-dialog.png)

說明：

- `drive.file`：讓應用可以寫入和管理它自己建立的備份檔案
- `userinfo.email`：讀取郵箱地址
- `userinfo.profile`：讀取基本賬號資訊

額外說明：

- 頁面裡填寫的 `備份目錄`，應理解為應用會在自己的可管理範圍內自動建立並維護的目錄路徑。
- 不要把它理解成“可直接複用你網盤裡任意一個現有目錄”；為了避免許可權和可見性問題，建議為本應用單獨使用一個專用目錄。

加完後點擊：

```text
更新 / Update
```

然後再點選頁面裡的：

```text
儲存 / Save
```

### 第 8 步：建立客戶端（Create OAuth client）

點選左側：

```text
客戶端 / Clients
```

然後點選：

```text
建立 OAuth 客戶端 / Create OAuth client
```

在 `Application type` 下拉里選擇：

```text
Web 應用 / Web application
```

![選擇 Web application 型別](./images/cloud-drive-setup/gdrive-08-client-type.png)

名稱建議填寫：

```text
2FA Backup Google Drive Web
```

### 第 9 步：填寫 Google Drive 回撥地址

在 `已獲授權的重定向 URI / Authorized redirect URIs` 區域點選 `Add URI` 並填入：

```text
https://你的應用地址/api/gdrive/oauth/callback
```

例如：

```text
https://your-app.workers.dev/api/gdrive/oauth/callback
```

或者：

```text
https://2fa.example.com/api/gdrive/oauth/callback
```

![填寫 Web 應用的 Redirect URI](./images/cloud-drive-setup/gdrive-09-redirect-uri.png)

然後點選底部 `Create` 建立。

### 第 10 步：複製客戶端資訊

建立完成後，會彈出 `OAuth client created` 對話方塊，裡面會顯示 `Client ID`：

![建立成功彈窗：Client ID](./images/cloud-drive-setup/gdrive-10-client-credentials.png)

想要同時檢視 `Client secret`（金鑰），關閉該彈窗後點擊剛建立的客戶端名稱，在詳情頁右下角的 `Additional information` 和 `Client secrets` 區塊中可以看到完整資訊，`Client secret` 右側有一鍵複製按鈕：

![客戶端詳情頁同時顯示 ID 和 Secret](./images/cloud-drive-setup/gdrive-10b-client-detail.png)

把它們儲存下來。分別對應：

```text
GOOGLE_DRIVE_CLIENT_ID
GOOGLE_DRIVE_CLIENT_SECRET
```

---

## 四、OneDrive 配置步驟

下面這部分是給 Microsoft / OneDrive 用的。

### 第 1 步：開啟 Microsoft Entra 管理中心

訪問：

https://entra.microsoft.com/

登入後進入首頁，介面頂部顯示當前的租戶和帳戶資訊。

![Microsoft Entra 首頁](./images/cloud-drive-setup/onedrive-01-entra-home.png)

> 注意：
>
> - `entra.microsoft.com` 是 Microsoft Entra 的租戶管理後臺，不是普通的個人 OneDrive 登入頁。
> - 如果你用的是 `outlook.com` / `hotmail.com` / `live.com` 這類個人 Microsoft 帳號，並且開啟後直接報 `AADSTS16000` 或“`user account from identity provider 'live.com' does not exist in tenant`”，通常表示這個帳號當前沒有可管理的 Entra 租戶。
> - 解決辦法通常是二選一：
>   1. 改用已有 Microsoft 365 / Azure / 工作或學校租戶的帳號登入；
>   2. 或先去 `https://portal.azure.com/` 建立一個 Microsoft Entra 租戶，再回到這裡註冊應用。
> - 如果瀏覽器自動帶入了錯誤帳號，先退出當前所有 Microsoft 登入狀態，或使用無痕視窗重新登入。

### 第 2 步：進入應用註冊（App registrations）

左側進入：

```text
Microsoft Entra ID -> 應用註冊 / App registrations
```

點選頂部的：

```text
新註冊 / New registration
```

![App registrations 列表頁](./images/cloud-drive-setup/onedrive-02-app-registrations.png)

### 第 3 步：建立應用

建議填寫：

- 名稱 / Name：`2FA Backup OneDrive`

支援的帳戶型別建議選擇：

```text
任何組織目錄中的帳戶以及個人 Microsoft 帳戶
/ Accounts in any organizational directory (Any Microsoft Entra ID tenant - Multitenant) and personal Microsoft accounts
```

原因：

- 當前專案實現使用通用授權端點
- 這樣個人 OneDrive 和工作/學校 OneDrive 都更容易相容

![Register an application 表單](./images/cloud-drive-setup/onedrive-03-register-form.png)

然後點選註冊 / Register。

### 第 4 步：複製客戶端 ID（Application (client) ID）

建立完成後，在概覽頁找到：

```text
應用程式(客戶端) ID / Application (client) ID
```

頁面結構：`Essentials` 卡片裡會依次顯示 `Display name`、`Application (client) ID`、`Object ID`、`Directory (tenant) ID` 等欄位，每個欄位右側有一鍵複製按鈕。把 `Application (client) ID` 那一行的值複製下來。

它對應：

```text
ONEDRIVE_CLIENT_ID
```

> 此步截圖會直接暴露 `client/tenant ID` 與個人賬號郵箱，文件裡不再附圖，防止誤推到倉庫。按頁面上的位置找 `Application (client) ID` 一欄即可。

### 第 5 步：配置身份驗證（Authentication）

左側進入：

```text
Authentication (Preview)
```

在新版 Entra 介面中，保持停留在：

```text
重定向 URI 配置 / Redirect URI configuration
```

![Authentication 頁面 - 尚未配置 Redirect URI](./images/cloud-drive-setup/onedrive-05-authentication.png)

然後點選：

```text
新增重定向 URI / Add Redirect URI
```

### 第 6 步：填寫 OneDrive 回撥地址

右側會彈出 `Select a platform to add redirect URI` 側欄。

在 `Web applications` 區域選擇：

```text
Web
```

> 不要選擇 `單頁應用程式 / Single-page application`（SPA）。

![Select a platform 側欄，選擇 Web](./images/cloud-drive-setup/onedrive-06-select-platform.png)

在重定向 URI 輸入框中填寫：

```text
https://你的應用地址/api/onedrive/oauth/callback
```

例如：

```text
https://your-app.workers.dev/api/onedrive/oauth/callback
```

或者：

```text
https://2fa.example.com/api/onedrive/oauth/callback
```

![填入 OneDrive Redirect URI](./images/cloud-drive-setup/onedrive-07-redirect-uri.png)

填寫後點擊 `Configure` 儲存。

> 如果你看到的是舊版介面，也可以按舊流程操作：`身份驗證 -> 新增平臺 -> Web`。

### 第 7 步：配置 API 許可權（API permissions）

左側進入：

```text
API 許可權 / API permissions
```

點選 `Add a permission`，選擇 `Microsoft Graph`，然後選擇 `委託的許可權 / Delegated permissions`。

頁面預設會已經帶有一個 `User.Read`，再額外新增：

```text
Files.ReadWrite.AppFolder
```

如果頁面裡能找到 `offline_access`，也一併加上。

![API permissions 頁面](./images/cloud-drive-setup/onedrive-08-api-permissions.png)

說明：

- `Files.ReadWrite.AppFolder`：允許把備份寫到 OneDrive 應用專用目錄
- `User.Read`：讀取基本賬戶資訊

### 第 8 步：企業賬號可能需要管理員同意

如果你使用的是公司或學校賬號，後面授權時可能提示需要管理員批准。

這種情況可以回到 `API 許可權 / API permissions`，點選：

```text
授予管理員同意 / Grant admin consent
```

> 個人 Microsoft 帳號（`outlook.com` / `hotmail.com`）或自建的個人租戶一般不會觸發這一步，可以直接跳過。

如果你沒有管理員許可權，就需要讓管理員來操作。

### 第 9 步：建立客戶端金鑰（Client secrets）

左側進入：

```text
證書和密碼 / Certificates & secrets
```

切換到 `客戶端密碼 / Client secrets` 選項卡，點選：

```text
新建客戶端密碼 / New client secret
```

![Certificates & secrets 頁面](./images/cloud-drive-setup/onedrive-09-certificates-secrets.png)

在彈出的側欄裡：

- 描述 / Description：建議填 `2FA OneDrive Secret`
- 有效期 / Expires：按頁面推薦即可（預設 180 天 / 6 個月）

![新建 Client secret 表單](./images/cloud-drive-setup/onedrive-09b-new-secret-form.png)

然後點選 `Add` 建立。

### 第 10 步：立刻複製“值”（Value）

建立後表格裡會多出一條記錄，兩個列分別是：

- `值 / Value`
- `機密 ID / Secret ID`

請複製 **`值 / Value`** 這一列（頁面會提示 `Value` 只在剛建立時可見，重新整理或離開頁面後就再也查不到），不是 `機密 ID / Secret ID`。

> 此步頁面會完整顯示剛建立的 secret 值，文件裡不再附圖，防止誤推到倉庫。按頁面上的位置找到剛新建的那一行，複製 `Value` 列即可。

這個值對應：

```text
ONEDRIVE_CLIENT_SECRET
```

---

## 五、把憑據填回 Cloudflare

### 方式一：命令列

在專案目錄下執行：

```bash
npx wrangler secret put ONEDRIVE_CLIENT_ID
npx wrangler secret put ONEDRIVE_CLIENT_SECRET
npx wrangler secret put GOOGLE_DRIVE_CLIENT_ID
npx wrangler secret put GOOGLE_DRIVE_CLIENT_SECRET
```

**強烈建議再加一條 `ENCRYPTION_KEY`**（否則 OAuth 的 `refresh_token / access_token` 會以**明文**寫入 KV，授權頁會彈警告 `ENCRYPTION_KEY 未配置，... 憑據將以明文儲存`）：

```bash
# 1. 生成一個 32 位元組的 AES-GCM-256 金鑰（Base64 格式）
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# 2. 把上一步輸出的字串貼上給 Wrangler
npx wrangler secret put ENCRYPTION_KEY
```

> ⚠️ **配置完記得把生成的金鑰妥善備份到密碼管理器裡。** 如果之後 `ENCRYPTION_KEY` 丟了，已經加密儲存過的 OAuth 憑據、WebDAV 配置、備份檔案全部無法解密；程式在這種情況下會直接報錯拒絕讀取，不會嘗試亂猜。

如果你使用自定義域名，建議再配置：

```text
OAUTH_REDIRECT_BASE_URL = https://你的應用地址
```

### 方式二：Cloudflare Dashboard

進入：

```text
Workers & Pages -> 你的 Worker -> Settings -> Variables and Secrets
```

找到 **Variables and Secrets / 變數和機密** 區塊，點選右側的 `Add / 新增` 按鈕。

![Worker Settings 中的 Variables and Secrets 區塊](./images/cloud-drive-setup/cloudflare-01-variables-secrets.png)

在彈出的側欄中：

- 把 **Type / 型別** 切到 `Secret`
- **Variable name / 變數名** 填入下面 4 個名字之一
- **Value / 值** 填入對應的 ID 或 Secret
- 點選 `Add variable` → 最後 `Deploy` 部署

![新增 Secret 的側欄](./images/cloud-drive-setup/cloudflare-02-add-secret.png)

新增 4 個 Secret：

- `ONEDRIVE_CLIENT_ID`
- `ONEDRIVE_CLIENT_SECRET`
- `GOOGLE_DRIVE_CLIENT_ID`
- `GOOGLE_DRIVE_CLIENT_SECRET`

**強烈建議再加一個 `ENCRYPTION_KEY`**（Type = `Secret`），用於加密 KV 裡存的 OAuth 重新整理令牌。Value 按下面的命令在任意機器上生成 32 位元組 Base64 字串後貼上：

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

> ⚠️ 生成的 `ENCRYPTION_KEY` 請立刻備份到密碼管理器。丟失金鑰 = 現有加密資料無法恢復。

如果用了自定義域名，再新增普通變數（Type = `Text`）：

- `OAUTH_REDIRECT_BASE_URL`

例如：

```text
https://2fa.example.com
```

### 最後一步

重新部署 Worker。

---

## 六、如何驗證自己配置成功

部署完成後，開啟你的 2FA 應用，依次檢查：

1. 進入 `設定 -> 同步設定`
2. 檢視 `OneDrive 同步` 和 `Google Drive 同步`
3. 如果頁面不再提示“服務端未配置 OAuth 憑據”，說明 Cloudflare 變數大機率已經生效
4. 分別新增一個測試目標
5. 點選 `儲存並授權`
6. 在彈出的視窗中完成登入和授權
7. 首次授權成功 + 連線測試通過後，目標會自動啟用（若只想暫停同步，可隨時在列表裡把開關關掉）
8. 手動觸發一次備份，檢視網盤裡是否出現 `backup_*.(txt|json|csv|html)` 檔案
   副檔名取決於「設定 → 預設匯出格式」

如果 Cloudflare KV 中的備份丟失，但遠端儲存裡仍有 `backup_*` 檔案，可以先從 WebDAV/S3/OneDrive/Google Drive 下載該檔案，再到站內 **還原配置 → 上傳備份檔案** 進行預覽和恢復。加密備份必須使用建立時同一個 `ENCRYPTION_KEY`，否則無法解密。

---

## 七、後續如何使用

完成配置後，你後續應當只需要：

1. 開啟 `設定 -> 同步設定`
2. 進入 `OneDrive 同步` 或 `Google Drive 同步`
3. 新增目標
4. 填一個名稱
5. 點選 `儲存並授權`
6. 登入自己的網盤並同意授權
7. 首次授權成功 + 連線測試通過後，目標會自動啟用（若只想暫停同步，可隨時在列表裡把開關關掉）

然後系統會對所有**已啟用**目標自動：

- 在手動備份時推送
- 在資料變更觸發備份時推送
- 在定時備份時推送

---

## 八、最常見的問題

### 1. 提示 `redirect_uri_mismatch`

原因：

- 平臺控制台裡填寫的回撥地址和程式實際使用的不完全一致

重點檢查：

- 是否是 `https`
- 域名是否一致
- 路徑是否一致
- 是否多了或少了 `/`

### 2. Google 授權被擋：`Access blocked` / `Error 403: access_denied`

典型報錯：

```text
Access blocked: <你的域名> has not completed the Google verification process
Error 403: access_denied
```

原因：應用仍然處於 `Testing`，而你當前授權的郵箱不在 `Test users` 名單裡。Google 會直接把請求擋下來。

處理辦法（推薦按這個順序）：

1. 開啟 `Google Auth Platform -> Audience`；
2. 看 `Publishing status`：
   - 如果是 `Testing`：點 `Publish app`，在彈出的 `Push to production?` 對話方塊裡點 `Confirm`，確認變成 `In production` 後重新授權（見本文件「第 6.5 步」）。
   - 如果必須留在 `Testing`：找到 `Test users` → `Add users`，把你當前授權的 Google 郵箱加進去後再授權。
3. 切到 `正式版` 後，如果個人自用且只請求 `drive.file` / `userinfo.email` / `userinfo.profile` 三個範圍，**不需要**提交 Google 驗證；第一次授權看到“未驗證應用”中間頁時點 `高階 / Advanced → 前往 <你的應用名>（不安全）/ Go to <app name> (unsafe)` 繼續即可。

### 3. 開啟 `entra.microsoft.com` 就報 `AADSTS16000`

常見原因：

- 你當前登入的是個人 Microsoft 帳號
- 該帳號沒有關聯可管理的 Microsoft Entra 租戶
- 瀏覽器自動複用了錯誤的 Microsoft 登入狀態

處理辦法：

- 先確認你登入的是準備用來建立 OneDrive OAuth 應用的帳號
- 如果你已有 Microsoft 365 / Azure / 工作或學校租戶，切換到對應帳號或對應目錄後再進入 Entra
- 如果你只有個人帳號，先訪問 `https://portal.azure.com/`，按 Microsoft 官方文件建立一個 Microsoft Entra 租戶，再回到 `https://entra.microsoft.com/`
- 仍然報同樣錯誤時，先退出所有 Microsoft 帳號，或使用無痕視窗重新登入

### 4. OneDrive 提示需要管理員批准

常見原因：

- 你使用的是企業租戶
- 需要管理員同意權限

處理辦法：

- 回到 `API 許可權`
- 讓管理員點選 `授予管理員同意`

### 5. 頁面裡能看到入口，但點選授權失敗

優先檢查：

- `ONEDRIVE_CLIENT_ID`
- `ONEDRIVE_CLIENT_SECRET`
- `GOOGLE_DRIVE_CLIENT_ID`
- `GOOGLE_DRIVE_CLIENT_SECRET`

是否真的已經配置到 Cloudflare，並且已經重新部署。

### 6. Google 授權成功，但立刻提示 `Google Drive API 尚未啟用`

典型報錯：

```text
Google Drive 授權已儲存，但自動連線測試失敗：Google Drive API 尚未啟用。
請到 Google Cloud Console 中啟用 Google Drive API 後再重試。
```

原因：你只配置了 OAuth 憑據（Client ID / Secret），但沒有在 Google Cloud 專案裡啟用 `Google Drive API`。授權流程只檢驗憑據合法性，不會檢查 Drive API 是否開通。

處理辦法：**回去執行「第 3 步：啟用 Google Drive API」**。開啟 `https://console.cloud.google.com/apis/library/drive.googleapis.com`（記得在右上角確認是你 OAuth 客戶端所在的那個專案），點藍色的 `Enable`，等頁面跳到 `API/Service Details` 並顯示 `Status: Enabled` 後，回到應用重新點「儲存並授權」即可（不需要再跑一遍 OAuth 流程，應用會自動重試連線測試）。

### 7. 授權頁彈出 `ENCRYPTION_KEY 未配置，... 憑據將以明文儲存`

原因：Cloudflare 裡沒配置 `ENCRYPTION_KEY`。此時 OAuth 的 `access_token / refresh_token` 會以 **明文** 寫入 KV——雖然 KV 自身有訪問控制，但在自部署場景下仍然建議加密。

處理辦法：按「第五節 · 把憑據填回 Cloudflare」裡的 `ENCRYPTION_KEY` 子步驟生成一個 32 位元組 Base64 字串並配置為 Secret。重新部署後，後續所有新授權會自動加密；之前已存的明文憑據不會被自動遷移，但程式會正確讀取（向後相容），下一次重新授權就會覆蓋成密文。

> `ENCRYPTION_KEY` 同時也會被備份、WebDAV/S3 憑據加密複用，不只是 OAuth 場景需要。
