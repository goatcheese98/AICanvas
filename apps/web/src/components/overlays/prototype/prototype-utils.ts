import { normalizePrototypeOverlay } from '@ai-canvas/shared/schemas';
import type { PrototypeOverlayCustomData } from '@ai-canvas/shared/types';

export function getPrototypeStudioPath(canvasId: string, prototypeId: string) {
	return `/canvas/${canvasId}/prototype/${prototypeId}`;
}

function serializePrototypeFiles(files: PrototypeOverlayCustomData['files']) {
	return JSON.stringify(
		Object.keys(files)
			.sort()
			.map((path) => [path, files[path]]),
	);
}

export function serializePrototypeState(input: PrototypeOverlayCustomData) {
	const normalized = normalizePrototypeOverlay(input);
	return JSON.stringify({
		title: normalized.title,
		template: normalized.template,
		activeFile: normalized.activeFile,
		dependencies: Object.keys(normalized.dependencies ?? {})
			.sort()
			.reduce<Record<string, string>>((result, name) => {
				result[name] = normalized.dependencies?.[name] ?? '';
				return result;
			}, {}),
		files: JSON.parse(serializePrototypeFiles(normalized.files)),
	});
}
