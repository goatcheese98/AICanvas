import { useMountEffect } from '@/hooks/useMountEffect';
import { fetchAssistantArtifactAsset, getRequiredAuthHeaders } from '@/lib/api';
import { parseStoredAssistantAssetContent } from '@ai-canvas/shared/schemas';
import type { AssistantArtifact } from '@ai-canvas/shared/types';
import { useAuth } from '@clerk/clerk-react';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useRef } from 'react';

export function useStoredAssetPreview(artifact: AssistantArtifact) {
	const { getToken, isSignedIn } = useAuth();
	const objectUrlRef = useRef<string | null>(null);

	// Cleanup object URL on unmount
	useMountEffect(() => {
		return () => {
			if (objectUrlRef.current) {
				URL.revokeObjectURL(objectUrlRef.current);
				objectUrlRef.current = null;
			}
		};
	});

	const storedAsset = useMemo(
		() => parseStoredAssistantAssetContent(artifact.content),
		[artifact.content],
	);

	const query = useQuery({
		queryKey: ['assistant-artifact-preview', storedAsset?.runId, storedAsset?.artifactId],
		enabled: Boolean(isSignedIn && storedAsset?.runId && storedAsset?.artifactId),
		queryFn: async () => {
			// Revoke previous URL before fetching new one
			if (objectUrlRef.current) {
				URL.revokeObjectURL(objectUrlRef.current);
				objectUrlRef.current = null;
			}

			// Type guard: storedAsset and its IDs are guaranteed by enabled check
			if (!storedAsset?.runId || !storedAsset?.artifactId) {
				throw new Error('Missing required asset identifiers');
			}

			const headers = await getRequiredAuthHeaders(async () => (await getToken?.()) ?? null);
			const { blob } = await fetchAssistantArtifactAsset(
				storedAsset.runId,
				storedAsset.artifactId,
				headers,
			);
			const url = URL.createObjectURL(blob);
			objectUrlRef.current = url;
			return url;
		},
		staleTime: 1000 * 60 * 5,
	});

	const status: 'idle' | 'loading' | 'ready' | 'error' =
		!isSignedIn || !storedAsset?.artifactId || !storedAsset?.runId
			? 'idle'
			: query.isLoading
				? 'loading'
				: query.isError
					? 'error'
					: query.data
						? 'ready'
						: 'idle';

	return { previewUrl: query.data ?? null, status };
}
