import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LexicalToolbar } from './LexicalToolbar';

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
	CODE_LANGUAGE_FRIENDLY_NAME_MAP: {},
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

describe('LexicalToolbar', () => {
	it('keeps the copied markdown state tied to the latest click', async () => {
		vi.useFakeTimers();
		vi.stubGlobal('navigator', {
			clipboard: {
				writeText: vi.fn().mockResolvedValue(undefined),
			},
		});

		render(<LexicalToolbar />);

		await act(async () => {
			fireEvent.click(screen.getByRole('button', { name: 'MD' }));
		});
		expect(screen.getByRole('button', { name: 'Copied!' })).toBeTruthy();

		act(() => {
			vi.advanceTimersByTime(1000);
		});

		await act(async () => {
			fireEvent.click(screen.getByRole('button', { name: 'Copied!' }));
		});

		act(() => {
			vi.advanceTimersByTime(1799);
		});
		expect(screen.getByRole('button', { name: 'Copied!' })).toBeTruthy();

		act(() => {
			vi.advanceTimersByTime(1);
		});
		expect(screen.getByRole('button', { name: 'MD' })).toBeTruthy();

		vi.useRealTimers();
	});
});
