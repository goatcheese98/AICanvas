import { CodeSnippet } from '../AIChatArtifactPrimitives';
import type { AssistantArtifact } from '@ai-canvas/shared/types';

interface LayoutPlanArtifactCardProps {
	artifact: AssistantArtifact;
}

export function LayoutPlanArtifactCard({ artifact }: LayoutPlanArtifactCardProps) {
	return (
		<div className="rounded-[10px] border border-amber-200 bg-amber-50 p-3">
			<details>
				<summary className="cursor-pointer text-[9px] font-semibold uppercase tracking-[0.2em] text-amber-700">
					Layout Plan
				</summary>
				<div className="mt-3">
					<CodeSnippet code={artifact.content} language="JSON" compact />
				</div>
			</details>
		</div>
	);
}
