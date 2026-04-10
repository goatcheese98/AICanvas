import type { OverlayType } from '@ai-canvas/shared/types';
import { useUser } from '@clerk/clerk-react';
import { CHROME_BUTTON_BASE, CHROME_BUTTON_IDLE } from './canvas-chrome';
import { getProfileInfo, overlayActions } from './canvas-ui-utils';

interface CanvasTopToolbarProps {
	isInsertMenuOpen: boolean;
	onToggleInsertMenu: () => void;
	onInsertOverlay: (type: OverlayType) => void;
	activePanel: 'none' | 'assets' | 'collab' | 'chat';
	onToggleAssetsPanel: () => void;
	insertMenuRef: React.RefObject<HTMLDivElement | null>;
}

export function CanvasTopToolbar({
	isInsertMenuOpen,
	onToggleInsertMenu,
	onInsertOverlay,
	activePanel,
	onToggleAssetsPanel,
	insertMenuRef,
}: CanvasTopToolbarProps) {
	const { user } = useUser();
	const { initials } = getProfileInfo(user);

	return (
		<>
			<div className="absolute right-4 top-4 z-20 flex max-w-[calc(100vw-1rem)] items-center gap-2">
				<div className="relative" ref={insertMenuRef}>
					<button
						type="button"
						onClick={onToggleInsertMenu}
						className={`${CHROME_BUTTON_BASE} ${
							isInsertMenuOpen ? 'border-[#d7dafd] bg-[#eef0ff] text-[#4d55cc]' : CHROME_BUTTON_IDLE
						} bg-white/96 tracking-[0.22em] backdrop-blur`}
					>
						Insert
					</button>
					{isInsertMenuOpen ? (
						<div className="absolute right-0 top-[calc(100%+0.75rem)] w-72 rounded-[12px] border border-stone-200 bg-white p-2 shadow-xl">
							<div className="px-3 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">
								Add To Canvas
							</div>
							<div className="space-y-1">
								{overlayActions.map((action) => (
									<button
										key={action.type}
										type="button"
										onClick={() => onInsertOverlay(action.type)}
										className="flex w-full flex-col rounded-[8px] px-3 py-3 text-left hover:bg-[#f3f1ff]"
									>
										<span className="text-sm font-semibold text-stone-900">{action.label}</span>
										<span className="mt-1 text-xs text-stone-500">{action.description}</span>
									</button>
								))}
							</div>
						</div>
					) : null}
				</div>

				<button
					type="button"
					aria-label="Profile and workspace menu"
					onClick={onToggleAssetsPanel}
					className={`flex h-9 w-9 items-center justify-center rounded-[8px] border shadow-sm backdrop-blur ${
						activePanel === 'assets'
							? 'border-[#d7dafd] bg-[#eef0ff] text-[#4d55cc]'
							: 'border-stone-200 bg-white/96 text-stone-700 hover:border-[#d7dafd] hover:bg-[#f3f1ff] hover:text-[#4d55cc]'
					}`}
				>
					{user?.imageUrl ? (
						<img src={user.imageUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
					) : (
						<div className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-900 text-xs font-semibold text-white">
							{initials}
						</div>
					)}
				</button>
			</div>
		</>
	);
}
