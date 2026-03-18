import { normalizePrototypeOverlay } from '@ai-canvas/shared/schemas';
import type {
	AssistantArtifact,
	AssistantPrototypePatchArtifact,
	PrototypeOverlayCustomData,
} from '@ai-canvas/shared/types';
import { extractCodeBlock } from './assistant-artifact-text';

interface PrototypeArtifactPayload {
	title?: string;
	template?: PrototypeOverlayCustomData['template'];
	activeFile?: string;
	dependencies?: Record<string, string>;
	preview?: PrototypeOverlayCustomData['preview'];
	files?: PrototypeOverlayCustomData['files'];
	showEditor?: boolean;
	showPreview?: boolean;
	prototype?: PrototypeOverlayCustomData;
}

const DEFAULT_REACT_PROTOTYPE_INDEX_CODE =
	"import { StrictMode } from 'react';\nimport { createRoot } from 'react-dom/client';\nimport './styles.css';\n\nimport App from './App';\n\nconst container = document.getElementById('root');\n\nif (container) {\n  const root = createRoot(container);\n  root.render(\n    <StrictMode>\n      <App />\n    </StrictMode>\n  );\n}\n";

export function parsePrototypePatchArtifact(
	artifact: AssistantArtifact,
): AssistantPrototypePatchArtifact | null {
	if (artifact.type !== 'prototype-patch') {
		return null;
	}

	try {
		const parsed = JSON.parse(artifact.content) as AssistantPrototypePatchArtifact;
		if (parsed.kind !== 'prototype_patch' || typeof parsed.targetId !== 'string') {
			return null;
		}

		return {
			...parsed,
			base: normalizePrototypeOverlay(parsed.base),
			next: normalizePrototypeOverlay(parsed.next),
			changedFiles: Array.isArray(parsed.changedFiles)
				? parsed.changedFiles.filter((file) => typeof file === 'string')
				: [],
		};
	} catch {
		return null;
	}
}

export function buildPrototypeFromArtifact(
	artifact: AssistantArtifact,
): PrototypeOverlayCustomData {
	if (artifact.type !== 'prototype-files') {
		return normalizePrototypeOverlay();
	}

	try {
		const parsed = JSON.parse(artifact.content) as PrototypeArtifactPayload;
		return normalizePrototypeOverlay(
			(typeof parsed.prototype === 'object' && parsed.prototype !== null
				? parsed.prototype
				: parsed) as PrototypeOverlayCustomData | PrototypeArtifactPayload,
		);
	} catch {
		return normalizePrototypeOverlay();
	}
}

export function buildPrototypeFromMessageContent(
	content: string,
): PrototypeOverlayCustomData | null {
	const html = extractCodeBlock(content, 'html');
	const css = extractCodeBlock(content, 'css');
	const javascript = extractCodeBlock(content, 'javascript') ?? extractCodeBlock(content, 'js');
	const jsx = extractCodeBlock(content, 'jsx') ?? extractCodeBlock(content, 'tsx');

	if (html && css && javascript) {
		return normalizePrototypeOverlay({
			title: 'Vanilla JS Prototype',
			template: 'vanilla',
			activeFile: '/index.js',
			files: {
				'/index.html': { code: html, hidden: true },
				'/index.js': { code: javascript },
				'/styles.css': { code: css },
			},
		});
	}

	if (jsx && css) {
		return normalizePrototypeOverlay({
			title: 'React Prototype',
			template: 'react',
			activeFile: '/App.jsx',
			files: {
				'/App.jsx': { code: jsx },
				'/index.jsx': {
					code: DEFAULT_REACT_PROTOTYPE_INDEX_CODE,
					hidden: true,
				},
				'/styles.css': { code: css },
			},
		});
	}

	return null;
}
