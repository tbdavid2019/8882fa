/**
 * 导出模块 - 格式配置
 * 包含二级格式选择配置和排序函数
 */

/**
 * 获取导出配置代码
 * @returns {string} JavaScript 代码
 */
export function getExportConfigCode() {
	return `
    // ========== 导出配置模块 ==========

    // 需要二级选择的格式配置
    function getSubFormatConfig(multiFormatId) {
      const _t = typeof t === 'function' ? t : (k) => null;
      const configs = {
        'freeotp-plus-multi': {
          title: _t('exportFormatFreeotpTitle') || 'Select FreeOTP+ Export Format',
          options: [
            {
              id: 'freeotp-plus',
              icon: '🔓',
              name: _t('exportFormatFreeotpNative') || 'FreeOTP+ Native',
              ext: '.json',
              desc: _t('exportFormatFreeotpNativeDesc') || 'Community edition native format, plain JSON file',
              compat: 'FreeOTP+ (Android)'
            },
            {
              id: 'freeotp-txt',
              icon: '🔓',
              name: _t('exportFormatStandard') || 'Standard Format',
              ext: '.txt',
              desc: _t('exportFormatStandardDesc') || 'OTPAuth URL format, compatible with all authenticators',
              compat: _t('exportFormatCompatGeneral') || 'Universal'
            }
          ]
        },
        'aegis-multi': {
          title: _t('exportFormatAegisTitle') || 'Select Aegis Export Format',
          options: [
            {
              id: 'aegis',
              icon: '🔓',
              name: _t('exportFormatAegisNative') || 'Aegis Native',
              ext: '.json',
              desc: _t('exportFormatAegisNativeDesc') || 'Aegis Authenticator full format',
              compat: 'Aegis (Android)'
            },
            {
              id: 'aegis-txt',
              icon: '🔓',
              name: _t('exportFormatStandard') || 'Standard Format',
              ext: '.txt',
              desc: _t('exportFormatStandardDesc') || 'OTPAuth URL format, compatible with all authenticators',
              compat: _t('exportFormatCompatGeneral') || 'Universal'
            }
          ]
        },
        'authpro-multi': {
          title: _t('exportFormatAuthProTitle') || 'Select Authenticator Pro Export Format',
          options: [
            {
              id: 'authpro',
              icon: '🔓',
              name: _t('exportFormatAuthProNative') || 'Auth Pro Native',
              ext: '.authpro',
              desc: _t('exportFormatAuthProNativeDesc') || 'Stratum native format',
              compat: 'Authenticator Pro'
            },
            {
              id: 'authenticator-txt',
              icon: '🔓',
              name: _t('exportFormatStandard') || 'Standard Format',
              ext: '.txt',
              desc: _t('exportFormatStandardDesc') || 'OTPAuth URL format, compatible with all authenticators',
              compat: _t('exportFormatCompatGeneral') || 'Universal'
            }
          ]
        },
        'bitwarden-auth-multi': {
          title: _t('exportFormatBitwardenTitle') || 'Select Bitwarden Export Format',
          options: [
            {
              id: 'bitwarden-auth-csv',
              icon: '🔓',
              name: _t('exportFormatBitwardenCsv') || 'CSV Format',
              ext: '.csv',
              desc: _t('exportFormatBitwardenCsvDesc') || 'Spreadsheet format, viewable in Excel',
              compat: 'Bitwarden Authenticator'
            },
            {
              id: 'bitwarden-auth-json',
              icon: '🔓',
              name: _t('exportFormatBitwardenJson') || 'JSON Format',
              ext: '.json',
              desc: _t('exportFormatBitwardenJsonDesc') || 'Structured data format',
              compat: 'Bitwarden Authenticator'
            }
          ]
        }
      };
      return configs[multiFormatId] || null;
    }

    const subFormatConfigs = new Proxy({}, {
      get: (_, prop) => getSubFormatConfig(prop)
    });

    /**
     * 根据排序选项对密钥进行排序
     * @param {Array} secretsArray - 密钥数组
     * @param {string} sortValue - 排序选项值 (如 'index-asc', 'name-desc')
     * @returns {Array} 排序后的密钥数组
     */
    function sortSecretsForExport(secretsArray, sortValue) {
      const [field, direction] = sortValue.split('-');
      const isAsc = direction === 'asc';

      // 添加顺序：保持原数组顺序或倒序
      if (field === 'index') {
        return isAsc ? secretsArray : [...secretsArray].reverse();
      }

      return secretsArray.sort((a, b) => {
        let valueA, valueB;

        switch (field) {
          case 'name':
            valueA = (a.name || '').toLowerCase();
            valueB = (b.name || '').toLowerCase();
            break;
          case 'account':
            valueA = (a.account || '').toLowerCase();
            valueB = (b.account || '').toLowerCase();
            break;
          default:
            return 0;
        }

        if (valueA < valueB) return isAsc ? -1 : 1;
        if (valueA > valueB) return isAsc ? 1 : -1;
        return 0;
      });
    }

    // 选择导出格式
    function selectExportFormat(format) {
      // 隐藏格式选择模态框
      hideExportFormatModal();

      try {
        // 获取排序选项
        const sortSelect = document.getElementById('exportSortOrder');
        const sortValue = sortSelect ? sortSelect.value : 'index-asc';

        // 复制并排序密钥
        const secretsToExport = sortSecretsForExport([...secrets], sortValue);

        // 调用通用导出函数
        exportSecretsAsFormat(secretsToExport, format);
      } catch (error) {
        console.error('导出失败:', error);
        showCenterToast('❌', ((typeof t === 'function' ? t('exportFailedWithReason', { error: error.message }) : null) || ('Export failed: ' + error.message)));
      }
    }
`;
}
