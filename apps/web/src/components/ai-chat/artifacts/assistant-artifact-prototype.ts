import { normalizePrototypeOverlay } from '@ai-canvas/shared/schemas';
import type {
	AssistantArtifact,
	AssistantPrototypePatchArtifact,
	PrototypeOverlayCustomData,
} from '@ai-canvas/shared/types';

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
): PrototypeOverlayCustomData | null {
	if (artifact.type !== 'prototype-files') {
		return null;
	}

	try {
		const parsed = JSON.parse(artifact.content) as PrototypeArtifactPayload;
		const payload =
			typeof parsed.prototype === 'object' && parsed.prototype !== null ? parsed.prototype : parsed;
		if (typeof payload.files !== 'object' || payload.files === null) {
			return null;
		}

		const prototype = normalizePrototypeOverlay(payload);
		if (Object.keys(prototype.files).length === 0) {
			return null;
		}

		const entryPath = prototype.template === 'react' ? '/index.jsx' : '/index.js';
		return prototype.files[entryPath] ? prototype : null;
	} catch {
		return null;
	}
}
