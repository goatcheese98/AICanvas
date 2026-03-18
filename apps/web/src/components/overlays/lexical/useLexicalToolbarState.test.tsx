import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLexicalToolbarState } from './useLexicalToolbarState';

const registerUpdateListener = vi.fn(() => () => {});
const dispatchCommand = vi.fn();
const update = vi.fn();
const readEditorState = vi.fn((callback: () => void) => callback());
const getEditorState = vi.fn(() => ({ read: readEditorState }));

vi.mock('@lexical/react/LexicalComposerContext', () => ({
	useLexicalComposerContext: () => [
		{
			registerUpdateListener,
			dispatchCommand,
			update,
			getEditorState,
		},
	],
}));

vi.mock('lexical', () => ({
	$getSelection: vi.fn(() => null),
	$isRangeSelection: vi.fn(() => false),
	FORMAT_ELEMENT_COMMAND: 'FORMAT_ELEMENT_COMMAND',
	FORMAT_TEXT_COMMAND: 'FORMAT_TEXT_COMMAND',
	REDO_COMMAND: 'REDO_COMMAND',
	UNDO_COMMAND: 'UNDO_COMMAND',
	$createParagraphNode: vi.fn(() => ({})),
}));

vi.mock('@lexical/rich-text', () => ({
	$createHeadingNode: vi.fn(() => ({})),
	$createQuoteNode: vi.fn(() => ({})),
	$isHeadingNode: vi.fn(() => false),
	$isQuoteNode: vi.fn(() => false),
}));

vi.mock('@lexical/list', () => ({
	$isListNode: vi.fn(() => false),
	INSERT_CHECK_LIST_COMMAND: 'INSERT_CHECK_LIST_COMMAND',
	INSERT_ORDERED_LIST_COMMAND: 'INSERT_ORDERED_LIST_COMMAND',
	INSERT_UNORDERED_LIST_COMMAND: 'INSERT_UNORDERED_LIST_COMMAND',
	ListNode: class {},
	REMOVE_LIST_COMMAND: 'REMOVE_LIST_COMMAND',
}));

vi.mock('@lexical/code', () => ({
	$createCodeNode: vi.fn(() => ({})),
	$isCodeNode: vi.fn(() => false),
	CodeNode: class {},
}));

vi.mock('@lexical/link', () => ({
	$isLinkNode: vi.fn(() => false),
	TOGGLE_LINK_COMMAND: 'TOGGLE_LINK_COMMAND',
}));

vi.mock('@lexical/utils', () => ({
	$getNearestNodeOfType: vi.fn(() => null),
	mergeRegister:
		(...cleanups: Array<() => void>) =>
		() => {
			for (const cleanup of cleanups) {
				cleanup();
			}
		},
}));

vi.mock('@lexical/table', () => ({
	INSERT_TABLE_COMMAND: 'INSERT_TABLE_COMMAND',
}));

vi.mock('@lexical/react/LexicalHorizontalRuleNode', () => ({
	INSERT_HORIZONTAL_RULE_COMMAND: 'INSERT_HORIZONTAL_RULE_COMMAND',
}));

vi.mock('@lexical/markdown', () => ({
	$convertToMarkdownString: vi.fn(() => '# Test'),
	TRANSFORMERS: [],
}));

vi.mock('@lexical/selection', () => ({
	$getSelectionStyleValueForProperty: vi.fn(() => ''),
	$patchStyleText: vi.fn(),
	$setBlocksType: vi.fn(),
}));

vi.mock('./plugins/EquationPlugin', () => ({
	INSERT_EQUATION_COMMAND: 'INSERT_EQUATION_COMMAND',
}));

vi.mock('./plugins/ImagesPlugin', () => ({
	INSERT_IMAGE_COMMAND: 'INSERT_IMAGE_COMMAND',
	openImageFilePicker: vi.fn(),
}));

vi.mock('@/hooks/useMountEffect', () => ({
	useMountEffect: vi.fn((fn) => fn()),
}));

vi.mock('@/hooks/useResettableTimeout', () => ({
	useResettableTimeout: () => ({
		schedule: vi.fn(),
		clear: vi.fn(),
	}),
}));

describe('useLexicalToolbarState', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('initializes with default state', () => {
		const { result } = renderHook(() => useLexicalToolbarState());

		expect(result.current.state.blockType).toBe('paragraph');
		expect(result.current.state.isBold).toBe(false);
		expect(result.current.state.isItalic).toBe(false);
		expect(result.current.state.isUnderline).toBe(false);
		expect(result.current.state.isLink).toBe(false);
		expect(result.current.state.textColor).toBe('#000000');
		expect(result.current.state.highlightColor).toBe('');
		expect(result.current.state.codeLanguage).toBe('auto');
		expect(result.current.state.openDropdown).toBeNull();
		expect(result.current.state.markdownCopied).toBe(false);
	});

	it('registers editor update listener on mount', () => {
		renderHook(() => useLexicalToolbarState());
		expect(registerUpdateListener).toHaveBeenCalled();
	});

	it('updates table rows', () => {
		const { result } = renderHook(() => useLexicalToolbarState());

		act(() => {
			result.current.actions.setTableRows('5');
		});

		expect(result.current.state.tableRows).toBe('5');
	});

	it('updates table cols', () => {
		const { result } = renderHook(() => useLexicalToolbarState());

		act(() => {
			result.current.actions.setTableCols('4');
		});

		expect(result.current.state.tableCols).toBe('4');
	});

	it('updates equation value', () => {
		const { result } = renderHook(() => useLexicalToolbarState());

		act(() => {
			result.current.actions.setEquationValue('x^2 + y^2 = r^2');
		});

		expect(result.current.state.equationValue).toBe('x^2 + y^2 = r^2');
	});

	it('updates equation inline state', () => {
		const { result } = renderHook(() => useLexicalToolbarState());

		act(() => {
			result.current.actions.setEquationInline(false);
		});

		expect(result.current.state.equationInline).toBe(false);
	});

	it('toggles dropdown', () => {
		const { result } = renderHook(() => useLexicalToolbarState());

		act(() => {
			result.current.actions.toggleDropdown('table');
		});

		expect(result.current.state.openDropdown).toBe('table');

		act(() => {
			result.current.actions.toggleDropdown('table');
		});

		expect(result.current.state.openDropdown).toBeNull();
	});

	it('closes dropdown', () => {
		const { result } = renderHook(() => useLexicalToolbarState());

		act(() => {
			result.current.actions.toggleDropdown('table');
		});
		expect(result.current.state.openDropdown).toBe('table');

		act(() => {
			result.current.actions.closeDropdown();
		});
		expect(result.current.state.openDropdown).toBeNull();
	});
});
