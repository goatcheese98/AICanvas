import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useQuery } from '@tanstack/react-query';
import { getRequiredAuthHeaders } from '@/lib/api';
import { captureBrowserException } from '@/lib/observability';

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

	const previewQuery = useQuery({
		queryKey: ['canvas-thumbnail', canvasId, thumbnailUrl],
		enabled: Boolean(thumbnailUrl),
		queryFn: async () => {
			try {
				const headers = await getRequiredAuthHeaders(getToken);
				const response = await fetch(thumbnailUrl ?? `/api/canvas/${canvasId}/thumbnail`, {
					headers,
				});

				if (response.status === 404) {
					return null;
				}

				if (!response.ok) {
					throw new Error(await response.text());
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

	useEffect(() => {
		if (!previewQuery.data) {
			setObjectUrl(null);
			return;
		}

		const nextObjectUrl = URL.createObjectURL(previewQuery.data);
		setObjectUrl(nextObjectUrl);

		return () => {
			URL.revokeObjectURL(nextObjectUrl);
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
