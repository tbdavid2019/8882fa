/**
 * WebAuthn / FIDO2 / Touch ID / Passkey 模組
 * 提供基於純 Web Crypto API 的無依賴 Passkey 認證與管理
 */

import { getJwtExpiryDays, generateJWT, createSetCookieHeader, verifyAuthWithDetails } from '../utils/auth.js';
import { getSecurityHeaders } from '../utils/security.js';
import { getClientIdentifier, checkRateLimit, createRateLimitResponse, RATE_LIMIT_PRESETS } from '../utils/rateLimit.js';
import { createJsonResponse, createErrorResponse } from '../utils/response.js';
import { getLogger } from '../utils/logger.js';

// ==================== Base64URL 工具函式 ====================

export function base64UrlToBytes(base64url) {
	const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
	const pad = base64.length % 4 === 0 ? '' : '='.repeat(4 - (base64.length % 4));
	const binary = atob(base64 + pad);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}

export function bytesToBase64Url(bytes) {
	let binary = '';
	for (let i = 0; i < bytes.byteLength; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// ==================== 密碼學轉換函式 ====================

/**
 * 將 WebAuthn 瀏覽器回傳的 ASN.1 DER 編碼簽名轉換為 Web Crypto 所需的 64 位元組 IEEE P1363 格式 (r || s)
 * @param {Uint8Array} derBytes
 * @returns {Uint8Array} 64 位元組簽名
 */
export function derToP1363(derBytes) {
	let offset = 0;
	if (derBytes[offset++] !== 0x30) {
		throw new Error('Invalid DER signature sequence');
	}
	const seqLen = derBytes[offset++];
	if (seqLen & 0x80) {
		offset += seqLen & 0x7f;
	}

	if (derBytes[offset++] !== 0x02) {
		throw new Error('Expected integer marker for r');
	}
	const rLen = derBytes[offset++];
	let r = derBytes.slice(offset, offset + rLen);
	offset += rLen;

	if (derBytes[offset++] !== 0x02) {
		throw new Error('Expected integer marker for s');
	}
	const sLen = derBytes[offset++];
	let s = derBytes.slice(offset, offset + sLen);

	// 移除正負號補零 (0x00 字首) 或左側補零至 32 位元組
	if (r.length === 33 && r[0] === 0x00) {
		r = r.slice(1);
	}
	if (s.length === 33 && s[0] === 0x00) {
		s = s.slice(1);
	}

	const p1363 = new Uint8Array(64);
	p1363.set(r, 32 - r.length);
	p1363.set(s, 64 - s.length);
	return p1363;
}

/**
 * 輕量零依賴 CBOR 解碼器，用於解析 Attestation Object 與 COSE 公鑰
 * @param {Uint8Array} bytes
 * @returns {*}
 */
export function decodeCbor(bytes) {
	let offset = 0;
	function read() {
		const initialByte = bytes[offset++];
		const majorType = initialByte >> 5;
		let val = initialByte & 0x1f;
		if (val === 24) {
			val = bytes[offset++];
		} else if (val === 25) {
			val = (bytes[offset++] << 8) | bytes[offset++];
		} else if (val === 26) {
			val = ((bytes[offset++] << 24) | (bytes[offset++] << 16) | (bytes[offset++] << 8) | bytes[offset++]) >>> 0;
		}

		if (majorType === 0) {
			return val;
		} // unsigned int
		if (majorType === 1) {
			return -1 - val;
		} // negative int
		if (majorType === 2) {
			// byte string
			const str = bytes.slice(offset, offset + val);
			offset += val;
			return str;
		}
		if (majorType === 3) {
			// utf-8 string
			const str = new TextDecoder().decode(bytes.slice(offset, offset + val));
			offset += val;
			return str;
		}
		if (majorType === 4) {
			// array
			const arr = [];
			for (let i = 0; i < val; i++) {
				arr.push(read());
			}
			return arr;
		}
		if (majorType === 5) {
			// map
			const map = new Map();
			for (let i = 0; i < val; i++) {
				const k = read();
				const v = read();
				map.set(k, v);
			}
			return map;
		}
		throw new Error('Unsupported CBOR type: ' + majorType);
	}
	return read();
}

/**
 * 解析 Attestation Object 並提取 Credential ID 與 Raw P-256 公鑰
 * @param {Uint8Array} attestationBytes
 * @returns {{ credentialId: string, rawPublicKey: string }}
 */
export function parseAttestationAuthData(attestationBytes) {
	const attestationMap = decodeCbor(attestationBytes);
	const authData = attestationMap.get('authData');
	if (!authData || authData.length < 55) {
		throw new Error('Invalid authenticator data in attestation');
	}

	const flags = authData[32];
	if (!(flags & 0x40)) {
		throw new Error('Attested credential data not present');
	}

	const credIdLen = (authData[53] << 8) | authData[54];
	const credIdBytes = authData.slice(55, 55 + credIdLen);
	const coseBytes = authData.slice(55 + credIdLen);

	const coseMap = decodeCbor(coseBytes);
	const kty = coseMap.get(1); // 2 = EC2
	const alg = coseMap.get(3); // -7 = ES256
	const crv = coseMap.get(-1); // 1 = P-256
	const x = coseMap.get(-2);
	const y = coseMap.get(-3);

	if (kty !== 2 || alg !== -7 || crv !== 1 || !x || !y) {
		throw new Error('Only ES256 (P-256) credentials are supported');
	}

	// 拼接未壓縮的 65 位元組公鑰 (0x04 || X || Y)
	const rawPublicKeyBytes = new Uint8Array(65);
	rawPublicKeyBytes[0] = 0x04;
	rawPublicKeyBytes.set(x, 1);
	rawPublicKeyBytes.set(y, 33);

	return {
		credentialId: bytesToBase64Url(credIdBytes),
		rawPublicKey: bytesToBase64Url(rawPublicKeyBytes),
	};
}

/**
 * 驗證 WebAuthn 登入簽名
 */
export async function verifyFidoAssertion({
	publicKeyRawBase64,
	authenticatorDataBase64,
	clientDataJsonBase64,
	signatureBase64,
	expectedChallenge,
	expectedOrigin,
	expectedRpId,
}) {
	const clientDataBytes = base64UrlToBytes(clientDataJsonBase64);
	const clientData = JSON.parse(new TextDecoder('utf-8').decode(clientDataBytes));

	if (clientData.type !== 'webauthn.get') {
		throw new Error('Invalid clientData type');
	}
	if (clientData.challenge !== expectedChallenge) {
		throw new Error('Challenge mismatch');
	}
	if (expectedOrigin && clientData.origin !== expectedOrigin) {
		throw new Error('Origin mismatch');
	}

	const authDataBytes = base64UrlToBytes(authenticatorDataBase64);
	if (expectedRpId) {
		const rpIdHash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(expectedRpId)));
		for (let i = 0; i < 32; i++) {
			if (authDataBytes[i] !== rpIdHash[i]) {
				throw new Error('RP ID hash mismatch');
			}
		}
	}

	const flags = authDataBytes[32];
	if (!(flags & 0x01)) {
		throw new Error('User Presence flag not set');
	}

	const clientDataHash = await crypto.subtle.digest('SHA-256', clientDataBytes);
	const signedData = new Uint8Array(authDataBytes.length + 32);
	signedData.set(authDataBytes, 0);
	signedData.set(new Uint8Array(clientDataHash), authDataBytes.length);

	const publicKeyBytes = base64UrlToBytes(publicKeyRawBase64);
	const cryptoKey = await crypto.subtle.importKey('raw', publicKeyBytes, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);

	const derSig = base64UrlToBytes(signatureBase64);
	const p1363Sig = derToP1363(derSig);

	const isValid = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, cryptoKey, p1363Sig, signedData);

	if (!isValid) {
		throw new Error('ECDSA Cryptographic Signature Invalid');
	}
	return true;
}

