import type { DragEvent } from 'react';

interface KanbanDeleteDropZoneProps {
	isDeleteTargeted: boolean;
	onDragOver: (event: DragEvent<HTMLDivElement>) => void;
	onDrop: (event: DragEvent<HTMLDivElement>) => void;
}

export function KanbanDeleteDropZone({
	isDeleteTargeted,
	onDragOver,
	onDrop,
}: KanbanDeleteDropZoneProps) {
	return (
		<div className="pointer-events-none absolute inset-x-4 bottom-4 z-20 flex justify-center">
			<div
				className="pointer-events-auto inline-flex min-w-[13rem] items-center justify-center rounded-[16px] border px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] transition-all"
				style={{
					borderColor: isDeleteTargeted ? 'var(--color-danger-border)' : 'var(--color-border)',
					background: isDeleteTargeted
						? 'color-mix(in srgb, var(--color-danger-bg) 86%, white)'
						: 'color-mix(in srgb, var(--color-surface-strong) 94%, white)',
					color: isDeleteTargeted ? 'var(--color-danger-text)' : 'var(--color-text-secondary)',
					boxShadow: isDeleteTargeted
						? '0 12px 28px rgba(179,91,85,0.16)'
						: '0 12px 28px rgba(15,23,42,0.12)',
				}}
				onDragOver={onDragOver}
				onDrop={onDrop}
			>
				Drop here to delete
			</div>
		</div>
	);
}
