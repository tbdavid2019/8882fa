/**
 * Tools Module - Index
 * 工具模組整合索引
 *
 * 將所有獨立工具模組整合到一起
 */

import { getQRDecodeToolCode } from './tools/qrDecode.js';
import { getQRGenerateToolCode } from './tools/qrGenerate.js';
import { getBase32ToolCode } from './tools/base32Tool.js';
import { getTimestampToolCode } from './tools/timestampTool.js';
import { getKeyCheckerToolCode } from './tools/keyChecker.js';
import { getKeyGeneratorToolCode } from './tools/keyGenerator.js';
import { getWebdavToolCode } from './tools/webdavTool.js';
import { getS3ToolCode } from './tools/s3Tool.js';
import { getOneDriveToolCode } from './tools/onedriveTool.js';
import { getGoogleDriveToolCode } from './tools/gdriveTool.js';

/**
 * Get complete Tools code by integrating all tool modules
 * @returns {string} Complete Tools JavaScript code
 */
export function getToolsCode() {
	return `    // ========== 實用工具模組集合 ==========
    // 包含6個獨立工具：二維碼解析、二維碼生成、Base32編解碼、時間戳、金鑰檢查器、金鑰生成器

    // 入口函式
    function showQRScanAndDecode() {
      // 預載入 jsQR（解析二維碼圖片需要）
      if (typeof ensureJsQR === 'function') ensureJsQR().catch(() => {});
      hideToolsModal();
      showQRDecodeModal();
    }

    function showQRGenerateTool() {
      // 預載入 qrcode-generator（生成二維碼需要）
      if (typeof ensureQRCodeGen === 'function') ensureQRCodeGen().catch(() => {});
      hideToolsModal();
      showQRGenerateModal();
    }

    function showBase32Tool() {
      hideToolsModal();
      showBase32Modal();
    }

    function showTimestampTool() {
      hideToolsModal();
      showTimestampModal();
    }

    function showKeyCheckTool() {
      hideToolsModal();
      showKeyCheckModal();
    }

    function showKeyGeneratorTool() {
      hideToolsModal();
      showKeyGeneratorModal();
    }

    function showWebdavTool() {
      hideToolsModal();
      showWebdavModal();
    }

    function showS3Tool() {
      hideToolsModal();
      showS3Modal();
    }

    function showOneDriveTool() {
      hideToolsModal();
      showOneDriveModal();
    }

    function showGoogleDriveTool() {
      hideToolsModal();
      showGoogleDriveModal();
    }

${getQRDecodeToolCode()}

${getQRGenerateToolCode()}

${getBase32ToolCode()}

${getTimestampToolCode()}

${getKeyCheckerToolCode()}

${getKeyGeneratorToolCode()}

${getWebdavToolCode()}

${getS3ToolCode()}

${getOneDriveToolCode()}

${getGoogleDriveToolCode()}
`;
}
