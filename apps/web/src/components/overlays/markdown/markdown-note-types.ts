import type { MarkdownOverlayCustomData } from '@ai-canvas/shared/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';

export type MarkdownElement = ExcalidrawElement & {
	customData: MarkdownOverlayCustomData;
};

export interface MarkdownNoteProps {
	element: MarkdownElement;
	isSelected: boolean;
	onChange: (
		elementId: string,
		content: string,
		images?: Record<string, string>,
		title?: string,
		settings?: MarkdownOverlayCustomData['settings'],
		editorMode?: MarkdownOverlayCustomData['editorMode'],
		elementStyle?: {
			backgroundColor?: string;
			strokeColor?: string;
			strokeWidth?: number;
			roundness?: ExcalidrawElement['roundness'];
		},
	) => void;
	onEditingChange?: (isEditing: boolean) => void;
}
