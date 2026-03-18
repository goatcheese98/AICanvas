import { useCallback, useRef, useState } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { mergeRegister } from '@lexical/utils';
import {
	$getSelection,
	$isRangeSelection,
	FORMAT_ELEMENT_COMMAND,
	FORMAT_TEXT_COMMAND,
	REDO_COMMAND,
	UNDO_COMMAND,
	$createParagraphNode,
} from 'lexical';
import { $setBlocksType, $getSelectionStyleValueForProperty, $patchStyleText } from '@lexical/selection';
import {
	$createHeadingNode,
	$createQuoteNode,
	type HeadingTagType,
} from '@lexical/rich-text';
import {
	$createCodeNode,
	CodeNode,
} from '@lexical/code';
import {
	INSERT_UNORDERED_LIST_COMMAND,
	INSERT_ORDERED_LIST_COMMAND,
	INSERT_CHECK_LIST_COMMAND,
	REMOVE_LIST_COMMAND,
} from '@lexical/list';
import { $isLinkNode, TOGGLE_LINK_COMMAND } from '@lexical/link';
import { $convertToMarkdownString, TRANSFORMERS } from '@lexical/markdown';
import { INSERT_TABLE_COMMAND } from '@lexical/table';
import { INSERT_HORIZONTAL_RULE_COMMAND } from '@lexical/react/LexicalHorizontalRuleNode';
import { useMountEffect } from '@/hooks/useMountEffect';
import { useResettableTimeout } from '@/hooks/useResettableTimeout';
import { INSERT_EQUATION_COMMAND } from './plugins/EquationPlugin';
import { INSERT_IMAGE_COMMAND, openImageFilePicker } from './plugins/ImagesPlugin';
import {
	getBlockType,
	requestLinkUrl,
	isLinkNodeAtSelection,
	getCodeNodeFromSelection,
} from './lexical-toolbar-utils';
import type { BlockType, ToolbarDropdownType, ToolbarState, ToolbarActions } from './lexical-toolbar-types';

export interface UseLexicalToolbarStateReturn {
	editor: ReturnType<typeof useLexicalComposerContext>[0];
	state: ToolbarState;
	actions: ToolbarActions;
	refs: {
		textColorRef: React.RefObject<HTMLButtonElement | null>;
		highlightRef: React.RefObject<HTMLButtonElement | null>;
		tableRef: React.RefObject<HTMLButtonElement | null>;
		equationRef: React.RefObject<HTMLButtonElement | null>;
	};
}

export function useLexicalToolbarState(): UseLexicalToolbarStateReturn {
	const [editor] = useLexicalComposerContext();

	// Format state
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

	// UI state
	const [openDropdown, setOpenDropdown] = useState<ToolbarDropdownType>(null);
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

	// Toolbar update logic - derived from editor state
	const updateToolbar = useCallback(() => {
		const selection = $getSelection();
		if (!$isRangeSelection(selection)) return;

		setIsBold(selection.hasFormat('bold'));
		setIsItalic(selection.hasFormat('italic'));
		setIsUnderline(selection.hasFormat('underline'));
		setIsStrikethrough(selection.hasFormat('strikethrough'));
		setIsSubscript(selection.hasFormat('subscript'));
		setIsSuperscript(selection.hasFormat('superscript'));

		const currentBlockType = getBlockType(selection);
		setBlockType(currentBlockType);

		if (currentBlockType === 'code') {
			const codeNode = getCodeNodeFromSelection(selection);
			setCodeLanguage(codeNode?.getLanguage() ?? 'auto');
		}

		setIsLink(isLinkNodeAtSelection(selection));
		setTextColor($getSelectionStyleValueForProperty(selection, 'color', '#000000'));
		setHighlightColor($getSelectionStyleValueForProperty(selection, 'background-color', ''));
	}, []);

	// Register editor update listener (legitimate external system - useMountEffect)
	useMountEffect(() => {
		return mergeRegister(
			editor.registerUpdateListener(({ editorState }) => {
				editorState.read(() => updateToolbar());
			}),
		);
	});

	const closeDropdown = useCallback(() => setOpenDropdown(null), []);
	const toggleDropdown = useCallback(
		(name: ToolbarDropdownType) => setOpenDropdown((current) => (current === name ? null : name)),
		[],
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

	const handleSetCodeLanguage = useCallback(
		(language: string) => {
			setCodeLanguage(language);
			editor.update(() => {
				const selection = $getSelection();
				if (!$isRangeSelection(selection)) return;
				const codeNode = getCodeNodeFromSelection(selection);
				codeNode?.setLanguage(language);
			});
		},
		[editor],
	);

	const state: ToolbarState = {
		blockType,
		isBold,
		isItalic,
		isUnderline,
		isStrikethrough,
		isSubscript,
		isSuperscript,
		isLink,
		textColor,
		highlightColor,
		codeLanguage,
		openDropdown,
		tableRows,
		tableCols,
		equationValue,
		equationInline,
		markdownCopied,
	};

	const actions: ToolbarActions = {
		applyBlockType,
		applyTextColor,
		applyHighlight,
		applyTextTransform,
		insertTable,
		insertEquation,
		insertImage,
		handleLinkToggle,
		copyAsMarkdown,
		setCodeLanguage: handleSetCodeLanguage,
		setOpenDropdown,
		setTableRows,
		setTableCols,
		setEquationValue,
		setEquationInline,
		closeDropdown,
		toggleDropdown,
	};

	return {
		editor,
		state,
		actions,
		refs: {
			textColorRef,
			highlightRef,
			tableRef,
			equationRef,
		},
	};
}
