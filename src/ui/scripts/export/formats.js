/**
 * 匯出模組 - 標準格式
 * 包含 OTPAuth、JSON、CSV、HTML 等標準格式匯出
 */

import { getStandaloneHead } from '../../standalone.js';
import { getBackupDocumentStyles } from '../../styles/backupDocument.js';

/**
 * 獲取標準格式匯出程式碼
 * @returns {string} JavaScript 程式碼
 */
export function getStandardFormatsCode() {
	return `
    // ========== 標準格式匯出 ==========

    // 通用匯出函式
    async function exportSecretsAsFormat(secretsData, format, options = {}) {
      const opts = {
        filenamePrefix: options.filenamePrefix || '2FA-secrets',
        source: options.source || 'export',
        metadata: options.metadata || {}
      };

      switch(format) {
        case 'txt':
          await exportStandardFormatViaApi(secretsData, format, opts);
          break;
        case 'json':
          await exportStandardFormatViaApi(secretsData, format, opts);
          break;
        case 'csv':
          await exportStandardFormatViaApi(secretsData, format, opts);
          break;
        case 'html':
          await exportStandardFormatViaApi(secretsData, format, opts);
          break;
        case 'google':
          showExportToGoogleModal();
          break;
        case 'aegis':
          exportAsAegis(secretsData, opts);
          break;
        case 'andotp':
          exportAsAndOTP(secretsData, opts);
          break;
        case 'freeotp-plus':
          exportAsFreeOTPPlusJSON(secretsData, opts);
          break;
        case 'freeotp':
          showFreeOTPExportModal();
          break;
        case 'totp-auth':
          showTOTPAuthExportModal();
          break;
        case 'lastpass':
          exportAsLastPass(secretsData, opts);
          break;
        case 'proton':
          exportAsProtonAuthenticator(secretsData, opts);
          break;
        case 'authpro':
          exportAsAuthenticatorPro(secretsData, opts);
          break;
        case 'bitwarden-auth-csv':
          exportAsBitwardenAuthenticatorCSV(secretsData, opts);
          break;
        case 'bitwarden-auth-json':
          exportAsBitwardenAuthenticatorJSON(secretsData, opts);
          break;
        case 'ente-auth':
        case 'winauth':
        case 'aegis-txt':
        case 'authenticator-txt':
        case 'freeotp-txt':
          await exportAsOTPAuth(secretsData, { formatName: format });
          break;
        default:
          showCenterToast('❌', ((typeof t === 'function' ? t('unsupportedExportFormat') : null) || 'Unsupported export format'));
      }
    }

    // 匯出為 OTPAuth 文本格式
    async function exportStandardFormatLocally(sortedSecrets, format, options = {}) {
      switch (format) {
        case 'txt':
          await exportAsOTPAuth(sortedSecrets, {
            ...options,
            formatName: 'otpauth'
          });
          return;
        case 'json':
          await exportAsJSON(sortedSecrets, options);
          return;
        case 'csv':
          await exportAsCSV(sortedSecrets, options);
          return;
        case 'html':
          await exportAsHTML(sortedSecrets, options);
          return;
        default:
          throw new Error('Unsupported export format');
      }
    }

    function shouldFallbackToLocalStandardExport(responseStatus, errorData) {
      return responseStatus === 413 || Boolean(errorData && errorData.offline === true);
    }

    async function exportStandardFormatViaApi(sortedSecrets, format, options = {}) {
      const fallbackToLocalExport = async (reasonMessage) => {
        console.warn('Export API unavailable, falling back to local export:', reasonMessage);
        showCenterToast('⚠️', reasonMessage);
        await exportStandardFormatLocally(sortedSecrets, format, options);
      };

      try {
        showCenterToast('INFO', 'Preparing export file...');

        const response = await authenticatedFetch('/api/secrets/export', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            format: format,
            filenamePrefix: options.filenamePrefix || '2FA-secrets',
            metadata: options.metadata || {},
            secrets: sortedSecrets
          })
        });

        if (response.status === 202) {
          let errorMessage = 'Export requires an online connection';
          try {
            const queuedData = await response.clone().json();
            if (queuedData && queuedData.offline) {
              errorMessage = queuedData.message || queuedData.detail || errorMessage;
            }
          } catch {
            // ignore non-JSON queued responses
          }
          throw new Error(errorMessage);
        }

        if (response.status !== 200) {
          let errorMessage = 'Export failed';
          let errorData = null;
          try {
            errorData = await response.json();
            errorMessage = errorData.message || errorData.error || errorMessage;
          } catch {
            // ignore non-JSON error responses
          }

          if (shouldFallbackToLocalStandardExport(response.status, errorData)) {
            const fallbackMessage = response.status === 413
              ? ((typeof t === 'function' ? t('exportFallbackLarge') : null) || 'Export payload is large, falling back to local compatible export')
              : ((typeof t === 'function' ? t('exportFallbackOffline') : null) || 'Currently offline, falling back to local compatible export');
            await fallbackToLocalExport(fallbackMessage);
            return;
          }

          throw new Error(errorMessage);
        }

        const contentDisposition = response.headers.get('Content-Disposition');
        if (!contentDisposition) {
          throw new Error('Export failed: server did not return a downloadable file');
        }

        let filename = (options.filenamePrefix || '2FA-secrets') + '-' + format + '-' + getDateString();
        if (contentDisposition) {
          const filenameMatch = contentDisposition.match(/filename="(.+)"/);
          if (filenameMatch) {
            filename = filenameMatch[1];
          }
        }

        const blob = await response.blob();
        const saved = await downloadFile(blob, filename, blob.type || response.headers.get('Content-Type') || 'application/octet-stream');
        if (saved) {
          const formatNames = {
            txt: 'OTPAuth TXT',
            json: 'JSON',
            csv: 'CSV',
            html: 'HTML'
          };
          showExportSuccess(sortedSecrets.length, formatNames[format] || format.toUpperCase());
        }
      } catch (error) {
        const errorMessage = error && error.message ? error.message : 'Export failed';
        const isNetworkFailure = error && (error.name === 'TypeError' || /Failed to fetch|NetworkError/i.test(errorMessage));

        if (isNetworkFailure) {
          await fallbackToLocalExport((typeof t === 'function' ? t('exportFallbackNetwork') : null) || 'Unable to connect to online export service, falling back to local compatible export');
          return;
        }

        console.error('Export failed:', error);
        showCenterToast('ERR', 'Export failed: ' + errorMessage);
      }
    }

    function buildLocalOTPAuthUrl(secret) {
      const serviceName = String(secret.name || 'Unknown').trim() || 'Unknown';
      const accountName = secret.account ? String(secret.account).trim() : '';
      const type = String(secret.type || 'TOTP').toUpperCase() === 'HOTP' ? 'HOTP' : 'TOTP';
      const label = accountName
        ? encodeURIComponent(serviceName) + ':' + encodeURIComponent(accountName)
        : encodeURIComponent(serviceName);
      const params = new URLSearchParams({
        secret: String(secret.secret || '').replace(/[\\s\\-+]/g, '').toUpperCase(),
        digits: String(secret.digits || 6),
        algorithm: String(secret.algorithm || 'SHA1').toUpperCase()
      });

      if (serviceName) {
        params.set('issuer', serviceName);
      }

      if (type === 'HOTP') {
        params.set('counter', String(secret.counter || 0));
        return 'otpauth://hotp/' + label + '?' + params.toString();
      }

      params.set('period', String(secret.period || 30));
      return 'otpauth://totp/' + label + '?' + params.toString();
    }

    async function exportAsOTPAuth(sortedSecrets, options = {}) {
      const filenamePrefix = options.filenamePrefix || '2FA-secrets';
      const formatName = options.formatName || 'otpauth';
      const otpauthUrls = sortedSecrets.map(secret => buildLocalOTPAuthUrl(secret));

      const content = otpauthUrls.join('\\n');
      const saved = await downloadFile(content, filenamePrefix + '-' + formatName + '-' + getDateString() + '.txt', 'text/plain;charset=utf-8');
      if (saved) {
        showExportSuccess(sortedSecrets.length, (typeof t === 'function' ? t('exportFormatOtpauthText') : null) || 'OTPAuth text');
      }
    }

    // 匯出為 JSON 格式
    async function exportAsJSON(sortedSecrets, options = {}) {
      const filenamePrefix = options.filenamePrefix || '2FA-secrets';
      const exportData = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        count: sortedSecrets.length,
        secrets: sortedSecrets.map(secret => {
          const type = secret.type || 'TOTP';
          const entry = {
            issuer: secret.name,
            account: secret.account || '',
            secret: secret.secret.toUpperCase(),
            type: type,
            digits: secret.digits || 6,
            period: secret.period || 30,
            algorithm: secret.algorithm || 'SHA1'
          };
          if (type.toUpperCase() === 'HOTP') {
            entry.counter = secret.counter || 0;
          }
          return entry;
        })
      };

      if (options.metadata) {
        exportData.metadata = options.metadata;
      }

      const content = JSON.stringify(exportData, null, 2);
      const saved = await downloadFile(content, filenamePrefix + '-data-' + getDateString() + '.json', 'application/json;charset=utf-8');
      if (saved) {
        showExportSuccess(sortedSecrets.length, (typeof t === 'function' ? t('exportFormatJsonData') : null) || 'JSON data');
      }
    }

    // 匯出為 CSV 格式
    async function exportAsCSV(sortedSecrets, options = {}) {
      const filenamePrefix = options.filenamePrefix || '2FA-secrets';
      const _t = typeof t === 'function' ? t : (k) => null;
      const headers = [
        _t('serviceName') || 'Service',
        _t('accountInfo') || 'Account',
        _t('keySecret') || 'Secret',
        _t('keyType') || 'Type',
        _t('keyDigits') || 'Digits',
        _t('keyPeriod') || 'Period (s)',
        _t('keyAlgorithm') || 'Algorithm',
        _t('counterLabel') || 'Counter'
      ];
      const csvRows = [headers.join(',')];

      sortedSecrets.forEach(secret => {
        const type = (secret.type || 'TOTP').toUpperCase();
        const row = [
          escapeCSV(secret.name),
          escapeCSV(secret.account || ''),
          escapeCSV(secret.secret.toUpperCase()),
          escapeCSV(secret.type || 'TOTP'),
          secret.digits || 6,
          secret.period || 30,
          escapeCSV(secret.algorithm || 'SHA1'),
          type === 'HOTP' ? (secret.counter || 0) : ''
        ];
        csvRows.push(row.join(','));
      });

      const content = csvRows.join('\\n');
      const bom = '\\uFEFF';
      const saved = await downloadFile(bom + content, filenamePrefix + '-table-' + getDateString() + '.csv', 'text/csv;charset=utf-8');
      if (saved) {
        showExportSuccess(sortedSecrets.length, (typeof t === 'function' ? t('exportFormatCsvTable') : null) || 'CSV table');
      }
    }

    async function exportAsHTML(sortedSecrets, options = {}) {
      const filenamePrefix = options.filenamePrefix || '2FA-secrets';
      const exportTimestamp = new Date().toISOString();
      const normalizedSecrets = sortedSecrets.map(secret => ({
        name: String(secret.name || 'Unknown').trim() || 'Unknown',
        account: String(secret.account || '').trim(),
        secret: String(secret.secret || '').replace(/[\\s\\-+]/g, '').toUpperCase(),
        type: String(secret.type || 'TOTP').toUpperCase() === 'HOTP' ? 'HOTP' : 'TOTP',
        digits: secret.digits || 6,
        period: secret.period || 30,
        algorithm: String(secret.algorithm || 'SHA1').toUpperCase(),
        counter: secret.counter || 0
      }));

      const embeddedPayload = escapeHTML(JSON.stringify({
        version: '1.0',
        format: 'html',
        timestamp: exportTimestamp,
        reason: options.source || 'export',
        count: normalizedSecrets.length,
        skippedInvalidCount: 0,
        secrets: normalizedSecrets,
        metadata: options.metadata || {}
      }, null, 2));

      const _t = typeof t === 'function' ? t : (k) => null;
      const unassignedText = _t('htmlBackupQrPlaceholder') || 'Not embedded';
      const docTitle = _t('htmlBackupTitle') || '2FA Secrets Backup';
      const createdTimeLabel = _t('exportCreatedTime') || 'Created';
      const countLabel = _t('exportBackupCount') || 'Total Secrets';
      const tableAriaLabel = _t('backupTableAriaLabel') || 'Backup secrets table';
      const thService = _t('serviceName') || 'Service';
      const thAccount = _t('accountInfo') || 'Account';
      const thSecret = _t('keySecret') || 'Secret';
      const thType = _t('keyType') || 'Type';
      const thDigits = _t('keyDigits') || 'Digits';
      const thPeriod = _t('keyPeriod') || 'Period (s)';
      const thAlgorithm = _t('keyAlgorithm') || 'Algorithm';
      const thCounter = _t('counterLabel') || 'Counter';
      const thQr = _t('qrCode') || 'QR Code';
      const htmlLang = (typeof currentLang === 'string' && currentLang) ? currentLang : 'en';

      const rowsHtml = normalizedSecrets.map(secret =>
        '        <tr>\\n' +
        '          <td>' + escapeHTML(secret.name) + '</td>\\n' +
        '          <td>' + escapeHTML(secret.account || '') + '</td>\\n' +
        '          <td><code>' + escapeHTML(secret.secret) + '</code></td>\\n' +
        '          <td>' + escapeHTML(secret.type) + '</td>\\n' +
        '          <td>' + secret.digits + '</td>\\n' +
        '          <td>' + secret.period + '</td>\\n' +
        '          <td>' + escapeHTML(secret.algorithm) + '</td>\\n' +
        '          <td>' + secret.counter + '</td>\\n' +
        '          <td class="qr-cell qr-cell-placeholder">' + escapeHTML(unassignedText) + '</td>\\n' +
        '        </tr>\\n'
      ).join('');

      const htmlContent = '<!DOCTYPE html>\\n' +
        '<html lang="' + escapeHTML(htmlLang) + '">\\n' +
        '<head>\\n' +
        ${JSON.stringify(getStandaloneHead('2FA Secrets Backup', getBackupDocumentStyles())).replace(/</g, '\\u003c')} +
        '  <meta name="2fa-backup-meta" content="skippedInvalidCount=0">\\n' +
        '</head>\\n' +
        '<body data-skipped-invalid-count="0">\\n' +
        '  <main class="backup-document"><header class="document-header"><h1>' + escapeHTML(docTitle) + '</h1><div class="meta">\\n' +
        '  <p>' + escapeHTML(createdTimeLabel) + ': ' + escapeHTML(exportTimestamp) + '</p>\\n' +
        '  <p>' + escapeHTML(countLabel) + ': ' + normalizedSecrets.length + '</p>\\n' +
        '  </div></header>\\n' +
        '  <div class="table-scroll" role="region" aria-label="' + escapeHTML(tableAriaLabel) + '" tabindex="0">\\n' +
        '  <table data-skipped-invalid-count="0">\\n' +
        '    <thead>\\n' +
        '      <tr>\\n' +
        '        <th>' + escapeHTML(thService) + '</th>\\n' +
        '        <th>' + escapeHTML(thAccount) + '</th>\\n' +
        '        <th>' + escapeHTML(thSecret) + '</th>\\n' +
        '        <th>' + escapeHTML(thType) + '</th>\\n' +
        '        <th>' + escapeHTML(thDigits) + '</th>\\n' +
        '        <th>' + escapeHTML(thPeriod) + '</th>\\n' +
        '        <th>' + escapeHTML(thAlgorithm) + '</th>\\n' +
        '        <th>' + escapeHTML(thCounter) + '</th>\\n' +
        '        <th>' + escapeHTML(thQr) + '</th>\\n' +
        '      </tr>\\n' +
        '    </thead>\\n' +
        '    <tbody>\\n' +
               rowsHtml +
        '    </tbody>\\n' +
        '  </table>\\n' +
        '  </div></main>\\n' +
        '  <script id="__2fa_backup_data__" type="application/json">' + embeddedPayload + '<' + '/script>\\n' +
        '</body>\\n' +
        '</html>';

      const saved = await downloadFile(htmlContent, filenamePrefix + '-backup-' + getDateString() + '.html', 'text/html;charset=utf-8');
      if (saved) {
        showExportSuccess(sortedSecrets.length, 'HTML');
      }
    }
`;
}