// ==================== API 路由處理函式 ====================

const CREDENTIALS_KEY = 'WEBAUTHN_CREDENTIALS';
const CHALLENGE_PREFIX = 'WEBAUTHN_CHALLENGE_';

function getRpId(request) {
	const url = new URL(request.url);
	return url.hostname;
}

async function loadStoredCredentials(env) {
	if (env.SECRETS_KV && typeof env.SECRETS_KV.get === 'function') {
		const raw = await env.SECRETS_KV.get(CREDENTIALS_KEY);
		if (raw) {
			try {
				return JSON.parse(raw);
			} catch {
				return [];
			}
		}
	}
	return [];
}

async function saveStoredCredentials(env, credentials) {
	if (env.SECRETS_KV && typeof env.SECRETS_KV.put === 'function') {
		await env.SECRETS_KV.put(CREDENTIALS_KEY, JSON.stringify(credentials));
	}
}

/**
 * 註冊 Challenge 生成 (需已登入)
 */
export async function handleWebAuthnRegisterOptions(request, env) {
	const auth = await verifyAuthWithDetails(request, env);
	if (!auth || !auth.valid) {
		return createErrorResponse('Unauthorized', 'Authentication required to register Passkey', 401, request);
	}

	const challengeBytes = crypto.getRandomValues(new Uint8Array(32));
	const challenge = bytesToBase64Url(challengeBytes);
	const rpId = getRpId(request);

	// 存入 KV，TTL 120 秒
	if (env.SECRETS_KV && typeof env.SECRETS_KV.put === 'function') {
		await env.SECRETS_KV.put(`${CHALLENGE_PREFIX}${challenge}`, 'pending', { expirationTtl: 120 });
	}

	return createJsonResponse(
		{
			challenge,
			rp: {
				name: '888 2FA',
				id: rpId,
			},
			user: {
				id: bytesToBase64Url(new TextEncoder().encode('admin')),
				name: 'admin@888-2fa',
				displayName: '888 2FA Administrator',
			},
			pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
			authenticatorSelection: {
				authenticatorAttachment: 'platform',
				userVerification: 'preferred',
				residentKey: 'preferred',
			},
			timeout: 60000,
		},
		200,
		request,
	);
}

