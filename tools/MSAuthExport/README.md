# Microsoft Authenticator 匯出工具

將 Microsoft Authenticator 的 PhoneFactor SQLite 資料庫轉換為通用的 otpauth:// URL 格式，以便匯入到 2FA Manager 或其他相容的 2FA 應用。

## 📋 功能特性

- ✅ 從 PhoneFactor SQLite 資料庫提取所有 2FA 賬戶
- ✅ 支援所有賬戶型別（account_type=0/1/2）
- ✅ 自動處理 Microsoft 個人賬戶（account_type=1）的 Base64 → Base32 金鑰轉換
- ✅ 支援企業賬戶（account_type=2）的 SHA256 演算法
- ✅ 自動清理金鑰中的空格、換行符等無效字元
- ✅ 匯出標準 otpauth:// URL 格式，相容所有主流 2FA 應用
- ✅ 自動合併 WAL 檔案到主資料庫
- ✅ Python 3.x 支援，使用現代 Python 語法

## 📦 前置要求

- Python 3.x（推薦 3.6 或更高版本）
- SQLite3（Python 內建）
- 已 Root 的 Android 裝置或模擬器（用於提取資料庫檔案）

## 📱 步驟 1：從 Microsoft Authenticator 匯出資料庫

### 方法：使用檔案管理器

**手機需要 Root 許可權，如果沒有可以使用 Android 模擬器登入賬號**

1. 使用支援 Root 的檔案管理器（如 Root Explorer、Solid Explorer）
2. 導航到 `/data/data/com.azure.authenticator/databases/`
3. 複製以下檔案到電腦：
   - `PhoneFactor`（主資料庫檔案，必需）
   - `PhoneFactor-wal`（WAL 日誌，如果存在請一起復制）
   - `PhoneFactor-shm`（共享記憶體索引，如果存在請一起復制）

**注意**：

- WAL 檔案包含最新的賬戶資料，務必一起復制
- 指令碼執行時會自動將 WAL 檔案合併到主資料庫，合併後 WAL 和 SHM 檔案會被自動刪除（這是正常行為）

## 🚀 步驟 2：執行匯出指令碼

### 檔案放置

將資料庫檔案放在以下固定位置：

```
tools/MSAuthExport/databases/PhoneFactor
```

如果有 WAL 和 SHM 檔案，也放在同一目錄：

```
tools/MSAuthExport/databases/
├── PhoneFactor          (主資料庫，必需)
├── PhoneFactor-wal      (WAL 日誌，如果存在)
└── PhoneFactor-shm      (共享記憶體，如果存在)
```

### 執行指令碼

```bash
# 或在指令碼目錄執行
cd tools/MSAuthExport
python MSAuthExportScript.py
```

### 執行結果示例

```
============================================================
Microsoft Authenticator 匯出工具
============================================================
輸出檔案: msauth-export-2025-12-14-164508.txt
============================================================

找到 50 個有效賬戶

  [ 1] AWS                        amazon@qq.com              (account_type=0)
  [ 2] GitHub                     test@gmail.com             (account_type=0)
  [ 3] Microsoft                  test@outlook.com           (account_type=1, Microsoft)
  [ 4] AzureAD                    user@company.com           (account_type=2, SHA256)
  ...

============================================================
成功匯出 50 個賬戶到檔案: msauth-export-2025-12-14-164508.txt
============================================================

下一步操作:
  1. 在 2FA Manager 中點選 "匯入" 按鈕
  2. 選擇或拖拽檔案: msauth-export-2025-12-14-164508.txt
  3. 應該成功匯入所有 50 個賬戶
```

## 📄 輸出格式說明

指令碼會生成一個帶時間戳的文本檔案 `msauth-export-<timestamp>.txt`，每行是一個標準的 otpauth:// URL：

```
otpauth://totp/GitHub:username?secret=JBSWY3DPEHPK3PXP&digits=6&period=30&algorithm=SHA1&issuer=GitHub
otpauth://totp/Microsoft:user%40outlook.com?secret=KQA5S3QN5PCKOJM4&digits=6&period=30&algorithm=SHA1&issuer=Microsoft
otpauth://totp/AzureAD:admin%40company.com?secret=ABCD1234EFGH5678&digits=6&period=30&algorithm=SHA256&issuer=AzureAD
```

### 欄位說明

- **secret**: 金鑰（已清理空格，轉為大寫）
- **digits**: 驗證碼位數（固定 6 位）
- **period**: 重新整理週期（固定 30 秒）
- **algorithm**: 雜湊演算法（SHA1 或 SHA256，根據賬戶型別自動選擇）
- **issuer**: 服務提供商名稱

## 📥 步驟 3：匯入到 2FA Manager

1. 訪問你的 2FA Manager 例項
2. 點選 **"匯入"** 按鈕
3. 選擇或拖拽生成的 `msauth-export-*.txt` 檔案
4. 系統會自動識別 otpauth:// URL 格式並預覽
5. 確認無誤後點擊 **"執行匯入"**

匯入後即可在 2FA Manager 中使用所有賬戶。

## 🔧 技術細節

### 賬戶型別處理

Microsoft Authenticator 使用 `account_type` 欄位區分賬戶型別，指令碼會自動識別並處理：

