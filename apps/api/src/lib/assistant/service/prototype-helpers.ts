import { normalizePrototypeOverlay } from '@ai-canvas/shared/schemas';
import type { PrototypeOverlayCustomData, PrototypeOverlayFile } from '@ai-canvas/shared/types';

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

function tryParseJsonObject(value: string): Record<string, unknown> | null {
	const trimmed = value.trim();

	try {
		const parsed = JSON.parse(trimmed);
		return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
	} catch {}

	const firstBrace = trimmed.indexOf('{');
	const lastBrace = trimmed.lastIndexOf('}');
	if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
		return null;
	}

	try {
		const parsed = JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
		return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
	} catch {
		return null;
	}
}

function coercePrototypeFile(value: unknown): PrototypeOverlayFile | null {
	if (typeof value === 'string') {
		return { code: value };
	}

	if (!value || typeof value !== 'object') {
		return null;
	}

	const record = value as Record<string, unknown>;
	const code =
		typeof record.code === 'string'
			? record.code
			: typeof record.content === 'string'
				? record.content
				: typeof record.source === 'string'
					? record.source
					: null;

	if (code === null) {
		return null;
	}

	return {
		code,
		...(typeof record.active === 'boolean' ? { active: record.active } : {}),
		...(typeof record.hidden === 'boolean' ? { hidden: record.hidden } : {}),
		...(typeof record.readOnly === 'boolean' ? { readOnly: record.readOnly } : {}),
	};
}

function coercePrototypeFiles(value: unknown): Record<string, PrototypeOverlayFile> | null {
	if (Array.isArray(value)) {
		const entries = value
			.map((entry) => {
				if (!entry || typeof entry !== 'object') {
					return null;
				}

				const record = entry as Record<string, unknown>;
				const path =
					typeof record.path === 'string'
						? record.path
						: typeof record.filePath === 'string'
							? record.filePath
							: typeof record.name === 'string'
								? record.name
								: null;
				if (!path) {
					return null;
				}

				const file = coercePrototypeFile(record);
				return file ? [path, file] : null;
			})
			.filter((entry): entry is [string, PrototypeOverlayFile] => entry !== null);

		return entries.length > 0 ? Object.fromEntries(entries) : null;
	}

	if (!value || typeof value !== 'object') {
		return null;
	}

	const entries = Object.entries(value as Record<string, unknown>)
		.map(([path, fileValue]) => {
			const file = coercePrototypeFile(fileValue);
			return file ? [path, file] : null;
		})
		.filter((entry): entry is [string, PrototypeOverlayFile] => entry !== null);

	return entries.length > 0 ? Object.fromEntries(entries) : null;
}

function coercePrototypeDependencies(value: unknown): Record<string, string> | undefined {
	if (Array.isArray(value)) {
		const entries = value
			.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
			.map((dependency) => [dependency, '']);

		return entries.length > 0 ? Object.fromEntries(entries) : {};
	}

	if (!value || typeof value !== 'object') {
		return undefined;
	}

	return Object.entries(value as Record<string, unknown>).reduce<Record<string, string>>(
		(result, [name, version]) => {
			if (typeof name !== 'string' || name.trim().length === 0) {
				return result;
			}

			result[name] = typeof version === 'string' ? version : '';
			return result;
		},
		{},
	);
}

export function parsePrototypeArtifactContent(value: string): PrototypeOverlayCustomData | null {
	try {
		const parsed = tryParseJsonObject(value) as
			| (Record<string, unknown> & {
					prototype?: Record<string, unknown>;
			  })
			| null;
		if (!parsed) {
			return null;
		}
		const payload =
			typeof parsed.prototype === 'object' && parsed.prototype !== null ? parsed.prototype : parsed;
		const files = coercePrototypeFiles(payload.files);
		if (!files) {
			return null;
		}

		const prototype = normalizePrototypeOverlay({
			...payload,
			files,
			dependencies: coercePrototypeDependencies(payload.dependencies),
		});
		if (Object.keys(prototype.files).length === 0) {
			return null;
		}
		return prototype;
	} catch {
		return null;
	}
}
