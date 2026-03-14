import type { ReactNode } from 'react';

interface KanbanCardShellProps {
	cardRadius: number;
	isLiveResizing: boolean;
	showReturnCue: boolean;
	children: ReactNode;
}

export function KanbanCardShell({
	cardRadius,
	isLiveResizing,
	showReturnCue,
	children,
}: KanbanCardShellProps) {
	return (
		<>
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-0"
				style={{
					borderRadius: `${cardRadius}px`,
					boxShadow: 'inset 0 0 0 1px var(--kanban-sketch-edge-soft)',
					transform:
						'translate(var(--kanban-sketch-edge-offset), calc(var(--kanban-sketch-edge-offset) * 0.55)) rotate(var(--kanban-sketch-edge-tilt))',
					opacity: isLiveResizing
						? 'calc(0.14 + (var(--kanban-sketch-intensity) * 0.22))'
						: 'calc(0.22 + (var(--kanban-sketch-intensity) * 0.55))',
				}}
			/>
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-[1px]"
				style={{
					borderRadius: `${Math.max(cardRadius - 1, 0)}px`,
					boxShadow: 'inset 0 0 0 1px var(--kanban-sketch-edge-strong)',
					transform:
						'translate(calc(var(--kanban-sketch-edge-offset-alt) * -1), var(--kanban-sketch-edge-offset-alt)) rotate(var(--kanban-sketch-edge-tilt-alt))',
					opacity: isLiveResizing
						? 'calc(0.1 + (var(--kanban-sketch-intensity) * 0.18))'
						: 'calc(0.16 + (var(--kanban-sketch-intensity) * 0.48))',
				}}
			/>
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-x-[10px] top-[8px] h-[18px]"
				style={{
					borderTop: '1px solid var(--kanban-sketch-edge-soft)',
					borderRadius: `${Math.max(cardRadius - 4, 0)}px`,
					transform: 'rotate(calc(var(--kanban-sketch-edge-tilt) * 0.55))',
					opacity: isLiveResizing
						? 'calc(0.06 + (var(--kanban-sketch-intensity) * 0.08))'
						: 'calc(0.12 + (var(--kanban-sketch-intensity) * 0.22))',
				}}
			/>
			<div
				className="relative z-[1]"
				style={{
					borderRadius: `${cardRadius}px`,
				}}
			>
				{children}
			</div>
		</>
	);
}
