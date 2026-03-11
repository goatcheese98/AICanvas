export type OverlayType = 'markdown' | 'newlex' | 'kanban' | 'web-embed' | 'prototype';

export type MarkdownEditorMode = 'raw' | 'hybrid';
export type PrototypeTemplate = 'react' | 'vanilla';

export interface MarkdownNoteSettings {
	font: string;
	fontSize: number;
	background: string;
	lineHeight: number;
	inlineCodeColor: string;
	showEmptyLines: boolean;
	autoHideToolbar: boolean;
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

export interface KanbanCardSummary {
	id: string;
	title: string;
	priority: 'low' | 'medium' | 'high';
	labels: string[];
	hasDescription: boolean;
	dueDate?: string;
	isOverdue: boolean;
	completedChecklistItemCount: number;
	totalChecklistItemCount: number;
}

export interface KanbanColumnSummary {
	id: string;
	title: string;
	cardCount: number;
	cards: KanbanCardSummary[];
}

export interface KanbanBoardSummary {
	title: string;
	columnCount: number;
	cardCount: number;
	emptyColumnCount: number;
	cardsWithDescriptions: number;
	overdueCardCount: number;
	completedChecklistItemCount: number;
	totalChecklistItemCount: number;
	priorityCounts: Record<'low' | 'medium' | 'high', number>;
	labels: string[];
	columns: KanbanColumnSummary[];
}

export interface MarkdownOverlayCustomData {
	type: 'markdown';
	title?: string;
	content: string;
	images?: Record<string, string>;
	settings?: MarkdownNoteSettings;
	editorMode?: MarkdownEditorMode;
}

export interface NewLexOverlayCustomData {
	type: 'newlex';
	title?: string;
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

export interface PrototypeOverlayFile {
	code: string;
	active?: boolean;
	hidden?: boolean;
	readOnly?: boolean;
}

export interface PrototypeCardMetric {
	label: string;
	value: string;
}

export interface PrototypeCardPreview {
	eyebrow: string;
	title: string;
	description: string;
	accent: string;
	background: string;
	badges: string[];
	metrics: PrototypeCardMetric[];
}

export interface PrototypeOverlayCustomData {
	type: 'prototype';
	title: string;
	template: PrototypeTemplate;
	files: Record<string, PrototypeOverlayFile>;
	dependencies?: Record<string, string>;
	preview?: PrototypeCardPreview;
	activeFile?: string;
	showEditor?: boolean;
	showPreview?: boolean;
}

export type OverlayCustomData =
	| MarkdownOverlayCustomData
	| NewLexOverlayCustomData
	| KanbanOverlayCustomData
	| WebEmbedOverlayCustomData
	| PrototypeOverlayCustomData;

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
