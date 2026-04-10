import type { ReactNode, PointerEvent as ReactPointerEvent } from 'react';

export const CHROME_BUTTON_BASE =
	'inline-flex h-9 items-center justify-center gap-2 rounded-[8px] border px-3.5 text-[10px] font-semibold uppercase tracking-[0.18em] transition-colors shadow-sm';
export const CHROME_BUTTON_IDLE =
	'border-stone-200 bg-white/96 text-stone-700 hover:border-[#d7dafd] hover:bg-[#f3f1ff] hover:text-[#4d55cc]';
export const CHROME_BUTTON_ACTIVE = 'border-[#d7dafd] bg-[#eef0ff] text-[#4d55cc]';
const CHROME_BUTTON_SUBTLE =
	'border-stone-200 bg-stone-50/92 text-stone-600 hover:border-[#d7dafd] hover:bg-[#f3f1ff] hover:text-[#4d55cc]';
export const CHROME_BUTTON_DANGER = 'border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100';

export function PanelShell({
	title,
	description,
	onClose,
	children,
}: {
	title: string;
	description: string;
	onClose: () => void;
	children: ReactNode;
}) {
	return (
		<div className="overflow-hidden rounded-[12px] border border-stone-200 bg-white shadow-xl">
			<div className="flex items-start justify-between gap-3 border-b border-stone-200 px-4 py-3">
				<div>
					<div className="text-sm font-semibold text-stone-900">{title}</div>
					<div className="mt-1 max-w-[24rem] text-xs text-stone-500">{description}</div>
				</div>
				<button
					type="button"
					onClick={onClose}
					className={`${CHROME_BUTTON_BASE} ${CHROME_BUTTON_SUBTLE} px-3 py-1.5`}
				>
					Close
				</button>
			</div>
			{children}
		</div>
	);
}

export function PanelFrame({
	width,
	className,
	onResizeStart,
	children,
}: {
	width: number;
	className: string;
	onResizeStart: (event: ReactPointerEvent<HTMLDivElement>) => void;
	children: ReactNode;
}) {
	return (
		<div className={className} style={{ width }}>
			<div
				className="absolute inset-y-8 -left-2 z-30 flex w-4 cursor-ew-resize items-center justify-center"
				onPointerDown={onResizeStart}
				aria-label="Resize panel"
			>
				<div className="h-16 w-1 rounded-[999px] bg-stone-200/90 shadow-sm" />
			</div>
			{children}
		</div>
	);
}
