import { useMountEffect } from '@/hooks/useMountEffect';
import {
	createObservedResponseError,
	getRequiredAuthHeaders,
	observedFetch,
	toApiUrl,
} from '@/lib/api';
import { captureBrowserException } from '@/lib/observability';
import { useAuth } from '@clerk/clerk-react';
import { useQuery } from '@tanstack/react-query';
import { useRef, useState, useEffect } from 'react';

interface CanvasPreviewThumbnailProps {
	canvasId: string;
	title: string;
	thumbnailUrl?: string;
}

export function CanvasPreviewThumbnail({
	canvasId,
	title,
	thumbnailUrl,
}: CanvasPreviewThumbnailProps) {
	const { getToken } = useAuth();
	const [objectUrl, setObjectUrl] = useState<string | null>(null);
	const objectUrlRef = useRef<string | null>(null);
	const prevBlobRef = useRef<Blob | null>(null);

	const previewQuery = useQuery({
		queryKey: ['canvas-thumbnail', canvasId, thumbnailUrl],
		enabled: Boolean(thumbnailUrl),
		queryFn: async () => {
			try {
				const headers = await getRequiredAuthHeaders(getToken);
				const response = await observedFetch(
					toApiUrl(thumbnailUrl ?? `/api/canvas/${canvasId}/thumbnail`),
					{
						headers,
					},
				);

				if (response.status === 404) {
					return null;
				}

				if (!response.ok) {
					throw await createObservedResponseError(
						response,
						`Canvas preview fetch failed with status ${response.status}`,
					);
				}

				return response.blob();
			} catch (error) {
				captureBrowserException(error, {
					tags: {
						area: 'canvas.thumbnail',
						action: 'load_preview',
					},
					extra: {
						canvasId,
						thumbnailUrl,
					},
				});
				throw error;
			}
		},
		staleTime: 1000 * 60 * 5,
	});

	// Manage object URL lifecycle
	useEffect(() => {
		const blob = previewQuery.data;
		if (blob === prevBlobRef.current) return;

		// Revoke previous URL
		if (objectUrlRef.current) {
			URL.revokeObjectURL(objectUrlRef.current);
			objectUrlRef.current = null;
		}

		// Create new URL if we have data
		if (blob) {
			objectUrlRef.current = URL.createObjectURL(blob);
		}

		prevBlobRef.current = blob ?? null;
		setObjectUrl(objectUrlRef.current);

		return () => {
			if (objectUrlRef.current) {
				URL.revokeObjectURL(objectUrlRef.current);
				objectUrlRef.current = null;
			}
		};
	}, [previewQuery.data]);

	if (thumbnailUrl && previewQuery.isLoading) {
		return <div className="h-full w-full animate-pulse bg-[var(--color-surface-muted)]" />;
	}

	if (!objectUrl) {
		return (
			<div className="flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,rgba(242,244,248,0.96)_0%,rgba(236,239,246,0.94)_55%,rgba(250,251,252,1)_100%)]">
				<div className="rounded-full border border-[var(--color-border)] bg-white/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-secondary)]">
					{previewQuery.isError ? 'Preview Unavailable' : 'Canvas Preview'}
				</div>
			</div>
		);
	}

	return <img src={objectUrl} alt={`${title} preview`} className="h-full w-full object-cover" />;
}
