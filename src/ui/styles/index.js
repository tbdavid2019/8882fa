/**
 * 樣式模組整合
 * 將所有樣式模組組合成完整的 <style> 標籤
 */

import { getVariables } from './variables.js';
import { getBaseStyles } from './base.js';
import { getComponentStyles } from './components.js';
import { getModalStyles } from './modals.js';
import { getResponsiveStyles } from './responsive.js';
import { getDialogStyles } from './dialogs.js';
import { getWorkspaceStyles } from './workspace.js';

/**
 * 獲取完整的樣式內容
 * @returns {string} 完整的 <style>...</style> 標籤
 */
export function getStyles() {
	return `
  <style>
${getVariables()}
${getBaseStyles()}${getComponentStyles()}${getModalStyles()}${getResponsiveStyles()}${getWorkspaceStyles()}${getDialogStyles()}  </style>
</head>`;
}
