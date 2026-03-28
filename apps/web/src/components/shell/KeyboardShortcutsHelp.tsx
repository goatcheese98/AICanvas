import { useEffect } from 'react';
import {
	CONTEXT_DISPLAY_NAMES,
	CONTEXT_DISPLAY_ORDER,
	KEYBOARD_SHORTCUTS,
	groupShortcutsByContext,
	parseShortcutKeys,
} from '@/lib/keyboard-shortcuts';
import { cn } from './utils';

interface KeyboardShortcutsHelpProps {
	isOpen: boolean;
	onClose: () => void;
}

export function KeyboardShortcutsHelp({ isOpen, onClose }: KeyboardShortcutsHelpProps) {
	// Close on Escape key
	useEffect(() => {
		if (!isOpen) return;

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				onClose();
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [isOpen, onClose]);

	// Prevent body scroll when modal is open
	useEffect(() => {
		if (!isOpen) return;

		const originalOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => {
			document.body.style.overflow = originalOverflow;
		};
	}, [isOpen]);

	if (!isOpen) return null;

	// Group shortcuts by context for organized display
	const groupedShortcuts = groupShortcutsByContext(KEYBOARD_SHORTCUTS);

	return (
		<div
			className="app-dialog-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
			onClick={onClose}
			role="dialog"
			aria-modal="true"
			aria-labelledby="keyboard-shortcuts-title"
		>
			<div
				className={cn(
					'app-panel app-panel-strong w-full max-w-lg overflow-hidden rounded-[18px]',
					'animate-in fade-in zoom-in-95 duration-200',
				)}
				onClick={(e) => e.stopPropagation()}
			>
				{/* Header */}
				<div className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-4">
					<div>
						<h2
							id="keyboard-shortcuts-title"
							className="text-lg font-semibold text-[var(--color-text-primary)]"
						>
							Keyboard Shortcuts
						</h2>
						<p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
							Press{' '}
							<kbd className="rounded bg-stone-100 px-1 py-0.5 font-mono text-[10px]">?</kbd>{' '}
							to open this help anytime
						</p>
					</div>
					<button
						type="button"
						onClick={onClose}
						className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-500 transition-colors hover:bg-stone-100"
						aria-label="Close"
					>
						<XIcon />
					</button>
				</div>

				{/* Content */}
				<div className="max-h-[60vh] overflow-y-auto px-6 py-4">
					<div className="space-y-5">
						{CONTEXT_DISPLAY_ORDER.map((context) => {
							const shortcuts = groupedShortcuts[context];
							if (!shortcuts || shortcuts.length === 0) return null;

							return (
								<section key={context}>
									<h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
										{CONTEXT_DISPLAY_NAMES[context]}
									</h3>
									<div className="space-y-2">
										{shortcuts.map((shortcut) => (
											<div
												key={shortcut.id}
												className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-stone-50"
											>
												<span className="text-sm text-[var(--color-text-primary)]">
													{shortcut.description}
												</span>
												<ShortcutKeys keys={parseShortcutKeys(shortcut.key)} />
											</div>
										))}
										</div>
									</section>
								);
								})}
							</div>
						</div>

						{/* Footer */}
						<div className="flex items-center justify-between border-t border-[var(--color-border)] bg-stone-50/50 px-6 py-3">
							<span className="text-xs text-[var(--color-text-tertiary)]">
								Tip: Shortcuts work from anywhere in the app
							</span>
							<button
								type="button"
								onClick={onClose}
								className="rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-stone-100"
							>
								Got it
							</button>
						</div>
					</div>
				</div>
			);
			}

			/**
			 * Render shortcut keys as styled kbd elements
			 */
			interface ShortcutKeysProps {
				keys: string[];
			}

			function ShortcutKeys({ keys }: ShortcutKeysProps) {
				return (
					<kbd className="flex items-center gap-0.5 font-mono">
						{keys.map((key, index) => (
							<span
								key={`${key}-${index}`}
								className={cn(
									'inline-flex min-w-[1.5rem] items-center justify-center rounded-md',
									'border border-stone-200 bg-white px-1.5 py-0.5 text-xs font-medium',
									'shadow-sm',
								)}
							>
								{key}
							</span>
						))}
					</kbd>
				);
			}

			function XIcon() {
				return (
					<svg
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						<path d="M18 6 6 18" />
						<path d="m6 6 12 12" />
					</svg>
				);
			}
