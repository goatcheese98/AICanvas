import type { CollaborationSessionStatus } from '@/hooks/collaboration-utils';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCanvasUIState } from './useCanvasUIState';

// Mock the app store
vi.mock('@/stores/store', () => ({
	useAppStore: vi.fn((selector) => {
		const state = {
			activePanel: 'none' as const,
			setActivePanel: vi.fn(),
			excalidrawApi: null,
			elements: [],
			appState: null,
			addToast: vi.fn(),
		};
		return selector(state);
	}),
}));

describe('useCanvasUIState', () => {
	const mockAddEventListener = vi.fn();
	const mockRemoveEventListener = vi.fn();

	beforeEach(() => {
		Object.defineProperty(globalThis, 'window', {
			value: {
				innerWidth: 1024,
				innerHeight: 768,
				addEventListener: mockAddEventListener,
				removeEventListener: mockRemoveEventListener,
			},
			writable: true,
		});
		mockAddEventListener.mockClear();
		mockRemoveEventListener.mockClear();
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it('should initialize with default values', () => {
		const { result } = renderHook(() =>
			useCanvasUIState({
				canvasId: 'test-canvas',
				sessionStatus: 'idle' as CollaborationSessionStatus,
			}),
		);

		expect(result.current.activePanel).toBe('none');
		expect(result.current.isInsertMenuOpen).toBe(false);
		expect(result.current.insertMenuRef.current).toBeNull();
	});

	it('should subscribe to window resize on mount', () => {
		renderHook(() =>
			useCanvasUIState({
				canvasId: 'test-canvas',
				sessionStatus: 'idle' as CollaborationSessionStatus,
			}),
		);

		expect(mockAddEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
	});

	it('should unsubscribe from window resize on unmount', () => {
		const { unmount } = renderHook(() =>
			useCanvasUIState({
				canvasId: 'test-canvas',
				sessionStatus: 'idle' as CollaborationSessionStatus,
			}),
		);

		unmount();

		expect(mockRemoveEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
	});

	it('should toggle insert menu', () => {
		const { result } = renderHook(() =>
			useCanvasUIState({
				canvasId: 'test-canvas',
				sessionStatus: 'idle' as CollaborationSessionStatus,
			}),
		);

		expect(result.current.isInsertMenuOpen).toBe(false);

		act(() => {
			result.current.toggleInsertMenu();
		});

		expect(result.current.isInsertMenuOpen).toBe(true);

		act(() => {
			result.current.toggleInsertMenu();
		});

		expect(result.current.isInsertMenuOpen).toBe(false);
	});

	it('should set insert menu open state directly', () => {
		const { result } = renderHook(() =>
			useCanvasUIState({
				canvasId: 'test-canvas',
				sessionStatus: 'idle' as CollaborationSessionStatus,
			}),
		);

		act(() => {
			result.current.setIsInsertMenuOpen(true);
		});

		expect(result.current.isInsertMenuOpen).toBe(true);

		act(() => {
			result.current.setIsInsertMenuOpen(false);
		});

		expect(result.current.isInsertMenuOpen).toBe(false);
	});

	it('should update active panel', () => {
		const { result } = renderHook(() =>
			useCanvasUIState({
				canvasId: 'test-canvas',
				sessionStatus: 'idle' as CollaborationSessionStatus,
			}),
		);

		// Note: setActivePanel is mocked, but we can verify it's a function
		expect(typeof result.current.setActivePanel).toBe('function');
	});

	it('should expose resize handlers as functions', () => {
		const { result } = renderHook(() =>
			useCanvasUIState({
				canvasId: 'test-canvas',
				sessionStatus: 'idle' as CollaborationSessionStatus,
			}),
		);

		expect(typeof result.current.startSidePanelResize).toBe('function');
		expect(typeof result.current.startChatPanelResize).toBe('function');
		expect(typeof result.current.startChatHeightResize).toBe('function');
	});

	it('should expose insertOverlay as a function', () => {
		const { result } = renderHook(() =>
			useCanvasUIState({
				canvasId: 'test-canvas',
				sessionStatus: 'idle' as CollaborationSessionStatus,
			}),
		);

		expect(typeof result.current.insertOverlay).toBe('function');
	});
});
