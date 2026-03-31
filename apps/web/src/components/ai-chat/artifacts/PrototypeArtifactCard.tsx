import type { ArtifactCardProps } from '../AIChatArtifactCard';
import { CodeSnippet } from '../AIChatArtifactPrimitives';

export function PrototypeArtifactCard({ artifact, insertionState }: ArtifactCardProps) {
	return (
		<div className="rounded-[10px] border border-sky-200 bg-sky-50 p-3">
			<div className="mb-2 text-[9px] font-semibold uppercase tracking-[0.2em] text-sky-700">
				Prototype Files
			</div>
			<div className="mb-3 rounded-[10px] border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
				Prototype file output is read-only during Phase 0. It stays visible for review, but it
				can&apos;t be applied onto the canvas right now.
			</div>
			<CodeSnippet code={artifact.content} language="JSON" compact />
			{insertionState?.status === 'inserted' ? (
				<div className="mt-3 inline-flex h-8 items-center justify-center rounded-[7px] border border-emerald-200 bg-emerald-50 px-3 text-[9px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
					Inserted Onto Canvas
				</div>
			) : null}
		</div>
	);
}
