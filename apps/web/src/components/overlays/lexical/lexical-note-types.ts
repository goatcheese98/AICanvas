import type { NewLexCommentThread, NewLexOverlayCustomData } from '@ai-canvas/shared/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';

export type LexicalElement = ExcalidrawElement & {
	customData: NewLexOverlayCustomData;
};

interface LexicalNoteChangePayload {
	title?: string;
	lexicalState?: string;
	comments?: NewLexOverlayCustomData['comments'];
}

export interface LexicalNoteProps {
	element: LexicalElement;
	mode: 'preview' | 'shell' | 'live';
	isSelected: boolean;
	isActive: boolean;
	onChange: (elementId: string, updates: LexicalNoteChangePayload) => void;
	onActivityChange?: (isActive: boolean) => void;
}

export type ReplyDraftByThread = Record<string, string>;

export interface PersistCommentsOptions {
	nextOpen?: boolean;
	nextSelectedCommentId?: string | null;
}

export type UpdateThreadFn = (thread: NewLexCommentThread) => NewLexCommentThread;