| account_type | 說明                                   | 處理方式             | 演算法 |
| ------------ | -------------------------------------- | -------------------- | ------ |
| 0            | 標準 TOTP 賬戶（如 Google、GitHub 等） | 直接使用 Base32 金鑰 | SHA1   |
| 1            | Microsoft 個人賬戶                     | Base64 → Base32 轉換 | SHA1   |
| 2            | 企業賬戶（如 Azure AD）                | 直接使用 Base32 金鑰 | SHA256 |

### Base64 → Base32 轉換

Microsoft 個人賬戶（account_type=1）的金鑰儲存為 Base64 編碼，指令碼會自動轉換為標準的 Base32 格式：

- **輸入（Base64）**: `VAHZbg3rxKclnA==`
- **輸出（Base32）**: `KQA5S3QN5PCKOJM4`

轉換過程完全自動化，無需手動操作。

### 金鑰清理

指令碼會自動清理所有金鑰中的：

- 空格 (` `)
- 製表符 (`\t`)
- 換行符 (`\n`, `\r`)

並統一轉換為大寫字母，確保符合標準格式。

### WAL 檔案自動合併

SQLite 的 WAL（Write-Ahead Logging）模式會將最新的資料寫入單獨的 `-wal` 檔案。當指令碼開啟資料庫時：

1. SQLite 自動檢測 WAL 檔案
2. 將 WAL 中的更改合併到主資料庫（checkpoint 操作）
3. 合併完成後自動刪除 WAL 和 SHM 檔案

**這是 SQLite 的正常行為**，不用擔心：

- ✅ 所有資料已安全合併到主資料庫
- ✅ 資料庫處於一致狀態
- ✅ 不會有資料丟失

## ⚠️ 注意事項

### 安全警告

- ⚠️ **資料庫檔案包含所有 2FA 金鑰的明文，務必妥善保管**
- ⚠️ **匯出的文本檔案包含可直接使用的金鑰，使用後請立即刪除**
- ⚠️ **不要將資料庫檔案或匯出檔案上傳到公共平臺或雲端儲存**
- ⚠️ **建議在操作完成後，從電腦中徹底刪除資料庫檔案和匯出檔案**

### Root 許可權要求

- 提取資料庫檔案**必須**需要 Root 許可權
- Android 系統保護應用資料目錄 `/data/data/`，普通使用者無法訪問
- 如果裝置未 Root，可以使用 Android 模擬器（如 BlueStacks、Memu）登入 Microsoft Authenticator

### 相容性

**指令碼相容性**：

- Python 3.6 或更高版本
- Windows、Linux、macOS

**匯出格式相容性**：

- Google Authenticator
- Authy
- Aegis Authenticator
- 2FAS Auth
- 1Password
- Bitwarden
- 等所有支援標準 TOTP 的應用

## 🛠️ 故障排除

### 問題 1：未找到資料庫檔案

**錯誤資訊**：

```
錯誤: 未找到 PhoneFactor 資料庫檔案
```

**解決方案**：

1. 確認檔案路徑正確：`tools/MSAuthExport/databases/PhoneFactor`
2. 檢查檔案是否從手機正確複製
3. 確認檔名拼寫正確（區分大小寫）

### 問題 2：未找到任何有效賬戶

**可能原因**：

- 資料庫為空（Microsoft Authenticator 中沒有賬戶）
- 資料庫檔案損壞
- 複製檔案時出錯

**解決方案**：

1. 在手機上開啟 Microsoft Authenticator，確認賬戶存在
2. 重新從手機複製資料庫檔案（包括 WAL 檔案）
3. 如果使用模擬器，確保賬戶已同步

### 問題 3：WAL 和 SHM 檔案被刪除了

這是**正常現象**，不是錯誤：

- SQLite 在開啟資料庫時會自動合併 WAL 檔案
- 合併後的資料已完整儲存在主資料庫檔案中
- 刪除 WAL/SHM 是 SQLite 的標準行為

**不需要任何操作**，資料已安全儲存。

### 問題 4：Microsoft 賬戶轉換失敗

**錯誤資訊**：

```
[XX] 轉換失敗，跳過: Microsoft user@outlook.com
```

**解決方案**：

1. 這可能是因為金鑰格式不符合 Base64 標準
2. 檢查匯出檔案，確認其他賬戶是否正常匯出
3. 如果問題持續，請提 Issue 並附上錯誤資訊

### 問題 5：匯入後驗證碼不正確

**可能原因**：

- 裝置時間不同步
- 金鑰格式錯誤

**解決方案**：

1. 確保所有裝置時間與標準時間同步（誤差應小於 30 秒）
2. 檢查匯出檔案中的金鑰格式
3. 嘗試重新匯出和匯入

## 📝 更新日誌

**版本 2.0.0** (2025-12-14)

- ✅ 新增對所有賬戶型別的支援（account_type=0/1/2）
- ✅ 實現 Base64 → Base32 自動轉換
- ✅ 支援 SHA256 演算法（企業賬戶）
- ✅ 簡化資料庫路徑為單一固定位置
- ✅ 新增 WAL 檔案自動合併說明
- ✅ 改進錯誤提示和文件

**版本 1.0.0** (2025-12-13)

- 初始版本
- 基本的 otpauth:// URL 匯出功能

## 📄 許可證

本工具是 2FA Manager 專案的一部分，遵循相同的開源許可證。

---

**最後更新**: 2025-12-14
**指令碼版本**: 2.0.0
**作者**: 2FA Manager Team
