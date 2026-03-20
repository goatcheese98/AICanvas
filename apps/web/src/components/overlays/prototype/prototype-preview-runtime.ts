import { useMountEffect } from '@/hooks/useMountEffect';
import type { PrototypeOverlayCustomData, PrototypeOverlayFile } from '@ai-canvas/shared/types';
import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import PrototypeCompilerWorker from './runtime/prototype-compiler.worker?worker';

const PROTOTYPE_ALLOWED_DEPENDENCIES = new Set([
	'framer-motion',
	'lucide-react',
	'@radix-ui/react-dialog',
	'@radix-ui/react-tabs',
]);
const REACT_IMPORT_MAP = {
	react: 'https://esm.sh/react@19.0.0?dev',
	'react-dom/client': 'https://esm.sh/react-dom@19.0.0/client?dev&external=react',
	'react/jsx-runtime': 'https://esm.sh/react@19.0.0/jsx-runtime?dev',
	'react/jsx-dev-runtime': 'https://esm.sh/react@19.0.0/jsx-dev-runtime?dev',
} as const;

const SCRIPT_EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx', '.json'] as const;
const RESOLVABLE_EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx', '.css', '.json'] as const;

let prototypeCompilerWorkerFactory = () => new PrototypeCompilerWorker();

export interface PrototypePreviewDiagnostic {
	message: string;
	path?: string;
	line?: number;
	column?: number;
	source: 'compile' | 'runtime' | 'dependency';
}

export interface PrototypePreviewState {
	status: 'idle' | 'compiling' | 'running' | 'ready' | 'error';
	srcDoc: string;
	diagnostics: PrototypePreviewDiagnostic[];
	refresh: () => void;
}

export function setPrototypeCompilerWorkerFactoryForTests(
	factory: (() => Worker) | null,
): void {
	prototypeCompilerWorkerFactory = factory ?? (() => new PrototypeCompilerWorker());
}

type WorkerSuccessPayload = {
	id: number;
	ok: true;
	modules: Record<string, string>;
};

type WorkerErrorPayload = {
	id: number;
	ok: false;
	errors: PrototypePreviewDiagnostic[];
};

function serializeRuntimeInput(input: {
	template: PrototypeOverlayCustomData['template'];
	files: Record<string, PrototypeOverlayFile>;
	dependencies: Record<string, string>;
}) {
	return JSON.stringify({
		template: input.template,
		dependencies: Object.keys(input.dependencies)
			.sort()
			.reduce<Record<string, string>>((result, key) => {
				result[key] = input.dependencies[key] ?? '';
				return result;
			}, {}),
		files: Object.keys(input.files)
			.sort()
			.map((path) => [
				path,
				{
					code: input.files[path]?.code ?? '',
					hidden: input.files[path]?.hidden ?? false,
					readOnly: input.files[path]?.readOnly ?? false,
				},
			]),
	});
}

function isScriptPath(path: string) {
	return SCRIPT_EXTENSIONS.some((extension) => path.endsWith(extension));
}

function isUrlImport(specifier: string) {
	return /^(?:[a-z]+:)?\/\//i.test(specifier) || specifier.startsWith('data:');
}

function isBareImport(specifier: string) {
	return !specifier.startsWith('.') && !specifier.startsWith('/') && !isUrlImport(specifier);
}

function getEntryPath(template: PrototypeOverlayCustomData['template']) {
	return template === 'react' ? '/index.jsx' : '/index.js';
}

function getPreviewMountId(template: PrototypeOverlayCustomData['template']) {
	return template === 'react' ? 'root' : 'app';
}

function getVirtualSpecifier(path: string) {
	return `prototype:${path.replace(/^\//, '')}`;
}

function joinPrototypePath(basePath: string, nextPath: string) {
	const segments = [...basePath.split('/').slice(0, -1), ...nextPath.split('/')];
	const resolved: string[] = [];

	for (const segment of segments) {
		if (!segment || segment === '.') continue;
		if (segment === '..') {
			resolved.pop();
			continue;
		}

		resolved.push(segment);
	}

	return `/${resolved.join('/')}`;
}

function resolvePrototypeImport(
	fromPath: string,
	specifier: string,
	files: Record<string, PrototypeOverlayFile>,
) {
	if (specifier.startsWith('/')) {
		return resolvePrototypePath(specifier, files);
	}

	if (!specifier.startsWith('.')) {
		return null;
	}

	return resolvePrototypePath(joinPrototypePath(fromPath, specifier), files);
}

function resolvePrototypePath(path: string, files: Record<string, PrototypeOverlayFile>) {
	if (files[path]) {
		return path;
	}

	for (const extension of RESOLVABLE_EXTENSIONS) {
		if (files[`${path}${extension}`]) {
			return `${path}${extension}`;
		}
		if (files[`${path}/index${extension}`]) {
			return `${path}/index${extension}`;
		}
	}

	return null;
}

