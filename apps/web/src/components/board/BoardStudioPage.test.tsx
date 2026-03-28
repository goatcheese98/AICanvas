import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BoardStudioPage } from './BoardStudioPage';

const { canvasGetMock, fetchMock, navigateMock, openExpandedOverlayMock, addToastMock } =
	vi.hoisted(() => ({
		canvasGetMock: vi.fn(),
		fetchMock: vi.fn(),
		navigateMock: vi.fn(),
		openExpandedOverlayMock: vi.fn(),
		addToastMock: vi.fn(),
	}));

vi.mock('@clerk/clerk-react', () => ({
	useAuth: () => ({
		getToken: vi.fn().mockResolvedValue('test-token'),
	}),
}));

vi.mock('@/lib/api', () => ({
	api: {
		api: {
			canvas: {
				':id': {
					$get: canvasGetMock,
				},
			},
		},
	},
	getRequiredAuthHeaders: vi.fn().mockResolvedValue({ Authorization: 'Bearer test' }),
	toApiUrl: (path: string) => path,
}));

vi.mock('@/components/shell/ProjectShell', () => ({
	ProjectShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/overlays/kanban/KanbanBoardContainer', () => ({
	KanbanBoardContainer: ({ element }: { element: { customData?: { title?: string } } }) => (
		<div data-testid="board-title">{element.customData?.title}</div>
	),
}));

vi.mock('@/hooks/useCollaboration', () => ({
	useCollaboration: () => ({
		isCollaborating: false,
		collaborators: new Map(),
		roomLink: null,
		sessionError: null,
		sessionStatus: 'idle',
		username: 'Anonymous',
		setUsername: vi.fn(),
		startSession: vi.fn(),
		stopSession: vi.fn(),
	}),
}));

vi.mock('@/stores/store', () => ({
	useAppStore: (selector: (state: {
		openExpandedOverlay: typeof openExpandedOverlayMock;
		addToast: typeof addToastMock;
	}) => unknown) =>
		selector({
			openExpandedOverlay: openExpandedOverlayMock,
			addToast: addToastMock,
		}),
}));

vi.mock('@tanstack/react-router', () => ({
	Link: ({ children, ...props }: { children: ReactNode }) => <a {...props}>{children}</a>,
	Navigate: () => null,
	useNavigate: () => navigateMock,
}));

describe('BoardStudioPage', () => {
	beforeEach(() => {
		cleanup();
		vi.clearAllMocks();
		canvasGetMock.mockResolvedValue({
			ok: true,
			json: () =>
				Promise.resolve({
					canvas: {
						title: 'Canvas Title',
						version: 2,
					},
					data: {
						id: 'canvas-1',
						elements: [
							{
								id: 'board-1',
								index: 'a0',
								type: 'rectangle',
								x: 0,
								y: 0,
								width: 320,
								height: 240,
								angle: 0,
								backgroundColor: '#ffffff',
								strokeColor: '#111111',
								strokeWidth: 1,
								strokeStyle: 'solid',
								roughness: 0,
								opacity: 100,
								fillStyle: 'solid',
								roundness: null,
								groupIds: [],
								frameId: null,
								boundElements: null,
								updated: 1,
								link: null,
								seed: 1,
								version: 1,
								versionNonce: 1,
								isDeleted: false,
								locked: false,
								customData: {
									type: 'kanban',
									title: 'Canvas Board',
									columns: [],
								},
							},
						],
						appState: {},
						files: {},
					},
				}),
		});
		fetchMock.mockResolvedValue({
			ok: true,
			json: () =>
				Promise.resolve({
					id: 'board-1',
					canvasId: 'canvas-1',
					resourceType: 'board',
					title: 'Board Resource',
					data: {
						type: 'kanban',
						title: 'Resource Board',
						columns: [],
					},
					createdAt: '2026-03-27T00:00:00.000Z',
					updatedAt: '2026-03-27T00:00:00.000Z',
				}),
		});
		globalThis.fetch = fetchMock as typeof fetch;
	});

	it('seeds the focused board from the heavy resource record', async () => {
		const queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});

		render(
			<QueryClientProvider client={queryClient}>
				<BoardStudioPage canvasId="canvas-1" boardId="board-1" />
			</QueryClientProvider>,
		);

		const boardTitle = await screen.findByTestId('board-title');
		expect(boardTitle.textContent).toBe('Resource Board');

		expect(fetchMock).toHaveBeenCalledWith(
			'/api/canvas/canvas-1/resources/board/board-1',
			expect.objectContaining({
				headers: { Authorization: 'Bearer test' },
			}),
		);
	});
});
