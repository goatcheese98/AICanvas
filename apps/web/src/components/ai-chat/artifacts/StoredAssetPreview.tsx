import { useStoredAssetPreview } from '@/hooks/useStoredAssetPreview';
import type { AssistantArtifact } from '@ai-canvas/shared/types';

interface StoredAssetPreviewProps {
	artifact: AssistantArtifact;
}

export function StoredAssetPreview({ artifact }: StoredAssetPreviewProps) {
	const { previewUrl, status } = useStoredAssetPreview(artifact);

	if (status === 'idle') {
		return null;
	}

	return (
		<div className="mb-3 overflow-hidden rounded-[10px] border border-stone-200 bg-white">
			{previewUrl ? (
				<img
					src={previewUrl}
					alt="Generated asset preview"
					className="block max-h-64 w-full object-contain"
				/>
			) : (
				<div className="flex h-40 items-center justify-center text-[11px] text-stone-500">
					{status === 'error' ? 'Preview unavailable' : 'Loading preview...'}
				</div>
			)}
		</div>
	);
}
