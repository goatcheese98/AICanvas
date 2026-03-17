import {
	EXCALIDRAW_FONT_OPTIONS,
	getExcalidrawFontFamily,
} from '@/components/canvas/excalidraw-element-style';
import {
	DEFAULT_MARKDOWN_NOTE_SETTINGS,
	MARKDOWN_SYSTEM_FONT_STACK,
	type normalizeMarkdownOverlay,
} from '@ai-canvas/shared/schemas';
import type { MarkdownEditorMode, MarkdownOverlayCustomData } from '@ai-canvas/shared/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { ReactNode } from 'react';

export type MarkdownViewMode = MarkdownEditorMode | 'preview';
export type UtilityPanel = 'none' | 'style' | 'image';
export type ControlsLayout = 'hidden' | 'icon' | 'full';

export const FONT_OPTIONS = EXCALIDRAW_FONT_OPTIONS.map((option) => ({
	id: option.id,
	label: option.label,
	font: getExcalidrawFontFamily(option.family) ?? DEFAULT_MARKDOWN_NOTE_SETTINGS.font,
}));

const EXTRA_MARKDOWN_FONT_OPTIONS = [
	{
		id: 'markdown-default',
		label: 'System UI',
		font: MARKDOWN_SYSTEM_FONT_STACK,
	},
	{
		id: 'markdown-serif',
		label: 'Serif',
		font: 'Georgia, serif',
	},
	{
		id: 'markdown-dm-sans',
		label: 'DM Sans',
		font: '"DM Sans", system-ui, sans-serif',
	},
	{
		id: 'markdown-playfair',
		label: 'Playfair',
		font: '"Playfair Display", Georgia, serif',
	},
	{
		id: 'markdown-mono',
		label: 'Mono',
		font: '"SFMono-Regular", "SF Mono", Menlo, Monaco, Consolas, "Liberation Mono", monospace',
	},
	{
		id: 'markdown-anonymous-pro',
		label: 'Anonymous Pro',
		font: '"Anonymous Pro", "SFMono-Regular", "SF Mono", Menlo, Monaco, Consolas, monospace',
	},
] as const;

export const FONT_OPTIONS_WITH_MARKDOWN_EXTRAS = [...FONT_OPTIONS, ...EXTRA_MARKDOWN_FONT_OPTIONS];

export const MODE_OPTIONS = [
	{ mode: 'raw', label: 'Raw', icon: 'raw' },
	{ mode: 'hybrid', label: 'Hybrid', icon: 'hybrid' },
	{ mode: 'preview', label: 'Preview', icon: 'preview' },
] as const;

export const NOTE_SEGMENTED_SHELL =
	'inline-flex items-center rounded-[8px] border border-stone-300/70 bg-white/42 p-[2px] shadow-sm backdrop-blur-md';
export const NOTE_SEGMENTED_BUTTON =
	'h-7 rounded-[6px] px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] transition-colors';
export const NOTE_SEGMENTED_ACTIVE =
	'border border-white/35 bg-[color-mix(in_srgb,var(--color-accent-bg)_58%,transparent)] text-[var(--color-accent-text)] shadow-[0_1px_3px_rgba(15,23,42,0.12)] backdrop-blur-sm';
export const NOTE_SEGMENTED_IDLE =
	'text-stone-600 hover:bg-white/24 hover:text-[var(--color-accent-text)]';
export const NOTE_TOOL_BUTTON =
	'inline-flex h-7 items-center gap-1.5 rounded-[8px] border px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] transition-colors backdrop-blur-md';
export const NOTE_TOOL_IDLE =
	'border-stone-300/70 bg-white/42 text-stone-700 hover:border-[var(--color-accent-border)] hover:bg-white/24 hover:text-[var(--color-accent-text)]';
export const NOTE_PANEL =
	'absolute right-0 top-[calc(100%+0.5rem)] z-20 rounded-[12px] border border-stone-200 bg-white p-3 shadow-xl';
export const NOTE_RESET_BUTTON =
	'rounded-[8px] border border-stone-300 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-stone-600 transition-colors hover:border-[var(--color-accent-border)] hover:bg-[var(--color-accent-hover)] hover:text-[var(--color-accent-text)]';
export const MAX_MARKDOWN_TITLE_LENGTH = 8;
export const MARKDOWN_HEADER_HIDDEN_BREAKPOINT = 320;
export const MARKDOWN_HEADER_FULL_BREAKPOINT = 570;
export const TITLE_COMPACT_BREAKPOINT = 220;

export const NOTE_EDGE_OPTIONS = [
	{
		id: 'square',
		label: 'Square',
		roundness: null,
	},
	{
		id: 'rounded',
		label: 'Rounded',
		roundness: { type: 3, value: 18 } as const,
	},
	{
		id: 'pill',
		label: 'Pill',
		roundness: { type: 1 } as const,
	},
] as const;

export function serializeImages(images: Record<string, string> | undefined) {
	return JSON.stringify(images ?? {});
}

export function serializeSettings(settings: MarkdownOverlayCustomData['settings']) {
	return JSON.stringify(settings);
}

export function serializeNoteState(input: {
	content: string;
	images: Record<string, string> | undefined;
	title: string;
	settings: MarkdownOverlayCustomData['settings'];
	editorMode: MarkdownOverlayCustomData['editorMode'];
}) {
	return JSON.stringify({
		content: input.content,
		images: input.images ?? {},
		title: input.title,
		settings: input.settings,
		editorMode: input.editorMode,
	});
}

export function serializeOverlayState(input: ReturnType<typeof normalizeMarkdownOverlay>) {
	return serializeNoteState({
		content: input.content,
		images: input.images ?? {},
		title: input.title ?? 'Markdown',
		settings: input.settings,
		editorMode: input.editorMode ?? 'raw',
	});
}

export function abbreviateMarkdownTitle(title: string) {
	const compact = title.replace(/\s+/g, '');
	return (compact.slice(0, 2) || title.slice(0, 2) || 'MD').toUpperCase();
}

export function getRoundnessOptionId(roundness: ExcalidrawElement['roundness'] | undefined) {
	if (!roundness) return 'square';
	if (roundness.type === 1 || roundness.type === 2) return 'pill';
	return 'rounded';
}

export function renderModeIcon(icon: (typeof MODE_OPTIONS)[number]['icon']): ReactNode {
	if (icon === 'raw') {
		return (
			<svg
				width="13"
				height="13"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
			>
				<path d="m18 16 4-4-4-4" />
				<path d="m6 8-4 4 4 4" />
				<path d="m14.5 4-5 16" />
			</svg>
		);
	}
	if (icon === 'hybrid') {
		return (
			<svg
				width="13"
				height="13"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
			>
				<rect x="3" y="4" width="7" height="7" rx="1.5" />
				<rect x="14" y="4" width="7" height="7" rx="1.5" />
				<rect x="3" y="14" width="7" height="7" rx="1.5" />
				<path d="M14 18h7" />
			</svg>
		);
	}
	return (
		<svg
			width="13"
			height="13"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
		>
			<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
			<circle cx="12" cy="12" r="3" />
		</svg>
	);
}
