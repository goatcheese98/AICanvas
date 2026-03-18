import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useAssistantCapabilities } from './useAssistantCapabilities';

const createWrapper = () => {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: { retry: false },
		},
	});
	return function Wrapper({ children }: { children: ReactNode }) {
		return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
	};
};

describe('useAssistantCapabilities', () => {
	it('returns default capabilities when not signed in', () => {
		const { result } = renderHook(
			() =>
				useAssistantCapabilities({
					getToken: vi.fn(),
					isSignedIn: false,
				}),
			{ wrapper: createWrapper() },
		);

		expect(result.current.data).toEqual({
			vectorizationEnabled: false,
			svgGenerationEnabled: false,
		});
		expect(result.current.isFetching).toBe(false);
	});

	it('returns default capabilities initially when signed in', () => {
		const { result } = renderHook(
			() =>
				useAssistantCapabilities({
					getToken: vi.fn().mockResolvedValue('test-token'),
					isSignedIn: true,
				}),
			{ wrapper: createWrapper() },
		);

		// Should have initial data while fetching
		expect(result.current.data).toEqual({
			vectorizationEnabled: false,
			svgGenerationEnabled: false,
		});
		// isLoading is false because we have initialData
		expect(result.current.isLoading).toBe(false);
	});
});
