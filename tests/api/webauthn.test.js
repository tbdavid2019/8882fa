import { describe, expect, it, beforeEach } from 'vitest';
import {
	base64UrlToBytes,
	bytesToBase64Url,
	derToP1363,
	decodeCbor,
	parseAttestationAuthData,
	verifyFidoAssertion,
	handleWebAuthnLoginOptions,
	handleWebAuthnRegisterOptions,
	handleWebAuthnListCredentials,
	handleWebAuthnDeleteCredential,
} from '../../src/api/webauthn.js';

describe('WebAuthn Cryptographic and Encoding Utilities', () => {
	it('converts base64url to bytes and back accurately', () => {
		const originalText = 'Hello WebAuthn TouchID Passkey 888!';
		const encoder = new TextEncoder();
		const bytes = encoder.encode(originalText);
		const base64url = bytesToBase64Url(bytes);

		expect(base64url).not.toContain('+');
		expect(base64url).not.toContain('/');
		expect(base64url).not.toContain('=');

		const recoveredBytes = base64UrlToBytes(base64url);
		const recoveredText = new TextDecoder().decode(recoveredBytes);
		expect(recoveredText).toBe(originalText);
	});

	it('converts ASN.1 DER signature to IEEE P1363 64-byte format', () => {
		// Construct a synthetic valid DER signature:
		// 0x30 [len] 0x02 [rLen] [r] 0x02 [sLen] [s]
		const r = new Uint8Array(32).fill(0x11);
		const s = new Uint8Array(32).fill(0x22);
		const der = new Uint8Array(2 + 2 + 32 + 2 + 32);
		let offset = 0;
		der[offset++] = 0x30;
		der[offset++] = 68; // 2 + 32 + 2 + 32
		der[offset++] = 0x02;
		der[offset++] = 32;
		der.set(r, offset);
		offset += 32;
		der[offset++] = 0x02;
		der[offset++] = 32;
		der.set(s, offset);

		const p1363 = derToP1363(der);
		expect(p1363).toHaveLength(64);
		expect(p1363.slice(0, 32)).toEqual(r);
		expect(p1363.slice(32, 64)).toEqual(s);
	});

	it('handles DER with leading 0x00 bytes when r or s is 33 bytes', () => {
		const r = new Uint8Array(33);
		r[0] = 0x00;
		r.fill(0xaa, 1);
		const s = new Uint8Array(33);
		s[0] = 0x00;
		s.fill(0xbb, 1);

		const der = new Uint8Array(2 + 2 + 33 + 2 + 33);
		let offset = 0;
		der[offset++] = 0x30;
		der[offset++] = 70;
		der[offset++] = 0x02;
		der[offset++] = 33;
		der.set(r, offset);
		offset += 33;
		der[offset++] = 0x02;
		der[offset++] = 33;
		der.set(s, offset);

		const p1363 = derToP1363(der);
		expect(p1363).toHaveLength(64);
		expect(p1363[0]).toBe(0xaa);
		expect(p1363[32]).toBe(0xbb);
	});

	it('throws error when converting invalid DER bytes', () => {
		expect(() => derToP1363(new Uint8Array([0x00, 0x01]))).toThrow('Invalid DER signature sequence');
	});

	it('decodes simple CBOR structures without external dependencies', () => {
		// CBOR unsigned integer 10
		expect(decodeCbor(new Uint8Array([10]))).toBe(10);

		// CBOR text string "888" (0x63 + '8' + '8' + '8')
		const textBytes = new Uint8Array([0x63, 0x38, 0x38, 0x38]);
		expect(decodeCbor(textBytes)).toBe('888');

		// CBOR array of 2 ints [1, 2]
		const arrayBytes = new Uint8Array([0x82, 0x01, 0x02]);
		expect(decodeCbor(arrayBytes)).toEqual([1, 2]);

		// CBOR map {"a": 1}
		const mapBytes = new Uint8Array([0xa1, 0x61, 0x61, 0x01]);
		const map = decodeCbor(mapBytes);
		expect(map.get('a')).toBe(1);
	});
});

