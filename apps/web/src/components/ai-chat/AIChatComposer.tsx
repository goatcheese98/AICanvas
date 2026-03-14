import type { KeyboardEvent, RefObject } from 'react';
import type { AssistantContextMode } from '@ai-canvas/shared/types';
import type { SelectionIndicator } from './ai-chat-types';
import {
	PANEL_BUTTON,
	PANEL_BUTTON_ACTIVE,
} from './ai-chat-constants';

export function AIChatComposer({
	chatError,
	selectionIndicator,
	contextMode,
	textareaRef,
	input,
	disabled,
	onInputChange,
	onSend,
}: {
	chatError: string | null;
	selectionIndicator: SelectionIndicator;
	contextMode: AssistantContextMode;
	textareaRef: RefObject<HTMLTextAreaElement | null>;
	input: string;
	disabled: boolean;
	onInputChange: (value: string) => void;
	onSend: () => void;
}) {
	return (
		<div className="border-t border-stone-200 bg-stone-50 px-4 py-3">
			<div className="mx-auto w-full max-w-[1120px]">
				{chatError ? (
					<div className="mb-3 rounded-[10px] border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-700">
						{chatError}
					</div>
				) : null}
				{selectionIndicator && contextMode !== 'selected' ? (
					<div className="mb-3 rounded-[10px] border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
						{selectionIndicator.label}. {selectionIndicator.detail}
					</div>
				) : null}
				<div className="rounded-[12px] border border-stone-200 bg-white p-2.5">
					<textarea
						ref={textareaRef}
						value={input}
						onChange={(event) => onInputChange(event.target.value)}
						onKeyDown={(event) => {
							if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
								event.preventDefault();
								onSend();
							}
						}}
						className="w-full resize-none border-0 bg-transparent px-1 py-1 text-[13px] leading-5 text-stone-900 outline-none placeholder:text-stone-400"
						placeholder="Describe the result you want on the canvas..."
					/>
					<div className="mt-2 flex items-center justify-between gap-3 border-t border-stone-200 pt-2">
						<div className="text-[10px] text-stone-500">Cmd/Ctrl+Enter to send</div>
						<button
							type="button"
							disabled={disabled}
							onClick={onSend}
							className={`${PANEL_BUTTON} ${
								disabled
									? 'cursor-not-allowed border-stone-200 bg-stone-200 text-stone-400'
									: PANEL_BUTTON_ACTIVE
							} h-8 px-3`}
						>
							Send
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
