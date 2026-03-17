import type { PrototypeOverlayFile } from '@ai-canvas/shared/types';
import * as esbuild from 'esbuild-wasm';
import esbuildWasmUrl from 'esbuild-wasm/esbuild.wasm?url';

type RuntimeFileMap = Record<string, PrototypeOverlayFile>;

interface CompileRequest {
	id: number;
	files: RuntimeFileMap;
}

interface CompileDiagnostic {
	message: string;
	path?: string;
	line?: number;
	column?: number;
}

type CompileSuccess = {
	id: number;
	ok: true;
	modules: Record<string, string>;
};

type CompileFailure = {
	id: number;
	ok: false;
	errors: CompileDiagnostic[];
};

let initialized = false;

async function ensureInitialized() {
	if (initialized) {
		return;
	}

	await esbuild.initialize({
		wasmURL: esbuildWasmUrl,
		worker: false,
	});
	initialized = true;
}

function getLoader(path: string): esbuild.Loader | null {
	if (path.endsWith('.tsx')) return 'tsx';
	if (path.endsWith('.ts')) return 'ts';
	if (path.endsWith('.jsx')) return 'jsx';
	if (path.endsWith('.js')) return 'js';
	if (path.endsWith('.json')) return 'json';
	return null;
}

function toDiagnostics(error: unknown): CompileDiagnostic[] {
	if (typeof error !== 'object' || error === null || !('errors' in error)) {
		return [{ message: error instanceof Error ? error.message : 'Unknown compiler error.' }];
	}

	const errors = (error as { errors?: esbuild.Message[] }).errors ?? [];
	return errors.map((entry) => ({
		message: entry.text,
		path: entry.location?.file,
		line: entry.location?.line,
		column: entry.location?.column,
	}));
}

self.addEventListener('message', async (event: MessageEvent<CompileRequest>) => {
	const { id, files } = event.data;

	try {
		await ensureInitialized();

		const modules: Record<string, string> = {};

		for (const [path, file] of Object.entries(files)) {
			const loader = getLoader(path);
			if (!loader) {
				continue;
			}

			const result = await esbuild.transform(file.code, {
				loader,
				format: 'esm',
				jsx: 'automatic',
				target: 'es2020',
				sourcefile: path,
			});
			modules[path] = result.code;
		}

		const payload: CompileSuccess = {
			id,
			ok: true,
			modules,
		};
		self.postMessage(payload);
	} catch (error) {
		const payload: CompileFailure = {
			id,
			ok: false,
			errors: toDiagnostics(error),
		};
		self.postMessage(payload);
	}
});
