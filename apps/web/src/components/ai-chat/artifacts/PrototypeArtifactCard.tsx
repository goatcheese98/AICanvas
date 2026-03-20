import { CodeSnippet } from '../AIChatArtifactPrimitives';
import { PANEL_BUTTON, PANEL_BUTTON_DANGER } from '../ai-chat-constants';
import type { ArtifactCardProps } from '../AIChatArtifactCard';

export function PrototypeArtifactCard({
	artifact,
	artifactKey,
	insertionState,
	onInsertArtifact,
	onUndoInsertedArtifact,
}: ArtifactCardProps) {
	return (
		<div className="rounded-[10px] border border-sky-200 bg-sky-50 p-3">
			<div className="mb-2 text-[9px] font-semibold uppercase tracking-[0.2em] text-sky-700">
				Prototype Files
			</div>
			<CodeSnippet code={artifact.content} language="JSON" compact />
			{onInsertArtifact ? (
				<div className="mt-3 flex flex-wrap gap-2">
					{insertionState?.status === 'inserted' ? (
						<>
							<div className="inline-flex h-8 items-center justify-center rounded-[7px] border border-emerald-200 bg-emerald-50 px-3 text-[9px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
								Inserted Onto Canvas
							</div>
							{onUndoInsertedArtifact ? (
								<button
									type="button"
									onClick={() => onUndoInsertedArtifact(artifactKey)}
									className={`${PANEL_BUTTON} ${PANEL_BUTTON_DANGER}`}
								>
									Undo Insert
								</button>
							) : null}
						</>
					) : (
						<button
							type="button"
							onClick={() => onInsertArtifact(artifactKey, artifact)}
							className="inline-flex h-8 items-center justify-center rounded-[7px] border border-sky-300 bg-white px-3 text-[9px] font-semibold uppercase tracking-[0.18em] text-sky-700 transition-colors hover:border-sky-400 hover:bg-sky-100"
						>
							Apply Prototype
						</button>
					)}
				</div>
			) : null}
		</div>
	);
}
