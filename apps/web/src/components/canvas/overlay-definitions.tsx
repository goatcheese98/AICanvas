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
import { KanbanBoard } from '../overlays/kanban';
import { LexicalNote } from '../overlays/lexical';
import { MarkdownNote } from '../overlays/markdown';
import { WebEmbed } from '../overlays/web-embed';
import { DEFAULT_MARKDOWN_CONTENT, createDefaultKanbanColumns } from './overlay-defaults';
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

function serializeNewLexComments(value: NewLexOverlayCustomData['comments']) {
	return JSON.stringify(value ?? []);
}

function hasSerializedChange(current: unknown, next: unknown) {
	return JSON.stringify(current) !== JSON.stringify(next);
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
			const didElementStyleChange =
				(payload.elementStyle?.backgroundColor !== undefined &&
					payload.elementStyle.backgroundColor !== element.backgroundColor) ||
				(payload.elementStyle?.strokeColor !== undefined &&
					payload.elementStyle.strokeColor !== element.strokeColor) ||
				(payload.elementStyle?.strokeWidth !== undefined &&
					payload.elementStyle.strokeWidth !== element.strokeWidth) ||
				(payload.elementStyle?.roundness !== undefined &&
					payload.elementStyle.roundness !== element.roundness);

			if (!didCustomDataChange && !didElementStyleChange) {
				return element as TypedOverlayCanvasElement<MarkdownOverlayCustomData>;
			}

			return bumpElementVersion({
				...element,
				...(payload.elementStyle?.backgroundColor !== undefined
					? { backgroundColor: payload.elementStyle.backgroundColor }
					: {}),
				...(payload.elementStyle?.strokeColor !== undefined
					? { strokeColor: payload.elementStyle.strokeColor }
					: {}),
				...(payload.elementStyle?.strokeWidth !== undefined
					? { strokeWidth: payload.elementStyle.strokeWidth }
					: {}),
				...(payload.elementStyle?.roundness !== undefined
					? { roundness: payload.elementStyle.roundness }
					: {}),
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
		createCustomData: (options) =>
			normalizeNewLexOverlay({
				title: typeof options.customData?.title === 'string' ? options.customData.title : undefined,
				lexicalState:
					typeof options.customData?.lexicalState === 'string'
						? options.customData.lexicalState
						: '',
				comments: Array.isArray(options.customData?.comments) ? options.customData.comments : [],
				commentsPanelOpen:
					typeof options.customData?.commentsPanelOpen === 'boolean'
						? options.customData.commentsPanelOpen
						: false,
				version: typeof options.customData?.version === 'number' ? options.customData.version : 1,
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
		render: ({ element, isSelected, isActive, mode, onChange, onActivityChange }) => (
			<LexicalNote
				element={element}
				isSelected={isSelected}
				isActive={isActive}
				mode={mode}
				onChange={(_elementId, updates) => onChange(updates)}
				onActivityChange={onActivityChange}
			/>
		),
	},
	kanban: {
		defaultSize: { width: 1050, height: 900 },
		normalizeCustomData: (input) =>
			normalizeKanbanOverlay(input as Partial<KanbanOverlayCustomData>),
		createCustomData: (options) =>
			normalizeKanbanOverlay({
				title:
					typeof options.customData?.title === 'string' ? options.customData.title : 'Kanban Board',
				columns: Array.isArray(options.customData?.columns)
					? (options.customData.columns as KanbanOverlayCustomData['columns'])
					: createDefaultKanbanColumns(),
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
		render: ({ element, isSelected, isActive, mode, onChange, onActivityChange }) => (
			<KanbanBoard
				element={element}
				mode={mode}
				isSelected={isSelected}
				isActive={isActive}
				onChange={(_elementId, data) => onChange(data)}
				onActivityChange={onActivityChange}
			/>
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
		createCustomData: (options) =>
			normalizePrototypeOverlay({
				title: typeof options.customData?.title === 'string' ? options.customData.title : undefined,
				template: options.customData?.template === 'vanilla' ? 'vanilla' : undefined,
				files:
					typeof options.customData?.files === 'object'
						? (options.customData.files as PrototypeOverlayCustomData['files'])
						: undefined,
				dependencies:
					typeof options.customData?.dependencies === 'object'
						? (options.customData.dependencies as Record<string, string>)
						: undefined,
				preview:
					typeof options.customData?.preview === 'object'
						? (options.customData.preview as PrototypeOverlayCustomData['preview'])
						: undefined,
				activeFile:
					typeof options.customData?.activeFile === 'string'
						? options.customData.activeFile
						: undefined,
				showEditor:
					typeof options.customData?.showEditor === 'boolean'
						? options.customData.showEditor
						: undefined,
				showPreview:
					typeof options.customData?.showPreview === 'boolean'
						? options.customData.showPreview
						: undefined,
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
		render: ({ element, isSelected }) => (
			<PrototypeCard element={element} isSelected={isSelected} />
		),
	},
};

function PrototypeCard({
	element,
	isSelected,
}: {
	element: TypedOverlayCanvasElement<PrototypeOverlayCustomData>;
	isSelected: boolean;
}) {
	const prototype = normalizePrototypeOverlay(element.customData);
	const snapshot = prototype.resourceSnapshot;
	const preview = prototype.preview;
	const title = snapshot?.title ?? preview?.title ?? prototype.title;
	const eyebrow = snapshot?.display?.badge ?? preview?.eyebrow ?? 'Prototype';
	const description =
		snapshot?.display?.summary ?? snapshot?.display?.subtitle ?? preview?.description ?? 'Interactive concept preview';
	const visibleFileCount = Object.values(prototype.files).filter((file) => !file.hidden).length;

	return (
		<div
			className={`flex h-full w-full flex-col overflow-hidden rounded-[22px] border bg-white shadow-[0_12px_30px_rgba(15,23,42,0.08)] ${
				isSelected ? 'border-[#4d55cc]' : 'border-stone-200'
			}`}
		>
			<div
				className="px-5 py-4 text-white"
				style={{
					background: preview?.background ?? 'linear-gradient(135deg, #eff6ff, #eef2ff)',
				}}
			>
				<div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/80">
					{eyebrow}
				</div>
				<div className="mt-2 text-lg font-semibold text-white">
					{title}
				</div>
				<div className="mt-1 text-sm text-white/85">
					{description}
				</div>
			</div>
			<div className="flex flex-1 flex-col gap-3 px-5 py-4">
				<div className="flex items-center justify-between text-xs text-stone-500">
					<span className="rounded-full bg-stone-100 px-2.5 py-1 font-medium uppercase tracking-[0.12em]">
						{prototype.template}
					</span>
					<span>{visibleFileCount} files</span>
				</div>
				{preview?.badges && preview.badges.length > 0 ? (
					<div className="flex flex-wrap gap-2">
						{preview.badges.map((badge) => (
							<span
								key={badge}
								className="rounded-full border border-stone-200 px-2.5 py-1 text-[11px] font-medium text-stone-600"
							>
								{badge}
							</span>
						))}
					</div>
				) : null}
				<div className="mt-auto flex flex-wrap gap-2">
					{preview?.metrics && preview.metrics.length > 0 ? (
						preview.metrics.map((metric) => (
							<div
								key={`${metric.label}-${metric.value}`}
								className="rounded-2xl bg-stone-50 px-3 py-2"
							>
								<div className="text-[10px] uppercase tracking-[0.14em] text-stone-400">
									{metric.label}
								</div>
								<div className="text-sm font-semibold text-stone-700">{metric.value}</div>
							</div>
						))
					) : (
						<div className="rounded-2xl bg-stone-50 px-3 py-2">
							<div className="text-[10px] uppercase tracking-[0.14em] text-stone-400">
								Active file
							</div>
							<div className="text-sm font-semibold text-stone-700">
								{prototype.activeFile ?? 'None'}
							</div>
						</div>
					)}
				</div>
				<div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-400">
					Double-click to open
				</div>
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
