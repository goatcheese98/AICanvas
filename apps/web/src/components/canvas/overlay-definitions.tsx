import { OVERLAY_TYPES } from '@ai-canvas/shared/constants';
import {
	normalizeKanbanOverlay,
	normalizeMarkdownOverlay,
	normalizeNewLexOverlay,
	normalizePrototypeOverlay,
	normalizeWebEmbedOverlay,
} from '@ai-canvas/shared/schemas';
import type {
	KanbanOverlayCustomData,
	MarkdownOverlayCustomData,
	NewLexOverlayCustomData,
	OverlayType,
	PrototypeOverlayCustomData,
	WebEmbedOverlayCustomData,
} from '@ai-canvas/shared/types';
import { KanbanPreviewCard } from '../overlays/kanban';
import { LexicalPreviewCard } from '../overlays/lexical';
import { MarkdownNote } from '../overlays/markdown';
import { WebEmbed } from '../overlays/web-embed';
import { DEFAULT_MARKDOWN_CONTENT } from './overlay-defaults';
import { bumpElementVersion } from './overlay-definition-types';
import type {
	OverlayCustomDataMap,
	OverlayDefinition,
	TypedOverlayCanvasElement,
} from './overlay-definition-types';

// Re-export types so existing imports still work
export type {
	TypedOverlayCanvasElement,
	OverlayUpdatePayloadMap,
} from './overlay-definition-types';

type MarkdownElementStyle = NonNullable<OverlayCustomDataMap['markdown']> extends never
	? never
	: NonNullable<
			Parameters<OverlayDefinition<'markdown'>['applyUpdate']>[1]['elementStyle']
	  >;

function serializeNewLexComments(value: NewLexOverlayCustomData['comments']) {
	return JSON.stringify(value ?? []);
}

function hasSerializedChange(current: unknown, next: unknown) {
	return JSON.stringify(current) !== JSON.stringify(next);
}

function hasMarkdownElementStyleChange(
	element: TypedOverlayCanvasElement<MarkdownOverlayCustomData>,
	elementStyle?: MarkdownElementStyle,
): boolean {
	if (!elementStyle) {
		return false;
	}

	return (
		(elementStyle.backgroundColor !== undefined &&
			elementStyle.backgroundColor !== element.backgroundColor) ||
		(elementStyle.strokeColor !== undefined &&
			elementStyle.strokeColor !== element.strokeColor) ||
		(elementStyle.strokeWidth !== undefined && elementStyle.strokeWidth !== element.strokeWidth) ||
		(elementStyle.roundness !== undefined && elementStyle.roundness !== element.roundness)
	);
}

function applyMarkdownElementStyle(
	element: TypedOverlayCanvasElement<MarkdownOverlayCustomData>,
	elementStyle?: MarkdownElementStyle,
) {
	if (!elementStyle) {
		return element;
	}

	return {
		...element,
		...(elementStyle.backgroundColor !== undefined
			? { backgroundColor: elementStyle.backgroundColor }
			: {}),
		...(elementStyle.strokeColor !== undefined ? { strokeColor: elementStyle.strokeColor } : {}),
		...(elementStyle.strokeWidth !== undefined ? { strokeWidth: elementStyle.strokeWidth } : {}),
		...(elementStyle.roundness !== undefined ? { roundness: elementStyle.roundness } : {}),
	};
}

