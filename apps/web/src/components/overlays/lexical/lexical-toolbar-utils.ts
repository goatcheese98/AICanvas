import { $isCodeNode, CodeNode } from '@lexical/code';
import { $isLinkNode } from '@lexical/link';
import { $isListNode, ListNode } from '@lexical/list';
import { $getNearestNodeOfType } from '@lexical/utils';
import { $isHeadingNode, $isQuoteNode } from '@lexical/rich-text';
import { $getSelection, $isRangeSelection } from 'lexical';
import type { BlockType } from './lexical-toolbar-types';

export function getBlockType(selection: ReturnType<typeof $getSelection>): BlockType {
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

export function requestLinkUrl(): string | null {
	const value = window.prompt('Enter a URL', 'https://');
	if (!value) return null;
	const trimmed = value.trim();
	return trimmed.length === 0 ? null : trimmed;
}

export function getButtonStyle(active: boolean): React.CSSProperties {
	const ACCENT_TEXT = '#4d55cc';
	const ACCENT_BG = '#eef0ff';

	return {
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
	};
}

export function getDividerStyle(): React.CSSProperties {
	return {
		width: 1,
		alignSelf: 'stretch',
		margin: '4px 3px',
		background: '#e7e5e4',
		flexShrink: 0,
	};
}

export function getToolbarContainerStyle(): React.CSSProperties {
	const NOTE_FONT_STACK =
		'"Segoe UI Variable", "SF Pro Text", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif';

	return {
		display: 'flex',
		alignItems: 'center',
		gap: 1,
		padding: '5px 10px',
		borderBottom: '1px solid #e7e5e4',
		background: 'transparent',
		overflowX: 'auto',
		overflowY: 'visible',
		flexShrink: 0,
		flexWrap: 'nowrap',
		minHeight: 40,
		scrollbarWidth: 'none',
		fontFamily: NOTE_FONT_STACK,
	};
}

export function isLinkNodeAtSelection(selection: ReturnType<typeof $getSelection>): boolean {
	if (!$isRangeSelection(selection)) return false;
	const node = selection.anchor.getNode();
	return $isLinkNode(node.getParent()) || $isLinkNode(node);
}

export function getCodeNodeFromSelection(
	selection: ReturnType<typeof $getSelection>,
): CodeNode | null {
	if (!$isRangeSelection(selection)) return null;
	return $getNearestNodeOfType<CodeNode>(selection.anchor.getNode(), CodeNode);
}
