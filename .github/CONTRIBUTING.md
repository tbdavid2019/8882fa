# 貢獻指南

感謝你對 2FA Manager 專案的關注！我們歡迎任何形式的貢獻。

## 如何貢獻

### 報告 Bug

如果你發現了 Bug，請：

1. 檢查 [Issues](https://github.com/tbdavid2019/8882fa/issues) 中是否已有類似問題
2. 如果沒有，建立新的 Issue，使用 "Bug 報告" 模板
3. 提供詳細的復現步驟、環境資訊和截圖

### 提出功能建議

如果你有新功能的想法：

1. 檢視現有的 [Feature Requests](https://github.com/tbdavid2019/8882fa/labels/enhancement)
2. 建立新的 Issue，使用 "功能請求" 模板
3. 清楚描述功能的用途和預期收益

## 提交程式碼

### 基本流程

1. **Fork** 倉庫並克隆到本地

   ```bash
   git clone https://github.com/YOUR_USERNAME/2fa.git
   cd 2fa
   npm install
   ```

2. **建立分支**

   ```bash
   git checkout -b feature/your-feature-name
   # 或
   git checkout -b fix/your-bug-fix
   ```

3. **開發和測試** — 完成程式碼修改並確保測試通過

4. **提交程式碼**

   ```bash
   git add .
   git commit -m "feat: 新增新功能"
   ```

5. **推送並建立 PR**
   ```bash
   git push origin feature/your-feature-name
   ```
   在 GitHub 上建立 Pull Request，填寫 PR 模板，等待程式碼稽核。

> 詳細的開發環境配置、程式碼規範和測試指南請參考 [開發文件](../docs/DEVELOPMENT.md)。
> 部署相關資訊請參考 [部署文件](../docs/DEPLOYMENT.md)。
> 專案架構詳情請參考 [架構文件](../docs/ARCHITECTURE.md)。

## 提交資訊格式

使用 [Conventional Commits](https://www.conventionalcommits.org/) 規範：

- `feat:` 新功能
- `fix:` Bug 修復
- `docs:` 文件更新
- `style:` 程式碼格式調整
- `refactor:` 程式碼重構
- `test:` 測試相關
- `chore:` 構建/配置相關

## 程式碼稽核

### 稽核標準

- 程式碼功能正確
- 有適當的測試覆蓋
- 程式碼風格一致
- 有必要的註釋和文件
- 沒有引入新的安全問題
- 效能沒有明顯下降

### 稽核流程

1. 提交 PR 後，專案維護者會稽核程式碼
2. 如有修改建議，請及時響應
3. 稽核通過後會合併到主分支

## 安全

### 報告安全問題

如果發現安全漏洞，請：

1. **不要**公開披露
2. 通過 [GitHub Security Advisories](https://github.com/tbdavid2019/8882fa/security/advisories/new) 私密報告
3. 或傳送郵件到專案維護者

### 安全最佳實踐

- 永遠不要提交敏感資訊（密碼、API Key、金鑰等）
- 使用 `.gitignore` 忽略敏感檔案
- 加密敏感資料
- 定期更新依賴

## 行為準則

- 尊重所有貢獻者
- 建設性的反饋
- 保持專業和友好
- 歡迎新手提問

## 許可證

貢獻的程式碼將遵循專案的 [MIT License](../LICENSE)。

---

再次感謝你的貢獻！如有任何疑問，請檢視 [專案文件](../README.md) 或在 [Discussions](https://github.com/tbdavid2019/8882fa/discussions) 中提問。
