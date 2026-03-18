import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import { createElement } from 'react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock dependencies
vi.mock('@clerk/clerk-react', () => ({
	useAuth: () => ({
		getToken: vi.fn().mockResolvedValue('mock-token'),
	}),
}));

vi.mock('@/hooks/useCollaboration', () => ({
	useCollaboration: vi.fn(() => ({
		handleSceneChange: vi.fn(),
		handlePointerUpdate: vi.fn(),
		isConnected: false,
	})),
}));

vi.mock('@/stores/store', () => ({
	useAppStore: vi.fn((selector) => {
		const store = {
			excalidrawApi: null,
			elements: [],
			appState: null,
			files: {},
			setPersistenceState: vi.fn(),
			addToast: vi.fn(),
		};
		return selector(store);
	}),
}));

vi.mock('@/hooks/useMountEffect', () => ({
	useMountEffect: vi.fn((callback) => {
		// Execute callback immediately for testing
		const cleanup = callback();
		return cleanup;
	}),
}));

vi.mock('@/lib/api', () => ({
	api: {
		api: {
			canvas: {
				':id': {
					$get: vi.fn(),
					$put: vi.fn(),
				},
			},
		},
	},
	getRequiredAuthHeaders: vi.fn().mockResolvedValue({ Authorization: 'Bearer mock' }),
	toApiUrl: vi.fn((path) => path),
}));

vi.mock('@/lib/observability', () => ({
	captureBrowserException: vi.fn(),
}));

vi.mock('@/lib/persistence/CanvasPersistenceCoordinator', () => ({
	CanvasPersistenceCoordinator: vi.fn().mockImplementation(() => ({
		scheduleSave: vi.fn(),
		forceSave: vi.fn(),
		loadSnapshotFromStorage: vi.fn().mockReturnValue(null),
		cancelPendingSave: vi.fn(),
		dispose: vi.fn(),
	})),
}));

vi.mock('./canvas-persistence-utils', () => ({
	buildPersistedCanvasData: vi.fn((elements, appState, files) => ({
		elements: [...elements],
		appState: appState ?? {},
		files: files ?? null,
	})),
	shouldWaitForCanvasHydration: vi.fn().mockReturnValue(false),
}));

vi.mock('./ai-vector-resize-normalizer', () => ({
	normalizeAiVectorGroupResize: vi.fn().mockReturnValue(null),
}));

vi.mock('./excalidraw-store-sync', () => ({
	syncAppStoreFromExcalidraw: vi.fn(),
}));

vi.mock('./scene-element-normalizer', () => ({
	normalizeSceneElements: vi.fn((elements) => elements),
}));

vi.mock('./canvas-container-utils', () => ({
	getExportToBlob: vi.fn().mockResolvedValue(vi.fn()),
	getThumbnailSignature: vi.fn().mockReturnValue('mock-signature'),
	toBinaryFiles: vi.fn((files) => files ?? {}),
	toBinaryFileList: vi.fn().mockReturnValue([]),
	toSceneElements: vi.fn((elements) => elements ?? []),
	toSceneUpdateAppState: vi.fn((state) => state ?? {}),
}));

import { useCanvasContainerState } from './useCanvasContainerState';

describe('useCanvasContainerState', () => {
	let queryClient: QueryClient;

	beforeEach(() => {
		queryClient = new QueryClient({
			defaultOptions: {
				queries: {
					retry: false,
				},
			},
		});
		vi.clearAllMocks();
	});

	function wrapper({ children }: { children: ReactNode }) {
		return createElement(QueryClientProvider, { client: queryClient }, children);
	}

	it('should return expected state shape', () => {
		const { result } = renderHook(() => useCanvasContainerState({ canvasId: 'test-canvas' }), {
			wrapper,
		});

		expect(result.current).toHaveProperty('excalidrawApi');
		expect(result.current).toHaveProperty('elements');
		expect(result.current).toHaveProperty('appState');
		expect(result.current).toHaveProperty('files');
		expect(result.current).toHaveProperty('collaboration');
		expect(result.current).toHaveProperty('handleSaveNeeded');
		expect(result.current).toHaveProperty('normalizeSceneChange');
		expect(result.current).toHaveProperty('isInitialized');
		expect(result.current).toHaveProperty('canvasQueryData');
		expect(result.current).toHaveProperty('status');
	});

	it('should initialize collaboration', () => {
		const { result } = renderHook(() => useCanvasContainerState({ canvasId: 'test-canvas' }), {
			wrapper,
		});

		expect(result.current.collaboration).toBeDefined();
		expect(result.current.collaboration.handleSceneChange).toBeDefined();
		expect(result.current.collaboration.handlePointerUpdate).toBeDefined();
	});

	it('should return handler functions', () => {
		const { result } = renderHook(() => useCanvasContainerState({ canvasId: 'test-canvas' }), {
			wrapper,
		});

		expect(typeof result.current.handleSaveNeeded).toBe('function');
		expect(typeof result.current.normalizeSceneChange).toBe('function');
	});

	it('should not be initialized initially', () => {
		const { result } = renderHook(() => useCanvasContainerState({ canvasId: 'test-canvas' }), {
			wrapper,
		});

		// isInitialized starts false and becomes true after mount effect
		expect(result.current.isInitialized).toBe(false);
	});
});
