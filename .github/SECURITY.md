# Security Policy / 安全政策

## Supported Versions / 支援的版本

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |

## Reporting a Vulnerability / 報告漏洞

### English

We take the security of 2FA Manager seriously. If you discover a security vulnerability, please report it responsibly.

**How to Report:**

1. **Do NOT** open a public GitHub issue for security vulnerabilities
2. Create a private security advisory at: [GitHub Security Advisory](../../security/advisories/new)
3. Or email security concerns to the maintainer (see profile)

**Please include:**

- Description of the vulnerability
- Steps to reproduce
- Potential impact assessment
- Suggested fix (if any)

**What to Expect:**

- **Acknowledgment**: Within 48 hours
- **Initial Assessment**: Within 7 days
- **Resolution Timeline**: Depends on severity
  - Critical: 24-72 hours
  - High: 7 days
  - Medium: 30 days
  - Low: 90 days

### 中文

我們非常重視 2FA Manager 的安全性。如果您發現安全漏洞，請負責任地報告。

**如何報告：**

1. **不要** 在公開的 GitHub issue 中報告安全漏洞
2. 在此建立私密安全公告: [GitHub Security Advisory](../../security/advisories/new)
3. 或傳送郵件給維護者（見個人資料）

**請包含：**

- 漏洞描述
- 復現步驟
- 潛在影響評估
- 建議的修復方案（如有）

**預期響應時間：**

- **確認收到**: 48 小時內
- **初步評估**: 7 天內
- **解決時間線**: 取決於嚴重程度
  - 嚴重: 24-72 小時
  - 高危: 7 天
  - 中等: 30 天
  - 低危: 90 天

---

## Security Best Practices for Users / 使用者安全最佳實踐

### English

1. **Encryption Key**: Always set `ENCRYPTION_KEY` in production environments
2. **Strong Password**: Use a strong password (12+ characters, mixed case, numbers, symbols)
3. **HTTPS Only**: Always access via HTTPS (enforced by Cloudflare)
4. **Regular Backups**: Enable automatic backups and test restoration periodically
5. **Access Control**: Limit who has access to the Cloudflare Worker and KV namespace
6. **Monitor Access**: Check Cloudflare analytics for unusual access patterns
7. **Update Regularly**: Keep dependencies updated by running `npm audit` periodically

### 中文

1. **加密金鑰**: 生產環境必須設定 `ENCRYPTION_KEY`
2. **強密碼**: 使用強密碼（12+ 字元，混合大小寫、數字、符號）
3. **僅 HTTPS**: 始終通過 HTTPS 訪問（由 Cloudflare 強制）
4. **定期備份**: 啟用自動備份並定期測試恢復
5. **訪問控制**: 限制對 Cloudflare Worker 和 KV 名稱空間的訪問
6. **監控訪問**: 檢查 Cloudflare 分析以發現異常訪問模式
7. **定期更新**: 定期執行 `npm audit` 保持依賴更新

---

## Security Features / 安全特性

| Feature              | Description                                                    |
| -------------------- | -------------------------------------------------------------- |
| **AES-GCM 256-bit**  | All secrets encrypted at rest with authenticated encryption    |
| **PBKDF2**           | Password hashing with 100,000 iterations and SHA-256           |
| **HttpOnly Cookies** | JWT tokens stored in HttpOnly, Secure, SameSite=Strict cookies |
| **Rate Limiting**    | Protection against brute force attacks on all endpoints        |
| **CSP Headers**      | Content Security Policy headers to prevent XSS                 |
| **Input Validation** | Comprehensive input validation and sanitization                |

---

## Acknowledgments / 致謝

We thank the security researchers who have helped improve this project.

| Researcher | Vulnerability | Date |
| ---------- | ------------- | ---- |
| -          | -             | -    |

---

## Security Audit History / 安全審計歷史

| Date | Auditor    | Scope         | Result  |
| ---- | ---------- | ------------- | ------- |
| -    | Self-audit | Full codebase | Ongoing |
