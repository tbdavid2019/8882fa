# 🔌 API 參考文件

## 📋 目錄

- [認證](#認證)
- [端點列表](#端點列表)
- [金鑰管理 API](#金鑰管理-api)
- [時間校準 API](#時間校準-api)
- [OTP 生成 API](#otp-生成-api)
- [備份管理 API](#備份管理-api)
- [WebDAV 與 S3 同步 API](#webdav-與-s3-同步-api)
- [雲盤同步 API](#雲盤同步-api)
- [首次設定與系統設定 API](#首次設定與系統設定-api)
- [認證 API](#認證-api)
- [錯誤程式碼](#錯誤程式碼)
- [Rate Limiting](#rate-limiting)

---

## 認證

### 認證方式

所有 API 端點（除了公開端點）都需要身份認證。

**認證方法**: HttpOnly Cookie

```
Cookie: auth_token=<JWT_TOKEN>
```

**公開端點**（無需認證）:

- `GET /setup` - 首次設定頁面
- `POST /api/setup` - 首次設定
- `GET /` - 主頁面
- `GET /manifest.json` - PWA Manifest
- `GET /sw.js` - Service Worker
- `GET /icon-*.png` - PWA 圖示
- `POST /api/login` - 登入
- `POST /api/logout` - 退出登入
- `GET /api/time` - 客戶端時間校準
- `GET /otp` - OTP 使用說明
- `GET /otp/{secret}` - OTP 生成
- `GET /api/favicon/{domain}` - Favicon 代理
- `GET /api/onedrive/oauth/callback` - OneDrive OAuth 回撥
- `GET /api/gdrive/oauth/callback` - Google Drive OAuth 回撥

**特殊端點**:

- `POST /api/refresh-token` - 不經過全域性認證中介軟體，但仍要求請求中攜帶有效 `auth_token` Cookie

**受保護端點**（需要認證）:

- 其餘所有 `/api/*` 端點

### 獲取認證 Token

**端點**: `POST /api/login`

**請求體**:

```json
{
	"credential": "<YOUR_PASSWORD>"
}
```

**說明**:

- `credential`: 通過網頁介面設定的管理員密碼

**成功響應** (200 OK):

```json
{
	"success": true,
	"message": "登入成功",
	"token": "<JWT_TOKEN>",
	"expiresAt": "2026-05-17T10:30:00.000Z",
	"expiresIn": "30天"
}
```

**響應頭**:

```http
Set-Cookie: auth_token=<JWT_TOKEN>; HttpOnly; Secure; SameSite=Strict; Max-Age=604800; Path=/
```

**失敗響應** (401 Unauthorized):

```json
{
	"error": "認證失敗",
	"message": "訪問令牌無效",
	"timestamp": "2025-10-24T10:30:00.000Z"
}
```

### Token 重新整理

**端點**: `POST /api/refresh-token`

**認證**: ✅ 需要

**描述**: 重新整理當前 Token，延長過期時間。請求中需要攜帶有效 `auth_token` Cookie，或通過 `Authorization: Bearer <token>` 頭向後相容。

**成功響應** (200 OK):

```json
{
	"success": true,
	"message": "令牌重新整理成功",
	"token": "<NEW_JWT_TOKEN>",
	"expiresAt": "2026-05-17T10:30:00.000Z",
	"expiresIn": "30天"
}
```

**響應頭**:

```http
Set-Cookie: auth_token=<NEW_JWT_TOKEN>; HttpOnly; Secure; SameSite=Strict; Max-Age=604800; Path=/
```

---

## 端點列表

限流列表示當前應用程式碼實際呼叫的限流規則；`-` 表示沒有顯式呼叫應用限流，不代表每個端點都有獨立配額。共享計數方式見 [Rate Limiting](#rate-limiting)。

| 端點                                               | 方法   | 認證 | 限流   | 描述                         |
| -------------------------------------------------- | ------ | ---- | ------ | ---------------------------- |
| `/api/setup`                                       | POST   | ❌   | 5/min  | 首次設定                     |
| [/api/time](#獲取服務端時間)                       | GET    | ❌   | -      | 獲取 Worker Unix 毫秒時間    |
| [/api/secrets](#獲取所有金鑰)                      | GET    | ✅   | -      | 獲取所有金鑰                 |
| [/api/secrets](#新增新金鑰)                        | POST   | ✅   | -      | 新增新金鑰                   |
| [/api/secrets/{id}](#更新金鑰)                     | PUT    | ✅   | -      | 更新指定金鑰                 |
| [/api/secrets/{id}](#刪除金鑰)                     | DELETE | ✅   | 10/min | 刪除指定金鑰                 |
| [/api/secrets/{id}/counter](#遞增-hotp-計數器)     | POST   | ✅   | -      | 遞增 HOTP 計數器             |
| [/api/secrets/counters/compact](#壓實-hotp-計數器) | POST   | ✅   | -      | 回滾前壓實 HOTP 計數器       |
| [/api/secrets/batch](#批次新增金鑰)                | POST   | ✅   | 20/5m  | 批次新增金鑰                 |
| [/api/secrets/export](#批次匯出金鑰)               | POST   | ✅   | 10/min | 匯出標準 TXT/JSON/CSV/HTML   |
| [/api/backup](#手動觸發備份)                       | POST   | ✅   | 10/min | 手動觸發備份                 |
| [/api/backup](#獲取備份列表)                       | GET    | ✅   | -      | 獲取備份列表                 |
| [/api/backup/export/{backupKey}](#匯出備份)        | GET    | ✅   | -      | 匯出指定備份                 |
| [/api/backup/restore](#恢復備份)                   | POST   | ✅   | -      | 恢復或預覽指定備份           |
| `/api/change-password`                             | POST   | ✅   | 10/min | 修改密碼                     |
| `/api/settings`                                    | GET    | ✅   | -      | 獲取系統設定                 |
| `/api/settings`                                    | POST   | ✅   | 10/min | 儲存系統設定                 |
| `/api/webdav/config`                               | GET    | ✅   | -      | 獲取 WebDAV 目標             |
| `/api/webdav/config`                               | POST   | ✅   | 10/min | 新增或更新 WebDAV 目標       |
| `/api/webdav/config?id={id}`                       | DELETE | ✅   | 10/min | 刪除 WebDAV 目標             |
| `/api/webdav/test`                                 | POST   | ✅   | 10/min | 測試 WebDAV 連線和寫入       |
| `/api/webdav/toggle`                               | POST   | ✅   | 10/min | 啟用或停用 WebDAV 目標       |
| `/api/s3/config`                                   | GET    | ✅   | -      | 獲取 S3 目標                 |
| `/api/s3/config`                                   | POST   | ✅   | 10/min | 新增或更新 S3 目標           |
| `/api/s3/config?id={id}`                           | DELETE | ✅   | 10/min | 刪除 S3 目標                 |
| `/api/s3/test`                                     | POST   | ✅   | 10/min | 測試 S3 連線和寫入           |
| `/api/s3/toggle`                                   | POST   | ✅   | 10/min | 啟用或停用 S3 目標           |
| `/api/onedrive/config`                             | GET    | ✅   | -      | 獲取 OneDrive 目標           |
| `/api/onedrive/config`                             | POST   | ✅   | 10/min | 儲存 OneDrive 目標           |
| `/api/onedrive/config?id={id}`                     | DELETE | ✅   | 10/min | 刪除 OneDrive 目標           |
| `/api/onedrive/toggle`                             | POST   | ✅   | 10/min | 啟用或停用 OneDrive 目標     |
| `/api/onedrive/oauth/start`                        | POST   | ✅   | 10/min | 啟動 OneDrive OAuth          |
| `/api/onedrive/oauth/callback`                     | GET    | ❌   | -      | OneDrive OAuth 回撥          |
| `/api/gdrive/config`                               | GET    | ✅   | -      | 獲取 Google Drive 目標       |
| `/api/gdrive/config`                               | POST   | ✅   | 10/min | 儲存 Google Drive 目標       |
| `/api/gdrive/config?id={id}`                       | DELETE | ✅   | 10/min | 刪除 Google Drive 目標       |
| `/api/gdrive/toggle`                               | POST   | ✅   | 10/min | 啟用或停用 Google Drive 目標 |
| `/api/gdrive/oauth/start`                          | POST   | ✅   | 10/min | 啟動 Google Drive OAuth      |
| `/api/gdrive/oauth/callback`                       | GET    | ❌   | -      | Google Drive OAuth 回撥      |
| [/api/login](#獲取認證-token)                      | POST   | ❌   | 5/min  | 使用者登入                   |
| [/api/logout](#退出登入)                           | POST   | ❌   | 10/min | 退出登入（清除 Cookie）      |
| [/api/refresh-token](#token-重新整理)              | POST   | ✅   | -      | 重新整理 Token               |
| [/otp/{secret}](#生成-otp)                         | GET    | ❌   | -      | 公開 OTP 生成                |

---

## 金鑰管理 API

### 獲取所有金鑰

**端點**: `GET /api/secrets`

**認證**: ✅ 需要

**描述**: 獲取所有儲存的 2FA 金鑰

**請求示例**:

```http
GET /api/secrets HTTP/1.1
Host: 2fa.example.com
Cookie: auth_token=<JWT_TOKEN>
```

**成功響應** (200 OK):

```json
[
	{
		"id": "550e8400-e29b-41d4-a716-446655440000",
		"name": "GitHub",
		"account": "user@example.com",
		"secret": "JBSWY3DPEHPK3PXP"
	},
	{
		"id": "660e8400-e29b-41d4-a716-446655440001",
		"name": "Google",
		"account": "john@gmail.com",
		"secret": "ABCDEFGHIJKLMNOP"
	}
]
```

**欄位說明**:
| 欄位 | 型別 | 說明 |
|------|------|------|
| `id` | String (UUID) | 金鑰唯一識別符號 |
| `name` | String | 服務名稱（如 "GitHub"） |
| `account` | String | 賬戶名稱（可選） |
| `secret` | String | Base32 編碼的金鑰 |
| `type` / `digits` / `period` / `algorithm` | String / Number / Number / String | OTP 引數，見[新增新金鑰](#新增新金鑰) |
| `counter` | Number | 僅 HOTP。返回的是疊加 sidecar 後的**有效計數器**，見[遞增 HOTP 計數器](#遞增-hotp-計數器) |
| `hotpCounterNamespace` | String (UUID) | 僅 HOTP，可選。編輯時變更了金鑰、位數或演算法後由服務端生成，用於隔離不同生成引數的計數器；客戶端只需原樣透傳 |

---

### 新增新金鑰

**端點**: `POST /api/secrets`

**認證**: ✅ 需要

**描述**: 新增新的 2FA 金鑰

**請求體**:

```json
{
	"name": "GitHub",
	"account": "user@example.com",
	"secret": "JBSWY3DPEHPK3PXP"
}
```

**欄位說明**:
| 欄位 | 型別 | 必填 | 說明 |
|------|------|------|------|
| `name` | String | ✅ | 服務名稱，不能為空 |
| `account` | String | ❌ | 賬戶名稱，可選 |
| `secret` | String | ✅ | Base32 格式的金鑰，至少 8 個字元 |

**成功響應** (201 Created):

```json
{
	"success": true,
	"data": {
		"id": "550e8400-e29b-41d4-a716-446655440000",
		"name": "GitHub",
		"account": "user@example.com",
		"secret": "JBSWY3DPEHPK3PXP"
	},
	"message": "金鑰新增成功"
}
```

**錯誤響應**:

**400 Bad Request** - 引數驗證失敗:

```json
{
	"error": "引數錯誤",
	"message": "服務名稱不能為空",
	"timestamp": "2025-10-24T10:30:00.000Z"
}
```

**409 Conflict** - 金鑰已存在:

```json
{
	"error": "金鑰已存在",
	"message": "相同服務名稱和賬戶的金鑰已存在",
	"timestamp": "2025-10-24T10:30:00.000Z"
}
```

**Base32 驗證規則**:

- 只允許字元: `A-Z` 和 `2-7`
- 可選的 `=` 填充字元
- 最小長度: 8 個字元
- 示例有效金鑰: `JBSWY3DPEHPK3PXP`, `ABCDEFGHIJKLMNOP====`

---

### 更新金鑰

**端點**: `PUT /api/secrets/{id}`

**認證**: ✅ 需要

**描述**: 更新指定 ID 的金鑰資訊

**URL 引數**:

- `id` (UUID): 金鑰的唯一識別符號

**請求體**:

```json
{
	"name": "GitHub Enterprise",
	"account": "newuser@example.com",
	"secret": "NEWBASE32SECRETKEY"
}
```

**成功響應** (200 OK):

```json
{
	"success": true,
	"data": {
		"id": "550e8400-e29b-41d4-a716-446655440000",
		"name": "GitHub Enterprise",
		"account": "newuser@example.com",
		"secret": "NEWBASE32SECRETKEY"
	},
	"message": "金鑰更新成功"
}
```

**錯誤響應**:

**404 Not Found** - 金鑰不存在:

```json
{
	"error": "金鑰不存在",
	"message": "找不到指定的金鑰",
	"timestamp": "2025-10-24T10:30:00.000Z"
}
```

**409 Conflict** - HOTP 計數器不能通過編輯降低：

當金鑰、位數、演算法都未變化時，請求體中的 `counter` 不能低於服務端當前有效值（計數器只允許通過[遞增介面](#遞增-hotp-計數器)前進）。客戶端應重新拉取金鑰列表後再提交編輯。需要把計數器歸零時，請刪除後重新新增，或同時更換金鑰。

```json
{
	"error": "ConflictError",
	"message": "HOTP計數器已推進，不能通過編輯操作降低計數器",
	"statusCode": 409,
	"details": {
		"operation": "updateSecret",
		"secretId": "550e8400-e29b-41d4-a716-446655440000",
		"requestedCounter": 3,
		"currentCounter": 12
	},
	"timestamp": "2025-10-24T10:30:00.000Z"
}
```

---

### 刪除金鑰

**端點**: `DELETE /api/secrets/{id}`

**認證**: ✅ 需要

**描述**: 刪除指定 ID 的金鑰

**URL 引數**:

- `id` (UUID): 金鑰的唯一識別符號

**成功響應** (200 OK):

```json
{
	"success": true,
	"data": {
		"id": "550e8400-e29b-41d4-a716-446655440000"
	},
	"message": "金鑰刪除成功"
}
```

**錯誤響應**:

**404 Not Found** - 金鑰不存在:

```json
{
	"error": "金鑰不存在",
	"message": "找不到指定的金鑰",
	"timestamp": "2025-10-24T10:30:00.000Z"
}
```

---

### 遞增 HOTP 計數器

**端點**: `POST /api/secrets/{id}/counter`

**認證**: ✅ 需要

**描述**: 將指定 HOTP 金鑰的計數器加 1。請求體攜帶客戶端當前看到的生成引數快照，服務端逐項比對通過後才遞增；任何一項不一致都返回 409，客戶端應重新拉取金鑰列表後重試，不要盲目重發。

自 1.8.0 起，遞增結果寫入獨立的 KV 鍵 `hotp-counter:{epoch}:{id}[:{namespace}]`（下稱 sidecar），不再改寫加密主文件 `secrets`。`GET /api/secrets` 返回的 `counter` 已經是疊加 sidecar 後的有效值；編輯、備份、雲盤推送等所有讀路徑同樣使用有效值。回滾到 1.8.0 之前的版本前必須先執行[壓實](#壓實-hotp-計數器)。

**URL 引數**:

- `id` (UUID): 金鑰的唯一識別符號

**請求體**:

```json
{
	"expectedNamespace": null,
	"expectedCounter": 5,
	"expectedSecret": "JBSWY3DPEHPK3PXP",
	"expectedDigits": 6,
	"expectedAlgorithm": "SHA1"
}
```

| 欄位                | 型別           | 必填 | 說明                                                                |
| ------------------- | -------------- | ---- | ------------------------------------------------------------------- |
| `expectedNamespace` | String \| null | 否   | 金鑰物件的 `hotpCounterNamespace`；金鑰沒有該欄位時傳 `null` 或省略 |
| `expectedCounter`   | Number         | 是   | 客戶端當前看到的計數器值（非負安全整數）                            |
| `expectedSecret`    | String         | 是   | Base32 金鑰                                                         |
| `expectedDigits`    | Number         | 是   | `6` 或 `8`                                                          |
| `expectedAlgorithm` | String         | 是   | `SHA1` / `SHA256` / `SHA512`                                        |

**成功響應** (200 OK):

```json
{
	"success": true,
	"message": "HOTP計數器遞增成功",
	"data": {
		"secret": {
			"id": "550e8400-e29b-41d4-a716-446655440000",
			"name": "GitHub",
			"account": "user@example.com",
			"secret": "JBSWY3DPEHPK3PXP",
			"type": "HOTP",
			"digits": 6,
			"period": 30,
			"algorithm": "SHA1",
			"counter": 6
		},
		"id": "550e8400-e29b-41d4-a716-446655440000",
		"counter": 6,
		"idempotent": false
	}
}
```

**錯誤響應**:

| 狀態碼 | `message`                                    | 說明                                                                                   |
| ------ | -------------------------------------------- | -------------------------------------------------------------------------------------- |
| 400    | 欄位校驗資訊                                 | 請求體缺欄位或型別錯誤                                                                 |
| 404    | 金鑰不存在                                   | `id` 不存在                                                                            |
| 409    | `只有HOTP金鑰可以遞增計數器`                 | 目標是 TOTP 或 Steam 金鑰                                                              |
| 409    | `HOTP生成引數已變更，請重新整理後重試`       | 金鑰、位數、演算法或 namespace 與服務端不一致，`details.currentCounter` 為服務端當前值 |
| 409    | `HOTP計數器已變更，請重新整理後重試`         | 計數器已被其他裝置推進，`details` 含 `expectedCounter` 與 `currentCounter`             |
| 409    | `HOTP計數器已達到安全整數上限，無法繼續遞增` | 計數器已是 `Number.MAX_SAFE_INTEGER`                                                   |
| 500    | `HOTP計數器遞增失敗`                         | sidecar 無法解密或 KV 異常。此時不會寫入任何資料                                       |

**併發說明**: Workers KV 沒有原子比較寫入。兩臺裝置在同一秒對同一金鑰發起遞增時，可能都通過快照比對並得到同一個新值。這是 HOTP 在 KV 上的固有限制，客戶端應在 409 或對賬發現不一致後重新整理列表。

---

### 壓實 HOTP 計數器

**端點**: `POST /api/secrets/counters/compact`

**認證**: ✅ 需要

**描述**: 維護介面。把所有 HOTP 金鑰的有效計數器寫回加密主文件 `secrets`，然後輪換 sidecar 紀元（KV 鍵 `hotp-counter-epoch`），使舊 sidecar 全部失效。

**什麼時候需要呼叫**: 回滾到 1.8.0 之前的版本之前。舊版本只讀主文件，不認識 sidecar；不壓實就回滾，HOTP 計數器會退回到升級 1.8.0 時的值，之後生成的驗證碼會被服務方判定為已使用。沒有 HOTP 金鑰的部署無需呼叫。正常升級、日常使用都不需要呼叫。

**請求頭**:

```http
X-Confirm-Maintenance: compact-hotp-counters
```

缺少該頭時返回 400，避免誤觸。

**成功響應** (200 OK):

```json
{
	"success": true,
	"message": "HOTP計數器壓實成功",
	"data": {
		"compactedCount": 3,
		"secretCount": 12
	}
}
```

`compactedCount` 為 HOTP 金鑰數，`secretCount` 為全部金鑰數。

**注意事項**:

- 主文件寫入與紀元輪換是兩步 KV 操作，不是原子的。若返回 500，直接重試即可：輪換成功前舊 sidecar 仍然有效，不會丟計數器。
- 壓實過程中請勿在其他裝置複製 HOTP 驗證碼，否則該次遞增可能落在即將失效的舊紀元裡。
- 該操作不觸發事件備份，但會記錄資料雜湊，定時備份按正常規則處理。
- 舊紀元的 sidecar 鍵不會被刪除，只是不再被讀取。

---

### 批次新增金鑰

**端點**: `POST /api/secrets/batch`

**認證**: ✅ 需要

**描述**: 批次新增多個金鑰（用於匯入）

**請求體**:

```json
{
	"secrets": [
		{
			"name": "GitHub",
			"account": "user@example.com",
			"secret": "JBSWY3DPEHPK3PXP"
		},
		{
			"name": "Google",
			"account": "john@gmail.com",
			"secret": "ABCDEFGHIJKLMNOP"
		}
	]
}
```

**成功響應** (200 OK):

```json
{
	"success": true,
	"data": {
		"total": 2,
		"success": 2,
		"failed": 0,
		"results": [
			{
				"success": true,
				"name": "GitHub",
				"account": "user@example.com"
			},
			{
				"success": true,
				"name": "Google",
				"account": "john@gmail.com"
			}
		]
	},
	"message": "批次新增完成：成功 2 個，失敗 0 個"
}
```

**部分成功響應** (200 OK):

```json
{
	"success": true,
	"data": {
		"total": 3,
		"success": 2,
		"failed": 1,
		"results": [
			{
				"success": true,
				"name": "GitHub",
				"account": "user@example.com"
			},
			{
				"success": false,
				"name": "Invalid",
				"error": "金鑰格式無效"
			},
			{
				"success": true,
				"name": "Google",
				"account": "john@gmail.com"
			}
		]
	},
	"message": "批次新增完成：成功 2 個，失敗 1 個"
}
```

---

### 批次匯出金鑰

**端點**: `POST /api/secrets/export`

**認證**: ✅ 需要
**描述**: 匯出標準 TXT、JSON、CSV、HTML 格式的金鑰檔案。該介面主要供網頁端批次匯出功能呼叫，也可以在攜帶認證 Cookie 的情況下直接使用。

**請求體**:

```json
{
	"format": "json",
	"filenamePrefix": "2FA-secrets",
	"metadata": {
		"source": "export"
	},
	"secrets": [
		{
			"id": "550e8400-e29b-41d4-a716-446655440000",
			"name": "GitHub",
			"account": "user@example.com",
			"secret": "JBSWY3DPEHPK3PXP",
			"type": "TOTP",
			"digits": 6,
			"period": 30,
			"algorithm": "SHA1",
			"counter": 0,
			"createdAt": "2026-04-16T00:00:00.000Z"
		}
	]
}
```

**欄位說明**:

| 欄位             | 型別   | 必填 | 說明                                        |
| ---------------- | ------ | ---- | ------------------------------------------- |
| `format`         | String | ✅   | 匯出格式，支援 `txt`、`json`、`csv`、`html` |
| `filenamePrefix` | String | ❌   | 下載檔名字首                                |
| `metadata`       | Object | ❌   | 附加後設資料，僅寫入匯出檔案內容            |
| `secrets`        | Array  | ✅   | 待匯出的金鑰陣列                            |

**成功響應** (200 OK):

返回檔案下載流，響應頭示例：

```http
Content-Type: application/json;charset=utf-8
Content-Disposition: attachment; filename="2FA-secrets-data-2026-04-17.json"
```

**錯誤響應**:

**400 Bad Request** - 引數錯誤、無效 profile、空匯出或金鑰資料無效:

```json
{
	"error": "請求驗證失敗",
	"message": "請提供金鑰陣列",
	"timestamp": "2026-04-17T10:30:00.000Z"
}
```

**413 Payload Too Large** - 請求體超過 2 MB:

```json
{
	"error": "匯出請求過大",
	"message": "單次匯出請求體不能超過 2 MB（當前約 2.1 MB）",
	"timestamp": "2026-04-17T10:30:00.000Z"
}
```

**429 Too Many Requests** - 觸發敏感操作限流:

```json
{
	"error": "請求過於頻繁",
	"message": "您的請求次數過多，請在 60 秒後重試",
	"retryAfter": 60,
	"limit": 10,
	"remaining": 0,
	"resetAt": "2026-04-17T10:31:00.000Z",
	"algorithm": "sliding-window"
}
```

**限制說明**:

- 該介面使用敏感操作限流：`10 次 / 1 分鐘`
- 單次請求體最大 `2 MB`
- HTML 匯出在金鑰數量較大時會降級為僅表格、不嵌入二維碼的可恢復檔案

---

### 匯入格式參考

批次匯入功能在客戶端自動識別格式並解析為標準結構後呼叫 `POST /api/secrets/batch`。以下是各應用匯出檔案的格式說明。

#### otpauth:// URI（通用）

每行一個 URI，支援 TXT 檔案或直接貼上：

```
otpauth://totp/GitHub:user@example.com?secret=JBSWY3DPEHPK3PXP&issuer=GitHub&digits=6&period=30&algorithm=SHA1
otpauth://hotp/Service:account?secret=ABCDEFGH&counter=5
```

#### Google Authenticator 遷移二維碼

掃描或貼上 `otpauth-migration://` 連結，內含 Protobuf 編碼的批次金鑰資料：

```
otpauth-migration://offline?data=CjEKCkhlbGxvId...
```

#### Aegis Authenticator（JSON）

```json
{
	"db": {
		"entries": [
			{
				"type": "totp",
				"issuer": "GitHub",
				"name": "user@example.com",
				"info": {
					"secret": "JBSWY3DPEHPK3PXP",
					"digits": 6,
					"period": 30,
					"algo": "SHA1"
				}
			}
		]
	}
}
```

#### 2FAS Authenticator（.2fas）

```json
{
	"services": [
		{
			"name": "GitHub",
			"secret": "JBSWY3DPEHPK3PXP",
			"otp": {
				"account": "user@example.com",
				"digits": 6,
				"period": 30,
				"algorithm": "SHA1",
				"tokenType": "TOTP"
			}
		}
	],
	"schemaVersion": 4
}
```

#### Bitwarden（JSON）

```json
{
	"items": [
		{
			"name": "GitHub",
			"login": {
				"username": "user@example.com",
				"totp": "otpauth://totp/GitHub:user?secret=JBSWY3DPEHPK3PXP&issuer=GitHub"
			}
		}
	]
}
```

`totp` 欄位支援完整 `otpauth://` URI 或純 Base32 金鑰。也支援 Bitwarden Authenticator 的 CSV 格式（含 `login_totp` 列）。

#### LastPass Authenticator（JSON）

```json
{
	"version": 1,
	"accounts": [
		{
			"issuerName": "GitHub",
			"userName": "user@example.com",
			"secret": "JBSWY3DPEHPK3PXP",
			"digits": 6,
			"timeStep": 30,
			"algorithm": "SHA1"
		}
	]
}
```

#### andOTP（JSON）

```json
[
	{
		"secret": "JBSWY3DPEHPK3PXP",
		"issuer": "GitHub",
		"label": "user@example.com",
		"digits": 6,
		"type": "totp",
		"algorithm": "SHA1",
		"period": 30,
		"thumbnail": "Default"
	}
]
```

#### Ente Auth（HTML）

Ente Auth 匯出為 HTML 檔案，包含如下結構的表格：

```html
<table class="otp-entry">
	<tr>
		<td>
			<p><b>GitHub</b></p>
			<p><b>user@example.com</b></p>
			<p>Type: <b>TOTP</b></p>
			<p>Secret: <b>JBSWY3DPEHPK3PXP</b></p>
			<p>Digits: <b>6</b></p>
			<p>Period: <b>30</b></p>
		</td>
	</tr>
</table>
```

#### CSV 格式

支援兩種 CSV 表頭：

```csv
服務名稱,賬戶資訊,金鑰,型別,位數,週期(秒),演算法
GitHub,user@example.com,JBSWY3DPEHPK3PXP,TOTP,6,30,SHA1
```

```csv
service,account,secret,type,digits,period,algorithm
GitHub,user@example.com,JBSWY3DPEHPK3PXP,TOTP,6,30,SHA1
```

#### 其他支援的格式

| 來源                 | 格式                             | 識別方式                               |
| -------------------- | -------------------------------- | -------------------------------------- |
| Proton Authenticator | JSON（含 `version` + `entries`） | `entries[].content.uri` 為 otpauth URL |
| Authenticator Pro    | JSON（含 `Authenticators` 大寫） | 欄位 `Type`: 1=HOTP, 2=TOTP            |
| FreeOTP+             | JSON（含 `tokens`）              | `secret` 可為 Base32 或位元組陣列      |
| FreeOTP              | JSON（含 `tokenOrder`）          | `secret` 為位元組陣列格式              |

---

## 時間校準 API

### 獲取服務端時間

**端點**: `GET /api/time`

**認證**: ❌ 不需要

**描述**: 返回 Worker 當前的 Unix 毫秒時間，供客戶端修正 TOTP 計算時鐘。響應禁止快取，不包含金鑰或 OTP 資料。

**成功響應** (200 OK):

```json
{
	"serverTimeMs": 1786248000123
}
```

---

## OTP 生成 API

### 生成 OTP

**端點**: `GET /otp/{secret}`

**認證**: ❌ 不需要

**描述**: 公開 OTP 生成介面。預設返回 HTML 頁面；當 `format=json` 時返回 JSON。

**URL 引數**:

- `secret` (String): Base32 編碼的金鑰

**查詢引數** (可選):

- `type` (String): OTP 型別 (`totp`, `hotp`)，預設 `TOTP`
- `digits` (Number): OTP 位數，支援 `6`、`8`，預設 `6`
- `period` (Number): TOTP 時間步長（秒），支援 `30`、`60`、`120`，預設 `30`
- `algorithm` (String): 雜湊演算法，支援 `SHA1`、`SHA256`、`SHA512`
- `counter` (Number): HOTP 計數器（僅 `HOTP` 使用）
- `format` (String): `html` 或 `json`，預設 `html`
- `preview` (String): 顯式設為 `1` 時，TOTP JSON 響應包含後續兩個週期的驗證碼和時間資訊；HOTP 忽略此引數

**請求示例**:

```http
GET /otp/JBSWY3DPEHPK3PXP?type=totp&digits=6&period=30&format=json HTTP/1.1
Host: 2fa.example.com
```

**成功響應** (`format=json`, 200 OK):

```json
{
	"token": "123456"
}
```

**成功響應** (`format=html`, 200 OK):

- 返回可直接展示的 OTP HTML 頁面
- TOTP 頁面顯示當前、下一週期驗證碼和剩餘有效時間，並自動更新
- HOTP 頁面只顯示指定計數器的當前驗證碼，不顯示倒計時、不自動遞增計數器

**TOTP 預覽響應** (`format=json&preview=1`, 200 OK):

```json
{
	"token": "123456",
	"nextToken": "654321",
	"followingToken": "789012",
	"period": 30,
	"validUntil": 1800000030000,
	"serverTime": 1800000015000
}
```

`validUntil` 為當前驗證碼所屬週期的結束時間，`serverTime` 為驗證碼生成結束時的伺服器時間，二者均為 Unix 毫秒。三個驗證碼使用同一個時間基準生成；如果生成期間跨過週期邊界，`validUntil` 可能已經過去，客戶端應按時間判斷有效性。`nextToken` 僅在下一週期生效；`followingToken` 在再下一個週期生效，用於週期交接時補上新的下期碼，頁面不單獨顯示第三個驗證碼。

不帶 `preview=1` 的 JSON 請求，以及所有 HOTP JSON 請求，仍只返回 `{ "token": "…" }`。OTP JSON 響應使用 `Cache-Control: no-store`。

**錯誤響應**:

**400 Bad Request** - 金鑰無效:

```json
{
	"error": "OTP生成失敗",
	"message": "金鑰格式無效，必須是有效的 Base32 格式",
	"timestamp": "2025-10-24T10:30:00.000Z"
}
```

---

## 備份管理 API

### 手動觸發備份

**端點**: `POST /api/backup`

**認證**: ✅ 需要

**描述**: 立即觸發一次備份。生成的備份副檔名會跟隨「預設匯出格式」設定（`txt` / `json` / `csv` / `html`）。

**成功響應** (200 OK):

```json
{
	"success": true,
	"message": "備份完成，共備份 15 個金鑰",
	"backupKey": "backup_2026-04-17_06-05-18-599-us85.txt",
	"count": 15,
	"timestamp": "2026-04-17T06:05:18.599Z",
	"encrypted": true,
	"format": "txt"
}
```

---

### 獲取備份列表

**端點**: `GET /api/backup`

**認證**: ✅ 需要

**描述**: 獲取所有可用備份的列表

**成功響應** (200 OK):

```json
{
	"success": true,
	"backups": [
		{
			"key": "backup_2026-04-17_06-05-18-599-us85.txt",
			"created": "2026-04-17T06:05:18.599Z",
			"count": 15,
			"encrypted": true,
			"format": "txt",
			"partial": false,
			"skippedInvalidCount": 0,
			"size": 2048
		},
		{
			"key": "backup_2026-04-17_06-05-18-552-n8b1.html",
			"created": "2026-04-17T06:05:18.552Z",
			"count": 15,
			"encrypted": true,
			"format": "html",
			"partial": false,
			"skippedInvalidCount": 0,
			"size": 8192
		}
	],
	"count": 2,
	"pagination": {
		"limit": 50,
		"hasMore": false,
		"cursor": null,
		"loadedAll": false
	}
}
```

---

### 匯出備份

**端點**: `GET /api/backup/export/{backupKey}?format={format}`

**認證**: ✅ 需要

**描述**: 將指定備份匯出為目標格式檔案。支援 `txt`、`json`、`csv`、`html` 四種格式。

**URL 引數**:

- `backupKey` (String): 備份檔名（如 `backup_2026-04-17_06-05-18-599-us85.txt`）
- `format` (String，可選): 匯出格式，預設 `txt`

**成功響應** (200 OK): 返回下載檔案，響應頭示例：

```http
Content-Type: text/plain;charset=utf-8
Content-Disposition: attachment; filename="2FA-backup-2026-04-17.txt"
```

**錯誤響應**:

**404 Not Found** - 備份不存在:

```json
{
	"error": "備份不存在",
	"message": "找不到指定的備份",
	"timestamp": "2025-10-24T10:30:00.000Z"
}
```

**400 Bad Request** - 備份已加密但無金鑰:

```json
{
	"error": "無法匯出",
	"message": "備份檔案已加密，但未配置 ENCRYPTION_KEY。如需訪問加密備份，請先配置正確的加密金鑰。",
	"timestamp": "2025-10-24T10:30:00.000Z"
}
```

---

### 恢復備份

**端點**: `POST /api/backup/restore`

**認證**: ✅ 需要

**描述**: 從指定備份恢復資料（會覆蓋當前資料）

**請求體**:

KV 備份恢復:

```json
{
	"backupKey": "backup_2026-04-17_06-05-18-599-us85.txt",
	"preview": false
}
```

- `backupKey`: KV 中的備份檔名
- `preview`: `true` 時僅返回預覽，不執行恢復

上傳備份檔案恢復（適用於從 WebDAV/S3/OneDrive/Google Drive 下載的遠端備份）:

```json
{
	"backupFileName": "backup_2026-04-17_06-05-18-599-us85.txt",
	"backupContent": "v1:base64iv:base64ciphertext",
	"preview": true
}
```

- `backupFileName`: 上傳檔名，必須為 `backup_*.(txt|json|csv|html)`
- `backupContent`: 上傳檔案原始文本內容，可為明文備份或 `v1:` 加密備份
- `preview`: `true` 時僅返回預覽，不執行恢復

**成功響應** (200 OK):

```json
{
	"success": true,
	"message": "恢復備份成功，共恢復 15 個金鑰",
	"backupKey": "backup_2026-04-17_06-05-18-599-us85.txt",
	"count": 15,
	"timestamp": "2026-04-17T06:05:18.599Z",
	"sourceEncrypted": true,
	"format": "txt",
	"source": "kv"
}
```

**預覽響應** (`preview: true`):

```json
{
	"success": true,
	"data": {
		"message": "備份預覽獲取成功",
		"backupKey": "backup_2026-04-17_06-05-18-599-us85.txt",
		"count": 15,
		"timestamp": "2026-04-17T06:05:18.599Z",
		"encrypted": true,
		"format": "txt",
		"source": "kv",
		"partial": false,
		"skippedInvalidCount": 0,
		"warnings": [],
		"secrets": []
	}
}
```

**錯誤響應**:

**404 Not Found** - 備份不存在:

```json
{
	"error": "備份不存在",
	"message": "找不到指定的備份",
	"timestamp": "2025-10-24T10:30:00.000Z"
}
```

**400 Bad Request** - 備份已加密但無金鑰:

```json
{
	"error": "無法恢復",
	"message": "備份檔案已加密，但未配置 ENCRYPTION_KEY。如需恢復加密備份，請先配置正確的加密金鑰。",
	"timestamp": "2025-10-24T10:30:00.000Z"
}
```

---

## WebDAV 與 S3 同步 API

兩類服務均支援多個備份目標，所有端點都需要認證。配置儲存在 KV；配置了 `ENCRYPTION_KEY` 時加密儲存，否則儲存響應會返回 `encrypted: false` 和 `warning`。

### 獲取 WebDAV 或 S3 目標列表

**端點**: `GET /api/webdav/config` 或 `GET /api/s3/config`

**WebDAV 成功響應** (200 OK):

```json
{
	"destinations": [
		{
			"id": "550e8400-e29b-41d4-a716-446655440000",
			"name": "WebDAV 備份",
			"enabled": true,
			"config": {
				"url": "https://dav.example.com",
				"username": "backup-user",
				"password": "",
				"hasPassword": true,
				"path": "/2FA-Backups"
			},
			"status": { "lastSuccess": null, "lastError": null },
			"createdAt": "2026-09-16T00:00:00.000Z"
		}
	],
	"count": 1,
	"maxAllowed": 5
}
```

S3 返回相同的外層結構，各目標的 `config` 為：

```json
{
	"endpoint": "https://s3.example.com",
	"bucket": "2fa-backups",
	"region": "auto",
	"accessKeyId": "example-access-key",
	"secretAccessKey": "",
	"hasSecretKey": true,
	"prefix": "2fa/"
}
```

密碼和 Secret Access Key 不會返回明文，客戶端通過 `hasPassword` / `hasSecretKey` 判斷是否已儲存。`status` 為最近備份推送結果；`maxAllowed: 5` 用於介面提示，當前 WebDAV/S3 儲存 API 未強制校驗目標數量上限。

### 儲存 WebDAV 目標

**端點**: `POST /api/webdav/config`

**請求體**:

```json
{
	"name": "WebDAV 備份",
	"url": "https://dav.example.com",
	"username": "backup-user",
	"password": "example-app-password",
	"path": "/2FA-Backups"
}
```

- 新增時省略 `id`；更新時附加目標 `id`，仍需提交 `name`、`url`、`username`。
- `name` 最多 30 個字元，`url` 必須使用 HTTPS。
- 首次儲存必須提供 `password`；更新時省略或傳空字串會保留已儲存的密碼。
- `path` 預設 `/`，儲存時規範化為以 `/` 開頭的目錄路徑。

**成功響應** (200 OK，已配置加密金鑰的示例):

```json
{
	"success": true,
	"message": "WebDAV 配置已儲存",
	"id": "550e8400-e29b-41d4-a716-446655440000",
	"encrypted": true
}
```

### 儲存 S3 目標

**端點**: `POST /api/s3/config`

**請求體**:

```json
{
	"name": "S3 備份",
	"endpoint": "https://s3.example.com",
	"bucket": "2fa-backups",
	"region": "auto",
	"accessKeyId": "example-access-key",
	"secretAccessKey": "example-secret-key",
	"prefix": "2fa/"
}
```

- 新增時省略 `id`；更新時附加目標 `id`，仍需提交 `name`、`endpoint`、`bucket`、`accessKeyId`。
- `name` 最多 30 個字元，`endpoint` 必須使用 HTTPS。
- 首次儲存必須提供 `secretAccessKey`；更新時省略或傳空字串會保留已儲存的金鑰。
- `region` 預設 `auto`；`prefix` 預設空字串，非空字首會規範化為無前導 `/`、以 `/` 結尾的路徑。
- 成功響應結構與 WebDAV 相同，`message` 為 `S3 配置已儲存`。

兩類服務的新增目標預設啟用；更新配置保留原有啟用狀態。儲存介面不執行連線測試。

### 測試 WebDAV 或 S3 連線

**端點**: `POST /api/webdav/test` 或 `POST /api/s3/test`

請求體與對應儲存介面相同，必填配置欄位也相同。可以攜帶 `id` 並將密碼或 Secret Access Key 留空，以使用該目標已儲存的憑證；僅提交 `id` 不足以完成測試。測試不會儲存配置，但會向遠端寫入測試檔案，當前實現不會自動刪除該檔案。

**WebDAV 成功響應** (200 OK):

```json
{
	"success": true,
	"message": "連線成功，已驗證寫入許可權（測試檔案：.2fa-webdav-test.txt）",
	"method": "PROPFIND"
}
```

`method` 為實際連線探測成功的方法。S3 成功響應沒有 `method` 欄位，`message` 中的測試檔案為 `<prefix>.2fa-s3-test.txt`。連線或寫入測試失敗返回 400，例如：

```json
{
	"success": false,
	"message": "寫入測試失敗：沒有寫入許可權，請檢查 Access Key 許可權"
}
```

### 切換 WebDAV 或 S3 啟用狀態

**端點**: `POST /api/webdav/toggle` 或 `POST /api/s3/toggle`

**請求體**:

```json
{
	"id": "550e8400-e29b-41d4-a716-446655440000",
	"enabled": false
}
```

**成功響應** (200 OK):

```json
{
	"success": true,
	"message": "已停用"
}
```

`enabled` 必須為布林值；傳 `true` 時成功訊息為 `已啟用`。目標不存在時返回 404。

### 刪除 WebDAV 或 S3 目標

**端點**: `DELETE /api/webdav/config?id={id}` 或 `DELETE /api/s3/config?id={id}`

通過查詢引數指定目標，不需要請求體。成功返回 200，例如：

```json
{
	"success": true,
	"message": "WebDAV 配置已刪除"
}
```

S3 的成功訊息為 `S3 配置已刪除`。缺少 `id` 返回 400，目標不存在返回 404。儲存、刪除、測試、切換介面均使用 `sensitive` 限流（10 次 / 分鐘），共享計數方式見 [Rate Limiting](#rate-limiting)。

---

## 雲盤同步 API

OneDrive 和 Google Drive 使用同一套目標管理模型:

- 目標配置儲存到 KV，可選使用 `ENCRYPTION_KEY` 加密
- OAuth 授權成功後會立即執行一次自動連線測試
- 新目標授權成功後預設保持關閉狀態，需要使用者手動啟用
- 已啟用的目標重新授權後，會保留原有啟用狀態
- 遠端自動備份寫入的副檔名跟隨「預設匯出格式」設定

### 目標配置欄位

```json
{
	"id": "uuid",
	"name": "工作盤",
	"folderPath": "/2FA-Backups"
}
```

欄位說明:

- `id`: 目標 ID；更新或刪除現有目標時使用
- `name`: 目標名稱，最多 30 個字元
- `folderPath`: 遠端備份目錄，預設為 `/2FA-Backups`

### OneDrive API

| 端點                           | 方法   | 認證 | 描述                                                              |
| ------------------------------ | ------ | ---- | ----------------------------------------------------------------- |
| `/api/onedrive/config`         | GET    | ✅   | 獲取 OneDrive 目標列表、授權狀態和最近推送結果                    |
| `/api/onedrive/config`         | POST   | ✅   | 新增或更新 OneDrive 目標                                          |
| `/api/onedrive/config?id={id}` | DELETE | ✅   | 刪除指定 OneDrive 目標                                            |
| `/api/onedrive/toggle`         | POST   | ✅   | 啟用或停用指定 OneDrive 目標                                      |
| `/api/onedrive/oauth/start`    | POST   | ✅   | 生成授權連結並啟動 OAuth                                          |
| `/api/onedrive/oauth/callback` | GET    | ❌   | Microsoft 回撥地址，返回彈窗 HTML 並通過 `postMessage` 通知主視窗 |

### Google Drive API

| 端點                         | 方法   | 認證 | 描述                                                           |
| ---------------------------- | ------ | ---- | -------------------------------------------------------------- |
| `/api/gdrive/config`         | GET    | ✅   | 獲取 Google Drive 目標列表、授權狀態和最近推送結果             |
| `/api/gdrive/config`         | POST   | ✅   | 新增或更新 Google Drive 目標                                   |
| `/api/gdrive/config?id={id}` | DELETE | ✅   | 刪除指定 Google Drive 目標                                     |
| `/api/gdrive/toggle`         | POST   | ✅   | 啟用或停用指定 Google Drive 目標                               |
| `/api/gdrive/oauth/start`    | POST   | ✅   | 生成授權連結並啟動 OAuth                                       |
| `/api/gdrive/oauth/callback` | GET    | ❌   | Google 回撥地址，返回彈窗 HTML 並通過 `postMessage` 通知主視窗 |

### 儲存目標

**端點**: `POST /api/onedrive/config` 或 `POST /api/gdrive/config`

**請求體**:

```json
{
	"name": "工作盤",
	"folderPath": "/2FA-Backups"
}
```

**成功響應** (200 OK):

```json
{
	"success": true,
	"id": "550e8400-e29b-41d4-a716-446655440000",
	"message": "配置已儲存",
	"encrypted": true,
	"warning": null
}
```

### 切換啟用狀態

**端點**: `POST /api/onedrive/toggle` 或 `POST /api/gdrive/toggle`

**請求體**:

```json
{
	"id": "550e8400-e29b-41d4-a716-446655440000",
	"enabled": true
}
```

說明:

- 未授權目標不能直接啟用
- 授權成功但連線測試失敗時，目標會保持停用

### 啟動 OAuth

**端點**: `POST /api/onedrive/oauth/start` 或 `POST /api/gdrive/oauth/start`

**請求體**:

```json
{
	"id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**成功響應** (200 OK):

```json
{
	"success": true,
	"authorizeUrl": "https://provider.example.com/oauth/authorize?...",
	"callbackOrigin": "https://your-app.example.com"
}
```

### OAuth 回撥

**端點**: `GET /api/onedrive/oauth/callback` 或 `GET /api/gdrive/oauth/callback`

**認證**: ❌ 不需要

**描述**:

- 這是 OAuth 平臺回跳用的公開端點
- 它會消費一次性 `state`，儲存授權結果，並返回一個彈窗頁面
- 彈窗頁面會向主視窗傳送 `cloudBackupAuthComplete` 訊息，然後嘗試自動關閉

---

## 首次設定與系統設定 API

### 首次設定

**端點**: `POST /api/setup`

**認證**: ❌ 不需要

**描述**: 初始化管理員密碼，並在成功後自動登入。

**請求體**:

```json
{
	"password": "Str0ng-Pass!",
	"confirmPassword": "Str0ng-Pass!"
}
```

**欄位說明**:

- `password`: 新管理員密碼
- `confirmPassword`: 確認密碼，必須與 `password` 完全一致

**密碼規則**:

- 長度至少 8 位
- 至少包含 1 個大寫字母
- 至少包含 1 個小寫字母
- 至少包含 1 個數字
- 至少包含 1 個特殊字元

**成功響應** (200 OK):

```json
{
	"success": true,
	"message": "密碼設定成功，已自動登入",
	"expiresAt": "2026-05-17T10:30:00.000Z",
	"expiresIn": "30天"
}
```

**響應頭**:

```http
Set-Cookie: auth_token=<JWT_TOKEN>; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000; Path=/
```

**錯誤響應**:

**400 Bad Request** - 引數缺失、兩次密碼不一致或密碼強度不足:

```json
{
	"error": "ValidationError",
	"message": "兩次輸入的密碼不一致",
	"statusCode": 400,
	"details": {
		"issue": "password_mismatch"
	},
	"timestamp": "2026-04-17T10:30:00.000Z"
}
```

**409 Conflict** - 已完成首次設定:

```json
{
	"error": "ConflictError",
	"message": "密碼已設定，無法重複設定。如需修改密碼，請聯絡管理員。",
	"statusCode": 409,
	"details": {
		"operation": "first_time_setup",
		"alreadyCompleted": true
	},
	"timestamp": "2026-04-17T10:30:00.000Z"
}
```

**500 Internal Server Error** - KV 未繫結或服務端配置異常:

```json
{
	"error": "設定失敗",
	"message": "KV 儲存未繫結，請在 Cloudflare Dashboard 或 wrangler.toml 中配置 SECRETS_KV 名稱空間後重試",
	"timestamp": "2026-04-17T10:30:00.000Z"
}
```

---

### 修改密碼

**端點**: `POST /api/change-password`

**認證**: ✅ 需要

**描述**: 校驗當前密碼後更新管理員密碼。修改成功後，舊 JWT 會因簽名金鑰變化而失效，客戶端應重新登入。

**請求體**:

```json
{
	"currentPassword": "Old-Pass1!",
	"newPassword": "New-Pass2!",
	"confirmPassword": "New-Pass2!"
}
```

**成功響應** (200 OK):

```json
{
	"success": true,
	"message": "密碼修改成功，請重新登入"
}
```

**錯誤響應**:

**400 Bad Request** - 引數缺失、兩次新密碼不一致或新密碼強度不足:

```json
{
	"error": "ValidationError",
	"message": "請提供當前密碼、新密碼和確認密碼",
	"statusCode": 400,
	"details": {
		"missing": ["confirmPassword"]
	},
	"timestamp": "2026-04-17T10:30:00.000Z"
}
```

**401 Unauthorized** - 當前密碼錯誤:

```json
{
	"error": "AuthenticationError",
	"message": "密碼錯誤",
	"statusCode": 401,
	"details": {
		"operation": "change_password"
	},
	"timestamp": "2026-04-17T10:30:00.000Z"
}
```

**500 Internal Server Error** - 服務端未配置 KV 或尚未完成首次設定:

```json
{
	"error": "ConfigurationError",
	"message": "未設定密碼，請先完成首次設定",
	"statusCode": 500,
	"details": {
		"setupRequired": true
	},
	"timestamp": "2026-04-17T10:30:00.000Z"
}
```

---

### 獲取系統設定

**端點**: `GET /api/settings`

**認證**: ✅ 需要

**描述**: 獲取當前系統設定。若設定不存在或已損壞，服務端會自動回退到預設值。

**成功響應** (200 OK):

```json
{
	"jwtExpiryDays": 30,
	"maxBackups": 100,
	"defaultExportFormat": "json"
}
```

**欄位說明**:

- `jwtExpiryDays`: JWT 登入有效期，範圍 `1~365`
- `maxBackups`: 自動備份保留數量，範圍 `0~1000`；`0` 表示不限制
- `defaultExportFormat`: 預設匯出格式，支援 `txt`、`json`、`csv`、`html`

**錯誤響應**:

**500 Internal Server Error** - 讀取設定失敗:

```json
{
	"error": "獲取設定失敗",
	"message": "讀取設定時發生錯誤",
	"timestamp": "2026-04-17T10:30:00.000Z"
}
```

---

### 儲存系統設定

**端點**: `POST /api/settings`

**認證**: ✅ 需要

**描述**: 儲存系統設定。請求體支援部分更新，未提供的欄位保持原值不變。

**請求體**:

```json
{
	"jwtExpiryDays": 30,
	"maxBackups": 100,
	"defaultExportFormat": "html"
}
```

**說明**:

- 可只提交任意一個欄位進行區域性更新
- `defaultExportFormat` 不僅影響匯出按鈕預設選項，也會影響新建立備份檔案和遠端自動備份的副檔名

**成功響應** (200 OK):

```json
{
	"success": true,
	"message": "設定已儲存",
	"settings": {
		"jwtExpiryDays": 30,
		"maxBackups": 100,
		"defaultExportFormat": "html"
	}
}
```

**錯誤響應**:

**400 Bad Request** - 欄位值非法:

```json
{
	"error": "ValidationError",
	"message": "預設匯出格式僅支援：txt, json, csv, html",
	"statusCode": 400,
	"details": {
		"field": "defaultExportFormat",
		"value": "xml"
	},
	"timestamp": "2026-04-17T10:30:00.000Z"
}
```

**429 Too Many Requests** - 寫入過於頻繁:

```json
{
	"error": "請求過於頻繁",
	"message": "您的請求過於頻繁，請稍後再試",
	"retryAfter": 30,
	"timestamp": "2026-04-17T10:30:00.000Z"
}
```

**500 Internal Server Error** - 儲存設定失敗:

```json
{
	"error": "儲存設定失敗",
	"message": "儲存設定時發生錯誤",
	"timestamp": "2026-04-17T10:30:00.000Z"
}
```

---

## 認證 API

### 登入

見 [獲取認證 Token](#獲取認證-token)

### Token 重新整理

見 [Token 重新整理](#token-重新整理)

### 退出登入

清除當前會話的 HttpOnly 認證 Cookie。該端點無需認證（即使 Cookie 已失效仍可呼叫），但內建 CSRF 防護與限流。

**端點**: `POST /api/logout`

**鑑權**: 不需要 `auth_token` Cookie，但要求請求來自同源頁面

**必需請求頭**:

| 頭部                       | 值                                   | 用途                                      |
| -------------------------- | ------------------------------------ | ----------------------------------------- |
| `X-Requested-With`         | `XMLHttpRequest`                     | CSRF 防護：跨站表單無法新增自定義頭       |
| `Origin`（若存在）         | 同當前 Worker 主機                   | 與 `getAllowedOrigin` 計算結果一致        |
| `Sec-Fetch-Site`（若存在） | `same-origin` / `same-site` / `none` | 現代瀏覽器自動附帶；`cross-site` 會被拒絕 |

**請求體**: 無

**成功響應** (200 OK):

```json
{
	"success": true,
	"message": "已退出登入"
}
```

響應同時附帶：

```http
Set-Cookie: auth_token=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/; HttpOnly; SameSite=Strict; Secure
Cache-Control: no-store
```

**失敗響應**:

| 狀態碼 | 觸發條件                                                                      | 錯誤標題     |
| ------ | ----------------------------------------------------------------------------- | ------------ |
| 403    | 缺少 `X-Requested-With` / `Origin` 與本站不一致 / `Sec-Fetch-Site=cross-site` | 請求被拒絕   |
| 429    | 1 分鐘內對同一 IP 呼叫超過 10 次（`sensitive` 預設）                          | 請求過於頻繁 |

**前端使用要點**: 即使後端返回非 200，前端仍應清理本地狀態（金鑰列表、OTP 定時器、`localStorage` 快取）並跳轉登入頁。HttpOnly Cookie 最終會隨 `SameSite=Strict` 失效或瀏覽器關閉而消失。

---

## 錯誤程式碼

### HTTP 狀態碼

| 狀態碼  | 說明                  | 場景                   |
| ------- | --------------------- | ---------------------- |
| **200** | OK                    | 請求成功               |
| **201** | Created               | 資源建立成功           |
| **400** | Bad Request           | 請求引數錯誤或驗證失敗 |
| **401** | Unauthorized          | 未授權或 Token 無效    |
| **404** | Not Found             | 資源不存在             |
| **409** | Conflict              | 資源衝突（如重複新增） |
| **429** | Too Many Requests     | 超過限流限制           |
| **500** | Internal Server Error | 伺服器內部錯誤         |

### 錯誤響應格式

所有錯誤響應都遵循統一格式：

```json
{
	"error": "錯誤標題",
	"message": "詳細錯誤資訊",
	"timestamp": "2025-10-24T10:30:00.000Z"
}
```

### 常見錯誤示例

#### 1. 認證失敗 (401)

```json
{
	"error": "認證失敗",
	"message": "訪問令牌無效或已過期",
	"timestamp": "2025-10-24T10:30:00.000Z"
}
```

#### 2. 引數驗證失敗 (400)

```json
{
	"error": "引數錯誤",
	"message": "金鑰格式無效，必須是有效的 Base32 格式",
	"timestamp": "2025-10-24T10:30:00.000Z"
}
```

#### 3. 資源不存在 (404)

```json
{
	"error": "金鑰不存在",
	"message": "找不到指定的金鑰",
	"timestamp": "2025-10-24T10:30:00.000Z"
}
```

#### 4. 資源衝突 (409)

```json
{
	"error": "金鑰已存在",
	"message": "相同服務名稱和賬戶的金鑰已存在",
	"timestamp": "2025-10-24T10:30:00.000Z"
}
```

#### 5. 超過限流 (429)

```json
{
	"error": "請求過於頻繁",
	"message": "您的請求次數過多，請在 30 秒後重試",
	"retryAfter": 30,
	"limit": 10,
	"remaining": 0,
	"resetAt": "2026-01-01T00:00:30.000Z",
	"algorithm": "sliding-window"
}
```

#### 6. 伺服器錯誤 (500)

```json
{
	"error": "伺服器錯誤",
	"message": "請求處理失敗，請稍後重試",
	"errorId": "err_1729765800_abc123",
	"timestamp": "2025-10-24T10:30:00.000Z"
}
```

---

## Rate Limiting

### 限流策略

當前由各處理函式顯式呼叫限流，並未在路由入口統一限流。實際呼叫的規則如下：

| 操作                                                       | 限流規則 | 視窗時間 | 預設名稱    |
| ---------------------------------------------------------- | -------- | -------- | ----------- |
| 登入、首次設定                                             | 5 次     | 1 分鐘   | `login`     |
| 退出登入、修改密碼、儲存系統設定                           | 10 次    | 1 分鐘   | `sensitive` |
| 刪除金鑰、手動觸發備份                                     | 10 次    | 1 分鐘   | `sensitive` |
| WebDAV/S3 儲存、刪除、連線測試、切換啟用狀態               | 10 次    | 1 分鐘   | `sensitive` |
| OneDrive/Google Drive 儲存、刪除、切換啟用狀態、啟動 OAuth | 10 次    | 1 分鐘   | `sensitive` |
| 批次新增金鑰 (`POST /api/secrets/batch`)                   | 20 次    | 5 分鐘   | `bulk`      |
| 批次匯出金鑰 (`POST /api/secrets/export`)                  | 10 次    | 1 分鐘   | `sensitive` |

除批次匯出使用 `export:<IP>` 外，上表操作均直接使用客戶端 IP 作為鍵，共享 `ratelimit:v2:<IP>` 記錄。因此表中數字是處理當前請求時使用的閾值，並非各介面互相獨立的配額；不同操作可能相互影響。

金鑰讀取/新增/更新、HOTP 計數器操作、備份列表/匯出/恢復、系統設定和雲盤配置讀取、時間校準、Token 重新整理、OAuth 回撥、Favicon 代理以及公開 OTP 生成，當前沒有顯式應用限流。`api`（30 次 / 分鐘）和 `global`（100 次 / 分鐘）雖然定義在預設中，但當前路由未使用這些預設。

### 限流響應頭

登入和首次設定的成功響應包含以下三個響應頭。由限流器生成的 429 響應還包含 `Retry-After` 和 `X-RateLimit-Algorithm`；其他響應不保證攜帶限流頭。

```http
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 4
X-RateLimit-Reset: 1767225630000
```

| Header                  | 說明                                                             |
| ----------------------- | ---------------------------------------------------------------- |
| `X-RateLimit-Limit`     | 視窗時間內的最大請求數                                           |
| `X-RateLimit-Remaining` | 視窗時間內剩餘請求數                                             |
| `X-RateLimit-Reset`     | 最早一條記錄離開當前視窗的時間（Unix 毫秒時間戳）                |
| `X-RateLimit-Algorithm` | 使用的演算法，當前為 `sliding-window`；在限流器的 429 響應中返回 |
| `Retry-After`           | 建議等待的秒數；在限流器的 429 響應中返回                        |

### 超過限流

當超過限流限制時，API 返回 429 狀態碼：

```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json
Retry-After: 30
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1767225630000
X-RateLimit-Algorithm: sliding-window
```

```json
{
	"error": "請求過於頻繁",
	"message": "您的請求次數過多，請在 30 秒後重試",
	"retryAfter": 30,
	"limit": 10,
	"remaining": 0,
	"resetAt": "2026-01-01T00:00:30.000Z",
	"algorithm": "sliding-window"
}
```

### 限流演算法

使用**滑動視窗 (Sliding Window)** 演算法：

```
時間軸: ───────────────────────────→
         [最近 60 秒滑動視窗]
                ↑ 當前請求時間

統計範圍: 僅計算當前時刻向前回溯 windowSeconds 內的請求
放行條件: 視窗內請求數 < maxAttempts
視窗移動: 每次請求到來時重新計算，而不是等待整分鐘重置
```

**演算法特點**:

- ✅ 相比固定視窗，更平滑地限制突發流量
- ✅ 降低視窗邊界瞬時雙倍突發的問題
- ✅ 當前實現基於 Cloudflare KV 持久化限流狀態
- ✅ 所有預設均統一使用 `sliding-window`

**實現說明**:

- 基於 Cloudflare KV 儲存限流狀態
- 客戶端 IP 優先取 `CF-Connecting-IP`，其次為 `X-Real-IP`、`X-Forwarded-For` 的首項；缺失時使用 `unknown`。除批次匯出帶 `export:` 字首外，其餘已接入限流的操作共享該 IP 的記錄
- KV 自動過期機制確保視窗狀態自動清理
- 限流檢查失敗時採用 "fail open" 策略（允許請求通過，不影響正常使用者）

---

## 示例程式碼

### JavaScript / Fetch API

#### 登入並獲取金鑰

```javascript
// 1. 登入
const loginResponse = await fetch('https://2fa.example.com/api/login', {
	method: 'POST',
	headers: {
		'Content-Type': 'application/json',
	},
	body: JSON.stringify({
		credential: 'YOUR_PASSWORD',
	}),
	credentials: 'include', // 重要：攜帶 Cookie
});

if (loginResponse.ok) {
	console.log('登入成功');

	// 2. 獲取金鑰列表（Cookie 自動攜帶）
	const secretsResponse = await fetch('https://2fa.example.com/api/secrets', {
		credentials: 'include', // 重要：攜帶 Cookie
	});

	const secrets = await secretsResponse.json();
	console.log('金鑰列表:', secrets);
}
```

#### 新增新金鑰

```javascript
const response = await fetch('https://2fa.example.com/api/secrets', {
	method: 'POST',
	headers: {
		'Content-Type': 'application/json',
	},
	credentials: 'include',
	body: JSON.stringify({
		name: 'GitHub',
		account: 'user@example.com',
		secret: 'JBSWY3DPEHPK3PXP',
	}),
});

const result = await response.json();
if (response.ok) {
	console.log('金鑰新增成功:', result.data);
} else {
	console.error('新增失敗:', result.message);
}
```

#### 生成 OTP

```javascript
const response = await fetch('https://2fa.example.com/otp/JBSWY3DPEHPK3PXP?type=totp&period=30&format=json');

const result = await response.json();
console.log('當前 OTP:', result.token);
```

### cURL

#### 登入

```bash
curl -X POST https://2fa.example.com/api/login \
  -H "Content-Type: application/json" \
  -d '{"credential":"YOUR_PASSWORD"}' \
  -c cookies.txt  # 儲存 Cookie
```

#### 獲取金鑰列表

```bash
curl https://2fa.example.com/api/secrets \
  -b cookies.txt  # 使用儲存的 Cookie
```

#### 新增新金鑰

```bash
curl -X POST https://2fa.example.com/api/secrets \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "name": "GitHub",
    "account": "user@example.com",
    "secret": "JBSWY3DPEHPK3PXP"
  }'
```

#### 生成 OTP（無需認證）

```bash
curl "https://2fa.example.com/otp/JBSWY3DPEHPK3PXP?format=json"
```

#### 回滾到 1.8.0 之前的版本前壓實 HOTP 計數器

```bash
curl -X POST https://2fa.example.com/api/secrets/counters/compact \
  -H "X-Confirm-Maintenance: compact-hotp-counters" \
  -b cookies.txt
```

### Python

```python
import requests

# 1. 登入
session = requests.Session()
login_response = session.post(
    'https://2fa.example.com/api/login',
    json={
        'credential': 'YOUR_PASSWORD'
    }
)

if login_response.ok:
    print('登入成功')

    # 2. 獲取金鑰列表
    secrets_response = session.get(
        'https://2fa.example.com/api/secrets'
    )
    secrets = secrets_response.json()
    print('金鑰列表:', secrets)

    # 3. 新增新金鑰
    add_response = session.post(
        'https://2fa.example.com/api/secrets',
        json={
            'name': 'GitHub',
            'account': 'user@example.com',
            'secret': 'JBSWY3DPEHPK3PXP'
        }
    )
    print('新增結果:', add_response.json())
```

---

## Webhook 整合（計劃中）

> **狀態**: 🚧 計劃中，尚未實現

未來版本將支援 Webhook 整合，用於：

- 金鑰新增/刪除通知
- 備份完成通知
- 異常登入警報

---

## GraphQL API（計劃中）

> **狀態**: 🚧 計劃中，尚未實現

未來版本可能提供 GraphQL 端點，提供更靈活的資料查詢。

---

## 相關文件

- [架構文件](ARCHITECTURE.md) - 瞭解系統設計
- [部署指南](DEPLOYMENT.md) - 部署和配置
- [文件中心](README.md) - 功能與開發文件索引
- [雲盤備份配置](CLOUD_DRIVE_SETUP.md) - OneDrive 和 Google Drive OAuth 配置

---

**基礎 URL**: `https://your-worker.workers.dev` 或自定義域名