const overlayDefinitions: { [K in OverlayType]: OverlayDefinition<K> } = {
	markdown: {
		defaultSize: { width: 400, height: 450 },
		normalizeCustomData: (input) =>
			normalizeMarkdownOverlay(input as Partial<MarkdownOverlayCustomData>),
		createCustomData: (options) =>
			normalizeMarkdownOverlay({
				title: typeof options.customData?.title === 'string' ? options.customData.title : undefined,
				content:
					typeof options.customData?.content === 'string'
						? options.customData.content
						: DEFAULT_MARKDOWN_CONTENT,
				images:
					typeof options.customData?.images === 'object'
						? (options.customData.images as Record<string, string>)
						: undefined,
				settings:
					typeof options.customData?.settings === 'object'
						? (options.customData.settings as Record<string, unknown>)
						: undefined,
				editorMode: options.customData?.editorMode === 'hybrid' ? 'hybrid' : undefined,
			}),
		applyUpdate: (element, payload) => {
			const current = normalizeMarkdownOverlay(element.customData);
			const nextCustomData = normalizeMarkdownOverlay({
				...current,
				title: payload.title ?? current.title,
				content: payload.content,
				images: payload.images ?? current.images,
				settings: payload.settings ?? current.settings,
				editorMode: payload.editorMode ?? current.editorMode,
			});
			const didCustomDataChange = hasSerializedChange(current, nextCustomData);
			const didElementStyleChange = hasMarkdownElementStyleChange(
				element,
				payload.elementStyle,
			);

			if (!didCustomDataChange && !didElementStyleChange) {
				return element as TypedOverlayCanvasElement<MarkdownOverlayCustomData>;
			}

			return bumpElementVersion({
				...applyMarkdownElementStyle(element, payload.elementStyle),
				customData: nextCustomData,
			}) as TypedOverlayCanvasElement<MarkdownOverlayCustomData>;
		},
		render: ({ element, isSelected, isActive, mode, onChange, onActivityChange }) => (
			<MarkdownNote
				element={element}
				isSelected={isSelected}
				isActive={isActive}
				mode={mode}
				onChange={(_elementId, content, images, title, settings, editorMode, elementStyle) =>
					onChange({ content, images, title, settings, editorMode, elementStyle })
				}
				onActivityChange={onActivityChange}
			/>
		),
	},
	newlex: {
		defaultSize: { width: 500, height: 400 },
		normalizeCustomData: normalizeNewLexOverlay,
		// Reference-only: new cards only store title, full data lives in resource record
		createCustomData: (options) =>
			normalizeNewLexOverlay({
				title: typeof options.customData?.title === 'string' ? options.customData.title : undefined,
			}),
		applyUpdate: (element, payload) => {
			const current = normalizeNewLexOverlay(element.customData);
			const nextCustomData = normalizeNewLexOverlay({
				...current,
				commentsPanelOpen: false,
				...payload,
			});

			const didChange =
				nextCustomData.title !== current.title ||
				nextCustomData.lexicalState !== current.lexicalState ||
				serializeNewLexComments(nextCustomData.comments) !==
					serializeNewLexComments(current.comments);

			if (!didChange) return element;

			return bumpElementVersion({
				...element,
				customData: nextCustomData,
			});
		},
		render: ({ element, isSelected, onOpen }) => (
			<LexicalPreviewCard element={element} isSelected={isSelected} onOpen={onOpen} />
		),
	},
	kanban: {
		defaultSize: { width: 1050, height: 900 },
		normalizeCustomData: (input) =>
			normalizeKanbanOverlay(input as Partial<KanbanOverlayCustomData>),
		// Reference-only: new cards only store title, full data lives in resource record
		createCustomData: (options) =>
			normalizeKanbanOverlay({
				title: typeof options.customData?.title === 'string' ? options.customData.title : undefined,
			}),
		applyUpdate: (element, payload) => {
			const current = normalizeKanbanOverlay(element.customData);
			const nextCustomData = normalizeKanbanOverlay(payload);
			if (!hasSerializedChange(current, nextCustomData)) {
				return element;
			}

			return bumpElementVersion({
				...element,
				customData: nextCustomData,
			});
		},
		render: ({ element, isSelected, onOpen }) => (
			<KanbanPreviewCard element={element} isSelected={isSelected} onOpen={onOpen} />
		),
	},
	'web-embed': {
		defaultSize: { width: 960, height: 720 },
		normalizeCustomData: normalizeWebEmbedOverlay,
		createCustomData: (options) =>
			normalizeWebEmbedOverlay({
				url: typeof options.customData?.url === 'string' ? options.customData.url : '',
			}),
		applyUpdate: (element, payload) => {
			const current = normalizeWebEmbedOverlay(
				element.customData as Partial<WebEmbedOverlayCustomData>,
			);
			const nextCustomData = normalizeWebEmbedOverlay({
				...current,
				url: payload.url,
			});
			if (!hasSerializedChange(current, nextCustomData)) {
				return element;
			}

			return bumpElementVersion({
				...element,
				customData: nextCustomData,
			});
		},
		render: ({ element, isSelected, isActive, mode, onChange, onActivityChange }) => (
			<WebEmbed
				element={element}
				isSelected={isSelected}
				isActive={isActive}
				mode={mode}
				onChange={(_elementId, url) => onChange({ url })}
				onActivityChange={onActivityChange}
			/>
		),
	},
	prototype: {
		defaultSize: { width: 520, height: 320 },
		normalizeCustomData: normalizePrototypeOverlay,
		// Reference-only: new cards only store title/template, full data lives in resource record
		createCustomData: (options) =>
			normalizePrototypeOverlay({
				title: typeof options.customData?.title === 'string' ? options.customData.title : undefined,
				template: options.customData?.template === 'vanilla' ? 'vanilla' : undefined,
			}),
		applyUpdate: (element, payload) => {
			const current = normalizePrototypeOverlay(element.customData);
			const nextCustomData = normalizePrototypeOverlay({
				...current,
				...payload,
			});
			if (!hasSerializedChange(current, nextCustomData)) {
				return element as TypedOverlayCanvasElement<PrototypeOverlayCustomData>;
			}

			return bumpElementVersion({
				...element,
				customData: nextCustomData,
			}) as TypedOverlayCanvasElement<PrototypeOverlayCustomData>;
		},
		render: ({ element, isSelected, onOpen }) => (
			<PrototypeCard element={element} isSelected={isSelected} onOpen={onOpen} />
		),
	},
};

