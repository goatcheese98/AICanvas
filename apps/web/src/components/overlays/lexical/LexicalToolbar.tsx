import { useCallback, useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
	$getSelection,
	$isRangeSelection,
	FORMAT_ELEMENT_COMMAND,
	FORMAT_TEXT_COMMAND,
	REDO_COMMAND,
	UNDO_COMMAND,
} from 'lexical';
import {
	$createHeadingNode,
	$createQuoteNode,
	$isHeadingNode,
	$isQuoteNode,
	type HeadingTagType,
} from '@lexical/rich-text';
import {
	$isListNode,
	INSERT_CHECK_LIST_COMMAND,
	INSERT_ORDERED_LIST_COMMAND,
	INSERT_UNORDERED_LIST_COMMAND,
	ListNode,
	REMOVE_LIST_COMMAND,
} from '@lexical/list';
import {
	$createCodeNode,
	$isCodeNode,
	CODE_LANGUAGE_FRIENDLY_NAME_MAP,
	CodeNode,
} from '@lexical/code';
import { $isLinkNode, TOGGLE_LINK_COMMAND } from '@lexical/link';
import { $getNearestNodeOfType, mergeRegister } from '@lexical/utils';
import { INSERT_TABLE_COMMAND } from '@lexical/table';
import { INSERT_HORIZONTAL_RULE_COMMAND } from '@lexical/react/LexicalHorizontalRuleNode';
import { $convertToMarkdownString, TRANSFORMERS } from '@lexical/markdown';
import { $createParagraphNode } from 'lexical';
import { $getSelectionStyleValueForProperty, $patchStyleText, $setBlocksType } from '@lexical/selection';
import { useResettableTimeout } from '@/hooks/useResettableTimeout';
import { INSERT_EQUATION_COMMAND } from './plugins/EquationPlugin';
import { INSERT_IMAGE_COMMAND, openImageFilePicker } from './plugins/ImagesPlugin';

type BlockType =
	| 'paragraph'
	| 'h1'
	| 'h2'
	| 'h3'
	| 'bullet'
	| 'number'
	| 'check'
	| 'quote'
	| 'code';

