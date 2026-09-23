# 專案維護指示

## 版號與變更紀錄

- 每次準備提交或發布產品程式碼時，都使用日曆日期作為產品版號。
- `package.json` 使用 npm 相容格式 `YYYY.M.D`；頁尾、README 徽章、變更紀錄標題及 Git 標籤顯示為 `vYYYY.MM.DD`。
- 同一變更集必須更新 `CHANGELOG.md` 對應日期的專案。
- `package-lock.json` 與 `src/utils/version.js` 必須和 `package.json` 使用相同日期版號。
- 部署前確認頁尾、README 徽章、變更紀錄標題及 Git 標籤顯示相同日期。

## 中文註解與檔案

- 程式碼註解、開發工具訊息及中文維護檔案使用臺灣繁體中文。
- `src/ui/locales/zh-CN.js` 的介面翻譯維持簡體中文，對應簡體中文語系。
