import type { ReactElement } from 'react';
import type {
	KanbanOverlayCustomData,
	MarkdownOverlayCustomData,
	NewLexOverlayCustomData,
	OverlayCustomData,
	OverlayType,
	PrototypeOverlayCustomData,
	WebEmbedOverlayCustomData,
} from '@ai-canvas/shared/types';
import {
	normalizeKanbanOverlay,
	normalizeMarkdownOverlay,
	normalizeNewLexOverlay,
	normalizePrototypeOverlay,
	normalizeWebEmbedOverlay,
} from '@ai-canvas/shared/schemas';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { OVERLAY_TYPES } from '@ai-canvas/shared/constants';
import { MarkdownNote } from '../overlays/markdown';
import { LexicalNote } from '../overlays/lexical';
import { KanbanBoard } from '../overlays/kanban';
import { PrototypeNote } from '../overlays/prototype';
import { WebEmbed } from '../overlays/web-embed';

export type TypedOverlayCanvasElement<T extends OverlayCustomData = OverlayCustomData> =
	ExcalidrawElement & { customData: T };

const normalizedOverlayElementCache = new WeakMap<
	TypedOverlayCanvasElement,
	TypedOverlayCanvasElement
>();

type OverlayCustomDataMap = {
	markdown: MarkdownOverlayCustomData;
	newlex: NewLexOverlayCustomData;
	kanban: KanbanOverlayCustomData;
	'web-embed': WebEmbedOverlayCustomData;
	prototype: PrototypeOverlayCustomData;
};

export type OverlayUpdatePayloadMap = {
	markdown: {
		title?: string;
		content: string;
		images?: Record<string, string>;
		settings?: MarkdownOverlayCustomData['settings'];
		editorMode?: MarkdownOverlayCustomData['editorMode'];
		elementStyle?: {
			backgroundColor?: string;
			strokeColor?: string;
			strokeWidth?: number;
			roundness?: ExcalidrawElement['roundness'];
		};
	};
	newlex: {
		title?: string;
		lexicalState?: string;
		comments?: NewLexOverlayCustomData['comments'];
	};
	kanban: KanbanOverlayCustomData;
	'web-embed': {
		url: string;
	};
	prototype: {
		title?: string;
		template?: PrototypeOverlayCustomData['template'];
		files?: PrototypeOverlayCustomData['files'];
		dependencies?: Record<string, string>;
		preview?: PrototypeOverlayCustomData['preview'];
		activeFile?: string;
		showEditor?: boolean;
		showPreview?: boolean;
	};
};

interface CreateOverlayElementOptions {
	type: OverlayType;
	x: number;
	y: number;
	width?: number;
	height?: number;
	customData?: Record<string, unknown>;
}

interface OverlayRenderProps<K extends OverlayType> {
	element: TypedOverlayCanvasElement<OverlayCustomDataMap[K]>;
	isSelected: boolean;
	onChange: (payload: OverlayUpdatePayloadMap[K]) => void;
	onEditingChange?: (isEditing: boolean) => void;
}

interface OverlayDefinition<K extends OverlayType> {
	defaultSize: { width: number; height: number };
	normalizeCustomData: (
		input?: Partial<OverlayCustomDataMap[K]> | Record<string, unknown> | null,
	) => OverlayCustomDataMap[K];
	createCustomData: (options: CreateOverlayElementOptions) => OverlayCustomDataMap[K];
	applyUpdate: (
		element: TypedOverlayCanvasElement<OverlayCustomDataMap[K]>,
		payload: OverlayUpdatePayloadMap[K],
	) => TypedOverlayCanvasElement<OverlayCustomDataMap[K]>;
	render: (props: OverlayRenderProps<K>) => ReactElement;
}

function bumpElementVersion<T extends ExcalidrawElement>(element: T): T {
	return {
		...element,
		version: (element.version ?? 0) + 1,
		versionNonce: Math.floor(Math.random() * 2 ** 31),
	};
}

function createDefaultKanbanColumns(): KanbanOverlayCustomData['columns'] {
	return [
		{
			id: crypto.randomUUID(),
			title: 'To Do',
			color: '#6965db',
			cards: [
				{
					id: crypto.randomUUID(),
					title: 'Capture the goal',
					description: 'Write down what this board is helping you ship before you add more cards.',
					priority: 'medium' as const,
					labels: ['setup'],
					checklist: [
						{ text: 'Name the outcome', done: false },
						{ text: 'Note the deadline', done: false },
					],
				},
				{
					id: crypto.randomUUID(),
					title: 'List the next actions',
					description: 'Break the work into concrete cards so the first move is obvious.',
					priority: 'low' as const,
					labels: ['planning'],
					checklist: [],
				},
			],
		},
		{
			id: crypto.randomUUID(),
			title: 'In Progress',
			color: '#c28a42',
			cards: [
				{
					id: crypto.randomUUID(),
					title: 'Shape the first pass',
					description: 'Use this lane for the card you are actively moving right now.',
					priority: 'high' as const,
					labels: ['focus'],
					checklist: [
						{ text: 'Finish the rough draft', done: true },
						{ text: 'Review the flow', done: false },
					],
				},
			],
		},
		{
			id: crypto.randomUUID(),
			title: 'Done',
			color: '#557768',
			cards: [
				{
					id: crypto.randomUUID(),
					title: 'Board ready',
					description: 'Keep a finished card here so new boards do not feel empty.',
					priority: 'low' as const,
					labels: ['starter'],
					checklist: [{ text: 'Starter template loaded', done: true }],
				},
			],
		},
	];
}

