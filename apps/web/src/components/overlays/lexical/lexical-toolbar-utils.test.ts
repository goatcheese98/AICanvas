import { describe, expect, it, vi } from 'vitest';
import {
	getBlockType,
	requestLinkUrl,
	getButtonStyle,
	getDividerStyle,
	getToolbarContainerStyle,
	isLinkNodeAtSelection,
	getCodeNodeFromSelection,
} from './lexical-toolbar-utils';
import type { BlockType } from './lexical-toolbar-types';

// Mock lexical modules
vi.mock('@lexical/code', () => ({
	$isCodeNode: vi.fn(() => false),
	CodeNode: class {},
}));

vi.mock('@lexical/link', () => ({
	$isLinkNode: vi.fn(() => false),
}));

vi.mock('@lexical/list', () => ({
	$isListNode: vi.fn(() => false),
	ListNode: class {},
}));

vi.mock('@lexical/rich-text', () => ({
	$isHeadingNode: vi.fn(() => false),
	$isQuoteNode: vi.fn(() => false),
}));

vi.mock('@lexical/utils', () => ({
	$getNearestNodeOfType: vi.fn(() => null),
}));

vi.mock('lexical', () => ({
	$isRangeSelection: vi.fn(() => true),
}));

describe('lexical-toolbar-utils', () => {
	describe('getButtonStyle', () => {
		it('returns inactive button style when active is false', () => {
			const style = getButtonStyle(false);
			expect(style.background).toBe('transparent');
			expect(style.color).toBe('#57534e');
			expect(style.fontWeight).toBe(500);
		});

		it('returns active button style when active is true', () => {
			const style = getButtonStyle(true);
			expect(style.background).toBe('#eef0ff');
			expect(style.color).toBe('#4d55cc');
			expect(style.fontWeight).toBe(700);
		});
	});

	describe('getDividerStyle', () => {
		it('returns correct divider styles', () => {
			const style = getDividerStyle();
			expect(style.width).toBe(1);
			expect(style.background).toBe('#e7e5e4');
			expect(style.flexShrink).toBe(0);
		});
	});

	describe('getToolbarContainerStyle', () => {
		it('returns correct container styles', () => {
			const style = getToolbarContainerStyle();
			expect(style.display).toBe('flex');
			expect(style.alignItems).toBe('center');
			expect(style.borderBottom).toBe('1px solid #e7e5e4');
			expect(style.minHeight).toBe(40);
		});
	});

	describe('requestLinkUrl', () => {
		it('returns trimmed URL when user enters value', () => {
			const mockPrompt = vi.fn().mockReturnValue('  https://example.com  ');
			vi.stubGlobal('window', { prompt: mockPrompt });

			const result = requestLinkUrl();

			expect(mockPrompt).toHaveBeenCalledWith('Enter a URL', 'https://');
			expect(result).toBe('https://example.com');
		});

		it('returns null when user cancels prompt', () => {
			const mockPrompt = vi.fn().mockReturnValue(null);
			vi.stubGlobal('window', { prompt: mockPrompt });

			const result = requestLinkUrl();

			expect(result).toBeNull();
		});

		it('returns null when user enters empty string', () => {
			const mockPrompt = vi.fn().mockReturnValue('   ');
			vi.stubGlobal('window', { prompt: mockPrompt });

			const result = requestLinkUrl();

			expect(result).toBeNull();
		});
	});
});
