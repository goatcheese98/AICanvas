import { useAuth } from '@clerk/clerk-react';
import { useQuery } from '@tanstack/react-query';
import type { CanvasAppState, CanvasElement, CanvasFiles } from '@ai-canvas/shared/types';
import { api, getRequiredAuthHeaders } from '@/lib/api';

interface CanvasPreviewThumbnailProps {
	canvasId: string;
	title: string;
}

let exportToSvgLoader: Promise<typeof import('@excalidraw/excalidraw')['exportToSvg']> | null = null;

async function getExportToSvg() {
	if (!exportToSvgLoader) {
		exportToSvgLoader = import('@excalidraw/excalidraw').then((module) => module.exportToSvg);
	}
	return exportToSvgLoader;
}

export function CanvasPreviewThumbnail({ canvasId, title }: CanvasPreviewThumbnailProps) {
	const { getToken } = useAuth();

	const previewQuery = useQuery({
		queryKey: ['canvas-preview', canvasId, 'svg'],
		queryFn: async () => {
			const headers = await getRequiredAuthHeaders(getToken);
			const response = await api.api.canvas[':id'].$get({ param: { id: canvasId } }, { headers });
			if (!response.ok) {
				throw new Error(await response.text());
			}

			const result = await response.json();
			const data = result.data as
				| {
						elements?: CanvasElement[];
						appState?: CanvasAppState;
						files?: CanvasFiles | null;
				  }
				| null;
			const elements = (data?.elements ?? []).filter(
				(element) => (element as Record<string, unknown>).isDeleted !== true,
			);

			if (elements.length === 0) {
				return null;
			}

			const exportToSvg = await getExportToSvg();
			const svg = await exportToSvg({
				elements: elements as never,
				appState: {
					exportBackground: true,
					viewBackgroundColor: '#f8fafc',
					exportPadding: 16,
				},
				files: ((data?.files ?? null) as Record<string, unknown> | null) as never,
				skipInliningFonts: true,
				renderEmbeddables: false,
			});

			svg.setAttribute('width', '100%');
			svg.setAttribute('height', '100%');
			svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

			return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
				new XMLSerializer().serializeToString(svg),
			)}`;
		},
		staleTime: 1000 * 60 * 5,
	});

	if (previewQuery.isLoading) {
		return <div className="h-full w-full animate-pulse bg-stone-100" />;
	}

	if (!previewQuery.data) {
		return (
			<div className="flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,#f5efe0_0%,#e9f3ff_55%,#f8d9c7_100%)]">
				<div className="rounded-full bg-white/85 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-600">
					{previewQuery.isError ? 'Preview Unavailable' : 'Empty Canvas'}
				</div>
			</div>
		);
	}

	return (
		<img
			src={previewQuery.data}
			alt={`${title} preview`}
			className="h-full w-full object-cover"
		/>
	);
}
