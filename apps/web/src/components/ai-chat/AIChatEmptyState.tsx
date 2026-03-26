import type { AIChatEmptyStateProps } from './ai-chat-panel-types';

const DEFAULT_SUGGESTIONS = [
	'Diagram the auth flow',
	'Turn the selection into kanban tasks',
	'Create a raster image of this idea',
	'Export this as SVG',
];

/**
 * Empty state component shown when no messages exist.
 * Displays helpful suggestions for the user.
 */
export function AIChatEmptyState({ onSuggestionClick }: AIChatEmptyStateProps) {
	return (
		<div className="rounded-[12px] border border-stone-200 bg-white px-4 py-4">
			<div className="text-[10px] font-medium text-stone-500">
				Ask the canvas assistant to work on the canvas. If something is selected, the assistant will
				use it automatically when it helps.
			</div>
			<div className="mt-3 flex flex-wrap gap-2">
				{DEFAULT_SUGGESTIONS.map((suggestion) => (
					<button
						key={suggestion}
						type="button"
						onClick={() => onSuggestionClick?.(suggestion)}
						className="rounded-[8px] border border-stone-200 bg-stone-50 px-3 py-2 text-[12px] text-stone-900 transition-colors hover:border-stone-300 hover:bg-stone-100"
					>
						{suggestion}
					</button>
				))}
			</div>
		</div>
	);
}
