/**
 * E2E encryption for collaboration.
 * AES-GCM-128: key stays in URL hash, server never sees plaintext.
 * Direct port from reference codebase.
 */

export async function generateEncryptionKey(): Promise<CryptoKey> {
	return crypto.subtle.generateKey({ name: 'AES-GCM', length: 128 }, true, ['encrypt', 'decrypt']);
}

export async function exportKey(key: CryptoKey): Promise<string> {
	const raw = await crypto.subtle.exportKey('raw', key);
	return btoa(String.fromCharCode(...new Uint8Array(raw)));
}

export async function importKey(base64: string): Promise<CryptoKey> {
	const raw = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
	return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM', length: 128 }, true, [
		'encrypt',
		'decrypt',
	]);
}

export async function encryptData(
	plaintext: string,
	key: CryptoKey,
): Promise<{ payload: string; iv: string }> {
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const encoded = new TextEncoder().encode(plaintext);
	const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);

	return {
		payload: btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
		iv: btoa(String.fromCharCode(...iv)),
	};
}

export async function decryptData(payload: string, iv: string, key: CryptoKey): Promise<string> {
	const ciphertext = Uint8Array.from(atob(payload), (c) => c.charCodeAt(0));
	const ivBytes = Uint8Array.from(atob(iv), (c) => c.charCodeAt(0));
	const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivBytes }, key, ciphertext);

	return new TextDecoder().decode(plaintext);
}
