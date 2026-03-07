import type { CSSProperties, PropsWithChildren } from 'react';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import {
	getExcalidrawCornerRadius,
	getExcalidrawSurfaceStyle,
} from '@/components/canvas/excalidraw-element-style';

interface OverlaySurfaceProps extends PropsWithChildren {
	element: ExcalidrawElement;
	isSelected: boolean;
	className?: string;
	style?: CSSProperties;
	backgroundColor?: string;
}

export function OverlaySurface({
	element,
	isSelected,
	className,
	style,
	backgroundColor,
	children,
}: OverlaySurfaceProps) {
	const borderRadius = getExcalidrawCornerRadius(
		element.width,
		element.height,
		(element.roundness as { type: number; value?: number } | null | undefined) ?? null,
	);

	return (
		<div
			className={className}
			style={{
				borderRadius: `${borderRadius}px`,
				overflow: 'hidden',
				boxShadow: isSelected
					? '0 0 0 1px rgba(99, 102, 241, 0.12), 0 12px 24px -18px rgba(15, 23, 42, 0.28)'
					: '0 2px 8px -6px rgba(15, 23, 42, 0.18)',
				...getExcalidrawSurfaceStyle({
					backgroundColor: backgroundColor ?? element.backgroundColor,
					strokeColor: element.strokeColor,
					strokeWidth: element.strokeWidth,
					strokeStyle: (element.strokeStyle as 'solid' | 'dashed' | 'dotted') ?? 'solid',
					fillStyle: (element.fillStyle as 'solid' | 'hachure' | 'cross-hatch') ?? 'solid',
					opacity: element.opacity,
				}),
				...style,
			}}
		>
			{children}
		</div>
	);
}