function rewriteImportsToVirtualPaths(
	code: string,
	path: string,
	files: Record<string, PrototypeOverlayFile>,
): {
	code: string;
	dependencies: Set<string>;
	errors: PrototypePreviewDiagnostic[];
} {
	const dependencies = new Set<string>();
	const errors: PrototypePreviewDiagnostic[] = [];

	const replaceSpecifier = (specifier: string) => {
		if (isBareImport(specifier)) {
			dependencies.add(specifier);
			return specifier;
		}

		if (isUrlImport(specifier)) {
			return specifier;
		}

		const resolved = resolvePrototypeImport(path, specifier, files);
		if (!resolved) {
			errors.push({
				source: 'compile',
				message: `Unable to resolve "${specifier}" from ${path}.`,
				path,
			});
			return specifier;
		}

		return getVirtualSpecifier(resolved);
	};

	let nextCode = code.replace(
		/\b(?:import|export)\s+(?:[^'"]*?\s+from\s+)?(['"])([^'"]+)\1/g,
		(match, _quote: string, specifier: string) =>
			match.replace(specifier, replaceSpecifier(specifier)),
	);

	nextCode = nextCode.replace(
		/\bimport\(\s*(['"])([^'"]+)\1\s*\)/g,
		(match, _quote: string, specifier: string) =>
			match.replace(specifier, replaceSpecifier(specifier)),
	);

	return {
		code: nextCode,
		dependencies,
		errors,
	};
}

function createStyleModule(path: string, code: string) {
	return [
		`const styleId = ${JSON.stringify(`prototype-style:${path}`)};`,
		`let style = document.querySelector(\`style[data-prototype-style="\${styleId}"]\`);`,
		'if (!style) {',
		"  style = document.createElement('style');",
		"  style.setAttribute('data-prototype-style', styleId);",
		'  document.head.appendChild(style);',
		'}',
		`style.textContent = ${JSON.stringify(code)};`,
		`export default ${JSON.stringify(code)};`,
	].join('\n');
}

function createModuleUrl(code: string) {
	return `data:text/javascript;charset=utf-8,${encodeURIComponent(code)}`;
}

function getDependencyImportMap(dependencies: Iterable<string>) {
	const imports: Record<string, string> = {
		...REACT_IMPORT_MAP,
	};
	const diagnostics: PrototypePreviewDiagnostic[] = [];

	for (const dependency of dependencies) {
		if (
			dependency === 'react' ||
			dependency === 'react-dom/client' ||
			dependency === 'react/jsx-runtime' ||
			dependency === 'react/jsx-dev-runtime'
		) {
			continue;
		}

		if (!PROTOTYPE_ALLOWED_DEPENDENCIES.has(dependency)) {
			diagnostics.push({
				source: 'dependency',
				message: `Unsupported dependency "${dependency}".`,
			});
			continue;
		}

		imports[dependency] = `https://esm.sh/${dependency}?dev&external=react,react-dom`;
	}

	return { imports, diagnostics };
}

function createPreviewDocument(
	template: PrototypeOverlayCustomData['template'],
	files: Record<string, PrototypeOverlayFile>,
	compiledModules: Record<string, string>,
	declaredDependencies: Record<string, string>,
	previewId: string,
) {
	const localImports: Record<string, string> = {};
	const dependencyImports = new Set<string>();
	const diagnostics: PrototypePreviewDiagnostic[] = [];
	let entryModuleCode = '';
	const entryPath = getEntryPath(template);

	for (const [path, file] of Object.entries(files)) {
		if (path.endsWith('.css')) {
			const url = createModuleUrl(createStyleModule(path, file.code));
			localImports[getVirtualSpecifier(path)] = url;
			continue;
		}

		if (!isScriptPath(path)) {
			continue;
		}

		const compiledCode = compiledModules[path];
		if (!compiledCode) {
			diagnostics.push({
				source: 'compile',
				message: `No compiled output was produced for ${path}.`,
				path,
			});
			continue;
		}

		const rewritten = rewriteImportsToVirtualPaths(compiledCode, path, files);
		for (const dependency of rewritten.dependencies) {
			dependencyImports.add(dependency);
		}
		diagnostics.push(...rewritten.errors);

		if (path === entryPath) {
			entryModuleCode = rewritten.code;
			continue;
		}

		const url = createModuleUrl(rewritten.code);
		localImports[getVirtualSpecifier(path)] = url;
	}

	for (const dependency of Object.keys(declaredDependencies)) {
		dependencyImports.add(dependency);
	}

	const { imports: dependencyMap, diagnostics: dependencyDiagnostics } =
		getDependencyImportMap(dependencyImports);
	diagnostics.push(...dependencyDiagnostics);

	if (!entryModuleCode) {
		diagnostics.push({
			source: 'compile',
			message: `Missing prototype entry file ${entryPath}.`,
			path: entryPath,
		});
	}

	const importMap = {
		imports: {
			...localImports,
			...dependencyMap,
		},
	};

	const mountId = getPreviewMountId(template);
	const srcDoc = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      html, body, #${mountId} {
        min-height: 100%;
      }

      body {
        margin: 0;
        overflow-y: auto;
        background: #f8fafc;
      }
    </style>
    <script type="importmap">${JSON.stringify(importMap)}</script>
  </head>
  <body>
    <div id="${mountId}"></div>
    <script>
      const previewId = ${JSON.stringify(previewId)};
      window.__prototypePreviewSend = (type, payload = {}) => {
        window.parent.postMessage({ source: 'prototype-preview', type, previewId, ...payload }, '*');
      };

      window.__prototypePreviewFormatError = (error) => {
        if (error instanceof Error) {
          return error.stack || error.message;
        }

        return typeof error === 'string' ? error : JSON.stringify(error);
      };

      window.addEventListener('error', (event) => {
        window.__prototypePreviewSend('runtime-error', {
          message: event.message,
          stack: event.error ? window.__prototypePreviewFormatError(event.error) : undefined
        });
      });

      window.addEventListener('unhandledrejection', (event) => {
        window.__prototypePreviewSend('runtime-error', {
          message: window.__prototypePreviewFormatError(event.reason)
        });
      });
    </script>
    <script type="module">
${entryModuleCode || "throw new Error('Missing prototype entry module.');"}
requestAnimationFrame(() => window.__prototypePreviewSend('ready'));
    </script>
  </body>
</html>`;

	return {
		srcDoc,
		diagnostics,
		revoke() {},
	};
}

export function usePrototypePreview(input: PrototypeOverlayCustomData): PrototypePreviewState {
	const [nonce, setNonce] = useState(0);
	const [status, setStatus] = useState<PrototypePreviewState['status']>('idle');
	const [srcDoc, setSrcDoc] = useState('');
	const [diagnostics, setDiagnostics] = useState<PrototypePreviewDiagnostic[]>([]);
	const [workerVersion, setWorkerVersion] = useState(0);
	const cleanupRef = useRef<null | (() => void)>(null);
	const previewIdRef = useRef('');
	const jobIdRef = useRef(0);
	const workerRef = useRef<Worker | null>(null);
	const runtimeInput = useMemo(
		() => ({
			template: input.template,
			files: input.files,
			dependencies: input.dependencies ?? {},
		}),
		[input.dependencies, input.files, input.template],
	);
	const runtimeSignature = useMemo(() => serializeRuntimeInput(runtimeInput), [runtimeInput]);
	const runtimeInputRef = useRef(runtimeInput);
	runtimeInputRef.current = runtimeInput;
	const compileRequest = useMemo(
		() => ({
			key: `${runtimeSignature}:${nonce}`,
			input: runtimeInputRef.current,
		}),
		[nonce, runtimeSignature],
	);

	useMountEffect(() => {
		const worker = prototypeCompilerWorkerFactory();
		workerRef.current = worker;
		setWorkerVersion((value) => value + 1);
		return () => {
			worker.terminate();
			cleanupRef.current?.();
		};
	});

	const handlePreviewMessage = useEffectEvent((event: MessageEvent) => {
		const data = event.data as
			| { source?: string; type?: string; previewId?: string; message?: string; stack?: string }
			| undefined;
		if (data?.source !== 'prototype-preview' || data.previewId !== previewIdRef.current) {
			return;
		}

		if (data.type === 'ready') {
			setStatus('ready');
			return;
		}

		if (data.type === 'runtime-error') {
			setStatus('error');
			setDiagnostics((current) => [
				...current.filter((entry) => entry.source !== 'runtime'),
				{
					source: 'runtime',
					message: data.stack ?? data.message ?? 'Runtime error.',
				},
			]);
		}
	});

	useMountEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			handlePreviewMessage(event);
		};

		window.addEventListener('message', handleMessage);
		return () => window.removeEventListener('message', handleMessage);
	});

	useEffect(() => {
		if (workerVersion === 0) {
			return;
		}

		const worker = workerRef.current;
		if (!worker) {
			return;
		}

		const nextInput = compileRequest.input;
		const requestId = jobIdRef.current + 1;
		jobIdRef.current = requestId;
		setStatus('compiling');

		const handleWorkerMessage = (
			event: MessageEvent<WorkerSuccessPayload | WorkerErrorPayload>,
		) => {
			if (event.data.id !== requestId) {
				return;
			}

			worker.removeEventListener('message', handleWorkerMessage);

			if (!event.data.ok) {
				cleanupRef.current?.();
				setDiagnostics(event.data.errors);
				setStatus('error');
				return;
			}

			const previewId = `prototype-preview-${requestId}-${Date.now()}`;
			const document = createPreviewDocument(
				nextInput.template,
				nextInput.files,
				event.data.modules,
				nextInput.dependencies,
				previewId,
			);

			cleanupRef.current?.();
			cleanupRef.current = document.revoke;
			previewIdRef.current = previewId;
			setSrcDoc(document.srcDoc);
			setDiagnostics(document.diagnostics);
			setStatus(document.diagnostics.length > 0 ? 'error' : 'running');
		};

		worker.addEventListener('message', handleWorkerMessage);
		worker.postMessage({
			id: requestId,
			files: nextInput.files,
		});

		return () => {
			worker.removeEventListener('message', handleWorkerMessage);
		};
	}, [compileRequest, workerVersion]);

	return {
		status,
		srcDoc,
		diagnostics,
		refresh: () => setNonce((value) => value + 1),
	};
}
