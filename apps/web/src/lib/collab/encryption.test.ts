import { describe, expect, it } from 'vitest';
import { decryptData, encryptData, exportKey, generateEncryptionKey, importKey } from './encryption';

describe('collab encryption', () => {
	it('round-trips keys and encrypted payloads', async () => {
		const key = await generateEncryptionKey();
		const exported = await exportKey(key);
		const imported = await importKey(exported);

		const encrypted = await encryptData('hello collaboration', imported);
		const decrypted = await decryptData(encrypted.payload, encrypted.iv, imported);

		expect(decrypted).toBe('hello collaboration');
	});
});
