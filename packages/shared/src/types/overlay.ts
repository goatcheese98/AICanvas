export type OverlayType = 'markdown' | 'newlex' | 'kanban' | 'web-embed';

export interface MarkdownNoteSettings {
	font: string;
	fontSize: number;
	background: string;
	lineHeight: number;
}

export interface NewLexCommentReply {
	id: string;
	author: string;
	message: string;
	createdAt: number;
	deleted?: boolean;
}

export interface NewLexCommentThread {
	id: string;
	author: string;
	comment: string;
	commentDeleted?: boolean;
	anchorText: string;
	createdAt: number;
	resolved: boolean;
	collapsed: boolean;
	replies: NewLexCommentReply[];
}

export interface KanbanChecklistItem {
	text: string;
	done: boolean;
}

export interface KanbanCard {
	id: string;
	title: string;
	description?: string;
	priority?: 'low' | 'medium' | 'high';
	labels?: string[];
	dueDate?: string;
	checklist?: KanbanChecklistItem[];
}

export interface KanbanColumn {
	id: string;
	title: string;
	color?: string;
	wipLimit?: number;
	cards: KanbanCard[];
}

export interface MarkdownOverlayCustomData {
	type: 'markdown';
	content: string;
	images?: Record<string, string>;
	settings?: MarkdownNoteSettings;
}

export interface NewLexOverlayCustomData {
	type: 'newlex';
	lexicalState: string;
	comments?: NewLexCommentThread[];
	commentsPanelOpen?: boolean;
	version?: number;
}

export interface KanbanOverlayCustomData {
	type: 'kanban';
	title: string;
	columns: KanbanColumn[];
	theme?: 'sketch' | 'clean';
	bgTheme?: string;
	fontId?: string;
	fontSize?: number;
}

export interface WebEmbedOverlayCustomData {
	type: 'web-embed';
	url: string;
}

export type OverlayCustomData =
	| MarkdownOverlayCustomData
	| NewLexOverlayCustomData
	| KanbanOverlayCustomData
	| WebEmbedOverlayCustomData;

export interface OverlayElement {
	id: string;
	type: string;
	x: number;
	y: number;
	width: number;
	height: number;
	angle: number;
	customData: OverlayCustomData;
}