const DEFAULT_MARKDOWN_CONTENT = `# <img src="https://cdn.jsdelivr.net/gh/dcurtis/markdown-mark/svg/markdown-mark.svg" alt="Markdown icon" width="28" height="28" /> New Note

Double-click to edit this note.

## Bullet List
- First list item
- Second list item

## Checklist
- [ ] Draft the content
- [x] Review the layout

## Code Example
\`\`\`javascript
const example = "Hello World";
console.log(example);
\`\`\`

## Links Table
| Resource | Link |
| -------- | ---- |
| Markdown Guide | [CommonMark](https://commonmark.org/) |
| GFM Spec | [GitHub Flavored Markdown](https://github.github.com/gfm/) |

> Tip: switch between Raw, Hybrid, and Preview to explore the note.`;

function serializeNewLexComments(value: NewLexOverlayCustomData['comments']) {
	return JSON.stringify(value ?? []);
}

const overlayDefinitions: { [K in OverlayType]: OverlayDefinition<K> } = {
	markdown: {
		defaultSize: { width: 400, height: 450 },
		normalizeCustomData: (input) => normalizeMarkdownOverlay(input as Partial<MarkdownOverlayCustomData>),
		createCustomData: (options) =>
			normalizeMarkdownOverlay({
				title:
					typeof options.customData?.title === 'string'
						? options.customData.title
						: undefined,
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
		render: ({ element, isSelected, onChange, onEditingChange }) => (
			<MarkdownNote
				element={element}
				isSelected={isSelected}
				onChange={(elementId, content, images, title, settings, editorMode, elementStyle) =>
					onChange({ content, images, title, settings, editorMode, elementStyle })
				}
				onEditingChange={onEditingChange}
			/>
		),
	},
	newlex: {
		defaultSize: { width: 500, height: 400 },
		normalizeCustomData: normalizeNewLexOverlay,
		createCustomData: (options) =>
			normalizeNewLexOverlay({
				title:
					typeof options.customData?.title === 'string'
						? options.customData.title
						: undefined,
				lexicalState:
					typeof options.customData?.lexicalState === 'string'
						? options.customData.lexicalState
						: '',
				comments: Array.isArray(options.customData?.comments)
					? options.customData.comments
					: [],
				commentsPanelOpen:
					typeof options.customData?.commentsPanelOpen === 'boolean'
						? options.customData.commentsPanelOpen
						: false,
				version:
					typeof options.customData?.version === 'number' ? options.customData.version : 1,
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
		render: ({ element, isSelected, onChange, onEditingChange }) => (
			<LexicalNote
				element={element}
				isSelected={isSelected}
				onChange={(_elementId, updates) => onChange(updates)}
				onEditingChange={onEditingChange}
			/>
		),
	},
	kanban: {
		defaultSize: { width: 1050, height: 900 },
		normalizeCustomData: (input) => normalizeKanbanOverlay(input as Partial<KanbanOverlayCustomData>),
		createCustomData: (options) =>
			normalizeKanbanOverlay({
				title:
					typeof options.customData?.title === 'string'
						? options.customData.title
						: 'Kanban Board',
				columns: Array.isArray(options.customData?.columns)
					? (options.customData.columns as KanbanOverlayCustomData['columns'])
					: createDefaultKanbanColumns(),
			}),
		applyUpdate: (element, payload) =>
			bumpElementVersion({
				...element,
				customData: normalizeKanbanOverlay(payload),
			}),
		render: ({ element, isSelected, onChange, onEditingChange }) => (
			<KanbanBoard
				element={element}
				isSelected={isSelected}
				onChange={(_elementId, data) => onChange(data)}
				onEditingChange={onEditingChange}
			/>
		),
	},
	'web-embed': {
		defaultSize: { width: 640, height: 480 },
		normalizeCustomData: normalizeWebEmbedOverlay,
		createCustomData: (options) =>
			normalizeWebEmbedOverlay({
				url: typeof options.customData?.url === 'string' ? options.customData.url : '',
			}),
		applyUpdate: (element, payload) =>
			bumpElementVersion({
				...element,
				customData: normalizeWebEmbedOverlay({
					...element.customData,
					url: payload.url,
				}),
			}),
		render: ({ element, isSelected, onChange, onEditingChange }) => (
			<WebEmbed
				element={element}
				isSelected={isSelected}
				onChange={(_elementId, url) => onChange({ url })}
				onEditingChange={onEditingChange}
			/>
		),
	},
	prototype: {
		defaultSize: { width: 720, height: 520 },
		normalizeCustomData: normalizePrototypeOverlay,
		createCustomData: (options) =>
			normalizePrototypeOverlay({
				title:
					typeof options.customData?.title === 'string'
						? options.customData.title
						: 'Prototype',
				template:
					options.customData?.template === 'vanilla' ? 'vanilla' : 'react',
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
		applyUpdate: (element, payload) =>
			bumpElementVersion({
				...element,
				customData: normalizePrototypeOverlay({
					...element.customData,
					...payload,
				}),
			}),
		render: ({ element, isSelected }) => (
			<PrototypeNote
				element={element}
				isSelected={isSelected}
			/>
		),
	},
};

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
	const cached = normalizedOverlayElementCache.get(element);
	if (cached) {
		return cached as TypedOverlayCanvasElement<OverlayCustomDataMap[K]>;
	}

	const normalizedElement = {
		...element,
		customData: getOverlayDefinition(type).normalizeCustomData(
			element.customData as unknown as Partial<OverlayCustomDataMap[K]>,
		),
	} as TypedOverlayCanvasElement<OverlayCustomDataMap[K]>;

	normalizedOverlayElementCache.set(element, normalizedElement as TypedOverlayCanvasElement);
	return normalizedElement;
}
