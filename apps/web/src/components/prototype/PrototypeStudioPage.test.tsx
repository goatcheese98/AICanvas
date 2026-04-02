import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrototypeStudioPage } from './PrototypeStudioPage';

const { canvasGetMock, fetchMock, navigateMock } = vi.hoisted(() => ({
	canvasGetMock: vi.fn(),
	fetchMock: vi.fn(),
	navigateMock: vi.fn(),
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

vi.mock('@/components/shell', () => ({
	FocusedViewHeader: () => null,
	ProjectShell: ({
		children,
		resources,
		activeResourceId,
	}: {
		children: ReactNode;
		resources: { id: string; type: string; name: string }[];
		activeResourceId: string;
	}) => (
		<div>
			<div data-testid="resource-list">
				{resources.map((resource) => `${resource.type}:${resource.name}`).join('|')}
			</div>
			<div data-testid="active-resource">{activeResourceId}</div>
			{children}
		</div>
	),
}));

vi.mock('@/components/overlays/prototype', () => ({
	PrototypeStudioEditor: ({
		value,
	}: {
		value: { files: Record<string, { code: string }> };
	}) => <div data-testid="prototype-files">{Object.keys(value.files).sort().join(',')}</div>,
}));

vi.mock('@tanstack/react-router', () => ({
	Link: ({ children, ...props }: { children: ReactNode }) => <a {...props}>{children}</a>,
	useNavigate: () => navigateMock,
}));

describe('PrototypeStudioPage', () => {
	beforeEach(() => {
		cleanup();
		vi.clearAllMocks();
		canvasGetMock.mockResolvedValue({
			ok: true,
			json: () =>
				Promise.resolve({
					canvas: {
						title: 'Canvas Title',
						version: 3,
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
					id: 'prototype-1',
					canvasId: 'canvas-1',
					resourceType: 'prototype',
					title: 'Prototype Resource',
					data: {
						type: 'prototype',
						title: 'Prototype Resource',
						template: 'react',
						files: {},
						dependencies: {},
					},
					createdAt: '2026-03-27T00:00:00.000Z',
					updatedAt: '2026-03-27T00:00:00.000Z',
				}),
		});
		globalThis.fetch = fetchMock as typeof fetch;
	});

	it('shows the focused prototype in the sidebar and seeds a starter project', async () => {
		const queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});

		render(
			<QueryClientProvider client={queryClient}>
				<PrototypeStudioPage canvasId="canvas-1" prototypeId="prototype-1" />
			</QueryClientProvider>,
		);

		expect((await screen.findByTestId('resource-list')).textContent).toContain(
			'canvas:Canvas Title|prototype:Prototype Resource',
		);
		expect((await screen.findByTestId('prototype-files')).textContent).toContain(
			'/index.jsx,/styles.css',
		);
		expect((await screen.findByTestId('active-resource')).textContent).toBe('prototype-1');
	});
});
