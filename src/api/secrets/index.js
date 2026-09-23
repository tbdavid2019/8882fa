/**
 * API 處理器入口檔案（Barrel Export）
 *
 * 重新匯出所有 API 處理器，保持向後相容性
 * 允許外部程式碼繼續使用 `import { handleGetSecrets } from './api/secrets'`
 *
 * 模組組織:
 * - shared.js: 共享工具函式（saveSecretsToKV, getAllSecrets）
 * - crud.js: CRUD 操作（GET, POST, PUT, DELETE）
 * - batch.js: 批次匯入（POST batch）
 * - backup.js: 備份建立和列表（POST, GET backup）
 * - restore.js: 備份恢復和匯出（POST restore, GET export）
 * - otp.js: OTP 生成（GET otp）
 */

// CRUD 操作處理器
export { handleGetSecrets, handleAddSecret, handleUpdateSecret, handleDeleteSecret } from './crud.js';

// HOTP 計數器處理器
export { handleAdvanceHOTPCounter } from './counter.js';
export { handleCompactHOTPCounters } from './counter.js';

// 批次匯入處理器
export { handleBatchAddSecrets } from './batch.js';

// 備份處理器
export { handleBackupSecrets, handleGetBackups } from './backup.js';

// 恢復和匯出處理器
export { handleExportBackup, handleRestoreBackup } from './restore.js';
export { handleExportSecrets } from './export.js';

// OTP 生成處理器
export { handleGenerateOTP } from './otp.js';

// 共享工具函式（內部使用或測試）
export { saveSecretsToKV, getAllSecrets, getSecretByIdWithHOTPState } from './shared.js';
