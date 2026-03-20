import {
	decryptData,
	encryptData,
	exportKey as exportEncryptionKey,
	generateEncryptionKey,
	importKey as importEncryptionKey,
} from '@/lib/collab/encryption';
import { useCallback, useRef } from 'react';

export interface CollabEncryption {
	key: CryptoKey | null;
	generateKey: () => Promise<CryptoKey>;
	encrypt: (plaintext: string) => Promise<{ payload: string; iv: string } | null>;
	decrypt: (payload: string, iv: string) => Promise<string | null>;
	exportKey: (key: CryptoKey) => Promise<string>;
	importKey: (base64: string) => Promise<CryptoKey>;
	setKey: (key: CryptoKey | null) => void;
}

export function useCollabEncryption(): CollabEncryption {
	const keyRef = useRef<CryptoKey | null>(null);

	const generateKey = useCallback(async () => {
		const key = await generateEncryptionKey();
		keyRef.current = key;
		return key;
	}, []);

	const encrypt = useCallback(async (plaintext: string) => {
		const key = keyRef.current;
		if (!key) return null;
		try {
			return await encryptData(plaintext, key);
		} catch {
			return null;
		}
	}, []);

	const decrypt = useCallback(async (payload: string, iv: string) => {
		const key = keyRef.current;
		if (!key) return null;
		try {
			return await decryptData(payload, iv, key);
		} catch {
			return null;
		}
	}, []);

	const exportKey = useCallback(async (key: CryptoKey) => {
		return exportEncryptionKey(key);
	}, []);

	const importKey = useCallback(async (base64: string) => {
		const key = await importEncryptionKey(base64);
		keyRef.current = key;
		return key;
	}, []);

	const setKey = useCallback((key: CryptoKey | null) => {
		keyRef.current = key;
	}, []);

	return {
		key: keyRef.current,
		generateKey,
		encrypt,
		decrypt,
		exportKey,
		importKey,
		setKey,
	};
}
