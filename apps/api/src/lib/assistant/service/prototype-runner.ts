import type { PrototypeOverlayCustomData, PrototypeOverlayFile } from '@ai-canvas/shared/types';
import { createAnthropicMessage } from '../anthropic';
import { buildAnthropicConversation } from '../generation-mode';
import { buildPrototypePrompt, extractCodeBlock } from '../parsing';
import type { AssistantServiceInput } from '../types';
import { parsePrototypeArtifactContent, serializePrototypeArtifact } from './prototype-helpers';

const MAX_PROTOTYPE_ATTEMPTS = 3;
const MAX_FAILURE_EXCERPT_CHARS = 6000;
const PROTOTYPE_ALLOWED_DEPENDENCIES = new Set([
	'framer-motion',
	'lucide-react',
	'@radix-ui/react-dialog',
	'@radix-ui/react-tabs',
]);
const BUILT_IN_DEPENDENCIES = new Set([
	'react',
	'react-dom/client',
	'react/jsx-runtime',
	'react/jsx-dev-runtime',
]);
const SCRIPT_EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx'] as const;
const RESOLVABLE_EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx', '.css', '.json'] as const;

export interface PrototypeRunDiagnostic {
	source: 'model' | 'compile' | 'dependency';
	message: string;
	path?: string;
	line?: number;
	column?: number;
}

interface PrototypeRunSuccess {
	ok: true;
	prototype: PrototypeOverlayCustomData;
	attempts: number;
	model: string;
}

interface PrototypeRunFailure {
	ok: false;
	attempts: number;
	model?: string;
	diagnostics: PrototypeRunDiagnostic[];
}

export type PrototypeRunResult = PrototypeRunSuccess | PrototypeRunFailure;

function isScriptPath(path: string) {
	return SCRIPT_EXTENSIONS.some((extension) => path.endsWith(extension));
}

function isUrlImport(specifier: string) {
	return /^(?:[a-z]+:)?\/\//i.test(specifier) || specifier.startsWith('data:');
}

function isBareImport(specifier: string) {
	return !specifier.startsWith('.') && !specifier.startsWith('/') && !isUrlImport(specifier);
}