/**
 * 註冊 Passkey 憑據 (需已登入)
 */
export async function handleWebAuthnRegister(request, env) {
	const auth = await verifyAuthWithDetails(request, env);
	if (!auth || !auth.valid) {
		return createErrorResponse('Unauthorized', 'Authentication required to register Passkey', 401, request);
	}

	const body = await request.json();
	const { response, deviceName } = body;
	if (!response || !response.attestationObject || !response.clientDataJSON) {
		return createErrorResponse('Bad Request', 'Invalid WebAuthn registration payload', 400, request);
	}

	// 驗證 Challenge
	const clientDataBytes = base64UrlToBytes(response.clientDataJSON);
	const clientData = JSON.parse(new TextDecoder().decode(clientDataBytes));
	const challengeKey = `${CHALLENGE_PREFIX}${clientData.challenge}`;

	if (env.SECRETS_KV && typeof env.SECRETS_KV.get === 'function') {
		const stored = await env.SECRETS_KV.get(challengeKey);
		if (!stored) {
			return createErrorResponse('Bad Request', 'Challenge expired or invalid', 400, request);
		}
		// 一次性消費，防止重放攻擊
		await env.SECRETS_KV.delete(challengeKey);
	}

	const attestationBytes = base64UrlToBytes(response.attestationObject);
	const { credentialId, rawPublicKey } = parseAttestationAuthData(attestationBytes);

	// 讀取並儲存到憑證庫
	let credentials = await loadStoredCredentials(env);

	// 移除同 ID 的舊憑據
	credentials = credentials.filter((c) => c.id !== credentialId);
	credentials.push({
		id: credentialId,
		publicKey: rawPublicKey,
		name: deviceName || 'Touch ID / Passkey',
		createdAt: Date.now(),
	});

	await saveStoredCredentials(env, credentials);

	return createJsonResponse(
		{
			success: true,
			message: 'Passkey registered successfully',
			credential: {
				id: credentialId,
				name: deviceName || 'Touch ID / Passkey',
			},
		},
		200,
		request,
	);
}

/**
 * 登入 Challenge 生成 (公開介面)
 */
export async function handleWebAuthnLoginOptions(request, env) {
	const clientIP = getClientIdentifier(request, 'ip');
	const rateLimitInfo = await checkRateLimit(clientIP, env, RATE_LIMIT_PRESETS.login);
	if (!rateLimitInfo.allowed) {
		return createRateLimitResponse(rateLimitInfo, request);
	}

	const challengeBytes = crypto.getRandomValues(new Uint8Array(32));
	const challenge = bytesToBase64Url(challengeBytes);
	const rpId = getRpId(request);

	if (env.SECRETS_KV && typeof env.SECRETS_KV.put === 'function') {
		await env.SECRETS_KV.put(`${CHALLENGE_PREFIX}${challenge}`, 'pending', { expirationTtl: 120 });
	}

	const credentials = await loadStoredCredentials(env);

	return createJsonResponse(
		{
			challenge,
			rpId,
			hasCredentials: credentials.length > 0,
			allowCredentials: credentials.map((c) => ({
				id: c.id,
				type: 'public-key',
				transports: ['internal', 'hybrid'],
			})),
			timeout: 60000,
		},
		200,
		request,
	);
}

/**
 * 登入驗證 (公開介面)
 */
