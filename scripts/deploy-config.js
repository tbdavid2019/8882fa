export function injectWorkerVersion(configText, version) {
	// 必須帶 g：頂層 [vars] 和各 [env.X.vars] 都有獨立的 SW_VERSION，
	// 只替換首個會讓 env 部署的 Service Worker 快取版本停在舊值，使用者拿不到更新
	const updated = configText.replace(
		/^(\s*SW_VERSION\s*=\s*)"[^"]*"(\s*)$/gm,
		`$1"${version}"$2`
	);

	if (updated === configText) {
		throw new Error('在 wrangler.toml 中未找到 SW_VERSION 配置');
	}

	return updated;
}

/**
 * 提取 worker 名稱。
 * - envName=null（預設）：返回頂層 `name`（生產環境名）
 * - envName="X"：在 `[env.X]` 塊內查詢 `name`，找不到則回落到頂層
 */
export function extractWorkerName(configText, envName = null) {
	if (envName) {
		const lines = configText.split('\n');
		const envHeader = `[env.${envName}]`;
		let inEnvBlock = false;
		for (const line of lines) {
			const trimmed = line.trim();
			if (trimmed === envHeader) {
				inEnvBlock = true;
				continue;
			}
			if (!inEnvBlock) continue;
			if (/^\[/.test(trimmed)) break; // 進入下一個 section，env 塊結束
			const nameMatch = trimmed.match(/^name\s*=\s*"([^"]+)"/);
			if (nameMatch) return nameMatch[1];
		}
		// 未在 env 塊內找到 name，回落到頂層
	}
	const match = configText.match(/^name\s*=\s*"([^"]+)"/m);
	return match ? match[1] : null;
}

/**
 * 把 KV namespace id 注入到指定塊內（首個 binding = "SECRETS_KV" 的 [[kv_namespaces]] 陣列項）。
 * - envName=null（預設）：目標為頂層 `[[kv_namespaces]]`
 * - envName="X"：目標為 `[[env.X.kv_namespaces]]`
 *
 * 已存在 id 時覆蓋；不存在時插入到 binding 行後。其他塊（含其它 env 的 KV 塊）不會被改動。
 */
export function injectKvNamespaceId(configText, id, envName = null) {
	const lines = configText.split('\n');
	const targetHeader = envName
		? `[[env.${envName}.kv_namespaces]]`
		: '[[kv_namespaces]]';

	let inTargetBlock = false;
	let bindingLine = -1;
	let existingIdLine = -1;

	for (let i = 0; i < lines.length; i++) {
		const trimmed = lines[i].trim();

		// 任何 section header 都視為當前塊結束
		if (/^\[/.test(trimmed)) {
			if (inTargetBlock && bindingLine >= 0) {
				break; // 已經在目標塊裡找到 binding，停止掃描
			}
			inTargetBlock = trimmed === targetHeader;
			bindingLine = -1;
			existingIdLine = -1;
			continue;
		}

		if (!inTargetBlock) continue;

		if (/^binding\s*=\s*"SECRETS_KV"/.test(trimmed)) {
			bindingLine = i;
		}
		if (/^id\s*=\s*"/.test(trimmed)) {
			existingIdLine = i;
		}
	}

	if (bindingLine < 0) {
		return configText;
	}

	if (existingIdLine >= 0) {
		lines[existingIdLine] = `id = "${id}"`;
	} else {
		lines.splice(bindingLine + 1, 0, `id = "${id}"`);
	}

	return lines.join('\n');
}

/**
 * 注入自定義域名路由配置（用於消除版本切換時的邊緣路由空窗期）
 * 若已存在 routes 則不覆蓋
 */
export function injectCustomDomain(configText, domain) {
	if (!domain || typeof domain !== 'string') return configText;
	const trimmedDomain = domain.trim();
	if (!trimmedDomain) return configText;

	if (/routes\s*=\s*\[/.test(configText)) {
		return configText;
	}

	const routeBlock = `\nroutes = [\n\t{ pattern = "${trimmedDomain}", custom_domain = true }\n]\n`;
	if (/workers_dev\s*=\s*true/.test(configText)) {
		return configText.replace(/(workers_dev\s*=\s*true)/, `$1\n${routeBlock}`);
	}
	return configText + '\n' + routeBlock;
}

/**
 * 注入 Cloudflare Account ID（多賬號環境下自動鎖定目標賬號，避免互動提示）
 */
export function injectAccountId(configText, accountId) {
	if (!accountId || typeof accountId !== 'string') return configText;
	const trimmedId = accountId.trim();
	if (!trimmedId) return configText;

	if (/account_id\s*=\s*"/.test(configText)) {
		return configText.replace(/account_id\s*=\s*"[^"]*"/, `account_id = "${trimmedId}"`);
	}

	return configText.replace(/^(name\s*=\s*"[^"]*")/m, `$1\naccount_id = "${trimmedId}"`);
}