function joinPrototypePath(basePath: string, nextPath: string) {
	const segments = [...basePath.split('/').slice(0, -1), ...nextPath.split('/')];
	const resolved: string[] = [];

	for (const segment of segments) {
		if (!segment || segment === '.') {
			continue;
		}
		if (segment === '..') {
			resolved.pop();
			continue;
		}
		resolved.push(segment);
	}

	return `/${resolved.join('/')}`;
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

function collectImportSpecifiers(code: string) {
	const specifiers = new Set<string>();
	const staticImportPattern = /\b(?:import|export)\s+(?:[^'"]*?\s+from\s+)?(['"])([^'"]+)\1/g;
	const dynamicImportPattern = /\bimport\(\s*(['"])([^'"]+)\1\s*\)/g;

	for (const pattern of [staticImportPattern, dynamicImportPattern]) {
		for (const match of code.matchAll(pattern)) {
			const specifier = match[2]?.trim();
			if (specifier) {
				specifiers.add(specifier);
			}
		}
	}

	return [...specifiers];
}

function createDiagnostic(
	source: PrototypeRunDiagnostic['source'],
	message: string,
	options?: Partial<Omit<PrototypeRunDiagnostic, 'source' | 'message'>>,
): PrototypeRunDiagnostic {
	return {
		source,
		message,
		...(options ?? {}),
	};
}

function validateJsonSource(path: string, code: string): PrototypeRunDiagnostic[] {
	try {
		JSON.parse(code);
		return [];
	} catch (error) {
		return [
			createDiagnostic('compile', error instanceof Error ? error.message : 'Invalid JSON file.', {
				path,
			}),
		];
	}
}

function validatePrototypeWorkspace(
	prototype: PrototypeOverlayCustomData,
): PrototypeRunDiagnostic[] {
	const diagnostics: PrototypeRunDiagnostic[] = [];
	const files = prototype.files;
	const entryPath = prototype.template === 'react' ? '/index.jsx' : '/index.js';
	const importedDependencies = new Set<string>();

	if (!files[entryPath]) {
		diagnostics.push(
			createDiagnostic('compile', `Missing prototype entry file ${entryPath}.`, {
				path: entryPath,
			}),
		);
	}

	if (prototype.activeFile && !files[prototype.activeFile]) {
		diagnostics.push(
			createDiagnostic('compile', `Active file ${prototype.activeFile} does not exist.`, {
				path: prototype.activeFile,
			}),
		);
	}

	for (const [path, file] of Object.entries(files)) {
		if (path.endsWith('.json')) {
			diagnostics.push(...validateJsonSource(path, file.code));
			continue;
		}

		if (!isScriptPath(path)) {
			continue;
		}

		for (const specifier of collectImportSpecifiers(file.code)) {
			if (isBareImport(specifier)) {
				importedDependencies.add(specifier);
				continue;
			}

			if (isUrlImport(specifier)) {
				continue;
			}

			if (!resolvePrototypeImport(path, specifier, files)) {
				diagnostics.push(
					createDiagnostic('compile', `Unable to resolve "${specifier}" from ${path}.`, { path }),
				);
			}
		}
	}

	for (const dependency of new Set([
		...Object.keys(prototype.dependencies ?? {}),
		...importedDependencies,
	])) {
		if (BUILT_IN_DEPENDENCIES.has(dependency)) {
			continue;
		}

		if (!PROTOTYPE_ALLOWED_DEPENDENCIES.has(dependency)) {
			diagnostics.push(createDiagnostic('dependency', `Unsupported dependency "${dependency}".`));
		}
	}

	return diagnostics;
}

function summarizeDiagnostics(diagnostics: PrototypeRunDiagnostic[]) {
	return diagnostics
		.slice(0, 8)
		.map((diagnostic) => {
			const location = diagnostic.path
				? `${diagnostic.path}${diagnostic.line ? `:${diagnostic.line}` : ''}`
				: diagnostic.source;
			return `- ${location}: ${diagnostic.message}`;
		})
		.join('\n');
}

function buildPrototypeRepairPrompt(params: {
	userText: string;
	candidateJson?: string;
	invalidResponse?: string;
	diagnostics: PrototypeRunDiagnostic[];
}) {
	const candidateJson = params.candidateJson?.trim();
	const invalidResponse = params.invalidResponse?.trim().slice(0, MAX_FAILURE_EXCERPT_CHARS);

	return [
		'Repair the prototype JSON so it passes the runtime validation checks.',
		'Return only a single json code block with the full updated prototype.',
		'Keep the file graph complete. Do not return a partial patch.',
		'- For React prototypes, /index.jsx is required.',
		'- For vanilla prototypes, /index.js is required.',
		'- dependencies must be a JSON object map, not an array.',
		'- files must be a JSON object map of path -> { code, hidden?, active?, readOnly? }.',
		'- Only use dependencies from this allowlist: react, react-dom/client, framer-motion, lucide-react, @radix-ui/react-dialog, @radix-ui/react-tabs.',
		'',
		`Original request: ${params.userText}`,
		'',
		'Validation issues:',
		summarizeDiagnostics(params.diagnostics),
		...(candidateJson ? ['', 'Current prototype JSON:', '```json', candidateJson, '```'] : []),
		...(!candidateJson && invalidResponse
			? ['', 'Previous invalid response:', '```text', invalidResponse, '```']
			: []),
	].join('\n');
}

function buildPrototypeFailureDiagnostic(responseText: string): PrototypeRunDiagnostic[] {
	return [
		createDiagnostic(
			'model',
			'The model response was not a valid prototype JSON payload with files and a required entry file.',
		),
		...(responseText.trim()
			? [createDiagnostic('model', `Last response excerpt: ${responseText.trim().slice(0, 240)}`)]
			: []),
	];
}

export async function executePrototypeRun(params: {
	input: AssistantServiceInput;
	systemPrompt: string;
}): Promise<PrototypeRunResult> {
	let attempt = 0;
	let lastModel: string | undefined;
	let lastDiagnostics: PrototypeRunDiagnostic[] = [
		createDiagnostic('model', 'Prototype generation did not start.'),
	];
	let candidateJson = params.input.prototypeContext
		? serializePrototypeArtifact(params.input.prototypeContext)
		: undefined;
	let nextPrompt = buildPrototypePrompt(params.input.message, candidateJson);

	while (attempt < MAX_PROTOTYPE_ATTEMPTS) {
		attempt += 1;
		const completion = await createAnthropicMessage(params.input.bindings!, {
			system: params.systemPrompt,
			messages: buildAnthropicConversation(params.input, nextPrompt),
			maxTokens: 5000,
		});
		lastModel = completion.model;

		const rawResponse = extractCodeBlock(completion.text, 'json') ?? completion.text.trim();
		const prototype = parsePrototypeArtifactContent(rawResponse);
		if (!prototype) {
			lastDiagnostics = buildPrototypeFailureDiagnostic(rawResponse);
			nextPrompt = buildPrototypeRepairPrompt({
				userText: params.input.message,
				invalidResponse: rawResponse,
				diagnostics: lastDiagnostics,
			});
			continue;
		}

		const diagnostics = validatePrototypeWorkspace(prototype);
		if (diagnostics.length === 0) {
			return {
				ok: true,
				prototype,
				attempts: attempt,
				model: completion.model,
			};
		}

		lastDiagnostics = diagnostics;
		candidateJson = serializePrototypeArtifact(prototype);
		nextPrompt = buildPrototypeRepairPrompt({
			userText: params.input.message,
			candidateJson,
			diagnostics,
		});
	}

	return {
		ok: false,
		attempts: attempt,
		model: lastModel,
		diagnostics: lastDiagnostics,
	};
}