function PrototypeCard({
	element,
	isSelected,
	onOpen,
}: {
	element: TypedOverlayCanvasElement<PrototypeOverlayCustomData>;
	isSelected: boolean;
	onOpen?: () => void;
}) {
	const prototype = normalizePrototypeOverlay(element.customData);
	const snapshot = prototype.resourceSnapshot;
	const title = snapshot?.title ?? prototype.title;
	const eyebrow = snapshot?.display?.badge ?? 'Prototype';
	const description =
		snapshot?.display?.summary ?? snapshot?.display?.subtitle ?? 'Interactive concept preview';

	return (
		<div
			className={`flex h-full w-full flex-col overflow-hidden rounded-[22px] border bg-white shadow-[0_12px_30px_rgba(15,23,42,0.08)] ${
				isSelected ? 'border-[#4d55cc]' : 'border-stone-200'
			}`}
		>
			<div
				className="px-5 py-4 text-white"
				style={{
					background: 'linear-gradient(135deg, #eff6ff, #eef2ff)',
				}}
			>
				<div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/80">
					{eyebrow}
				</div>
				<div className="mt-2 text-lg font-semibold text-white">{title}</div>
				<div className="mt-1 text-sm text-white/85">{description}</div>
			</div>
			<div className="flex flex-1 flex-col gap-3 px-5 py-4">
				<div className="flex items-center justify-between text-xs text-stone-500">
					<span className="rounded-full bg-stone-100 px-2.5 py-1 font-medium uppercase tracking-[0.12em]">
						{prototype.template}
					</span>
					<span>{Object.keys(prototype.files).length} files</span>
				</div>
				<div className="mt-auto">
					<div className="rounded-2xl bg-stone-50 px-3 py-2">
						<div className="text-[10px] uppercase tracking-[0.14em] text-stone-400">
							Active file
						</div>
						<div className="text-sm font-semibold text-stone-700">
							{prototype.activeFile ?? 'None'}
						</div>
					</div>
				</div>
				<button
					type="button"
					onClick={onOpen}
					disabled={!onOpen}
					className="self-end rounded-full border border-stone-200 bg-white px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-600 transition-colors hover:bg-stone-50 disabled:cursor-default disabled:opacity-70"
				>
					Open Prototype
				</button>
			</div>
		</div>
	);
}

export function isOverlayType(value: unknown): value is OverlayType {
	return typeof value === 'string' && (OVERLAY_TYPES as readonly string[]).includes(value);
}

export function getOverlayDefinition<K extends OverlayType>(type: K): OverlayDefinition<K> {
	return overlayDefinitions[type];
}

export function normalizeOverlayElement<K extends OverlayType>(
	type: K,
	element: TypedOverlayCanvasElement,
): TypedOverlayCanvasElement<OverlayCustomDataMap[K]> {
	return {
		...element,
		customData: getOverlayDefinition(type).normalizeCustomData(
			element.customData as unknown as Partial<OverlayCustomDataMap[K]>,
		),
	} as TypedOverlayCanvasElement<OverlayCustomDataMap[K]>;
}
