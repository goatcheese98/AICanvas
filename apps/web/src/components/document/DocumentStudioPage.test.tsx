import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DocumentStudioPage } from './DocumentStudioPage';

const { canvasGetMock, fetchMock, navigateMock, addToastMock } = vi.hoisted(() => ({
	canvasGetMock: vi.fn(),
	fetchMock: vi.fn(),
	navigateMock: vi.fn(),
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

vi.mock('@/components/overlays/lexical', () => ({
	LexicalNoteContainer: ({ element }: { element: { customData?: { title?: string } } }) => (
		<div data-testid="document-title">{element.customData?.title}</div>
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
	useAppStore: (selector: (state: { addToast: typeof addToastMock }) => unknown) =>
		selector({
			addToast: addToastMock,
		}),
}));

vi.mock('@tanstack/react-router', () => ({
	Link: ({ children, ...props }: { children: ReactNode }) => <a {...props}>{children}</a>,
	Navigate: () => null,
	useNavigate: () => navigateMock,
}));

describe('DocumentStudioPage', () => {
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
						elements: [],
						appState: {},
						files: {},
					},
				}),
		});
		fetchMock.mockResolvedValue({
			ok: true,
			json: () =>
				Promise.resolve({
					id: 'document-1',
					canvasId: 'canvas-1',
					resourceType: 'document',
					title: 'Document Resource',
					data: {
						type: 'newlex',
						title: 'Resource Note',
						lexicalState: '{"root":{"children":[]}}',
						comments: [],
					},
					createdAt: '2026-03-27T00:00:00.000Z',
					updatedAt: '2026-03-27T00:00:00.000Z',
				}),
		});
		globalThis.fetch = fetchMock as typeof fetch;
	});

	it('seeds the focused document from the heavy resource record when the canvas card is missing', async () => {
		const queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});

		render(
			<QueryClientProvider client={queryClient}>
				<DocumentStudioPage canvasId="canvas-1" documentId="document-1" />
			</QueryClientProvider>,
		);

		const documentTitle = await screen.findByTestId('document-title');
		expect(documentTitle.textContent).toBe('Resource Note');

		expect(fetchMock).toHaveBeenCalledWith(
			'/api/canvas/canvas-1/resources/document/document-1',
			expect.objectContaining({
				headers: { Authorization: 'Bearer test' },
			}),
		);
	});
});
