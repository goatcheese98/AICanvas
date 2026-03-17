import type { RefObject } from 'react';
import { KANBAN_FONT_OPTIONS, KANBAN_FONT_SIZE_RANGE, clampKanbanFontSize } from './kanban-theme';
import { KANBAN_BUTTON, KANBAN_ICON_BUTTON, getKanbanPanelStyle } from './kanban-ui';

interface KanbanBoardSettingsPanelProps {
	settingsRef: RefObject<HTMLDivElement | null>;
	activeFontId: string;
	fontSize: number;
	onSelectFont: (fontId: string) => void;
	onAdjustFontSize: (delta: number) => void;
	onResetBoard: () => void;
}

export function KanbanBoardSettingsPanel({
	settingsRef,
	activeFontId,
	fontSize,
	onSelectFont,
	onAdjustFontSize,
	onResetBoard,
}: KanbanBoardSettingsPanelProps) {
	return (
		<div
			ref={settingsRef}
			className="absolute right-3 top-[3.85rem] z-20 w-[16rem] rounded-[18px] border p-4 shadow-[var(--shadow-float)] backdrop-blur-md"
			style={{
				borderColor: 'var(--color-border)',
				background: 'color-mix(in srgb, var(--color-surface-strong) 96%, white)',
			}}
		>
			<div className="mb-4">
				<div
					className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em]"
					style={{ color: 'var(--color-text-tertiary)' }}
				>
					Font
				</div>
				<div className="space-y-2">
					{KANBAN_FONT_OPTIONS.map((font) => {
						const isActive = activeFontId === font.id;
						return (
							<button
								key={font.id}
								type="button"
								onClick={() => onSelectFont(font.id)}
								className="w-full rounded-[12px] border px-3 py-2 text-left text-sm transition-colors"
								style={{
									borderColor: isActive
										? 'color-mix(in srgb, var(--color-accent-border) 34%, var(--color-border))'
										: 'var(--color-border)',
									background: isActive
										? 'color-mix(in srgb, var(--color-accent-bg) 16%, white)'
										: 'transparent',
									color: isActive
										? 'color-mix(in srgb, var(--color-accent-text) 24%, var(--color-text-secondary))'
										: 'var(--color-text-primary)',
									fontFamily: font.family,
								}}
							>
								{font.label}
							</button>
						);
					})}
				</div>
			</div>

			<div>
				<div
					className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em]"
					style={{ color: 'var(--color-text-tertiary)' }}
				>
					Font size
				</div>
				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={() => onAdjustFontSize(-1)}
						disabled={fontSize <= KANBAN_FONT_SIZE_RANGE.min}
						className={KANBAN_ICON_BUTTON}
						style={getKanbanPanelStyle()}
					>
						−
					</button>
					<div
						className="flex-1 rounded-[12px] border px-3 py-2 text-center text-sm font-semibold"
						style={{
							borderColor: 'var(--color-border)',
							background: 'color-mix(in srgb, var(--color-surface-muted) 88%, white)',
							color: 'var(--color-text-primary)',
						}}
					>
						{clampKanbanFontSize(fontSize)}px
					</div>
					<button
						type="button"
						onClick={() => onAdjustFontSize(1)}
						disabled={fontSize >= KANBAN_FONT_SIZE_RANGE.max}
						className={KANBAN_ICON_BUTTON}
						style={getKanbanPanelStyle()}
					>
						+
					</button>
				</div>
			</div>

			<div className="mt-4 border-t pt-4" style={{ borderColor: 'var(--color-border)' }}>
				<button
					type="button"
					onClick={onResetBoard}
					className={`${KANBAN_BUTTON} w-full`}
					style={getKanbanPanelStyle()}
				>
					Reset board
				</button>
			</div>
		</div>
	);
}
