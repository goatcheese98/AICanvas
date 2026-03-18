import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
	computePosition,
	requestLinkUrl,
	isValidSelection,
	getSelectionRect,
	TOOLBAR_HEIGHT,
	OFFSET_Y,
	TEXT_COLORS,
	ACCENT_TEXT,
	ACCENT_BG,
	NOTE_FONT_STACK,
} from './floating-toolbar-utils';

describe('floating-toolbar-utils', () => {
	describe('constants', () => {
		it('should have correct toolbar dimensions', () => {
			expect(TOOLBAR_HEIGHT).toBe(34);
			expect(OFFSET_Y).toBe(8);
		});

		it('should have text colors array', () => {
			expect(TEXT_COLORS).toHaveLength(8);
			expect(TEXT_COLORS[0]).toBe('#000000');
			expect(TEXT_COLORS).toContain('#dc2626'); // red
			expect(TEXT_COLORS).toContain('#2563eb'); // blue
		});

		it('should have theme constants', () => {
			expect(ACCENT_TEXT).toBe('#4d55cc');
			expect(ACCENT_BG).toBe('#eef0ff');
			expect(NOTE_FONT_STACK).toContain('SF Pro Text');
		});
	});

	describe('computePosition', () => {
		const originalInnerWidth = window.innerWidth;

		beforeEach(() => {
			Object.defineProperty(window, 'innerWidth', {
				writable: true,
				configurable: true,
				value: 1024,
			});
		});

		afterEach(() => {
			Object.defineProperty(window, 'innerWidth', {
				writable: true,
				configurable: true,
				value: originalInnerWidth,
			});
		});

		it('should position toolbar above selection when there is room', () => {
			const rect = {
				top: 100,
				left: 100,
				width: 200,
				height: 20,
				bottom: 120,
				right: 300,
				x: 100,
				y: 100,
				toJSON: () => ({}),
			} as DOMRect;

			const toolbarWidth = 300;
			const position = computePosition(rect, toolbarWidth);

			// Should be above the selection
			expect(position.top).toBe(rect.top - TOOLBAR_HEIGHT - OFFSET_Y);
			// Should be centered
			expect(position.left).toBe(rect.left + rect.width / 2 - toolbarWidth / 2);
		});

		it('should position toolbar below selection when not enough room above', () => {
			const rect = {
				top: 10, // Too close to top
				left: 100,
				width: 200,
				height: 20,
				bottom: 30,
				right: 300,
				x: 100,
				y: 10,
				toJSON: () => ({}),
			} as DOMRect;

			const toolbarWidth = 300;
			const position = computePosition(rect, toolbarWidth);

			// Should be below the selection
			expect(position.top).toBe(rect.bottom + OFFSET_Y);
		});

		it('should clamp position to left edge', () => {
			const rect = {
				top: 100,
				left: 0,
				width: 50,
				height: 20,
				bottom: 120,
				right: 50,
				x: 0,
				y: 100,
				toJSON: () => ({}),
			} as DOMRect;

			const toolbarWidth = 400;
			const position = computePosition(rect, toolbarWidth);

			// Should be at least 8px from left edge
			expect(position.left).toBe(8);
		});

		it('should clamp position to right edge', () => {
			const rect = {
				top: 100,
				left: 900,
				width: 100,
				height: 20,
				bottom: 120,
				right: 1000,
				x: 900,
				y: 100,
				toJSON: () => ({}),
			} as DOMRect;

			const toolbarWidth = 400;
			const position = computePosition(rect, toolbarWidth);

			// Should be at least 8px from right edge
			expect(position.left).toBe(1024 - toolbarWidth - 8);
		});
	});

	describe('requestLinkUrl', () => {
		const originalPrompt = window.prompt;

		afterEach(() => {
			window.prompt = originalPrompt;
		});

		it('should return trimmed URL when user provides input', () => {
			window.prompt = () => '  https://example.com  ';

			const result = requestLinkUrl();

			expect(result).toBe('https://example.com');
		});

		it('should return null when user cancels', () => {
			window.prompt = () => null;

			const result = requestLinkUrl();

			expect(result).toBeNull();
		});

		it('should return null when user enters empty string', () => {
			window.prompt = () => '   ';

			const result = requestLinkUrl();

			expect(result).toBeNull();
		});

		it('should use default URL in prompt', () => {
			const promptMock = (message?: string, defaultValue?: string): string | null => {
				expect(message).toBe('Enter a URL');
				expect(defaultValue).toBe('https://');
				return 'https://example.com';
			};
			window.prompt = promptMock;

			requestLinkUrl();
		});
	});

	describe('isValidSelection', () => {
		it('should return true for valid selection', () => {
			const mockSelection = {
				isCollapsed: false,
				rangeCount: 1,
				toString: () => 'selected text',
			} as unknown as Selection;

			expect(isValidSelection(mockSelection)).toBe(true);
		});

		it('should return false for null selection', () => {
			expect(isValidSelection(null)).toBe(false);
		});

		it('should return false for collapsed selection', () => {
			const mockSelection = {
				isCollapsed: true,
				rangeCount: 1,
				toString: () => 'text',
			} as unknown as Selection;

			expect(isValidSelection(mockSelection)).toBe(false);
		});

		it('should return false for empty range count', () => {
			const mockSelection = {
				isCollapsed: false,
				rangeCount: 0,
				toString: () => 'text',
			} as unknown as Selection;

			expect(isValidSelection(mockSelection)).toBe(false);
		});

		it('should return false for whitespace-only selection', () => {
			const mockSelection = {
				isCollapsed: false,
				rangeCount: 1,
				toString: () => '   \n\t  ',
			} as unknown as Selection;

			expect(isValidSelection(mockSelection)).toBe(false);
		});
	});

	describe('getSelectionRect', () => {
		const mockRect = {
			top: 100,
			left: 100,
			width: 200,
			height: 20,
			bottom: 120,
			right: 300,
			x: 100,
			y: 100,
			toJSON: () => ({}),
		} as DOMRect;

		const originalGetSelection = window.getSelection;

		afterEach(() => {
			window.getSelection = originalGetSelection;
		});

		it('should return rect for valid selection', () => {
			const mockRange = {
				getBoundingClientRect: () => mockRect,
			} as unknown as Range;

			const mockSelection = {
				rangeCount: 1,
				getRangeAt: () => mockRange,
			} as unknown as Selection;

			window.getSelection = () => mockSelection;

			const result = getSelectionRect();
			expect(result).toEqual(mockRect);
		});

		it('should return null when no selection exists', () => {
			window.getSelection = () => null;

			const result = getSelectionRect();
			expect(result).toBeNull();
		});

		it('should return null when range count is zero', () => {
			const mockSelection = {
				rangeCount: 0,
			} as unknown as Selection;

			window.getSelection = () => mockSelection;

			const result = getSelectionRect();
			expect(result).toBeNull();
		});

		it('should return null when rect has no dimensions', () => {
			const emptyRect = {
				width: 0,
				height: 0,
			} as DOMRect;

			const mockRange = {
				getBoundingClientRect: () => emptyRect,
			} as unknown as Range;

			const mockSelection = {
				rangeCount: 1,
				getRangeAt: () => mockRange,
			} as unknown as Selection;

			window.getSelection = () => mockSelection;

			const result = getSelectionRect();
			expect(result).toBeNull();
		});
	});
});
