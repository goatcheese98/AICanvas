import * as api from '@/lib/api';
import { useAppStore } from '@/stores/store';
import type { AssistantThread, CanvasElement } from '@ai-canvas/shared/types';
import { useAuth } from '@clerk/clerk-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AIChatPanel } from './AIChatPanel';

vi.mock('@clerk/clerk-react', () => ({
	useAuth: vi.fn(),
}));

vi.mock('@/stores/store', () => ({
	useAppStore: vi.fn(),
}));

vi.mock('@/lib/api', async (importOriginal) => {
	const original = await importOriginal<typeof import('@/lib/api')>();
	return {
		...original,
		getRequiredAuthHeaders: vi.fn(),
		fetchAssistantCapabilities: vi.fn(),
		fetchAssistantThreads: vi.fn(),
	};
});

function renderWithQueryClient(children: ReactNode) {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				retry: false,
			},
		},
	});

	return render(<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>);
}

describe('AIChatPanel characterization', () => {
	const canvasId = 'canvas-test-id';
	const mockGetToken = vi.fn<() => Promise<string | null>>();
	const mockSetElements = vi.fn();
	const mockSetFiles = vi.fn();
	const mockSetIsChatLoading = vi.fn();
	const mockSetChatError = vi.fn();
	const mockUpdateScene = vi.fn();
	const mockAddFiles = vi.fn();

	const mockElements: CanvasElement[] = [];
	const mockSelectedElementIds: Record<string, boolean> = {};

	beforeEach(() => {
		vi.clearAllMocks();
		mockElements.length = 0;
		for (const key of Object.keys(mockSelectedElementIds)) {
			delete mockSelectedElementIds[key];
		}

		vi.mocked(useAuth).mockReturnValue({
			getToken: mockGetToken,
			isSignedIn: true,
		} as unknown as ReturnType<typeof useAuth>);

		vi.mocked(useAppStore).mockImplementation((selector) =>
			selector({
				excalidrawApi: {
					updateScene: mockUpdateScene,
					getSceneElements: () => [],
					addFiles: mockAddFiles,
				},
				isChatLoading: false,
				chatError: null,
				elements: mockElements,
				appState: {
					selectedElementIds: mockSelectedElementIds,
				},
				setElements: mockSetElements,
				setFiles: mockSetFiles,
				setIsChatLoading: mockSetIsChatLoading,
				setChatError: mockSetChatError,
			} as never),
		);

		vi.mocked(api.getRequiredAuthHeaders).mockResolvedValue({
			Authorization: 'Bearer test-token',
		});
		vi.mocked(api.fetchAssistantCapabilities).mockResolvedValue({
			vectorizationEnabled: false,
			svgGenerationEnabled: true,
		});
		vi.mocked(api.fetchAssistantThreads).mockResolvedValue([]);
	});

	it('renders the signed-in composer and loads threads on mount', async () => {
		renderWithQueryClient(<AIChatPanel canvasId={canvasId} />);

		expect(
			screen.getByPlaceholderText('Describe the result you want on the canvas...'),
		).toBeTruthy();
		expect(screen.getByRole('button', { name: 'New Chat' })).toBeTruthy();
		expect(screen.queryByLabelText('Canvas context')).toBeNull();
		expect(screen.queryByLabelText('Output style')).toBeNull();
		expect(screen.getByText('No saved chats for this canvas yet.')).toBeTruthy();
		expect(
			screen.getByText(
				(_, node) =>
					node?.textContent?.replace(/\s+/g, ' ').trim() ===
					'Type / for commands. Cmd/Ctrl+Enter to send.',
			),
		).toBeTruthy();

		await waitFor(() => {
			expect(api.getRequiredAuthHeaders).toHaveBeenCalledWith(mockGetToken);
			expect(api.fetchAssistantThreads).toHaveBeenCalledWith(canvasId, {
				Authorization: 'Bearer test-token',
			});
		});
	});

	it('renders fetched threads using the live thread title', async () => {
		const threads: AssistantThread[] = [
			{
				id: 'thread-1',
				canvasId,
				title: 'Launch planning',
				messages: [],
				createdAt: '2026-03-13T10:00:00.000Z',
				updatedAt: '2026-03-13T10:05:00.000Z',
			},
		];
		vi.mocked(api.fetchAssistantThreads).mockResolvedValue(threads);

		renderWithQueryClient(<AIChatPanel canvasId={canvasId} />);

		expect(await screen.findByRole('button', { name: /launch planning/i })).toBeTruthy();
	});

	it('shows selection as automatic context instead of a context toggle', async () => {
		mockElements.push({
			id: 'el-1',
			type: 'rectangle',
			x: 0,
			y: 0,
			width: 100,
			height: 80,
			angle: 0,
			strokeColor: '#000000',
			backgroundColor: 'transparent',
			fillStyle: 'solid',
			strokeWidth: 1,
			strokeStyle: 'solid',
			roughness: 0,
			opacity: 100,
			groupIds: [],
			frameId: null,
			roundness: null,
			seed: 1,
			version: 1,
			versionNonce: 1,
			isDeleted: false,
			boundElements: null,
			updated: 1,
			link: null,
			locked: false,
		} as CanvasElement);
		mockSelectedElementIds['el-1'] = true;

		renderWithQueryClient(<AIChatPanel canvasId={canvasId} />);

		expect(screen.queryByLabelText('Canvas context')).toBeNull();
		expect(
			screen.getAllByText(/The assistant will use it automatically when it helps\./i).length,
		).toBeGreaterThan(0);
		await waitFor(() => {
			expect(api.fetchAssistantThreads).toHaveBeenCalledWith(canvasId, {
				Authorization: 'Bearer test-token',
			});
		});
	});
});
