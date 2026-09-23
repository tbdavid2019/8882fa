# Test Fixtures

測試用的匯入/匯出樣本檔案。

## 目錄結構

- `imports/` — 第三方 2FA 應用的匯出檔案，用於測試匯入解析功能
- `exports/` — 本專案匯出的檔案，用於驗證匯出格式正確性

## imports/ 檔案清單

| 檔名                          | 來源應用                | 格式        | 備註             |
| ----------------------------- | ----------------------- | ----------- | ---------------- |
| `2fas-backup.2fas`            | 2FAS                    | JSON (zip)  |                  |
| `aegis-export-plain.json`     | Aegis                   | JSON        | 明文匯出         |
| `aegis-export.html`           | Aegis                   | HTML        |                  |
| `aegis-export-uri.txt`        | Aegis                   | otpauth URI |                  |
| `andotp-accounts.json`        | andOTP                  | JSON        |                  |
| `authpro-backup.authpro`      | Authenticator Pro       | 自有格式    |                  |
| `authpro-backup.html`         | Authenticator Pro       | HTML        |                  |
| `authpro-backup.txt`          | Authenticator Pro       | 文本        |                  |
| `bitwarden-auth.json`         | Bitwarden Authenticator | JSON        |                  |
| `bitwarden-auth.csv`          | Bitwarden Authenticator | CSV         |                  |
| `ente-auth-encrypted.txt`     | ente Auth               | 文本        | 加密，密碼見下方 |
| `ente-auth-html.txt`          | ente Auth               | HTML 文本   |                  |
| `ente-auth-plain.txt`         | ente Auth               | 文本        | 明文             |
| `freeotp-backup.xml`          | FreeOTP                 | XML         |                  |
| `freeotp-plus-backup.json`    | FreeOTP+                | JSON        |                  |
| `freeotp-plus-backup.txt`     | FreeOTP+                | 文本        |                  |
| `lastpass-auth.json`          | LastPass Authenticator  | JSON        |                  |
| `proton-auth-backup.json`     | Proton Authenticator    | JSON        |                  |
| `totp-auth-encrypted.encrypt` | TOTP Authenticator      | 自有格式    | 加密，密碼見下方 |
| `winauth-backup.txt`          | WinAuth                 | 文本        |                  |

## exports/ 檔案清單

本專案匯出的各種格式，檔名遵循 `2fa-secrets-{format}.{ext}` 規範。

## 加密檔案測試密碼

| 檔案                                             | 密碼       |
| ------------------------------------------------ | ---------- |
| `imports/ente-auth-encrypted.txt`                | `666666`   |
| `imports/totp-auth-encrypted.encrypt`            | `666666Aa` |
| `exports/2fa-secrets-freeotp-encrypted.xml`      | `666666`   |
| `exports/2fa-secrets-totpauth-encrypted.encrypt` | `666666Aa` |
