# 案例：堅果雲 WebDAV 在 Cloudflare Workers 上返回 520 錯誤

> 排查過程全記錄，從現象到根因，適合零基礎閱讀。

---

## 目錄

1. [背景介紹](#1-背景介紹)
2. [問題現象](#2-問題現象)
3. [排查過程](#3-排查過程)
   - [第一輪：以為是 HTTP 方法不支援](#31-第一輪以為是-http-方法不支援)
   - [第二輪：以為是缺少 User-Agent](#32-第二輪以為是缺少-user-agent)
   - [第三輪：加除錯資訊，發現 Cloudflare](#33-第三輪加除錯資訊發現-cloudflare)
   - [第四輪：海外 VPS 驗證，修正根因](#34-第四輪海外-vps-驗證修正根因)
4. [根因分析](#4-根因分析)
5. [知識點詳解](#5-知識點詳解)
   - [什麼是 HTTP 520 錯誤？](#51-什麼是-http-520-錯誤)
   - [什麼是 Cloudflare CDN？](#52-什麼是-cloudflare-cdn)
   - [什麼是 Cloudflare Workers？](#53-什麼是-cloudflare-workers)
   - [什麼是 WebDAV？](#54-什麼是-webdav)
   - [如何判斷一個網站是否在 Cloudflare 後面？](#55-如何判斷一個網站是否在-cloudflare-後面)
6. [最終解決方案](#6-最終解決方案)
7. [教訓與收穫](#7-教訓與收穫)
8. [參考資料](#8-參考資料)

---

## 1. 背景介紹

### 專案是什麼？

「2FA Manager」是一個部署在 **Cloudflare Workers** 上的兩步驗證金鑰管理工具。它可以：

- 儲存你各個網站的 2FA 金鑰
- 生成 TOTP 驗證碼
- 自動備份金鑰資料

### 想做什麼？

我們想給這個工具加一個「WebDAV 自動推送」功能：每次備份時，自動把備份檔案推送到使用者的 WebDAV 網盤（比如堅果雲），這樣即使 Cloudflare KV 資料丟失，使用者也有一份備份在自己的網盤裡。

### 使用者的配置

| 配置項        | 值                                        |
| ------------- | ----------------------------------------- |
| WebDAV 伺服器 | `https://dav.jianguoyun.com/dav` (堅果雲) |
| 使用者名稱    | `user@example.com`                        |
| 密碼          | 堅果雲的應用專用密碼                      |
| 備份路徑      | `/`                                       |

使用者確認賬號密碼沒有問題，在其他 WebDAV 客戶端中可以正常使用。

---

## 2. 問題現象

部署完成後，使用者在 `https://2fa.guts.eu.org/` 頁面開啟 WebDAV 設定，填入堅果雲的地址和憑據，點選「測試連線」按鈕，頁面提示：

> ❌ 伺服器返回 520

使用者反覆檢查了賬號密碼，確認無誤，但始終無法連線。

---

## 3. 排查過程

### 3.1 第一輪：以為是 HTTP 方法不支援

**假設：** WebDAV 使用的 `PROPFIND` 方法不被堅果雲支援，所以返回錯誤。

**做了什麼：** 在 `PROPFIND` 失敗後，加了回退邏輯，先試 `PROPFIND`，如果返回 405（方法不允許），就改用 `OPTIONS` 方法。

```
PROPFIND 失敗(405) → 回退到 OPTIONS
```

**結果：** 部署後依然報 520。因為 520 ≠ 405，回退邏輯沒被觸發。

**修正：** 把 520 也加入回退條件。

```
PROPFIND 失敗(405 或 520) → 回退到 OPTIONS
```

**結果：** 依然失敗。OPTIONS 方法也返回 520。

**反思：** 說明不是某個方法不被支援的問題——是所有方法都失敗了。

---

### 3.2 第二輪：以為是缺少 User-Agent

**假設：** Cloudflare Workers 的 `fetch()` 預設不傳送 `User-Agent` 請求頭，堅果雲伺服器可能會拒絕沒有 `User-Agent` 的請求。

**做了什麼：** 給所有 WebDAV 請求加上了 `User-Agent` 頭：

```javascript
const WEBDAV_USER_AGENT = '2FA-Manager/1.0 (Cloudflare Workers; WebDAV Client)';

// 每個 fetch 呼叫都加上：
headers: {
    Authorization: authHeader,
    'User-Agent': WEBDAV_USER_AGENT,
}
```

同時擴充套件了測試方法，改為依次嘗試三種方法：

```
PROPFIND → HEAD → GET
```

**結果：** 三種方法全部返回 520。

**反思：** 不是請求頭的問題。三種完全不同的 HTTP 方法都返回同樣的錯誤，說明問題在更底層。

---

### 3.3 第三輪：加除錯資訊，發現 Cloudflare

**做了什麼：** 在 `testWebDAVConnection` 函式中加入了除錯程式碼，捕獲每次請求的完整響應資訊（狀態碼、響應頭、響應體前 200 字元），一併返回給前端。

然後在瀏覽器控制台直接呼叫測試 API：

```javascript
const resp = await fetch('/api/webdav/test', {
	method: 'POST',
	credentials: 'include',
	headers: { 'Content-Type': 'application/json' },
	body: JSON.stringify({
		url: 'https://dav.jianguoyun.com/dav',
		username: 'user@example.com',
		password: 'YOUR_APP_PASSWORD',
		path: '/',
	}),
});
const data = await resp.json();
console.log(JSON.stringify(data, null, 2));
```

**看到的除錯資料：**

```json
{
	"success": false,
	"message": "連線失敗：所有測試方法均不可用，請檢查伺服器地址和網路",
	"debug": [
		{
			"method": "PROPFIND",
			"status": 520,
			"headers": {
				"server": "cloudflare",
				"cf-ray": "9d58d8a4a2c8dcfa-LAX"
			},
			"bodyPreview": "error code: 520"
		},
		{
			"method": "HEAD",
			"status": 520,
			"headers": {
				"server": "cloudflare",
				"cf-ray": "9d58d8a74387dcfa-LAX"
			},
			"bodyPreview": ""
		},
		{
			"method": "GET",
			"status": 520,
			"headers": {
				"server": "cloudflare",
				"cf-ray": "9d58d8aa1461dcfa-LAX"
			},
			"bodyPreview": "error code: 520"
		}
	]
}
```

**關鍵發現：**

響應頭中出現了兩個決定性的欄位：

- `"server": "cloudflare"` → 請求經過了 Cloudflare 的基礎設施
- `"cf-ray": "...-LAX"` → 請求經過了 Cloudflare 的洛杉磯（LAX）節點

**初步結論（後來被修正）：** 堅果雲使用了 Cloudflare CDN，CDN 看不懂 WebDAV 的 207 響應，所以返回 520。

但這個結論對嗎？我們決定用海外 VPS 進一步驗證。

---

### 3.4 第四輪：海外 VPS 驗證，修正根因

**為什麼要再驗證？** 第三輪得出的結論是「Cloudflare CDN 看不懂 WebDAV 響應」。但如果這是真的，那麼任何通過 Cloudflare CDN 訪問堅果雲的客戶端都應該失敗。我們用一臺洛杉磯的 VPS 來驗證。

**做了什麼：** 在美國洛杉磯的 VPS（RackNerd）上執行了三組測試。

**測試 1：國內直連 vs 海外訪問**

```bash
# 國內電腦
$ curl -sI https://dav.jianguoyun.com | head -3
HTTP/1.1 403 Forbidden
Server: nginx                    ← 國內直連堅果雲 nginx，不經過 CF

# 洛杉磯 VPS
$ curl -sI https://dav.jianguoyun.com | head -3
HTTP/2 403
server: nginx                    ← 等等... 海外也是 nginx？！
```

**意外發現：** 雖然 DNS 解析到了 Cloudflare IP，但 `server` 頭顯示的是 `nginx`，不是 `cloudflare`。Cloudflare 在這裡是作為負載均衡器（Load Balancer）透傳請求，沒有改寫響應頭。

**測試 2：帶認證的 WebDAV 請求**

```bash
# 洛杉磯 VPS - PROPFIND 請求
$ curl -sI -X PROPFIND \
    -H "Authorization: Basic $(echo -n 'user@example.com:YOUR_APP_PASSWORD' | base64)" \
    -H "Depth: 0" \
    https://dav.jianguoyun.com/dav/

HTTP/2 207                       ← ✅ WebDAV 正常返回 207！
server: nginx
content-type: text/xml; charset=UTF-8
```

**關鍵發現：** 從海外 VPS 通過 Cloudflare CDN 訪問堅果雲 WebDAV，**PROPFIND 返回 207 完全正常**！這直接推翻了「CDN 看不懂 WebDAV 響應」的假設。

**測試 3：DNS 解析鏈路**

```bash
$ nslookup dav.jianguoyun.com
dav.jianguoyun.com      → app.jianguoyun.com
                        → cloudflarelb.jianguoyun.com
                        → cloudflarelb.jianguoyun.com.cdn.cloudflare.net
                        → 172.65.209.49 (Cloudflare IP)
```

DNS CNAME 鏈中的 `cloudflarelb` 明確表明堅果雲使用 Cloudflare 作為**負載均衡器**（LB），不是傳統的 CDN 代理。

**對比結論：**

| 請求來源                    | 路徑                             | PROPFIND 結果 |
| --------------------------- | -------------------------------- | ------------- |
| 海外 VPS（curl）            | curl → Cloudflare LB → 堅果雲    | **207 成功**  |
| Cloudflare Workers（fetch） | Workers → Cloudflare LB → 堅果雲 | **520 失敗**  |

同樣經過 Cloudflare，curl 正常但 Workers 的 `fetch()` 失敗 → **問題出在 Workers fetch() 自身**。

---

## 4. 根因分析

### 正常情況下的網路路徑

當你在國內的電腦或手機上使用堅果雲 WebDAV 時：

```
你的裝置 (國內)
  → 堅果雲源伺服器 (國內 nginx)
  ✅ 直連，正常工作
```

當你從海外 VPS（如洛杉磯）使用堅果雲 WebDAV 時：

```
海外 VPS
  → Cloudflare 負載均衡 (堅果雲的 LB)
    → 堅果雲源伺服器
  ✅ 正常返回 207，WebDAV 工作正常
```

### 出問題的網路路徑

當 Cloudflare Workers 去連線堅果雲時：

```
你的瀏覽器
  → Cloudflare Workers (你的 2FA 應用)  ← 第一層 Cloudflare
    → Cloudflare LB (堅果雲的負載均衡)  ← 第二層 Cloudflare
      → 堅果雲源伺服器 (國內)
```

形成了 **Cloudflare → Cloudflare → 源站** 的「套娃」結構。

### 為什麼會失敗？

這是排查中最關鍵的發現：**Cloudflare CDN 本身能正確傳遞 WebDAV 的 207 響應**（海外 VPS 用 curl 通過同一條 DNS 鏈路訪問完全正常）。

520 的真正原因是 **Cloudflare Workers 的 `fetch()` 請求另一個 Cloudflare 代理的域名時，觸發了 Cloudflare 內部的路由衝突或迴環檢測機制**。

具體來說：

1. Cloudflare Workers 的 `fetch()` 發出請求，出口 IP 在海外（本次是 LAX 節點）
2. DNS 將 `dav.jianguoyun.com` 解析到 Cloudflare IP（`172.65.209.49`），因為堅果雲使用了 Cloudflare 負載均衡
3. 請求從 Cloudflare Workers 邊緣節點發往 Cloudflare 負載均衡節點——**兩者都是 Cloudflare 內部基礎設施**
4. Cloudflare 檢測到這是一個從自身邊緣網路發往自身邊緣網路的請求，觸發內部安全機制，返回 520

這類似於一個信件在郵局內部轉來轉去，最終因為「內部迴圈」被退回——信件本身沒問題，收件地址也沒問題，問題在於轉運方式。

### 一張圖理解

```
┌─────────────┐     ┌──────────────────┐     ┌──────────────────┐     ┌──────────────┐
│   你的瀏覽器  │──→ │ Cloudflare Workers │──→ │  Cloudflare LB    │──→ │  堅果雲源伺服器 │
│             │     │ (你的 2FA 應用)    │     │ (堅果雲的負載均衡) │     │   (國內)      │
└─────────────┘     └──────────────────┘     └──────────────────┘     └──────────────┘
                           │                        │                        │
                      發出 PROPFIND            Cloudflare 內部            正常返回 207
                      HEAD/GET 請求            路由衝突，返回 520          XML 目錄列表
                           │                        │                   （但根本到不了這裡）
                           │←─── HTTP 520 ──────────│
                           │
                      所有方法都失敗
```

### 對比實驗：為什麼海外 VPS 沒問題？

| 請求來源                   | 到 Cloudflare LB 的請求來源     | 結果                       |
| -------------------------- | ------------------------------- | -------------------------- |
| 國內電腦                   | 來自普通客戶端 IP               | ✅ server: nginx, 正常     |
| 海外 VPS (curl)            | 來自普通伺服器 IP               | ✅ server: nginx, 207 正常 |
| Cloudflare Workers (fetch) | 來自 Cloudflare 內部邊緣節點 IP | ❌ 520 錯誤                |

關鍵區別：Workers 的 `fetch()` 請求源 IP 屬於 Cloudflare 自身的 IP 段。當 Cloudflare 負載均衡收到來自 Cloudflare 自身 IP 的請求時，觸發了內部保護機制。

### 為什麼國內直連沒問題？

從國內網路訪問 `dav.jianguoyun.com` 時，DNS 解析到堅果雲的國內 nginx 伺服器 IP（不經過 Cloudflare），WebDAV 響應直接返回給客戶端，完全不涉及 Cloudflare。

---

## 5. 知識點詳解

### 5.1 什麼是 HTTP 520 錯誤？

**520 不是標準的 HTTP 狀態碼**，它是 Cloudflare 自定義的。標準 HTTP 狀態碼只定義到 511。

| 狀態碼  | 含義                   | 誰定義的              |
| ------- | ---------------------- | --------------------- |
| 200     | 成功                   | HTTP 標準             |
| 404     | 頁面未找到             | HTTP 標準             |
| 500     | 伺服器內部錯誤         | HTTP 標準             |
| **520** | **源站返回了未知響應** | **Cloudflare 自定義** |
| 521     | 源站拒絕連線           | Cloudflare 自定義     |
| 522     | 連線源站超時           | Cloudflare 自定義     |
| 523     | 源站不可達             | Cloudflare 自定義     |
| 524     | 源站響應超時           | Cloudflare 自定義     |

Cloudflare 官方對 520 的描述：

> Error 520 occurs when the origin server returns an **empty, unknown, or unexpected response** to Cloudflare.

翻譯：當源站返回了空的、未知的或意外的響應時，Cloudflare 就返回 520。

**官方文件地址：**
[https://developers.cloudflare.com/support/troubleshooting/cloudflare-errors/troubleshooting-cloudflare-5xx-errors/#error-520](https://developers.cloudflare.com/support/troubleshooting/cloudflare-errors/troubleshooting-cloudflare-5xx-errors/#error-520)

---

### 5.2 什麼是 Cloudflare CDN？

**CDN（Content Delivery Network）** 叫「內容分發網路」，你可以理解為在全球各地放了很多個「快取伺服器」。

打個比方：

- 沒有 CDN：你在福州，想吃北京烤鴨，要從北京快遞過來 → 很慢
- 有 CDN：北京烤鴨在福州設了分店（快取節點），就近供應 → 很快

**Cloudflare CDN** 就是最大的 CDN 服務商之一。很多網站（包括堅果雲）把自己的域名解析到 Cloudflare 的 IP 上，讓 Cloudflare 幫忙加速和防護。

當你訪問一個使用了 Cloudflare CDN 的網站時，實際的訪問路徑是：

```
你 → Cloudflare CDN 節點 → 源站伺服器
```

Cloudflare 在中間「代理」了請求和響應。大部分時候這能加速訪問，並且能正確傳遞各種 HTTP 響應（包括 WebDAV 的 207 響應）。但當請求來自 Cloudflare 自身的基礎設施（如 Workers）時，可能觸發內部路由衝突（比如我們遇到的 520）。

---

### 5.3 什麼是 Cloudflare Workers？

**Cloudflare Workers** 是 Cloudflare 提供的「無伺服器計算平臺」。你可以把 JavaScript 程式碼部署在 Cloudflare 的全球邊緣網路上執行，不需要自己買伺服器。

優點：

- 免費額度夠個人使用
- 全球部署，訪問速度快
- 不需要維護伺服器

限制：

- 程式碼執行在 Cloudflare 的環境中，有一些限制
- **`fetch()` 發出的請求出口 IP 在海外**（這就是我們遇到問題的原因之一）

---

### 5.4 什麼是 WebDAV？

**WebDAV（Web Distributed Authoring and Versioning）** 是 HTTP 協議的擴充套件，讓你可以通過網路像操作本地檔案一樣管理遠端檔案（上傳、下載、建立資料夾、列目錄等）。

它在標準 HTTP 方法（GET、POST、PUT、DELETE）基礎上增加了幾個專有方法：

| 方法          | 作用              | 說明          |
| ------------- | ----------------- | ------------- |
| `PROPFIND`    | 檢視檔案/目錄屬性 | 類似 `ls -la` |
| `MKCOL`       | 建立目錄          | 類似 `mkdir`  |
| `COPY`        | 複製檔案          | 類似 `cp`     |
| `MOVE`        | 移動/重新命名檔案 | 類似 `mv`     |
| `LOCK/UNLOCK` | 鎖定/解鎖檔案     | 防止併發修改  |

WebDAV 響應也有自己的格式，比如 `207 Multi-Status` 狀態碼配合 XML 響應體。經過實測驗證，**Cloudflare CDN/LB 能正確傳遞這些響應**（海外 VPS 通過 Cloudflare 訪問堅果雲 PROPFIND 返回 207 完全正常）。520 錯誤的原因並非 CDN 看不懂 WebDAV 響應，而是 Workers 內部的路由衝突機制。

堅果雲、NextCloud、Alist 等工具都支援 WebDAV 協議。

---

### 5.5 如何判斷一個網站是否在 Cloudflare 後面？

#### 方法一：瀏覽器 F12（最簡單）

1. 開啟瀏覽器，按 F12 開啟開發者工具
2. 切換到 Network（網路）面板
3. 重新整理頁面
4. 點選第一個請求，檢視 Response Headers（響應頭）
5. 找這兩個欄位：

```
server: cloudflare              ← 看到這個就確認了
cf-ray: 9d58d8a4a2c8dcfa-LAX    ← Cloudflare 請求 ID，LAX 是節點代號
```

#### 方法二：命令列 curl

```bash
curl -sI https://dav.jianguoyun.com | grep -i "server\|cf-ray"
```

如果輸出：

```
server: cloudflare
cf-ray: xxxxxxx-LAX
```

就說明在 Cloudflare 後面。

#### 方法三：查 DNS 解析

```bash
nslookup dav.jianguoyun.com
```

如果解析到的 IP 在以下範圍內，就屬於 Cloudflare：

- `104.16.x.x` ~ `104.31.x.x`
- `172.64.x.x` ~ `172.71.x.x`
- `103.21.244.x` ~ `103.22.201.x`

完整列表：[https://www.cloudflare.com/ips/](https://www.cloudflare.com/ips/)

#### 方法四：線上工具

- [BuiltWith](https://builtwith.com) — 輸入域名，看技術棧裡有沒有 Cloudflare
- [SecurityTrails](https://securitytrails.com) — 查域名的 DNS 歷史

---

## 6. 最終解決方案

### 程式碼修改

清理了所有除錯程式碼，在 `testWebDAVConnection` 函式中加入了 520 專用檢測：

```javascript
// 跟蹤是否所有請求都返回 520
let all520 = true;

for (const { method, headers } of methods) {
	// ... 傳送請求 ...

	if (response.status !== 520) {
		all520 = false;
	}

	// 520/405 繼續嘗試下一個方法
	if (response.status === 520 || response.status === 405) {
		continue;
	}
}

// 所有請求都返回 520：給使用者明確的提示
if (all520) {
	return {
		success: false,
		message:
			'該 WebDAV 伺服器使用了 Cloudflare CDN，' +
			'Cloudflare Workers 內部請求會觸發路由衝突（錯誤 520）。' +
			'請使用未經 Cloudflare 代理的 WebDAV 服務，如自建 NextCloud、Alist 等。',
	};
}
```

### 為什麼不能在程式碼層面修復？

這是 Cloudflare 平臺級的限制，不是程式碼 bug。根本原因是 Workers 的 `fetch()` 請求源 IP 屬於 Cloudflare 自身的 IP 段，當目標域名也在 Cloudflare 後面時，Cloudflare 內部的路由/迴環檢測機制會攔截請求返回 520。

Cloudflare 官方提供了幾個繞過方案，但大部分對第三方服務（如堅果雲）不適用：

| 官方方案                 | 適用場景               | 對堅果雲是否可行          |
| ------------------------ | ---------------------- | ------------------------- |
| Service Bindings         | 同賬戶下 Worker 互調   | ❌ 堅果雲不是你的 Worker  |
| `cf.resolveOverride`     | 自定義 DNS 解析繞過 CF | ❌ 僅 Enterprise 付費計劃 |
| 灰雲 DNS（關閉 CF 代理） | 你控制目標域名的 DNS   | ❌ 你無法控制堅果雲的 DNS |
| 不掛 Worker 路由的子域名 | 同 Zone 下分流         | ❌ 堅果雲不在你的 Zone    |

### 使用者可以怎麼辦？

#### 方案一：VPS 反向代理中轉（推薦，你已有 VPS）

利用你已有的洛杉磯 VPS 做中轉。已驗證 VPS 直連堅果雲 WebDAV 完全正常（PROPFIND 返回 207）。

**原理：**

```
之前（失敗）：Workers fetch() [CF IP] → Cloudflare LB → 堅果雲 → 520
現在（成功）：Workers fetch() → 你的 VPS [普通 IP] → 堅果雲 → 207 ✅
```

**VPS 上的 nginx 配置：**

```nginx
server {
    listen 443 ssl;
    server_name webdav-proxy.yourdomain.com;

    ssl_certificate     /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location /dav/ {
        proxy_pass https://dav.jianguoyun.com/dav/;
        proxy_set_header Host dav.jianguoyun.com;
        proxy_set_header Authorization $http_authorization;
        proxy_ssl_server_name on;
    }
}
```

然後 Worker 中把 WebDAV URL 從 `https://dav.jianguoyun.com/dav` 改為 `https://webdav-proxy.yourdomain.com/dav` 即可。

| 專案 | 說明                             |
| ---- | -------------------------------- |
| 難度 | ⭐⭐ 中等（需要有 VPS 和域名）   |
| 費用 | 低（你已有 VPS）                 |
| 優點 | 不改變使用者習慣，備份仍在堅果雲 |
| 缺點 | 多一跳延遲，VPS 掛了備份中斷     |

#### 方案二：改用 Cloudflare R2 儲存備份（最穩定）

放棄 WebDAV，用 Cloudflare R2（S3 相容的物件儲存）存備份。R2 和 Workers 同屬 Cloudflare 內部網路，通過 binding 直連，不走 HTTP，完全不存在路由衝突問題。

**wrangler.toml 配置：**

```toml
[[r2_buckets]]
binding = "BACKUP_BUCKET"
bucket_name = "2fa-backups"
```

**程式碼示例：**

```javascript
// 儲存備份
await env.BACKUP_BUCKET.put(backupKey, backupContent);

// 讀取備份
const object = await env.BACKUP_BUCKET.get(backupKey);
const content = await object.text();

// 列出所有備份
const list = await env.BACKUP_BUCKET.list({ prefix: 'backup_' });
```

| 專案 | 說明                                                           |
| ---- | -------------------------------------------------------------- |
| 難度 | ⭐⭐ 中等（需要改程式碼）                                      |
| 費用 | 免費（R2 免費額度：10GB 儲存 + 每月 1000 萬次讀 + 100 萬次寫） |
| 優點 | 零延遲、最穩定、無外部依賴、和 Workers 原生整合                |
| 缺點 | 使用者不能像網盤一樣直接瀏覽檔案；需要單獨做匯出功能           |

#### 方案三：換用不在 Cloudflare 後面的 WebDAV 服務

| 替代服務                   | 說明                                           |
| -------------------------- | ---------------------------------------------- |
| 自建 NextCloud             | 開源私有云，支援 WebDAV，部署在自己的 VPS 上   |
| Alist                      | 輕量儲存管理工具，支援 WebDAV，Docker 一鍵部署 |
| 群暉 NAS WebDAV            | 如果有群暉 NAS，自帶 WebDAV Server 套件        |
| InfiniCLOUD (teracloud.jp) | 日本免費 WebDAV 服務，不在 Cloudflare 後面     |

| 專案 | 說明                                     |
| ---- | ---------------------------------------- |
| 難度 | ⭐ 簡單（只需更換 WebDAV 地址）          |
| 費用 | 免費~低                                  |
| 優點 | 不需要改程式碼，現有 WebDAV 功能直接可用 |
| 缺點 | 需要使用者遷移，放棄堅果雲               |

### 方案對比總結

| 方案           | 難度 | 費用    | 是否需要改程式碼 | 備份位置         | 穩定性     |
| -------------- | ---- | ------- | ---------------- | ---------------- | ---------- |
| VPS 反代中轉   | ⭐⭐ | 低      | 不需要           | 堅果雲           | 依賴 VPS   |
| Cloudflare R2  | ⭐⭐ | 免費    | 需要             | R2 儲存桶        | 最高       |
| 換 WebDAV 服務 | ⭐   | 免費~低 | 不需要           | 新的 WebDAV 服務 | 取決於服務 |

---

## 7. 教訓與收穫

### 排查方法論

| 步驟        | 我們做了什麼                     | 教訓                                        |
| ----------- | -------------------------------- | ------------------------------------------- |
| 1. 先猜測   | 猜是 HTTP 方法不支援             | 猜測可以作為起點，但不能只靠猜              |
| 2. 加回退   | 加了 PROPFIND → OPTIONS 回退     | 修了一個可能的原因，但沒驗證根因            |
| 3. 繼續猜   | 猜是缺少 User-Agent              | 多種方法都失敗時，要懷疑更底層的原因        |
| 4. 加除錯   | 返回完整的響應頭和響應體         | **看資料說話**，發現了 Cloudflare 的介入    |
| 5. 初步結論 | 以為是 CDN 看不懂 WebDAV 響應    | 看起來合理，但未經驗證的結論可能是錯的      |
| 6. 交叉驗證 | 用海外 VPS curl 同一域名         | **推翻了初步結論**，發現 CDN 能正確傳遞 207 |
| 7. 修正根因 | 確認是 Workers → CF 內部路由衝突 | 多維度驗證才能得到正確結論                  |

### 核心教訓

1. **先看資料，再下結論。** 頭兩輪排查都是在猜測，浪費了時間。第三輪加了除錯資訊後，一眼就看到了 `server: cloudflare`。

2. **結論需要交叉驗證。** 看到 `server: cloudflare` 後，我們最初以為是「CDN 看不懂 WebDAV 響應」。但用海外 VPS 做對比實驗後發現，同樣經過 Cloudflare 的 curl 請求完全正常（207），直接推翻了這個假設。**如果沒有這一步驗證，我們會帶著錯誤的根因給使用者錯誤的建議。**

3. **當所有變種都失敗時，問題不在變種本身。** PROPFIND、HEAD、GET 全部返回 520，說明問題不在 HTTP 方法，而在更底層（網路路徑）。

4. **Cloudflare Workers 的 `fetch()` 有隱含限制。** 它的出口 IP 屬於 Cloudflare 自身的 IP 段，當目標域名也在 Cloudflare 後面時，會觸發內部路由衝突或迴環檢測，產生 520 錯誤。這是一個平臺級的限制，無法在應用層規避。

5. **「套娃」架構要警惕。** Cloudflare Workers（第一層 CF）→ Cloudflare LB（第二層 CF）→ 源站，兩層 Cloudflare 之間的內部路由衝突是問題根源，而非協議不相容。

---

## 8. 參考資料

- [Cloudflare 5XX 錯誤排查官方文件](https://developers.cloudflare.com/support/troubleshooting/cloudflare-errors/troubleshooting-cloudflare-5xx-errors/#error-520)
- [Cloudflare IP 地址列表](https://www.cloudflare.com/ips/)
- [Cloudflare Workers 文件](https://developers.cloudflare.com/workers/)
- [WebDAV 協議 (RFC 4918)](https://datatracker.ietf.org/doc/html/rfc4918)
- [堅果雲 WebDAV 文件](https://help.jianguoyun.com/?p=2064)
- [Cloudflare Community Forum](https://community.cloudflare.com) — 搜尋 "520 error" 可找到更多案例

---

_文件生成日期：2026-03-01（根因修正於同日）_
_問題發現到定位耗時：4 輪排查，4 次部署，1 次海外 VPS 交叉驗證_