export async function handleWebAuthnLogin(request, env) {
	const logger = getLogger(env);
	const clientIP = getClientIdentifier(request, 'ip');
	const rateLimitInfo = await checkRateLimit(clientIP, env, RATE_LIMIT_PRESETS.login);
	if (!rateLimitInfo.allowed) {
		return createRateLimitResponse(rateLimitInfo, request);
	}

	const body = await request.json();
	const { id, response } = body;
	if (!id || !response || !response.authenticatorData || !response.clientDataJSON || !response.signature) {
		return createErrorResponse('Bad Request', 'Invalid WebAuthn assertion payload', 400, request);
	}

	// 提取 Challenge
	const clientDataBytes = base64UrlToBytes(response.clientDataJSON);
	const clientData = JSON.parse(new TextDecoder().decode(clientDataBytes));
	const challenge = clientData.challenge;
	const challengeKey = `${CHALLENGE_PREFIX}${challenge}`;

	if (env.SECRETS_KV && typeof env.SECRETS_KV.get === 'function') {
		const stored = await env.SECRETS_KV.get(challengeKey);
		if (!stored) {
			return createErrorResponse('Bad Request', 'Challenge expired or invalid', 400, request);
		}
		// 消費 challenge
		await env.SECRETS_KV.delete(challengeKey);
	}

	// 查詢對應憑據
	const credentials = await loadStoredCredentials(env);

	const cred = credentials.find((c) => c.id === id);
	if (!cred) {
		return createErrorResponse('Unauthorized', 'Passkey not recognized on this server', 401, request);
	}

	const rpId = getRpId(request);
	const url = new URL(request.url);
	const expectedOrigin = `${url.protocol}//${url.host}`;

	try {
		await verifyFidoAssertion({
			publicKeyRawBase64: cred.publicKey,
			authenticatorDataBase64: response.authenticatorData,
			clientDataJsonBase64: response.clientDataJSON,
			signatureBase64: response.signature,
			expectedChallenge: challenge,
			expectedOrigin,
			expectedRpId: rpId,
		});
	} catch (verifyErr) {
		logger.warn('Passkey verification failed', { error: verifyErr.message, id });
		return createErrorResponse('Unauthorized', `Passkey verification failed: ${verifyErr.message}`, 401, request);
	}

	// 驗證成功，簽發標準 JWT 會話
	const storedPasswordHash =
		env.SECRETS_KV && typeof env.SECRETS_KV.get === 'function'
			? (await env.SECRETS_KV.get('user_password')) || 'webauthn-fallback-secret'
			: 'webauthn-fallback-secret';
	const jwtExpiryDays = await getJwtExpiryDays(env);
	const jwtToken = await generateJWT(
		{
			auth: true,
			loginAt: new Date().toISOString(),
			authMethod: 'passkey',
			credentialId: id,
		},
		storedPasswordHash,
		jwtExpiryDays,
	);

	const expiryDate = new Date(Date.now() + jwtExpiryDays * 24 * 60 * 60 * 1000);
	const securityHeaders = getSecurityHeaders(request);

	return new Response(
		JSON.stringify({
			success: true,
			message: 'Passkey login successful',
			token: jwtToken,
			expiresAt: expiryDate.toISOString(),
			expiresIn: `${jwtExpiryDays}天`,
		}),
		{
			status: 200,
			headers: {
				...securityHeaders,
				'Content-Type': 'application/json',
				'Set-Cookie': createSetCookieHeader(jwtToken, jwtExpiryDays * 24 * 60 * 60),
			},
		},
	);
}

/**
 * 列出已繫結的 Passkey 憑據 (需已登入)
 */
export async function handleWebAuthnListCredentials(request, env) {
	const auth = await verifyAuthWithDetails(request, env);
	if (!auth || !auth.valid) {
		return createErrorResponse('Unauthorized', 'Authentication required', 401, request);
	}

	const credentials = await loadStoredCredentials(env);

	const safeList = credentials.map((c) => ({
		id: c.id,
		name: c.name,
		createdAt: c.createdAt,
	}));

	return createJsonResponse({ credentials: safeList }, 200, request);
}

/**
 * 刪除已繫結的 Passkey 憑據 (需已登入)
 */
export async function handleWebAuthnDeleteCredential(request, env, credId) {
	const auth = await verifyAuthWithDetails(request, env);
	if (!auth || !auth.valid) {
		return createErrorResponse('Unauthorized', 'Authentication required', 401, request);
	}

	let credentials = await loadStoredCredentials(env);

	const initialLen = credentials.length;
	credentials = credentials.filter((c) => c.id !== credId);

	if (credentials.length === initialLen) {
		return createErrorResponse('Not Found', 'Passkey not found', 404, request);
	}

	await saveStoredCredentials(env, credentials);

	return createJsonResponse({ success: true, message: 'Passkey deleted' }, 200, request);
}
