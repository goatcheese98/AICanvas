import { useMountEffect } from '@/hooks/useMountEffect';
import { $isLinkNode, TOGGLE_LINK_COMMAND } from '@lexical/link';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getSelectionStyleValueForProperty, $patchStyleText } from '@lexical/selection';
import {
	$getSelection,
	$isRangeSelection,
	FORMAT_TEXT_COMMAND,
	type TextFormatType,
} from 'lexical';
import { useCallback, useRef, useState } from 'react';
import {
	ACCENT_BG,
	ACCENT_TEXT,
	TEXT_COLORS,
	computePosition,
	getSelectionRect,
	isValidSelection,
	requestLinkUrl,
} from './floating-toolbar-utils';

export interface ToolbarFormatState {
	isBold: boolean;
	isItalic: boolean;
	isUnderline: boolean;
	isStrikethrough: boolean;
	isSubscript: boolean;
	isSuperscript: boolean;
	isLink: boolean;
	textColor: string;
}

export interface ToolbarPosition {
	top: number;
	left: number;
}

export interface UseFloatingFormatToolbarStateReturn {
	// State
	formatState: ToolbarFormatState;
	isVisible: boolean;
	showColors: boolean;
	colorPickerPos: ToolbarPosition;
	colorButtonRef: React.RefObject<HTMLButtonElement | null>;
	toolbarRef: React.RefObject<HTMLDivElement | null>;
	textColors: readonly string[];
	// Actions
	toggleFormat: (format: TextFormatType) => void;
	applyTextTransform: (transform: 'uppercase' | 'lowercase' | 'capitalize') => void;
	applyTextColor: (color: string) => void;
	toggleColorPicker: () => void;
	handleLinkToggle: () => void;
	buttonStyle: (active: boolean) => React.CSSProperties;
	separatorStyle: React.CSSProperties;
}

/**
 * Hook for managing floating format toolbar state.
 * Handles format state sync with Lexical editor, positioning, and user actions.
 */
export function useFloatingFormatToolbarState(): UseFloatingFormatToolbarStateReturn {
	const [editor] = useLexicalComposerContext();
	const toolbarRef = useRef<HTMLDivElement>(null);
	const colorButtonRef = useRef<HTMLButtonElement>(null);
	const isVisibleRef = useRef(false);

	const [formatState, setFormatState] = useState<ToolbarFormatState>({
		isBold: false,
		isItalic: false,
		isUnderline: false,
		isStrikethrough: false,
		isSubscript: false,
		isSuperscript: false,
		isLink: false,
		textColor: '#000000',
	});
	const [isVisible, setIsVisible] = useState(false);
	const [showColors, setShowColors] = useState(false);
	const [colorPickerPos, setColorPickerPos] = useState<ToolbarPosition>({ top: 0, left: 0 });

	// Initialize toolbar visibility on mount
	useMountEffect(() => {
		if (!toolbarRef.current) return;
		toolbarRef.current.style.visibility = 'hidden';
		toolbarRef.current.style.top = '0px';
		toolbarRef.current.style.left = '0px';
	});

	// Sync format state with Lexical editor selection
	const syncState = useCallback(() => {
		const selection = $getSelection();
		if (
			!$isRangeSelection(selection) ||
			selection.isCollapsed() ||
			selection.getTextContent().length === 0
		) {
			if (toolbarRef.current) toolbarRef.current.style.visibility = 'hidden';
			isVisibleRef.current = false;
			setIsVisible(false);
			setShowColors(false);
			return;
		}

		setFormatState({
			isBold: selection.hasFormat('bold'),
			isItalic: selection.hasFormat('italic'),
			isUnderline: selection.hasFormat('underline'),
			isStrikethrough: selection.hasFormat('strikethrough'),
			isSubscript: selection.hasFormat('subscript'),
			isSuperscript: selection.hasFormat('superscript'),
			textColor: $getSelectionStyleValueForProperty(selection, 'color', '#000000'),
			isLink: (() => {
				const node = selection.anchor.getNode();
				return $isLinkNode(node.getParent()) || $isLinkNode(node);
			})(),
		});

		// Update position
		if (!toolbarRef.current) return;
		const rect = getSelectionRect();
		if (!rect) return;

		const toolbarWidth = toolbarRef.current.offsetWidth || 300;
		const { top, left } = computePosition(rect, toolbarWidth);
		toolbarRef.current.style.top = `${top}px`;
		toolbarRef.current.style.left = `${left}px`;
		toolbarRef.current.style.visibility = 'visible';
		isVisibleRef.current = true;
		setIsVisible(true);
	}, []);

	// Register Lexical update listener for selection changes
	useMountEffect(() => {
		// Check selection on mount and on every editor update
		const unsubscribe = editor.registerUpdateListener(({ editorState }) => {
			editorState.read(() => syncState());
		});
		return unsubscribe;
	});

	// Handle document selection changes (for hiding toolbar when selection is cleared)
	useMountEffect(() => {
		const onSelectionChange = () => {
			const domSelection = window.getSelection();
			if (!isValidSelection(domSelection)) {
				if (toolbarRef.current) toolbarRef.current.style.visibility = 'hidden';
				isVisibleRef.current = false;
				setIsVisible(false);
				setShowColors(false);
			}
		};

		document.addEventListener('selectionchange', onSelectionChange);
		return () => document.removeEventListener('selectionchange', onSelectionChange);
	});

	const toggleFormat = useCallback(
		(format: TextFormatType) => {
			editor.dispatchCommand(FORMAT_TEXT_COMMAND, format);
		},
		[editor],
	);

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

	const applyTextColor = useCallback(
		(color: string) => {
			editor.update(() => {
				const selection = $getSelection();
				if ($isRangeSelection(selection)) {
					$patchStyleText(selection, { color });
				}
			});
			setShowColors(false);
		},
		[editor],
	);

	const toggleColorPicker = useCallback(() => {
		if (!colorButtonRef.current) return;
		const rect = colorButtonRef.current.getBoundingClientRect();
		setColorPickerPos({ top: rect.bottom + 6, left: rect.left });
		setShowColors((current) => !current);
	}, []);

	const handleLinkToggle = useCallback(() => {
		if (formatState.isLink) {
			editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
			return;
		}
		const url = requestLinkUrl();
		if (url) editor.dispatchCommand(TOGGLE_LINK_COMMAND, url);
	}, [editor, formatState.isLink]);

	const buttonStyle = useCallback(
		(active: boolean): React.CSSProperties => ({
			display: 'inline-flex',
			alignItems: 'center',
			justifyContent: 'center',
			width: 28,
			height: 28,
			padding: 0,
			border: 'none',
			borderRadius: 5,
			background: active ? ACCENT_BG : 'transparent',
			color: active ? ACCENT_TEXT : '#57534e',
			cursor: 'pointer',
			flexShrink: 0,
			fontSize: 12,
			fontWeight: active ? 700 : 500,
			transition: 'background 0.12s ease, color 0.12s ease',
		}),
		[],
	);

	const separatorStyle: React.CSSProperties = {
		width: 1,
		alignSelf: 'stretch',
		margin: '5px 2px',
		background: '#e7e5e4',
		flexShrink: 0,
	};

	return {
		formatState,
		isVisible,
		showColors,
		colorPickerPos,
		colorButtonRef,
		toolbarRef,
		textColors: TEXT_COLORS,
		toggleFormat,
		applyTextTransform,
		applyTextColor,
		toggleColorPicker,
		handleLinkToggle,
		buttonStyle,
		separatorStyle,
	};
}
