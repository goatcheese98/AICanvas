import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useWebEmbedState } from './useWebEmbedState';

describe('useWebEmbedState', () => {
	const createElement = (url = '') => ({
		id: 'test-embed-1',
		customData: { url },
	});

	describe('initial state', () => {
		it('initializes with empty url and editing mode when no url provided', () => {
			const { result } = renderHook(() =>
				useWebEmbedState({
					element: createElement(''),
					onChange: vi.fn(),
				}),
			);

			expect(result.current.urlInput).toBe('');
			expect(result.current.isEditing).toBe(true);
			expect(result.current.viewMode).toBe('inline');
			expect(result.current.isLoading).toBe(false);
		});

		it('initializes with provided url and view mode when url exists', () => {
			const { result } = renderHook(() =>
				useWebEmbedState({
					element: createElement('https://example.com'),
					onChange: vi.fn(),
				}),
			);

			expect(result.current.urlInput).toBe('https://example.com');
			expect(result.current.isEditing).toBe(false);
		});

		it('reports initial activity state via onActivityChange', () => {
			const onActivityChange = vi.fn();

			renderHook(() =>
				useWebEmbedState({
					element: createElement('https://example.com'),
					onChange: vi.fn(),
					onActivityChange,
				}),
			);

			// Should report initial state (false since not editing and inline mode)
			expect(onActivityChange).toHaveBeenCalledWith(false);
		});
	});

	describe('activity reporting', () => {
		it('reports active when entering edit mode', () => {
			const onActivityChange = vi.fn();

			const { result } = renderHook(() =>
				useWebEmbedState({
					element: createElement('https://example.com'),
					onChange: vi.fn(),
					onActivityChange,
				}),
			);

			// Clear initial call
			onActivityChange.mockClear();

			act(() => {
				result.current.handleStartEditing();
			});

			expect(onActivityChange).toHaveBeenCalledWith(true);
		});

		it('reports inactive when exiting edit mode', () => {
			const onActivityChange = vi.fn();

			const { result } = renderHook(() =>
				useWebEmbedState({
					element: createElement('https://example.com'),
					onChange: vi.fn(),
					onActivityChange,
				}),
			);

			// Enter edit mode first
			act(() => {
				result.current.handleStartEditing();
			});

			// Clear calls
			onActivityChange.mockClear();

			act(() => {
				result.current.handleStopEditing();
			});

			expect(onActivityChange).toHaveBeenCalledWith(false);
		});

		it('reports active when entering PiP mode', () => {
			const onActivityChange = vi.fn();

			const { result } = renderHook(() =>
				useWebEmbedState({
					element: createElement('https://example.com'),
					onChange: vi.fn(),
					onActivityChange,
				}),
			);

			// Clear initial call
			onActivityChange.mockClear();

			act(() => {
				result.current.handleTogglePip();
			});

			expect(onActivityChange).toHaveBeenCalledWith(true);
		});

		it('reports active when entering expanded mode', () => {
			const onActivityChange = vi.fn();

			const { result } = renderHook(() =>
				useWebEmbedState({
					element: createElement('https://example.com'),
					onChange: vi.fn(),
					onActivityChange,
				}),
			);

			// Clear initial call
			onActivityChange.mockClear();

			act(() => {
				result.current.handleToggleExpand();
			});

			expect(onActivityChange).toHaveBeenCalledWith(true);
		});

		it('does not re-report the same activity state', () => {
			const onActivityChange = vi.fn();

			const { rerender } = renderHook(
				(props: { element: { id: string; customData: { url: string } } }) =>
					useWebEmbedState({
						element: props.element,
						onChange: vi.fn(),
						onActivityChange,
					}),
				{
					initialProps: { element: createElement('https://example.com') },
				},
			);

			// Clear initial calls
			const callCount = onActivityChange.mock.calls.length;

			// Re-render without state change
			rerender({ element: createElement('https://example.com') });

			expect(onActivityChange.mock.calls.length).toBe(callCount);
		});
	});

	describe('URL handling', () => {
		it('updates urlInput when setUrlInput is called', () => {
			const { result } = renderHook(() =>
				useWebEmbedState({
					element: createElement(''),
					onChange: vi.fn(),
				}),
			);

			act(() => {
				result.current.setUrlInput('https://new-url.com');
			});

			expect(result.current.urlInput).toBe('https://new-url.com');
		});

		it('calls onChange with trimmed URL when submitting', () => {
			const onChange = vi.fn();

			const { result } = renderHook(() =>
				useWebEmbedState({
					element: createElement(''),
					onChange,
				}),
			);

			act(() => {
				result.current.setUrlInput('  https://example.com  ');
			});

			act(() => {
				result.current.handleSubmitUrl();
			});

			expect(onChange).toHaveBeenCalledWith('test-embed-1', 'https://example.com');
			expect(result.current.isEditing).toBe(false);
			expect(result.current.isLoading).toBe(true);
		});

		it('syncs urlInput from external element updates', () => {
			const { result, rerender } = renderHook(
				(props: { element: { id: string; customData: { url: string } } }) =>
					useWebEmbedState({
						element: props.element,
						onChange: vi.fn(),
					}),
				{
					initialProps: { element: createElement('') },
				},
			);

			expect(result.current.urlInput).toBe('');
			expect(result.current.isEditing).toBe(true);

			rerender({ element: createElement('https://example.com') });

			expect(result.current.urlInput).toBe('https://example.com');
			expect(result.current.isEditing).toBe(false);
			expect(result.current.isLoading).toBe(false);
		});
	});

	describe('view mode transitions', () => {
		it('toggles to PiP mode from inline', () => {
			const { result } = renderHook(() =>
				useWebEmbedState({
					element: createElement('https://example.com'),
					onChange: vi.fn(),
				}),
			);

			act(() => {
				result.current.handleTogglePip();
			});

			expect(result.current.viewMode).toBe('pip');
		});

		it('toggles back to inline from PiP mode', () => {
			const { result } = renderHook(() =>
				useWebEmbedState({
					element: createElement('https://example.com'),
					onChange: vi.fn(),
				}),
			);

			// Enter PiP
			act(() => {
				result.current.handleTogglePip();
			});

			// Exit PiP
			act(() => {
				result.current.handleTogglePip();
			});

			expect(result.current.viewMode).toBe('inline');
		});

		it('toggles to expanded mode from inline', () => {
			const { result } = renderHook(() =>
				useWebEmbedState({
					element: createElement('https://example.com'),
					onChange: vi.fn(),
				}),
			);

			act(() => {
				result.current.handleToggleExpand();
			});

			expect(result.current.viewMode).toBe('expanded');
		});

		it('toggles back to inline from expanded mode', () => {
			const { result } = renderHook(() =>
				useWebEmbedState({
					element: createElement('https://example.com'),
					onChange: vi.fn(),
				}),
			);

			// Enter expanded
			act(() => {
				result.current.handleToggleExpand();
			});

			// Exit expanded
			act(() => {
				result.current.handleToggleExpand();
			});

			expect(result.current.viewMode).toBe('inline');
		});
	});

	describe('edit mode', () => {
		it('toggles edit mode with handleToggleEdit', () => {
			const { result } = renderHook(() =>
				useWebEmbedState({
					element: createElement('https://example.com'),
					onChange: vi.fn(),
				}),
			);

			expect(result.current.isEditing).toBe(false);

			act(() => {
				result.current.handleToggleEdit();
			});

			expect(result.current.isEditing).toBe(true);

			act(() => {
				result.current.handleToggleEdit();
			});

			expect(result.current.isEditing).toBe(false);
		});

		it('explicitly starts editing with handleStartEditing', () => {
			const { result } = renderHook(() =>
				useWebEmbedState({
					element: createElement('https://example.com'),
					onChange: vi.fn(),
				}),
			);

			act(() => {
				result.current.handleStartEditing();
			});

			expect(result.current.isEditing).toBe(true);
		});

		it('explicitly stops editing with handleStopEditing', () => {
			const { result } = renderHook(() =>
				useWebEmbedState({
					element: createElement(''),
					onChange: vi.fn(),
				}),
			);

			// Starts in editing mode because no URL
			expect(result.current.isEditing).toBe(true);

			act(() => {
				result.current.handleStopEditing();
			});

			expect(result.current.isEditing).toBe(false);
		});
	});

	describe('PiP position management', () => {
		it('provides default PiP position', () => {
			const { result } = renderHook(() =>
				useWebEmbedState({
					element: createElement('https://example.com'),
					onChange: vi.fn(),
				}),
			);

			// Default position should be in viewport
			expect(result.current.pipPosition.x).toBeGreaterThan(0);
			expect(result.current.pipPosition.y).toBeGreaterThan(0);
		});

		it('clamps PiP position when setting', () => {
			const { result } = renderHook(() =>
				useWebEmbedState({
					element: createElement('https://example.com'),
					onChange: vi.fn(),
				}),
			);

			act(() => {
				result.current.setPipPosition({ x: -1000, y: -1000 });
			});

			// Should be clamped to minimum values
			expect(result.current.pipPosition.x).toBeGreaterThanOrEqual(20);
			expect(result.current.pipPosition.y).toBeGreaterThanOrEqual(88);
		});

		it('clears PiP drag listeners', () => {
			const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

			const { result } = renderHook(() =>
				useWebEmbedState({
					element: createElement('https://example.com'),
					onChange: vi.fn(),
				}),
			);

			// Set up a mock cleanup function
			const mockCleanup = vi.fn();
			result.current.pipDragCleanupRef.current = mockCleanup;

			act(() => {
				result.current.clearPipDragListeners();
			});

			expect(mockCleanup).toHaveBeenCalled();

			removeEventListenerSpy.mockRestore();
		});
	});

	describe('derived state', () => {
		it('calculates PiP dimensions from viewport', () => {
			const { result } = renderHook(() =>
				useWebEmbedState({
					element: createElement('https://example.com'),
					onChange: vi.fn(),
				}),
			);

			expect(result.current.pipDimensions.width).toBeGreaterThan(0);
			expect(result.current.pipDimensions.height).toBeGreaterThan(0);
		});

		it('calculates isActivelyActive correctly', () => {
			const { result } = renderHook(() =>
				useWebEmbedState({
					element: createElement('https://example.com'),
					onChange: vi.fn(),
				}),
			);

			// Initially not editing and inline mode
			expect(result.current.isActivelyActive).toBe(false);

			// Enter edit mode
			act(() => {
				result.current.handleStartEditing();
			});

			expect(result.current.isActivelyActive).toBe(true);

			// Exit edit mode
			act(() => {
				result.current.handleStopEditing();
			});

			expect(result.current.isActivelyActive).toBe(false);

			// Enter PiP mode
			act(() => {
				result.current.handleTogglePip();
			});

			expect(result.current.isActivelyActive).toBe(true);
		});
	});

	describe('viewport sync', () => {
		it('provides viewport dimensions from window', () => {
			const { result } = renderHook(() =>
				useWebEmbedState({
					element: createElement('https://example.com'),
					onChange: vi.fn(),
				}),
			);

			expect(result.current.viewport.width).toBe(window.innerWidth);
			expect(result.current.viewport.height).toBe(window.innerHeight);
		});
	});
});
