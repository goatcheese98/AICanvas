import type { ReactElement } from 'react';
import type {
	KanbanOverlayCustomData,
	MarkdownOverlayCustomData,
	NewLexOverlayCustomData,
	OverlayType,
	PrototypeOverlayCustomData,
	WebEmbedOverlayCustomData,
} from '@ai-canvas/shared/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';

export type TypedOverlayCanvasElement<T extends OverlayCustomDataMap[OverlayType] = OverlayCustomDataMap[OverlayType]> =
	ExcalidrawElement & { customData: T };

export type OverlayCustomDataMap = {
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

export interface CreateOverlayElementOptions {
	type: OverlayType;
	x: number;
	y: number;
	width?: number;
	height?: number;
	customData?: Record<string, unknown>;
}

export type OverlayRenderMode = 'preview' | 'shell' | 'live';

export interface OverlayRenderProps<K extends OverlayType> {
	element: TypedOverlayCanvasElement<OverlayCustomDataMap[K]>;
	mode: OverlayRenderMode;
	isSelected: boolean;
	isActive: boolean;
	onChange: (payload: OverlayUpdatePayloadMap[K]) => void;
	onActivityChange?: (isActive: boolean) => void;
}

export interface OverlayDefinition<K extends OverlayType> {
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

export function bumpElementVersion<T extends ExcalidrawElement>(element: T): T {
	return {
		...element,
		version: (element.version ?? 0) + 1,
		versionNonce: Math.floor(Math.random() * 2 ** 31),
	};
}
