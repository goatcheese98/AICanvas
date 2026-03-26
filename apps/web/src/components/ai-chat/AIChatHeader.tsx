import { PANEL_BUTTON, PANEL_BUTTON_DANGER } from './ai-chat-constants';
import type { SelectionIndicator } from './ai-chat-types';

export function AIChatHeader({
	messagesCount,
	selectionIndicator,
	onClearThread,
}: {
	messagesCount: number;
	selectionIndicator: SelectionIndicator;
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
							className="inline-flex h-9 items-center rounded-[9px] border border-stone-200 bg-stone-50 px-3 text-[11px] text-stone-700"
							title={selectionIndicator.detail}
						>
							{selectionIndicator.label}
						</div>
					) : null}
					<button
						type="button"
						onClick={onClearThread}
						className={`${PANEL_BUTTON} ${PANEL_BUTTON_DANGER} h-9`}
					>
						Clear Thread
					</button>
				</div>
			</div>
			<div className="mt-2 text-[10px] text-stone-500">
				Type <span className="font-medium text-stone-700">/</span> for shortcuts like{' '}
				<span className="font-medium text-stone-700">/select</span>,{' '}
				<span className="font-medium text-stone-700">/selectall</span>,{' '}
				<span className="font-medium text-stone-700">/none</span>,{' '}
				<span className="font-medium text-stone-700">/raster</span>,{' '}
				<span className="font-medium text-stone-700">/vector</span>, and{' '}
				<span className="font-medium text-stone-700">/svg</span>.
			</div>
		</div>
	);
}