describe('WebAuthn Attestation and Assertion Verification', () => {
	it('verifies real ECDSA P-256 assertions generated with Web Crypto', async () => {
		// Generate real ECDSA P-256 key pair
		const keyPair = await crypto.subtle.generateKey(
			{ name: 'ECDSA', namedCurve: 'P-256' },
			true,
			['sign', 'verify'],
		);

		// Export raw uncompressed public key (65 bytes: 0x04 || X || Y)
		const rawPublicKey = await crypto.subtle.exportKey('raw', keyPair.publicKey);
		const rawPublicKeyBase64 = bytesToBase64Url(new Uint8Array(rawPublicKey));

		// Prepare clientDataJSON
		const challengeStr = 'test-challenge-888-xyz';
		const origin = 'https://2fa.david888.com';
		const clientDataObj = {
			type: 'webauthn.get',
			challenge: challengeStr,
			origin: origin,
		};
		const clientDataBytes = new TextEncoder().encode(JSON.stringify(clientDataObj));
		const clientDataJsonBase64 = bytesToBase64Url(clientDataBytes);

		// Prepare authenticatorData (37 bytes minimum)
		const rpId = '2fa.david888.com';
		const rpIdHash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rpId)));
		const authDataBytes = new Uint8Array(37);
		authDataBytes.set(rpIdHash, 0); // 32 bytes rpIdHash
		authDataBytes[32] = 0x01; // Flags: UP (User Present)
		// 33-36: signCount = 0

		// Prepare signedData: authData || SHA-256(clientDataJSON)
		const clientDataHash = await crypto.subtle.digest('SHA-256', clientDataBytes);
		const signedData = new Uint8Array(authDataBytes.length + 32);
		signedData.set(authDataBytes, 0);
		signedData.set(new Uint8Array(clientDataHash), authDataBytes.length);

		// Sign with private key (Web Crypto returns 64-byte IEEE P1363)
		const p1363Signature = new Uint8Array(await crypto.subtle.sign(
			{ name: 'ECDSA', hash: 'SHA-256' },
			keyPair.privateKey,
			signedData,
		));

		// Convert P1363 (r || s) to ASN.1 DER to simulate browser authenticator
		const r = p1363Signature.slice(0, 32);
		const s = p1363Signature.slice(32, 64);
		const rExtra = r[0] & 0x80 ? 1 : 0;
		const sExtra = s[0] & 0x80 ? 1 : 0;
		const rLen = 32 + rExtra;
		const sLen = 32 + sExtra;
		const derSig = new Uint8Array(2 + 2 + rLen + 2 + sLen);
		let o = 0;
		derSig[o++] = 0x30;
		derSig[o++] = 2 + rLen + 2 + sLen;
		derSig[o++] = 0x02;
		derSig[o++] = rLen;
		if (rExtra) {
			derSig[o++] = 0x00;
		}
		derSig.set(r, o);
		o += 32;
		derSig[o++] = 0x02;
		derSig[o++] = sLen;
		if (sExtra) {
			derSig[o++] = 0x00;
		}
		derSig.set(s, o);

		const signatureBase64 = bytesToBase64Url(derSig);
		const authenticatorDataBase64 = bytesToBase64Url(authDataBytes);

		// Verify assertion succeeds
		const result = await verifyFidoAssertion({
			publicKeyRawBase64: rawPublicKeyBase64,
			authenticatorDataBase64,
			clientDataJsonBase64,
			signatureBase64,
			expectedChallenge: challengeStr,
			expectedOrigin: origin,
			expectedRpId: rpId,
		});
		expect(result).toBe(true);

		// Verify fails if challenge mismatches
		await expect(verifyFidoAssertion({
			publicKeyRawBase64: rawPublicKeyBase64,
			authenticatorDataBase64,
			clientDataJsonBase64,
			signatureBase64,
			expectedChallenge: 'wrong-challenge',
			expectedOrigin: origin,
			expectedRpId: rpId,
		})).rejects.toThrow('Challenge mismatch');

		// Verify fails if origin mismatches
		await expect(verifyFidoAssertion({
			publicKeyRawBase64: rawPublicKeyBase64,
			authenticatorDataBase64,
			clientDataJsonBase64,
			signatureBase64,
			expectedChallenge: challengeStr,
			expectedOrigin: 'https://evil.com',
			expectedRpId: rpId,
		})).rejects.toThrow('Origin mismatch');
	});
});

describe('WebAuthn API Endpoints', () => {
	let mockKv;
	let env;

	beforeEach(() => {
		const store = new Map();
		mockKv = {
			get: async (key) => store.get(key) || null,
			put: async (key, val) => store.set(key, String(val)),
			delete: async (key) => store.delete(key),
		};
		env = { SECRETS_KV: mockKv };
	});

	it('generates login options for unauthenticated client', async () => {
		const request = new Request('https://2fa.david888.com/api/webauthn/login-options', {
			method: 'GET',
		});
		const response = await handleWebAuthnLoginOptions(request, env);
		expect(response.status).toBe(200);

		const data = await response.json();
		expect(data).toHaveProperty('challenge');
		expect(data.rpId).toBe('2fa.david888.com');
		expect(data.hasCredentials).toBe(false);
	});

	it('rejects register options when unauthenticated', async () => {
		const request = new Request('https://2fa.david888.com/api/webauthn/register-options', {
			method: 'GET',
		});
		const response = await handleWebAuthnRegisterOptions(request, env);
		expect(response.status).toBe(401);
	});

	it('lists and deletes credentials when unauthenticated returns 401', async () => {
		// Simulate existing credential in KV
		await mockKv.put('WEBAUTHN_CREDENTIALS', JSON.stringify([
			{ id: 'cred-1', name: 'MacBook Touch ID', createdAt: 1234567890 },
		]));

		const unauthListRequest = new Request('https://2fa.david888.com/api/webauthn/credentials', {
			method: 'GET',
		});
		const listResponse = await handleWebAuthnListCredentials(unauthListRequest, env);
		expect(listResponse.status).toBe(401);

		const unauthDeleteRequest = new Request('https://2fa.david888.com/api/webauthn/credentials/cred-1', {
			method: 'DELETE',
		});
		const deleteResponse = await handleWebAuthnDeleteCredential(unauthDeleteRequest, env, 'cred-1');
		expect(deleteResponse.status).toBe(401);
	});

	it('validates attestation data requirements in parseAttestationAuthData', () => {
		// authData with no AT flag (0x40)
		const authData = new Uint8Array(60);
		authData[32] = 0x01; // UP flag only, no AT flag

		// Construct simple CBOR map {"authData": authData}
		const cbor = new Uint8Array(2 + 8 + 3 + 60);
		let idx = 0;
		cbor[idx++] = 0xa1; // map with 1 pair
		cbor[idx++] = 0x68; // text string length 8
		cbor.set(new TextEncoder().encode('authData'), idx);
		idx += 8;
		cbor[idx++] = 0x58; // byte string length in next byte
		cbor[idx++] = 60;
		cbor.set(authData, idx);

		expect(() => parseAttestationAuthData(cbor)).toThrow('Attested credential data not present');
	});
});