const BLOCK_OPTIONS: Array<{ value: BlockType; label: string }> = [
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

const NOTE_FONT_STACK =
	'"Segoe UI Variable", "SF Pro Text", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
const NOTE_MONO_STACK =
	'"SFMono-Regular", "SF Mono", Menlo, Monaco, Consolas, "Liberation Mono", monospace';
const ACCENT_TEXT = '#4d55cc';
const ACCENT_BG = '#eef0ff';

function getBlockType(selection: ReturnType<typeof $getSelection>): BlockType {
	if (!$isRangeSelection(selection)) return 'paragraph';

	const anchor = selection.anchor.getNode();
	const topLevel = anchor.getTopLevelElement();
	if (!topLevel || topLevel.getType() === 'root') return 'paragraph';

	if ($isHeadingNode(topLevel)) return topLevel.getTag() as BlockType;
	if ($isQuoteNode(topLevel)) return 'quote';
	if ($isCodeNode(topLevel)) return 'code';
	if ($isListNode(topLevel)) {
		const listNode = $getNearestNodeOfType<ListNode>(anchor, ListNode);
		const listType = listNode?.getListType();
		if (listType === 'bullet') return 'bullet';
		if (listType === 'number') return 'number';
		if (listType === 'check') return 'check';
	}

	return 'paragraph';
}

function PortalDropdown({
	triggerRef,
	isOpen,
	onClose,
	children,
	minWidth = 160,
}: {
	triggerRef: React.RefObject<HTMLElement | null>;
	isOpen: boolean;
	onClose: () => void;
	children: React.ReactNode;
	minWidth?: number;
}) {
	const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

	useEffect(() => {
		if (!isOpen || !triggerRef.current) return;
		const rect = triggerRef.current.getBoundingClientRect();
		const left = Math.min(rect.left, window.innerWidth - minWidth - 8);
		setPosition({ top: rect.bottom + 4, left });
	}, [isOpen, minWidth, triggerRef]);

	if (!isOpen || !position) return null;

	return ReactDOM.createPortal(
		<>
			<div
				style={{ position: 'fixed', inset: 0, zIndex: 99990 }}
				onClick={onClose}
				onMouseDown={(event) => event.preventDefault()}
			/>
			<div
				style={{
					position: 'fixed',
					top: position.top,
					left: position.left,
					zIndex: 99991,
					background: 'rgba(255,255,255,0.98)',
					border: '1px solid #e7e5e4',
					borderRadius: 12,
					padding: 10,
					boxShadow: '0 16px 36px rgba(28,25,23,0.12), 0 1px 4px rgba(28,25,23,0.06)',
					minWidth,
					backdropFilter: 'blur(12px)',
					fontFamily: NOTE_FONT_STACK,
				}}
				onMouseDown={(event) => event.stopPropagation()}
			>
				{children}
			</div>
		</>,
		document.body,
	);
}

function requestLinkUrl() {
	const value = window.prompt('Enter a URL', 'https://');
	if (!value) return null;
	const trimmed = value.trim();
	return trimmed.length === 0 ? null : trimmed;
}

function UndoIcon() {
	return (
		<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
			<polyline points="9 14 4 9 9 4" />
			<path d="M20 20v-7a4 4 0 0 0-4-4H4" />
		</svg>
	);
}

function RedoIcon() {
	return (
		<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
			<polyline points="15 14 20 9 15 4" />
			<path d="M4 20v-7a4 4 0 0 1 4-4h12" />
		</svg>
	);
}

function LinkIcon() {
	return (
		<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
			<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
			<path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
		</svg>
	);
}

function TableIcon() {
	return (
		<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
			<rect x="3" y="3" width="18" height="18" rx="2" />
			<line x1="3" y1="9" x2="21" y2="9" />
			<line x1="3" y1="15" x2="21" y2="15" />
			<line x1="9" y1="3" x2="9" y2="21" />
			<line x1="15" y1="3" x2="15" y2="21" />
		</svg>
	);
}

function SigmaIcon() {
	return (
		<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
			<path d="M18 4H6l6 8-6 8h12" />
		</svg>
	);
}

function HrIcon() {
	return (
		<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
			<line x1="3" y1="12" x2="21" y2="12" />
		</svg>
	);
}

function MarkdownCopyIcon() {
	return (
		<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
			<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
			<polyline points="14 2 14 8 20 8" />
			<line x1="9" y1="13" x2="9" y2="17" />
			<polyline points="7 15 9 13 11 15" />
			<line x1="15" y1="13" x2="15" y2="17" />
			<line x1="13" y1="17" x2="17" y2="17" />
		</svg>
	);
}

function ImageIcon() {
	return (
		<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
			<rect x="3" y="3" width="18" height="18" rx="2" />
			<circle cx="8.5" cy="8.5" r="1.5" />
			<polyline points="21 15 16 10 5 21" />
		</svg>
	);
}

function WordCountIcon() {
	return (
		<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
			<line x1="3" y1="6" x2="21" y2="6" />
			<line x1="3" y1="12" x2="21" y2="12" />
			<line x1="3" y1="18" x2="13" y2="18" />
		</svg>
	);
}

function CommentAddIcon() {
	return (
		<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
			<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
			<line x1="12" y1="8" x2="12" y2="14" />
			<line x1="9" y1="11" x2="15" y2="11" />
		</svg>
	);
}

function CommentListIcon() {
	return (
		<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
			<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
			<line x1="9" y1="9" x2="15" y2="9" />
			<line x1="9" y1="13" x2="13" y2="13" />
		</svg>
	);
}

function AlignLeftIcon() {
	return (
		<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
			<line x1="4" y1="7" x2="20" y2="7" />
			<line x1="4" y1="12" x2="16" y2="12" />
			<line x1="4" y1="17" x2="20" y2="17" />
		</svg>
	);
}

function AlignCenterIcon() {
	return (
		<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
			<line x1="4" y1="7" x2="20" y2="7" />
			<line x1="7" y1="12" x2="17" y2="12" />
			<line x1="4" y1="17" x2="20" y2="17" />
		</svg>
	);
}

function AlignRightIcon() {
	return (
		<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
			<line x1="4" y1="7" x2="20" y2="7" />
			<line x1="8" y1="12" x2="20" y2="12" />
			<line x1="4" y1="17" x2="20" y2="17" />
		</svg>
	);
}

export function LexicalToolbar({
	onRequestComment,
	onToggleCommentsPanel,
	isCommentsPanelOpen,
	showWordCount,
	onToggleWordCount,
}: {
	onRequestComment?: (selectedText: string) => void;
	onToggleCommentsPanel?: () => void;
	isCommentsPanelOpen?: boolean;
	showWordCount?: boolean;
	onToggleWordCount?: () => void;
}) {
	const [editor] = useLexicalComposerContext();
	const [blockType, setBlockType] = useState<BlockType>('paragraph');
	const [isBold, setIsBold] = useState(false);
	const [isItalic, setIsItalic] = useState(false);
	const [isUnderline, setIsUnderline] = useState(false);
	const [isStrikethrough, setIsStrikethrough] = useState(false);
	const [isSubscript, setIsSubscript] = useState(false);
	const [isSuperscript, setIsSuperscript] = useState(false);
	const [isLink, setIsLink] = useState(false);
	const [textColor, setTextColor] = useState('#000000');
	const [highlightColor, setHighlightColor] = useState('');
	const [codeLanguage, setCodeLanguage] = useState('auto');
	const [openDropdown, setOpenDropdown] = useState<'text-color' | 'highlight' | 'table' | 'equation' | null>(null);
	const [tableRows, setTableRows] = useState('3');
	const [tableCols, setTableCols] = useState('3');
	const [equationValue, setEquationValue] = useState('');
	const [equationInline, setEquationInline] = useState(true);
	const [markdownCopied, setMarkdownCopied] = useState(false);
	const { schedule: scheduleCopiedReset } = useResettableTimeout();

	const textColorRef = useRef<HTMLButtonElement>(null);
	const highlightRef = useRef<HTMLButtonElement>(null);
	const tableRef = useRef<HTMLButtonElement>(null);
	const equationRef = useRef<HTMLButtonElement>(null);

	const closeDropdown = useCallback(() => setOpenDropdown(null), []);
	const toggleDropdown = useCallback(
		(name: typeof openDropdown) => setOpenDropdown((current) => (current === name ? null : name)),
		[],
	);

	const updateToolbar = useCallback(() => {
		const selection = $getSelection();
		if (!$isRangeSelection(selection)) return;

		setIsBold(selection.hasFormat('bold'));
		setIsItalic(selection.hasFormat('italic'));
		setIsUnderline(selection.hasFormat('underline'));
		setIsStrikethrough(selection.hasFormat('strikethrough'));
		setIsSubscript(selection.hasFormat('subscript'));
		setIsSuperscript(selection.hasFormat('superscript'));
		setBlockType(getBlockType(selection));

		if (getBlockType(selection) === 'code') {
			const codeNode = $getNearestNodeOfType(selection.anchor.getNode(), CodeNode);
			setCodeLanguage(codeNode?.getLanguage() ?? 'auto');
		}

		const node = selection.anchor.getNode();
		setIsLink($isLinkNode(node.getParent()) || $isLinkNode(node));
		setTextColor($getSelectionStyleValueForProperty(selection, 'color', '#000000'));
		setHighlightColor($getSelectionStyleValueForProperty(selection, 'background-color', ''));
	}, []);

	useEffect(
		() =>
			mergeRegister(
				editor.registerUpdateListener(({ editorState }) => {
					editorState.read(() => updateToolbar());
				}),
			),
		[editor, updateToolbar],
	);

	const applyBlockType = useCallback(
		(type: BlockType) => {
			const listCommands = {
				bullet: INSERT_UNORDERED_LIST_COMMAND,
				number: INSERT_ORDERED_LIST_COMMAND,
				check: INSERT_CHECK_LIST_COMMAND,
			} as const;

			if (type === 'bullet' || type === 'number' || type === 'check') {
				if (blockType === type) {
					editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
				} else {
					editor.dispatchCommand(listCommands[type], undefined);
				}
				return;
			}

			editor.update(() => {
				const selection = $getSelection();
				if (!$isRangeSelection(selection)) return;

				if (type === 'paragraph') {
					$setBlocksType(selection, () => $createParagraphNode());
				} else if (type === 'h1' || type === 'h2' || type === 'h3') {
					$setBlocksType(selection, () => $createHeadingNode(type as HeadingTagType));
				} else if (type === 'quote') {
					$setBlocksType(selection, () => $createQuoteNode());
				} else if (type === 'code') {
					$setBlocksType(selection, () => $createCodeNode('auto'));
				}
			});
		},
		[blockType, editor],
	);

	const applyTextColor = useCallback(
		(color: string) => {
			editor.update(() => {
				const selection = $getSelection();
				if ($isRangeSelection(selection)) $patchStyleText(selection, { color });
			});
			closeDropdown();
		},
		[closeDropdown, editor],
	);

	const applyHighlight = useCallback(
		(color: string) => {
			editor.update(() => {
				const selection = $getSelection();
				if ($isRangeSelection(selection)) {
					$patchStyleText(selection, { 'background-color': color || 'transparent' });
				}
			});
			closeDropdown();
		},
		[closeDropdown, editor],
	);

	const insertTable = useCallback(() => {
		const rows = Number.parseInt(tableRows, 10);
		const cols = Number.parseInt(tableCols, 10);
		if (rows >= 1 && cols >= 1) {
			editor.dispatchCommand(INSERT_TABLE_COMMAND, {
				rows: String(rows),
				columns: String(cols),
			});
		}
		closeDropdown();
	}, [closeDropdown, editor, tableCols, tableRows]);

	const insertEquation = useCallback(() => {
		if (!equationValue.trim()) return;
		editor.dispatchCommand(INSERT_EQUATION_COMMAND, {
			equation: equationValue.trim(),
			inline: equationInline,
		});
		setEquationValue('');
		closeDropdown();
	}, [closeDropdown, editor, equationInline, equationValue]);

	const handleLinkToggle = useCallback(() => {
		if (isLink) {
			editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
			return;
		}
		const url = requestLinkUrl();
		if (url) editor.dispatchCommand(TOGGLE_LINK_COMMAND, url);
	}, [editor, isLink]);

	const insertImage = useCallback(() => {
		openImageFilePicker((payload) => {
			editor.dispatchCommand(INSERT_IMAGE_COMMAND, payload);
		});
	}, [editor]);

	const copyAsMarkdown = useCallback(() => {
		editor.getEditorState().read(() => {
			const markdown = $convertToMarkdownString(TRANSFORMERS);
			void navigator.clipboard.writeText(markdown).then(() => {
				setMarkdownCopied(true);
				scheduleCopiedReset(() => setMarkdownCopied(false), 1800);
			});
		});
	}, [editor, scheduleCopiedReset]);

	const applyTextTransform = useCallback(
		(transform: 'uppercase' | 'lowercase' | 'capitalize') => {
			editor.update(() => {
				const selection = $getSelection();
				if (!$isRangeSelection(selection)) return;
				const current = $getSelectionStyleValueForProperty(selection, 'text-transform', '');
				$patchStyleText(selection, { 'text-transform': current === transform ? '' : transform });
			});
		},
		[editor],
	);

	const buttonStyle = (active: boolean): React.CSSProperties => ({
		display: 'inline-flex',
		alignItems: 'center',
		justifyContent: 'center',
		height: 28,
		minWidth: 28,
		padding: '0 6px',
		border: 'none',
		borderRadius: 8,
		background: active ? ACCENT_BG : 'transparent',
		color: active ? ACCENT_TEXT : '#57534e',
		cursor: 'pointer',
		fontSize: 13,
		fontWeight: active ? 700 : 500,
		lineHeight: 1,
		flexShrink: 0,
		transition: 'background 0.12s ease, color 0.12s ease',
	});

	const dividerStyle: React.CSSProperties = {
		width: 1,
		alignSelf: 'stretch',
		margin: '4px 3px',
		background: '#e7e5e4',
		flexShrink: 0,
	};

	const textColors = ['#000000', '#374151', '#6b7280', '#9ca3af', '#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#2563eb', '#7c3aed', '#db2777', '#0891b2'];
	const highlightColors = ['', '#fef9c3', '#fed7aa', '#fecaca', '#bbf7d0', '#bfdbfe', '#e9d5ff', '#fce7f3'];

	return (
		<div
			style={{
				display: 'flex',
				alignItems: 'center',
				gap: 1,
				padding: '5px 10px',
				borderBottom: '1px solid #e7e5e4',
				background: 'linear-gradient(180deg, rgba(250,250,249,0.98) 0%, rgba(245,245,244,0.95) 100%)',
				overflowX: 'auto',
				overflowY: 'visible',
				flexShrink: 0,
				flexWrap: 'nowrap',
				minHeight: 40,
				scrollbarWidth: 'none',
				fontFamily: NOTE_FONT_STACK,
			}}
			onMouseDown={(event) => event.stopPropagation()}
		>
			<button type="button" style={buttonStyle(false)} onMouseDown={(event) => event.preventDefault()} onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)} title="Undo">
				<UndoIcon />
			</button>
			<button type="button" style={buttonStyle(false)} onMouseDown={(event) => event.preventDefault()} onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)} title="Redo">
				<RedoIcon />
			</button>
			<div style={dividerStyle} />
			<select
				value={blockType}
				onChange={(event) => applyBlockType(event.target.value as BlockType)}
				onMouseDown={(event) => event.stopPropagation()}
				style={{
					height: 28,
					padding: '0 24px 0 10px',
					border: '1px solid #e7e5e4',
					borderRadius: 8,
					fontSize: 12,
					fontWeight: 600,
					background: 'rgba(255,255,255,0.88)',
					color: '#44403c',
					cursor: 'pointer',
					flexShrink: 0,
					appearance: 'auto',
					marginRight: 2,
				}}
			>
				{BLOCK_OPTIONS.map((option) => (
					<option key={option.value} value={option.value}>
						{option.label}
					</option>
				))}
			</select>
			{blockType === 'code' ? (
				<select
					value={codeLanguage}
					onChange={(event) => {
						const language = event.target.value;
						setCodeLanguage(language);
						editor.update(() => {
							const selection = $getSelection();
							if (!$isRangeSelection(selection)) return;
							const codeNode = $getNearestNodeOfType(selection.anchor.getNode(), CodeNode);
							codeNode?.setLanguage(language);
						});
					}}
					onMouseDown={(event) => event.stopPropagation()}
					style={{
						height: 28,
						padding: '0 24px 0 10px',
						border: '1px solid #e7e5e4',
						borderRadius: 8,
						fontSize: 12,
						fontWeight: 600,
						background: codeLanguage === 'auto' ? '#ecfccb' : 'rgba(255,255,255,0.72)',
						color: codeLanguage === 'auto' ? '#3f6212' : '#44403c',
						cursor: 'pointer',
						flexShrink: 0,
						fontFamily: NOTE_MONO_STACK,
					}}
				>
					<option value="auto">Auto-detect</option>
					{Object.entries(CODE_LANGUAGE_FRIENDLY_NAME_MAP).map(([value, label]) => (
						<option key={value} value={value}>
							{label}
						</option>
					))}
					<option value="bash">Bash / Shell</option>
					<option value="go">Go</option>
					<option value="json">JSON</option>
					<option value="yaml">YAML</option>
					<option value="ruby">Ruby</option>
					<option value="kotlin">Kotlin</option>
					<option value="php">PHP</option>
				</select>
			) : null}
			<div style={dividerStyle} />
			<button type="button" style={{ ...buttonStyle(isBold), fontWeight: 700, fontFamily: 'serif', fontSize: 14 }} onMouseDown={(event) => event.preventDefault()} onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold')} title="Bold">
				B
			</button>
			<button type="button" style={{ ...buttonStyle(isItalic), fontStyle: 'italic', fontFamily: 'Georgia, serif', fontSize: 14 }} onMouseDown={(event) => event.preventDefault()} onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic')} title="Italic">
				I
			</button>
			<button type="button" style={{ ...buttonStyle(isUnderline), textDecoration: 'underline', fontSize: 14 }} onMouseDown={(event) => event.preventDefault()} onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline')} title="Underline">
				U
			</button>
			<button type="button" style={{ ...buttonStyle(isStrikethrough), textDecoration: 'line-through', fontSize: 14 }} onMouseDown={(event) => event.preventDefault()} onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'strikethrough')} title="Strikethrough">
				S
			</button>
			<div style={dividerStyle} />
			<button type="button" style={{ ...buttonStyle(isSuperscript), fontSize: 11 }} onMouseDown={(event) => event.preventDefault()} onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'superscript')} title="Superscript">
				x<sup style={{ fontSize: 8 }}>2</sup>
			</button>
			<button type="button" style={{ ...buttonStyle(isSubscript), fontSize: 11 }} onMouseDown={(event) => event.preventDefault()} onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'subscript')} title="Subscript">
				x<sub style={{ fontSize: 8 }}>2</sub>
			</button>
			<div style={dividerStyle} />
			<button type="button" style={{ ...buttonStyle(false), fontSize: 11, letterSpacing: '-0.01em' }} onMouseDown={(event) => event.preventDefault()} onClick={() => applyTextTransform('uppercase')} title="Uppercase">
				AA
			</button>
			<button type="button" style={{ ...buttonStyle(false), fontSize: 11, letterSpacing: '-0.01em' }} onMouseDown={(event) => event.preventDefault()} onClick={() => applyTextTransform('lowercase')} title="Lowercase">
				aa
			</button>
			<button type="button" style={{ ...buttonStyle(false), fontSize: 11, letterSpacing: '-0.01em' }} onMouseDown={(event) => event.preventDefault()} onClick={() => applyTextTransform('capitalize')} title="Capitalize">
				Aa
			</button>
			<div style={dividerStyle} />
			<button
				ref={textColorRef}
				type="button"
				style={{ ...buttonStyle(openDropdown === 'text-color'), flexDirection: 'column', gap: 2, padding: '3px 5px', height: 28 }}
				onMouseDown={(event) => event.preventDefault()}
				onClick={() => toggleDropdown('text-color')}
				title="Text color"
			>
				<span style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.1, fontFamily: 'serif' }}>A</span>
				<span style={{ width: 14, height: 2.5, background: textColor || '#000', borderRadius: 1 }} />
			</button>
			<PortalDropdown triggerRef={textColorRef} isOpen={openDropdown === 'text-color'} onClose={closeDropdown} minWidth={136}>
				<div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
					{textColors.map((color) => (
						<button
							key={color}
							type="button"
							onMouseDown={(event) => {
								event.preventDefault();
								applyTextColor(color);
							}}
							style={{
								width: 22,
								height: 22,
								borderRadius: '50%',
								background: color,
								border: color === textColor ? '2.5px solid #374151' : '1.5px solid #d1d5db',
								cursor: 'pointer',
								padding: 0,
							}}
							title={color}
						/>
					))}
				</div>
			</PortalDropdown>
			<button
				ref={highlightRef}
				type="button"
				style={{ ...buttonStyle(openDropdown === 'highlight'), flexDirection: 'column', gap: 2, padding: '3px 5px', height: 28 }}
				onMouseDown={(event) => event.preventDefault()}
				onClick={() => toggleDropdown('highlight')}
				title="Highlight color"
			>
				<span style={{ fontSize: 11, lineHeight: 1.3, color: '#57534e' }}>
					<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" style={{ display: 'block' }}>
						<path d="M12 3l1.5 4.5H18l-3.75 2.75 1.5 4.5L12 12 8.25 14.75l1.5-4.5L6 7.5h4.5z" />
					</svg>
				</span>
				<span style={{ width: 14, height: 2.5, background: highlightColor || '#d6d3d1', borderRadius: 1 }} />
			</button>
			<PortalDropdown triggerRef={highlightRef} isOpen={openDropdown === 'highlight'} onClose={closeDropdown} minWidth={128}>
				<div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
					{highlightColors.map((color, index) => (
						<button
							key={`${color}-${index}`}
							type="button"
							onMouseDown={(event) => {
								event.preventDefault();
								applyHighlight(color);
							}}
							style={{
								width: 22,
								height: 22,
								borderRadius: '50%',
								background: color || 'linear-gradient(135deg, #fff 45%, #e2e8f0 45%, #e2e8f0 55%, #fff 55%)',
								border: color === highlightColor ? '2.5px solid #374151' : '1.5px solid #d1d5db',
								cursor: 'pointer',
								padding: 0,
							}}
							title={color || 'None'}
						/>
					))}
				</div>
			</PortalDropdown>
			<div style={dividerStyle} />
			<button type="button" style={buttonStyle(isLink)} onMouseDown={(event) => event.preventDefault()} onClick={handleLinkToggle} title="Toggle link">
				<LinkIcon />
			</button>
			<button ref={tableRef} type="button" style={buttonStyle(openDropdown === 'table')} onMouseDown={(event) => event.preventDefault()} onClick={() => toggleDropdown('table')} title="Insert table">
				<TableIcon />
			</button>
			<PortalDropdown triggerRef={tableRef} isOpen={openDropdown === 'table'} onClose={closeDropdown} minWidth={170}>
				<div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
					<p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: '#78716c', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Insert table</p>
					{(['Rows', 'Cols'] as const).map((label) => (
						<div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
							<span style={{ color: '#78716c', width: 36 }}>{label}</span>
							<input
								type="number"
								min="1"
								max="50"
								value={label === 'Rows' ? tableRows : tableCols}
								onChange={(event) => label === 'Rows' ? setTableRows(event.target.value) : setTableCols(event.target.value)}
								style={{
									width: 56,
									padding: '4px 6px',
									border: '1px solid #e7e5e4',
									borderRadius: 5,
									fontSize: 13,
									color: '#44403c',
									background: '#fff',
								}}
							/>
						</div>
					))}
					<button type="button" onMouseDown={(event) => event.preventDefault()} onClick={insertTable} style={{ background: ACCENT_TEXT, color: '#fff', border: 'none', borderRadius: 8, padding: '7px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer', width: '100%' }}>
						Insert
					</button>
				</div>
			</PortalDropdown>
			<button ref={equationRef} type="button" style={buttonStyle(openDropdown === 'equation')} onMouseDown={(event) => event.preventDefault()} onClick={() => toggleDropdown('equation')} title="Insert equation">
				<SigmaIcon />
			</button>
			<PortalDropdown triggerRef={equationRef} isOpen={openDropdown === 'equation'} onClose={closeDropdown} minWidth={220}>
				<div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
					<p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: '#78716c', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Insert equation</p>
					<input
						type="text"
						value={equationValue}
						onChange={(event) => setEquationValue(event.target.value)}
						placeholder="e.g. x^2 + y^2 = r^2"
						autoFocus
						style={{
							padding: '6px 8px',
							border: '1px solid #e7e5e4',
							borderRadius: 5,
							fontSize: 13,
							fontFamily: '"Cascadia Code", "SFMono-Regular", monospace',
							color: '#44403c',
						}}
						onKeyDown={(event) => {
							if (event.key === 'Enter') insertEquation();
						}}
					/>
					<label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#78716c', cursor: 'pointer' }}>
						<input type="checkbox" checked={equationInline} onChange={(event) => setEquationInline(event.target.checked)} />
						Inline
					</label>
					<button type="button" onMouseDown={(event) => event.preventDefault()} onClick={insertEquation} style={{ background: ACCENT_TEXT, color: '#fff', border: 'none', borderRadius: 8, padding: '7px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer', width: '100%' }}>
						Insert
					</button>
				</div>
			</PortalDropdown>
			<button type="button" style={buttonStyle(false)} onMouseDown={(event) => event.preventDefault()} onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'left')} title="Align left">
				<AlignLeftIcon />
			</button>
			<button type="button" style={buttonStyle(false)} onMouseDown={(event) => event.preventDefault()} onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'center')} title="Align center">
				<AlignCenterIcon />
			</button>
			<button type="button" style={buttonStyle(false)} onMouseDown={(event) => event.preventDefault()} onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'right')} title="Align right">
				<AlignRightIcon />
			</button>
			<button type="button" style={buttonStyle(false)} onMouseDown={(event) => event.preventDefault()} onClick={() => editor.dispatchCommand(INSERT_HORIZONTAL_RULE_COMMAND, undefined)} title="Horizontal divider">
				<HrIcon />
			</button>
			<button type="button" style={buttonStyle(false)} onMouseDown={(event) => event.preventDefault()} onClick={insertImage} title="Insert image">
				<ImageIcon />
			</button>
			<button
				type="button"
				style={{
					...buttonStyle(markdownCopied),
					fontSize: 11,
					fontFamily: NOTE_FONT_STACK,
					gap: 4,
					paddingLeft: 7,
					paddingRight: 7,
					color: markdownCopied ? '#16a34a' : undefined,
				}}
				onMouseDown={(event) => event.preventDefault()}
				onClick={copyAsMarkdown}
				title="Copy note as Markdown"
			>
				<MarkdownCopyIcon />
				{markdownCopied ? 'Copied!' : 'MD'}
			</button>
			{onToggleWordCount ? (
				<button type="button" style={buttonStyle(Boolean(showWordCount))} onMouseDown={(event) => event.preventDefault()} onClick={onToggleWordCount} title={showWordCount ? 'Hide word count' : 'Show word count'}>
					<WordCountIcon />
				</button>
			) : null}
			{onRequestComment || onToggleCommentsPanel ? (
				<>
					<div style={{ flex: 1 }} />
					<div style={dividerStyle} />
					{onRequestComment ? (
						<button
							type="button"
							style={buttonStyle(false)}
							onMouseDown={(event) => event.preventDefault()}
							onClick={() => {
								const text = editor.getEditorState().read(() => {
									const selection = $getSelection();
									return $isRangeSelection(selection) ? selection.getTextContent() : '';
								});
								onRequestComment(text);
							}}
							title="Add comment"
						>
							<CommentAddIcon />
						</button>
					) : null}
					{onToggleCommentsPanel ? (
						<button
							type="button"
							style={buttonStyle(Boolean(isCommentsPanelOpen))}
							onMouseDown={(event) => event.preventDefault()}
							onClick={onToggleCommentsPanel}
							title={isCommentsPanelOpen ? 'Hide comments' : 'Show comments'}
						>
							<CommentListIcon />
						</button>
					) : null}
				</>
			) : null}
		</div>
	);
}
