import { render, screen, waitFor } from '@testing-library/react';
import { useAuth } from '@clerk/clerk-react';
import type { AssistantThread, CanvasElement } from '@ai-canvas/shared/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '@/lib/api';
import { useAppStore } from '@/stores/store';
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

describe('AIChatPanel characterization', () => {
	const canvasId = 'canvas-test-id';
	const mockGetToken = vi.fn<() => Promise<string | null>>();
	const mockSetElements = vi.fn();
	const mockSetFiles = vi.fn();
	const mockSetIsChatLoading = vi.fn();
	const mockSetChatError = vi.fn();
	const mockSetContextMode = vi.fn();
	const mockUpdateScene = vi.fn();
	const mockAddFiles = vi.fn();

	const mockElements: CanvasElement[] = [];
	const mockSelectedElementIds: Record<string, boolean> = {};

	beforeEach(() => {
		vi.clearAllMocks();

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
				contextMode: 'all',
				elements: mockElements,
				appState: {
					selectedElementIds: mockSelectedElementIds,
				},
				setElements: mockSetElements,
				setFiles: mockSetFiles,
				setIsChatLoading: mockSetIsChatLoading,
				setChatError: mockSetChatError,
				setContextMode: mockSetContextMode,
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
		render(<AIChatPanel canvasId={canvasId} />);

		expect(
			screen.getByPlaceholderText('Describe the result you want on the canvas...'),
		).toBeTruthy();
		expect(screen.getByRole('button', { name: 'New Chat' })).toBeTruthy();
		expect(screen.getByLabelText('Output style')).toBeTruthy();

		await waitFor(() => {
			expect(api.getRequiredAuthHeaders).toHaveBeenCalledWith(mockGetToken);
			expect(api.fetchAssistantCapabilities).toHaveBeenCalledWith({
				Authorization: 'Bearer test-token',
			});
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

		render(<AIChatPanel canvasId={canvasId} />);

		expect(await screen.findByRole('button', { name: /launch planning/i })).toBeTruthy();
	});
});
