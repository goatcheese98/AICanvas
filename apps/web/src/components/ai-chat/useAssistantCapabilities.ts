import { fetchAssistantCapabilities, getRequiredAuthHeaders } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import type { AuthContext } from './ai-chat-panel-types';

export interface AssistantCapabilities {
	vectorizationEnabled: boolean;
	svgGenerationEnabled: boolean;
}

const DEFAULT_CAPABILITIES: AssistantCapabilities = {
	vectorizationEnabled: false,
	svgGenerationEnabled: false,
};

/**
 * Fetches assistant capabilities from the server using TanStack Query.
 * Follows the no-useEffect pattern for data fetching.
 */
export function useAssistantCapabilities({ getToken, isSignedIn }: AuthContext) {
	return useQuery<AssistantCapabilities>({
		queryKey: ['assistantCapabilities'],
		queryFn: async () => {
			const headers = await getRequiredAuthHeaders(getToken);
			return await fetchAssistantCapabilities(headers);
		},
		enabled: isSignedIn === true,
		staleTime: 5 * 60 * 1000, // 5 minutes
		gcTime: 10 * 60 * 1000, // 10 minutes
		initialData: DEFAULT_CAPABILITIES,
	});
}
