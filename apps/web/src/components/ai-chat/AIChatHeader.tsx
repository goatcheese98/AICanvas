import type { AssistantContextMode } from '@ai-canvas/shared/types';
import type { SelectionIndicator } from './ai-chat-types';
import {
	PANEL_BUTTON,
	PANEL_BUTTON_DANGER,
	PANEL_BUTTON_IDLE,
} from './ai-chat-constants';

export function AIChatHeader({
	messagesCount,
	selectionIndicator,
	contextMode,
	onContextModeChange,
	onClearThread,
}: {
	messagesCount: number;
	selectionIndicator: SelectionIndicator;
	contextMode: AssistantContextMode;
	onContextModeChange: (value: AssistantContextMode) => void;
	onClearThread: () => void;
}) {
	return (
		<div className="border-b border-stone-200 bg-white px-4 py-2.5">
			<div className="flex items-center justify-between gap-3">
				<div className="min-w-0 truncate text-[11px] text-stone-500">
					{messagesCount} message{messagesCount === 1 ? '' : 's'}
				</div>
				<div className="flex flex-wrap items-center gap-2">
					{selectionIndicator ? (
						<div
							className={`inline-flex h-9 items-center rounded-[9px] border px-3 text-[11px] ${
								contextMode === 'selected'
									? 'border-emerald-200 bg-emerald-50 text-emerald-700'
									: 'border-amber-200 bg-amber-50 text-amber-700'
							}`}
							title={selectionIndicator.detail}
						>
							{contextMode === 'selected'
								? `Using ${selectionIndicator.label.toLowerCase()}`
								: `${selectionIndicator.label}.`}
						</div>
					) : null}
					<select
						value={contextMode}
						onChange={(event) => onContextModeChange(event.target.value as AssistantContextMode)}
						className={`h-9 min-w-[188px] rounded-[9px] border bg-white px-3 py-2 text-[12px] ${PANEL_BUTTON_IDLE}`}
					>
						<option value="none">No canvas context</option>
						<option value="all">Whole canvas</option>
						<option value="selected">Selected only</option>
					</select>
					<button
						type="button"
						onClick={onClearThread}
						className={`${PANEL_BUTTON} ${PANEL_BUTTON_DANGER} h-9`}
					>
						Clear Thread
					</button>
				</div>
			</div>
		</div>
	);
}
