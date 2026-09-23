import { describe, expect, it } from 'vitest';

import {
	extractWorkerName,
	injectAccountId,
	injectCustomDomain,
	injectKvNamespaceId,
	injectWorkerVersion,
} from '../../scripts/deploy-config.js';

describe('injectWorkerVersion', () => {
	it('replaces SW_VERSION without touching KV bindings', () => {
		const config = `name = "2fa"
main = "src/worker.js"

[[kv_namespaces]]
binding = "SECRETS_KV"

[vars]
SW_VERSION = "v1"
`;

		const updated = injectWorkerVersion(config, 'v20260325-123456');

		expect(updated).toContain('SW_VERSION = "v20260325-123456"');
		expect(updated).toContain('[[kv_namespaces]]\nbinding = "SECRETS_KV"');
		expect(updated.match(/\[\[kv_namespaces\]\]/g)).toHaveLength(1);
	});

	it('replaces SW_VERSION in every env block, not just the first', () => {
		const config = `name = "2fa"

[vars]
SW_VERSION = "v1"
ENVIRONMENT = "production"

[env.development]
name = "2fa-dev"

[env.development.vars]
ENVIRONMENT = "development"
SW_VERSION = "v1"
`;

		const updated = injectWorkerVersion(config, 'v1.7.0');

		// 漏替換任一處都會讓該環境的 Service Worker 快取版本停在舊值，使用者拿不到更新
		expect(updated.match(/SW_VERSION = "v1\.7\.0"/g)).toHaveLength(2);
		expect(updated).not.toContain('SW_VERSION = "v1"');
	});

	it('throws when SW_VERSION is missing', () => {
		expect(() => injectWorkerVersion('[vars]\n', 'v20260325-123456')).toThrow(
			'在 wrangler.toml 中未找到 SW_VERSION 配置'
		);
	});
});

describe('extractWorkerName', () => {
	it('extracts name from config', () => {
		expect(extractWorkerName('name = "2fa"\nmain = "src/worker.js"')).toBe('2fa');
	});

	it('returns null when name is missing', () => {
		expect(extractWorkerName('main = "src/worker.js"')).toBeNull();
	});

	it('extracts env-specific name when envName is provided', () => {
		const config = `name = "2fa"

[env.development]
name = "2fa-dev"

[env.development.vars]
SW_VERSION = "v1"
`;
		expect(extractWorkerName(config, 'development')).toBe('2fa-dev');
	});

	it('falls back to top-level name when env block has no name', () => {
		const config = `name = "2fa"

[env.staging]

[env.staging.vars]
SW_VERSION = "v1"
`;
		expect(extractWorkerName(config, 'staging')).toBe('2fa');
	});

	it('returns top-level name when env block does not exist', () => {
		const config = `name = "2fa"
main = "src/worker.js"
`;
		expect(extractWorkerName(config, 'production')).toBe('2fa');
	});
});

