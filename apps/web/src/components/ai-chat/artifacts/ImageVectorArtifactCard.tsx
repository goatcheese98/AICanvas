import type { ArtifactCardProps } from '../AIChatArtifactCard';
import { CodeSnippet } from '../AIChatArtifactPrimitives';
import { PANEL_BUTTON, PANEL_BUTTON_DANGER, PANEL_BUTTON_IDLE } from '../ai-chat-constants';
import { describeAssistantArtifact } from '../assistant-artifacts';
import { StoredAssetPreview } from './StoredAssetPreview';

export function ImageVectorArtifactCard({
	artifact,
	artifactKey,
	insertionState,
	onInsertArtifact,
	onUndoInsertedArtifact,
}: ArtifactCardProps) {
	return (
		<div className="rounded-[10px] border border-emerald-200 bg-emerald-50 p-3 text-[11px] text-emerald-900">
			<StoredAssetPreview artifact={artifact} />
			<CodeSnippet code={describeAssistantArtifact(artifact)} language="Vector Asset" compact />
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
					<button
						type="button"
						onClick={() => onInsertArtifact(artifactKey, artifact)}
						className={`${PANEL_BUTTON} ${PANEL_BUTTON_IDLE}`}
					>
						Insert Vector Asset
					</button>
				</div>
			) : null}
		</div>
	);
}
