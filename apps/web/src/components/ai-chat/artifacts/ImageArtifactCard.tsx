import { parseStoredAssistantAssetContent } from '@ai-canvas/shared/schemas';
import { CodeSnippet } from '../AIChatArtifactPrimitives';
import { PANEL_BUTTON, PANEL_BUTTON_DANGER, PANEL_BUTTON_IDLE } from '../ai-chat-constants';
import { describeAssistantArtifact } from '../assistant-artifacts';
import { StoredAssetPreview } from './StoredAssetPreview';
import type { ArtifactCardProps } from './artifact-card-types';

export function ImageArtifactCard({
	artifact,
	artifactKey,
	insertionState,
	onInsertArtifact,
	onUndoInsertedArtifact,
	onVectorizeArtifact,
	generationMode,
	hasVectorCompanionArtifact,
}: ArtifactCardProps) {
	const imageAsset = parseStoredAssistantAssetContent(artifact.content);
	const isSketchRasterFallback =
		generationMode === 'sketch' &&
		!hasVectorCompanionArtifact &&
		imageAsset?.mimeType !== 'image/svg+xml';

	return (
		<div className="rounded-[10px] border border-stone-200 bg-stone-50 p-3 text-[11px] text-stone-600">
			<StoredAssetPreview artifact={artifact} />
			{isSketchRasterFallback ? (
				<div className="mb-3 rounded-[10px] border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-800">
					<div className="font-semibold">Server vectorization was not available for this run.</div>
					<div className="mt-1">
						This result is a raster sketch preview. You can still trace this exact image into native
						Excalidraw elements locally, or insert the raster preview as-is.
					</div>
				</div>
			) : null}
			<CodeSnippet code={describeAssistantArtifact(artifact)} language="Image" compact />
			{onInsertArtifact ? (
				<div className="mt-3 flex flex-wrap gap-2">
					{insertionState?.status === 'inserted' ? (
						<div className="inline-flex h-8 items-center justify-center rounded-[7px] border border-emerald-200 bg-emerald-50 px-3 text-[9px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
							Inserted Onto Canvas
						</div>
					) : null}
					{insertionState?.status === 'inserted' && onUndoInsertedArtifact ? (
						<button
							type="button"
							onClick={() => onUndoInsertedArtifact(artifactKey)}
							className={`${PANEL_BUTTON} ${PANEL_BUTTON_DANGER}`}
						>
							Undo Last Insert
						</button>
					) : null}
					{isSketchRasterFallback && onVectorizeArtifact ? (
						<button
							type="button"
							onClick={() => onVectorizeArtifact(artifactKey, artifact)}
							className={`${PANEL_BUTTON} ${PANEL_BUTTON_IDLE}`}
						>
							Insert Native Vector
						</button>
					) : null}
					<button
						type="button"
						onClick={() => onInsertArtifact(artifactKey, artifact)}
						className={`${PANEL_BUTTON} ${PANEL_BUTTON_IDLE}`}
					>
						{isSketchRasterFallback ? 'Insert Raster Sketch' : 'Insert Image'}
					</button>
				</div>
			) : null}
		</div>
	);
}
