import { formatShortcut } from '@/lib/keyboard-shortcuts';
import type { ReactElement, ReactNode } from 'react';
import { Tooltip } from './Tooltip';
import type { RightPanelMode } from './useShellState';
import { cn } from './utils';

interface RightPanelProps {
	mode: RightPanelMode;
	onClose: () => void;
	onChangeMode: (mode: Exclude<RightPanelMode, 'none'>) => void;
	children: ReactNode;
}

const PANEL_CONFIG: Record<
	Exclude<RightPanelMode, 'none'>,
	{ label: string; shortcutKey: string; icon: () => ReactElement }
> = {
	ai: { label: 'AI Assistant', shortcutKey: 'mod+b', icon: BotIcon },
	details: { label: 'Details', shortcutKey: 'mod+i', icon: InfoIcon },
};

export function RightPanel({ mode, onClose, onChangeMode, children }: RightPanelProps) {
	const currentConfig = mode !== 'none' ? PANEL_CONFIG[mode] : null;

	return (
		<div className="flex h-full flex-col">
			{/* Header */}
			<div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
				<div className="flex items-center gap-2">
					{currentConfig && (
						<>
							<currentConfig.icon />
							<span className="font-semibold text-stone-900">{currentConfig.label}</span>
						</>
					)}
				</div>
				<div className="flex items-center gap-1">
					{/* Mode tabs */}
					{(Object.keys(PANEL_CONFIG) as Exclude<RightPanelMode, 'none'>[]).map((panelMode) => {
						const config = PANEL_CONFIG[panelMode];
						const formattedShortcut = formatShortcut(config.shortcutKey);
						return (
							<Tooltip
								key={panelMode}
								content={
									<span className="flex items-center gap-1.5">
										{config.label}
										<span className="text-stone-400">{formattedShortcut}</span>
									</span>
								}
								position="bottom"
							>
								<button
									type="button"
									className={cn(
										'flex h-7 w-7 items-center justify-center rounded-lg text-stone-500',
										mode === panelMode && 'bg-stone-100 text-[#4d55cc]',
									)}
									onClick={() => onChangeMode(panelMode)}
									aria-label={`${config.label} (${formattedShortcut})`}
								>
									{panelMode === 'ai' ? <BotIcon /> : <InfoIcon />}
								</button>
							</Tooltip>
						);
					})}
					<Tooltip content="Close (Esc)" position="bottom">
						<button
							type="button"
							className="flex h-7 w-7 items-center justify-center rounded-lg text-stone-500 hover:bg-stone-100"
							onClick={onClose}
							aria-label="Close panel (Escape)"
						>
							<XIcon />
						</button>
					</Tooltip>
				</div>
			</div>

			{/* Content */}
			<div className="flex-1 overflow-y-auto">{children}</div>
		</div>
	);
}

// Inline SVG Icons
function BotIcon() {
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
			<title>AI</title>
			<path d="M12 8V4H8" />
			<rect width="16" height="12" x="4" y="8" rx="2" />
			<path d="M2 14h2" />
			<path d="M20 14h2" />
			<path d="M15 13v2" />
			<path d="M9 13v2" />
		</svg>
	);
}

function InfoIcon() {
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
			<title>Details</title>
			<circle cx="12" cy="12" r="10" />
			<path d="M12 16v-4" />
			<path d="M12 8h.01" />
		</svg>
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
			<title>Close</title>
			<path d="M18 6 6 18" />
			<path d="m6 6 12 12" />
		</svg>
	);
}