describe('injectKvNamespaceId', () => {
	const baseConfig = `name = "2fa"
main = "src/worker.js"

[[kv_namespaces]]
binding = "SECRETS_KV"

[vars]
SW_VERSION = "v1"

[env.development]
name = "2fa-dev"

[[env.development.kv_namespaces]]
binding = "SECRETS_KV"
`;

	it('inserts id when none exists', () => {
		const result = injectKvNamespaceId(baseConfig, 'abc123');
		expect(result).toContain('binding = "SECRETS_KV"\nid = "abc123"');
	});

	it('replaces existing id', () => {
		const configWithId = baseConfig.replace(
			'binding = "SECRETS_KV"\n\n[vars]',
			'binding = "SECRETS_KV"\nid = "old-id"\n\n[vars]'
		);
		const result = injectKvNamespaceId(configWithId, 'new-id');
		expect(result).toContain('id = "new-id"');
		expect(result).not.toContain('old-id');
	});

	it('does not modify env.development kv_namespaces', () => {
		const result = injectKvNamespaceId(baseConfig, 'abc123');
		// The env.development block should not have id injected
		const devBlock = result.split('[[env.development.kv_namespaces]]')[1];
		expect(devBlock).not.toContain('id = "abc123"');
	});

	it('returns config unchanged when no SECRETS_KV binding found', () => {
		const noKvConfig = 'name = "2fa"\n[vars]\nSW_VERSION = "v1"\n';
		expect(injectKvNamespaceId(noKvConfig, 'abc123')).toBe(noKvConfig);
	});

	it('injects id into env.development block when envName is provided', () => {
		const result = injectKvNamespaceId(baseConfig, 'dev-id', 'development');
		const devBlock = result.split('[[env.development.kv_namespaces]]')[1];
		expect(devBlock).toContain('id = "dev-id"');
	});

	it('does not modify top-level kv_namespaces when envName is provided', () => {
		const result = injectKvNamespaceId(baseConfig, 'dev-id', 'development');
		const topBlock = result.split('[[kv_namespaces]]')[1].split('[')[0];
		expect(topBlock).not.toContain('id = "dev-id"');
	});

	it('replaces existing env id when envName is provided', () => {
		const configWithDevId = baseConfig.replace(
			'[[env.development.kv_namespaces]]\nbinding = "SECRETS_KV"',
			'[[env.development.kv_namespaces]]\nbinding = "SECRETS_KV"\nid = "old-dev-id"'
		);
		const result = injectKvNamespaceId(configWithDevId, 'new-dev-id', 'development');
		expect(result).toContain('id = "new-dev-id"');
		expect(result).not.toContain('old-dev-id');
	});

	it('does not match a different env block when envName is provided', () => {
		const configWithStaging = baseConfig + `
[[env.staging.kv_namespaces]]
binding = "SECRETS_KV"
`;
		const result = injectKvNamespaceId(configWithStaging, 'dev-id', 'development');
		const stagingBlock = result.split('[[env.staging.kv_namespaces]]')[1];
		expect(stagingBlock).not.toContain('id = "dev-id"');
	});
});

describe('injectCustomDomain', () => {
	const baseConfig = `name = "8882fa"
main = "src/worker.js"
compatibility_date = "2024-01-13"
workers_dev = true

[[kv_namespaces]]
binding = "SECRETS_KV"
`;

	it('injects custom domain route after workers_dev = true', () => {
		const updated = injectCustomDomain(baseConfig, '2fa.david888.com');
		expect(updated).toContain('routes = [\n\t{ pattern = "2fa.david888.com", custom_domain = true }\n]');
	});

	it('appends route at bottom if workers_dev is not present', () => {
		const configWithoutWorkersDev = `name = "8882fa"
main = "src/worker.js"
`;
		const updated = injectCustomDomain(configWithoutWorkersDev, '2fa.david888.com');
		expect(updated).toContain('routes = [\n\t{ pattern = "2fa.david888.com", custom_domain = true }\n]');
	});

	it('does not overwrite existing routes block', () => {
		const configWithRoute = `name = "8882fa"
routes = [
\t{ pattern = "existing.domain.com", custom_domain = true }
]
`;
		const updated = injectCustomDomain(configWithRoute, 'new.domain.com');
		expect(updated).toBe(configWithRoute);
	});

	it('returns original config if domain is empty or invalid', () => {
		expect(injectCustomDomain(baseConfig, '')).toBe(baseConfig);
		expect(injectCustomDomain(baseConfig, '   ')).toBe(baseConfig);
		expect(injectCustomDomain(baseConfig, null)).toBe(baseConfig);
		expect(injectCustomDomain(baseConfig, undefined)).toBe(baseConfig);
	});
});

describe('injectAccountId', () => {
	const baseConfig = `name = "8882fa"
main = "src/worker.js"
`;

	it('injects account_id after name when none exists', () => {
		const updated = injectAccountId(baseConfig, 'test-account-123');
		expect(updated).toContain('name = "8882fa"\naccount_id = "test-account-123"');
	});

	it('replaces existing account_id', () => {
		const configWithId = `name = "8882fa"
account_id = "old-account-456"
main = "src/worker.js"
`;
		const updated = injectAccountId(configWithId, 'new-account-789');
		expect(updated).toContain('account_id = "new-account-789"');
		expect(updated).not.toContain('old-account-456');
	});

	it('returns original config if accountId is empty or invalid', () => {
		expect(injectAccountId(baseConfig, '')).toBe(baseConfig);
		expect(injectAccountId(baseConfig, '   ')).toBe(baseConfig);
		expect(injectAccountId(baseConfig, null)).toBe(baseConfig);
		expect(injectAccountId(baseConfig, undefined)).toBe(baseConfig);
	});
});
