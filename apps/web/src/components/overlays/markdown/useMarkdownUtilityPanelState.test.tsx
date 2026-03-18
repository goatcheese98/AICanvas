import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useMarkdownUtilityPanelState } from './useMarkdownUtilityPanelState';
import { DEFAULT_MARKDOWN_NOTE_SETTINGS } from '@ai-canvas/shared/schemas';
import type { MarkdownNoteSettings } from '@ai-canvas/shared/types';

describe('useMarkdownUtilityPanelState', () => {
	const createMockProps = () => ({
		onSettingsChange: vi.fn((updater) => {
			// Simulate React state update
			if (typeof updater === 'function') {
				updater({
					font: 'Arial',
					fontSize: 14,
					background: '#ffffff',
					lineHeight: 1.5,
					inlineCodeColor: '#ff0000',
					showEmptyLines: false,
					autoHideToolbar: false,
				} as MarkdownNoteSettings);
			}
		}),
		onSurfaceStyleChange: vi.fn(),
	});

	describe('handleSettingsChange', () => {
		it('should call onSettingsChange with updater function', () => {
			const props = createMockProps();
			const { result } = renderHook(() => useMarkdownUtilityPanelState(props));

			result.current.handleSettingsChange({ fontSize: 20 });

			expect(props.onSettingsChange).toHaveBeenCalledTimes(1);
			expect(typeof props.onSettingsChange.mock.calls[0][0]).toBe('function');
		});

		it('should merge updates with current settings', () => {
			const props = createMockProps();
			const { result } = renderHook(() => useMarkdownUtilityPanelState(props));

			result.current.handleSettingsChange({ fontSize: 20, lineHeight: 2.0 });

			const updaterFn = props.onSettingsChange.mock.calls[0][0];
			const current: MarkdownNoteSettings = {
				font: 'Arial',
				fontSize: 14,
				background: '#ffffff',
				lineHeight: 1.5,
				inlineCodeColor: '#ff0000',
				showEmptyLines: false,
				autoHideToolbar: false,
			};
			const resultSettings = updaterFn(current);

			expect(resultSettings).toEqual({
				font: 'Arial',
				fontSize: 20,
				background: '#ffffff',
				lineHeight: 2.0,
				inlineCodeColor: '#ff0000',
				showEmptyLines: false,
				autoHideToolbar: false,
			});
		});
	});

	describe('handleReset', () => {
		it('should reset settings to defaults', () => {
			const props = createMockProps();
			const { result } = renderHook(() => useMarkdownUtilityPanelState(props));

			result.current.handleReset();

			expect(props.onSettingsChange).toHaveBeenCalledTimes(1);
			
			const updaterFn = props.onSettingsChange.mock.calls[0][0];
			const resultSettings = updaterFn({
				font: 'Custom',
				fontSize: 99,
				background: '#000000',
				lineHeight: 3.0,
				inlineCodeColor: '#00ff00',
				showEmptyLines: true,
				autoHideToolbar: true,
			} as MarkdownNoteSettings);

			expect(resultSettings).toEqual(DEFAULT_MARKDOWN_NOTE_SETTINGS);
		});

		it('should reset surface style to defaults', () => {
			const props = createMockProps();
			const { result } = renderHook(() => useMarkdownUtilityPanelState(props));

			result.current.handleReset();

			expect(props.onSurfaceStyleChange).toHaveBeenCalledTimes(1);
			expect(props.onSurfaceStyleChange).toHaveBeenCalledWith({
				backgroundColor: '#ffffff',
				strokeColor: 'rgba(17,24,39,0.09)',
				strokeWidth: 1,
				roundness: null,
			});
		});
	});

	describe('callback stability', () => {
		it('should return stable callbacks', () => {
			const props = createMockProps();
			const { result, rerender } = renderHook(() => useMarkdownUtilityPanelState(props));

			const firstHandleSettingsChange = result.current.handleSettingsChange;
			const firstHandleReset = result.current.handleReset;

			rerender();

			expect(result.current.handleSettingsChange).toBe(firstHandleSettingsChange);
			expect(result.current.handleReset).toBe(firstHandleReset);
		});
	});
});
