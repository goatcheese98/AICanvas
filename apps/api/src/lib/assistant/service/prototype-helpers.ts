import { normalizePrototypeOverlay } from '@ai-canvas/shared/schemas';
import type { PrototypeOverlayCustomData } from '@ai-canvas/shared/types';

export function serializePrototypeArtifact(prototype: PrototypeOverlayCustomData): string {
	return JSON.stringify(
		{
			title: prototype.title,
			template: prototype.template,
			activeFile: prototype.activeFile,
			dependencies: prototype.dependencies,
			preview: prototype.preview,
			files: prototype.files,
			showEditor: prototype.showEditor,
			showPreview: prototype.showPreview,
		},
		null,
		2,
	);
}

export function parsePrototypeArtifactContent(value: string): PrototypeOverlayCustomData | null {
	try {
		const parsed = JSON.parse(value) as Record<string, unknown> & {
			prototype?: Record<string, unknown>;
		};
		const payload =
			typeof parsed.prototype === 'object' && parsed.prototype !== null
				? parsed.prototype
				: parsed;

		if (typeof payload.files !== 'object' || payload.files === null) {
			return null;
		}

		const prototype = normalizePrototypeOverlay(payload);
		if (Object.keys(prototype.files).length === 0) {
			return null;
		}
		return prototype;
	} catch {
		return null;
	}
}
