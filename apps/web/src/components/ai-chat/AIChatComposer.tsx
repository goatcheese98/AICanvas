import { type RefObject, useMemo, useState } from 'react';
import { applyAIChatCommandSuggestion, getAIChatCommandMenuState } from './ai-chat-command-helpers';
import { PANEL_BUTTON, PANEL_BUTTON_ACTIVE } from './ai-chat-constants';
import type { SelectionIndicator } from './ai-chat-types';

export function AIChatComposer({
	chatError,
	selectionIndicator,
	textareaRef,
	input,
	disabled,
	onInputChange,
	onSend,
}: {
	chatError: string | null;
	selectionIndicator: SelectionIndicator;
	textareaRef: RefObject<HTMLTextAreaElement | null>;
	input: string;
	disabled: boolean;
	onInputChange: (value: string) => void;
	onSend: () => void;
}) {
	const [activeCommandIndex, setActiveCommandIndex] = useState(0);
	const [dismissedMenuInput, setDismissedMenuInput] = useState<string | null>(null);
	const commandMenu = useMemo(() => getAIChatCommandMenuState(input), [input]);
	const commandSuggestions = commandMenu?.suggestions ?? [];
	const showCommandMenu = Boolean(commandMenu) && dismissedMenuInput !== input;
	const activeCommand =
		commandSuggestions[Math.min(activeCommandIndex, Math.max(commandSuggestions.length - 1, 0))] ??
		null;

	const insertCommand = (commandName: Parameters<typeof applyAIChatCommandSuggestion>[1]) => {
		setDismissedMenuInput(null);
		setActiveCommandIndex(0);
		onInputChange(applyAIChatCommandSuggestion(input, commandName));
		requestAnimationFrame(() => textareaRef.current?.focus());
	};

	return (
		<div className="border-t border-stone-200 bg-stone-50 px-4 py-3">
			<div className="w-full">
				{chatError ? (
					<div className="mb-3 rounded-[10px] border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-700">
						{chatError}
					</div>
				) : null}
				{showCommandMenu && commandMenu ? (
					<div className="mb-3 overflow-hidden rounded-[10px] border border-stone-200 bg-white shadow-sm">
						<div className="border-b border-stone-200 px-3 py-2 text-[10px] uppercase tracking-[0.16em] text-stone-500">
							Commands
						</div>
						{commandSuggestions.length > 0 ? (
							<ul aria-label="Chat commands" className="divide-y divide-stone-100">
								{commandSuggestions.map((command) => (
									<li key={command.name}>
										<button
											type="button"
											onMouseDown={(event) => event.preventDefault()}
											onClick={() => insertCommand(command.name)}
											className={`flex w-full items-start justify-between gap-3 px-3 py-2 text-left text-[12px] ${
												activeCommand?.name === command.name
													? 'bg-stone-100 text-stone-950'
													: 'text-stone-700 hover:bg-stone-50'
											}`}
										>
											<span className="font-mono text-[11px] text-stone-900">/{command.name}</span>
											<span className="flex-1 text-right text-[11px] leading-4 text-stone-500">
												{command.description}
											</span>
										</button>
									</li>
								))}
							</ul>
						) : (
							<div className="px-3 py-2 text-[11px] text-stone-500">
								No matching command for <span className="font-mono">/{commandMenu.query}</span>.
							</div>
						)}
					</div>
				) : null}
				{selectionIndicator ? (
					<div className="mb-3 rounded-[10px] border border-stone-200 bg-white px-3 py-2 text-[11px] text-stone-600">
						<span className="font-medium text-stone-800">{selectionIndicator.label}.</span> The
						assistant will use it automatically when it helps.
					</div>
				) : null}
				<div className="rounded-[12px] border border-stone-200 bg-white p-2.5">
					<textarea
						ref={textareaRef}
						value={input}
						onChange={(event) => {
							setDismissedMenuInput(null);
							setActiveCommandIndex(0);
							onInputChange(event.target.value);
						}}
						onKeyDown={(event) => {
							if (showCommandMenu && commandSuggestions.length > 0) {
								if (event.key === 'ArrowDown') {
									event.preventDefault();
									setActiveCommandIndex((current) => (current + 1) % commandSuggestions.length);
									return;
								}

								if (event.key === 'ArrowUp') {
									event.preventDefault();
									setActiveCommandIndex((current) =>
										current === 0 ? commandSuggestions.length - 1 : current - 1,
									);
									return;
								}

								if ((event.key === 'Enter' || event.key === 'Tab') && activeCommand) {
									event.preventDefault();
									insertCommand(activeCommand.name);
									return;
								}
							}

							if (showCommandMenu && event.key === 'Escape') {
								event.preventDefault();
								setDismissedMenuInput(input);
								return;
							}

							if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
								event.preventDefault();
								onSend();
							}
						}}
						className="w-full resize-none border-0 bg-transparent px-1 py-1 text-[13px] leading-5 text-stone-900 outline-none placeholder:text-stone-400"
						placeholder="Describe the result you want on the canvas..."
					/>
					<div className="mt-2 flex items-center justify-between gap-3 border-t border-stone-200 pt-2">
						<div className="flex items-center gap-2">
							<button
								type="button"
								onClick={() => {
									if (!input.trimStart().startsWith('/')) {
										setDismissedMenuInput(null);
										setActiveCommandIndex(0);
										onInputChange('/');
									}
									requestAnimationFrame(() => textareaRef.current?.focus());
								}}
								className="inline-flex h-8 w-8 items-center justify-center rounded-[7px] border border-stone-200 bg-stone-50 text-[12px] font-semibold text-stone-600 transition-colors hover:border-stone-300 hover:bg-stone-100"
								aria-label="Show commands"
								title="Show commands"
							>
								?
							</button>
							<div className="text-[10px] text-stone-500">
								Type <span className="font-medium text-stone-700">/</span> for commands.
								Cmd/Ctrl+Enter to send.
							</div>
						</div>
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
