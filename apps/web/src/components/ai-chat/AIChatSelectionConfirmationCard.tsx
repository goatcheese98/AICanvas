import { PANEL_BUTTON, PANEL_BUTTON_IDLE } from './ai-chat-constants';

export function SelectionConfirmationCard({
	prompt,
	selectionLabel,
	onUseSelection,
	onContinueWithoutSelection,
}: {
	prompt: string;
	selectionLabel: string;
	onUseSelection: () => void;
	onContinueWithoutSelection: () => void;
}) {
	return (
		<div className="mr-auto max-w-[92%] rounded-[14px] border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-stone-900 shadow-none">
			<div className="mb-1.5 flex items-center justify-between gap-2 text-[9px] font-semibold uppercase tracking-[0.18em] text-amber-700">
				<span>Assistant</span>
				<span>Context Check</span>
			</div>
			<div className="text-[13px] leading-relaxed">
				This request looks like it refers to the current selection. {selectionLabel}.
			</div>
			<div className="mt-2 rounded-[10px] border border-amber-200 bg-white/70 px-3 py-2 text-xs text-stone-600">
				{prompt}
			</div>
			<div className="mt-3 flex flex-wrap gap-2">
				<button
					type="button"
					onClick={onUseSelection}
					className={`${PANEL_BUTTON} border-amber-300 bg-white text-amber-800 hover:border-amber-400 hover:bg-amber-100`}
				>
					Use Selection And Continue
				</button>
				<button
					type="button"
					onClick={onContinueWithoutSelection}
					className={`${PANEL_BUTTON} ${PANEL_BUTTON_IDLE}`}
				>
					Continue Without Selection
				</button>
			</div>
		</div>
	);
}
