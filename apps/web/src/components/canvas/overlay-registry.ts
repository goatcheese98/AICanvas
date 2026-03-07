import type {
	KanbanOverlayCustomData,
	MarkdownOverlayCustomData,
	NewLexOverlayCustomData,
	OverlayCustomData,
	OverlayType,
	WebEmbedOverlayCustomData,
} from '@ai-canvas/shared/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { OVERLAY_TYPES } from '@ai-canvas/shared/constants';

export type TypedOverlayCanvasElement<T extends OverlayCustomData = OverlayCustomData> =
	ExcalidrawElement & { customData: T };

export type OverlayUpdatePayloadMap = {
	markdown: {
		content: string;
		images?: Record<string, string>;
		settings?: MarkdownOverlayCustomData['settings'];
		editorMode?: MarkdownOverlayCustomData['editorMode'];
		elementStyle?: {
			backgroundColor?: string;
			strokeColor?: string;
		};
	};
	newlex: {
		lexicalState?: string;
		comments?: NewLexOverlayCustomData['comments'];
		commentsPanelOpen?: boolean;
	};
	kanban: KanbanOverlayCustomData;
	'web-embed': {
		url: string;
	};
};

export function collectOverlayElements(
	elements: readonly ExcalidrawElement[],
): TypedOverlayCanvasElement[] {
	return elements.filter(isOverlayElement) as unknown as TypedOverlayCanvasElement[];
}

function isOverlayElement(el: ExcalidrawElement): boolean {
	if (el.isDeleted) return false;
	const customData = el.customData as OverlayCustomData | undefined;
	if (!customData?.type) return false;
	return (OVERLAY_TYPES as readonly string[]).includes(customData.type);
}

export function bumpElementVersion<T extends ExcalidrawElement>(element: T): T {
	return {
		...element,
		version: (element.version ?? 0) + 1,
		versionNonce: Math.floor(Math.random() * 2 ** 31),
	};
}

export function applyOverlayUpdateByType<K extends OverlayType>(
	type: K,
	element: TypedOverlayCanvasElement,
	payload: OverlayUpdatePayloadMap[K],
): TypedOverlayCanvasElement {
	switch (type) {
		case 'markdown': {
			const markdownData = element.customData as MarkdownOverlayCustomData;
			const markdownPayload = payload as OverlayUpdatePayloadMap['markdown'];
			return bumpElementVersion({
				...element,
				...(markdownPayload.elementStyle?.backgroundColor !== undefined
					? { backgroundColor: markdownPayload.elementStyle.backgroundColor }
					: {}),
				...(markdownPayload.elementStyle?.strokeColor !== undefined
					? { strokeColor: markdownPayload.elementStyle.strokeColor }
					: {}),
				customData: {
					...markdownData,
					type: 'markdown',
					content: markdownPayload.content,
					...(markdownPayload.images !== undefined
						? { images: markdownPayload.images }
						: { images: markdownData.images }),
					...(markdownPayload.settings !== undefined
						? { settings: markdownPayload.settings }
						: { settings: markdownData.settings }),
					...(markdownPayload.editorMode !== undefined
						? { editorMode: markdownPayload.editorMode }
						: { editorMode: markdownData.editorMode }),
				},
			}) as TypedOverlayCanvasElement;
		}
		case 'newlex': {
			const newLexData = element.customData as NewLexOverlayCustomData;
			const newLexPayload = payload as OverlayUpdatePayloadMap['newlex'];
			return bumpElementVersion({
				...element,
				customData: {
					...newLexData,
					type: 'newlex',
					...(newLexPayload.lexicalState !== undefined
						? { lexicalState: newLexPayload.lexicalState }
						: { lexicalState: newLexData.lexicalState }),
					...(newLexPayload.comments !== undefined
						? { comments: newLexPayload.comments }
						: { comments: newLexData.comments }),
					...(newLexPayload.commentsPanelOpen !== undefined
						? { commentsPanelOpen: newLexPayload.commentsPanelOpen }
						: { commentsPanelOpen: newLexData.commentsPanelOpen }),
				},
			}) as TypedOverlayCanvasElement;
		}
		case 'kanban':
			return bumpElementVersion({
				...element,
				customData: payload as OverlayUpdatePayloadMap['kanban'],
			}) as TypedOverlayCanvasElement;
		case 'web-embed': {
			const webEmbedData = element.customData as WebEmbedOverlayCustomData;
			const webEmbedPayload = payload as OverlayUpdatePayloadMap['web-embed'];
			return bumpElementVersion({
				...element,
				customData: {
					...webEmbedData,
					type: 'web-embed',
					url: webEmbedPayload.url,
				},
			}) as TypedOverlayCanvasElement;
		}
	}
}

/**
 * Z-index calculation for overlay stacking.
 * Port of the reference codebase's getOverlayZIndex.
 */
export function getOverlayZIndex(
	isSelected: boolean,
	isEditing: boolean,
	stackIndex: number,
): number {
	let z = stackIndex * 10;
	if (isSelected) z += 2;
	if (isEditing) z += 3;
	return z;
}
