import type { HeadingTagType } from '@lexical/rich-text';

export type BlockType =
	| 'paragraph'
	| 'h1'
	| 'h2'
	| 'h3'
	| 'bullet'
	| 'number'
	| 'check'
	| 'quote'
	| 'code';

export type ToolbarDropdownType = 'text-color' | 'highlight' | 'table' | 'equation' | null;

export interface BlockOption {
	value: BlockType;
	label: string;
}

export const BLOCK_OPTIONS: BlockOption[] = [
	{ value: 'paragraph', label: 'Normal' },
	{ value: 'h1', label: 'Heading 1' },
	{ value: 'h2', label: 'Heading 2' },
	{ value: 'h3', label: 'Heading 3' },
	{ value: 'bullet', label: 'Bullet List' },
	{ value: 'number', label: 'Numbered List' },
	{ value: 'check', label: 'Checklist' },
	{ value: 'quote', label: 'Quote' },
	{ value: 'code', label: 'Code Block' },
];

export const NOTE_FONT_STACK =
	'"Segoe UI Variable", "SF Pro Text", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
export const NOTE_MONO_STACK =
	'"SFMono-Regular", "SF Mono", Menlo, Monaco, Consolas, "Liberation Mono", monospace';
export const ACCENT_TEXT = '#4d55cc';
export const ACCENT_BG = '#eef0ff';

export const TEXT_COLORS = [
	'#000000',
	'#374151',
	'#6b7280',
	'#9ca3af',
	'#dc2626',
	'#ea580c',
	'#ca8a04',
	'#16a34a',
	'#2563eb',
	'#7c3aed',
	'#db2777',
	'#0891b2',
];

export const HIGHLIGHT_COLORS = [
	'',
	'#fef9c3',
	'#fed7aa',
	'#fecaca',
	'#bbf7d0',
	'#bfdbfe',
	'#e9d5ff',
	'#fce7f3',
];

export interface ToolbarFormatState {
	blockType: BlockType;
	isBold: boolean;
	isItalic: boolean;
	isUnderline: boolean;
	isStrikethrough: boolean;
	isSubscript: boolean;
	isSuperscript: boolean;
	isLink: boolean;
	textColor: string;
	highlightColor: string;
	codeLanguage: string;
}

export interface ToolbarState extends ToolbarFormatState {
	openDropdown: ToolbarDropdownType;
	tableRows: string;
	tableCols: string;
	equationValue: string;
	equationInline: boolean;
	markdownCopied: boolean;
}

export interface ToolbarActions {
	applyBlockType: (type: BlockType) => void;
	applyTextColor: (color: string) => void;
	applyHighlight: (color: string) => void;
	applyTextTransform: (transform: 'uppercase' | 'lowercase' | 'capitalize') => void;
	insertTable: () => void;
	insertEquation: () => void;
	insertImage: () => void;
	handleLinkToggle: () => void;
	copyAsMarkdown: () => void;
	setCodeLanguage: (language: string) => void;
	setOpenDropdown: (dropdown: ToolbarDropdownType) => void;
	setTableRows: (rows: string) => void;
	setTableCols: (cols: string) => void;
	setEquationValue: (value: string) => void;
	setEquationInline: (inline: boolean) => void;
	closeDropdown: () => void;
	toggleDropdown: (name: ToolbarDropdownType) => void;
}

export interface LexicalToolbarProps {
	onRequestComment?: (selectedText: string) => void;
	onToggleCommentsPanel?: () => void;
	isCommentsPanelOpen?: boolean;
	showWordCount?: boolean;
	onToggleWordCount?: () => void;
}
