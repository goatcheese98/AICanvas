import type { ArtifactCardProps } from '../AIChatArtifactCard';
import { CodeSnippet } from '../AIChatArtifactPrimitives';
import { PANEL_BUTTON, PANEL_BUTTON_DANGER, PANEL_BUTTON_IDLE } from '../ai-chat-constants';

interface CodeArtifactCardProps extends ArtifactCardProps {
	label: string;
	language: string;
}

export function CodeArtifactCard({
	artifact,
	artifactKey,
	label,
	language,
	insertionState,
	onInsertArtifact,
	onUndoInsertedArtifact,
}: CodeArtifactCardProps) {
	return (
		<div className="rounded-[10px] border border-stone-200 bg-stone-50 p-3">
			<div className="mb-2 text-[9px] font-semibold uppercase tracking-[0.2em] text-stone-500">
				{label}
			</div>
			<CodeSnippet code={artifact.content} language={language} compact />
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
							className={`${PANEL_BUTTON} ${PANEL_BUTTON_IDLE}`}
						>
							Insert On Canvas
						</button>
					)}
				</div>
			) : null}
		</div>
	);
}
